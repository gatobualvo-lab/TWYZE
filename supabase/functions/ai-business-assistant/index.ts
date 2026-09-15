// AI Business Assistant. Auth follows the create-checkout pattern exactly:
// the caller's own JWT is forwarded and every subsequent Supabase call runs
// under their own RLS — never the service-role key. Postgres itself is the
// tenant-isolation boundary here, not custom access-control code.
//
// Claude is never given the database, never given tools that fetch more
// data, and never sees anything beyond a small, pre-aggregated context
// bundle the domain router decided this specific question needs. See
// _shared/aiAssistant/promptBuilder.ts and _shared/anthropicClient.ts for
// the prompt-injection and structured-output design.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { callAssistant, AnthropicCallError } from '../_shared/anthropicClient.ts';
import { classifyQuestion, type DataDomain } from '../_shared/aiAssistant/domainRouter.ts';
import { buildUserPrompt, SYSTEM_PROMPT, type AssistantContextData, type VendorBalance, type ExpenseBreakdownEntry, type UnpaidInvoiceSummary } from '../_shared/aiAssistant/promptBuilder.ts';
import { RESPONSE_JSON_SCHEMA, parseAssistantResponse } from '../_shared/aiAssistant/responseSchema.ts';
import { toNum } from '../_shared/businessLogic/toNum.ts';
import { getMonthRange, getAllTimeRange, previousEqualPeriod } from '../_shared/businessLogic/dateRange.ts';
import { calculateHealthScore } from '../_shared/businessLogic/healthScore.ts';
import { forecastStock } from '../_shared/businessLogic/inventoryForecast.ts';
import {
  detectOverdueBalances,
  detectDormantCustomers,
  detectLowMarginProducts,
  detectInventoryRisks,
  detectForgottenQuotations,
  detectExpenseSpike,
  sortOpportunities,
} from '../_shared/businessLogic/opportunityEngine.ts';
import type { BusinessMetrics, CustomerProfit, ProductProfit, StockForecast } from '../_shared/businessLogic/types.ts';

const MAX_MESSAGE_LENGTH = 2000;
const RATE_LIMIT_MAX = 20;
const RATE_LIMIT_WINDOW_SECONDS = 3600;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function toBusinessMetrics(row: Record<string, unknown> | undefined): BusinessMetrics {
  if (!row) {
    return {
      salesRevenue: 0, salesProfit: 0, salesCount: 0, supplierRevenue: 0, supplierProfit: 0, supplierCount: 0,
      adExpenses: 0, vendorExpenses: 0, generalExpenses: 0, totalExpenses: 0, grossProfit: 0, netProfit: 0,
      outstandingReceivables: 0, outstandingPayables: 0, cashReceived: 0, transactionCount: 0, netMarginPct: null,
    };
  }
  const salesRevenue = toNum(row.sales_revenue);
  const supplierRevenue = toNum(row.supplier_revenue);
  const netProfit = toNum(row.net_profit);
  const totalRevenue = salesRevenue + supplierRevenue;
  return {
    salesRevenue,
    salesProfit: toNum(row.sales_profit),
    salesCount: toNum(row.sales_count),
    supplierRevenue,
    supplierProfit: toNum(row.supplier_profit),
    supplierCount: toNum(row.supplier_count),
    adExpenses: toNum(row.ad_expenses),
    vendorExpenses: toNum(row.vendor_expenses),
    generalExpenses: toNum(row.general_expenses),
    totalExpenses: toNum(row.total_expenses),
    grossProfit: toNum(row.gross_profit),
    netProfit,
    outstandingReceivables: toNum(row.outstanding_receivables),
    outstandingPayables: toNum(row.outstanding_payables),
    cashReceived: toNum(row.cash_received),
    transactionCount: toNum(row.sales_count) + toNum(row.supplier_count),
    netMarginPct: totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : null,
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return json({ error: 'not_authenticated' }, 401);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return json({ error: 'not_authenticated' }, 401);
    }

    // Server-side gating — never trust a client-only check for something
    // that costs money. Both checks are re-verified here even though the
    // frontend also gates on them.
    const [{ data: profile }, { data: flag }] = await Promise.all([
      supabase.from('profiles').select('subscription_status').eq('id', user.id).maybeSingle(),
      supabase.from('feature_flags').select('enabled').eq('key', 'ai_business_assistant').maybeSingle(),
    ]);

    if (profile?.subscription_status !== 'active') {
      return json({ error: 'subscription_required' }, 403);
    }
    if (!flag?.enabled) {
      return json({ error: 'feature_disabled' }, 403);
    }

    // Server-side rate limit — fails CLOSED, unlike the client-side
    // checkRateLimit() helper (which fails open, fine for free actions).
    // This guards a metered third-party API call, so an RPC error must
    // block the request rather than risk unbounded Anthropic spend.
    const { data: withinLimit, error: rateLimitError } = await supabase.rpc('check_rate_limit', {
      p_action: 'ai_assistant.chat',
      p_max: RATE_LIMIT_MAX,
      p_window_seconds: RATE_LIMIT_WINDOW_SECONDS,
      p_anon_key: '',
    });
    if (rateLimitError) {
      // Distinct from a genuine limit-exceeded case (below) — this means the
      // RPC call itself failed (bad params, RLS denial, etc.), not that the
      // user actually hit 20 questions/hour. Logged loudly since the
      // client-facing message is identical either way by design (fail
      // closed, don't leak internals) — this is the only place that
      // distinction is visible.
      console.error('ai-business-assistant: check_rate_limit RPC errored (failing closed)', rateLimitError);
      return json({ error: 'rate_limited', retryAfterSeconds: RATE_LIMIT_WINDOW_SECONDS }, 429);
    }
    if (withinLimit !== true) {
      return json({ error: 'rate_limited', retryAfterSeconds: RATE_LIMIT_WINDOW_SECONDS }, 429);
    }

    const body = await req.json().catch(() => ({}));
    const { conversationId, message } = body as { conversationId?: string; message?: string };

    if (typeof message !== 'string' || message.trim().length === 0 || message.length > MAX_MESSAGE_LENGTH) {
      return json({ error: 'invalid_request' }, 400);
    }

    // If a conversationId was supplied, confirm it's actually this user's
    // before doing any further work — RLS would reject the eventual
    // message inserts either way, but checking now means a bad id fails
    // fast rather than after an already-paid-for Anthropic call.
    if (conversationId) {
      const { data: existingConv } = await supabase.from('ai_conversations').select('id').eq('id', conversationId).maybeSingle();
      if (!existingConv) {
        return json({ error: 'invalid_request' }, 400);
      }
    }

    const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!anthropicApiKey) {
      return json({ error: 'assistant_unavailable' }, 502);
    }

    // --- Domain routing -----------------------------------------------
    const domains = classifyQuestion(message);
    const needs = (d: DataDomain) => domains.includes(d);

    // --- Overview baseline: always fetched, this is what guarantees the
    // chat can never disagree with the deterministic briefing cards shown
    // elsewhere in the app, since both read the same detectors. -----------
    const currentRange = getMonthRange();
    const previousRange = previousEqualPeriod(currentRange);
    // Dormant-customer detection needs a long lookback — a customer with
    // zero transactions THIS month (which is exactly what "dormant" means)
    // would never appear in a current-month-only query. Matches
    // useOpportunities.ts's getPeriodRange('all') so the Assistant's
    // customer picture can't disagree with Opportunity Center's.
    const allTimeRange = getAllTimeRange();

    const [
      { data: currentMetricsRows },
      { data: previousMetricsRows },
      { data: customerRows },
      { data: productRows },
      { data: unpaidSalesRows },
      { data: quotationRows },
      { data: inventoryRows },
    ] = await Promise.all([
      supabase.rpc('get_business_metrics', { p_start: currentRange.start, p_end: currentRange.end }),
      supabase.rpc('get_business_metrics', { p_start: previousRange.start, p_end: previousRange.end }),
      supabase.rpc('get_profit_by_customer', { p_start: allTimeRange.start, p_end: allTimeRange.end, p_limit: 200 }),
      supabase.rpc('get_profit_by_product', { p_start: currentRange.start, p_end: currentRange.end, p_limit: 50 }),
      supabase.from('sales').select('client_name, selling_price, date').eq('payment_status', 'Unpaid').eq('is_deleted', false).eq('is_archived', false),
      supabase.from('documents').select('document_number, customer_name, total, date, status').eq('document_type', 'quotation'),
      supabase.from('inventory_items').select('product_name, current_stock, reorder_level, created_at').eq('is_deleted', false),
    ]);

    const currentMetrics = toBusinessMetrics(currentMetricsRows?.[0]);
    const previousMetrics = toBusinessMetrics(previousMetricsRows?.[0]);

    const customerProfit: CustomerProfit[] = (customerRows ?? []).map((row: Record<string, unknown>) => ({
      customerName: (row.customer_name as string) ?? 'Unknown customer',
      customerId: (row.customer_id as string) ?? null,
      revenue: toNum(row.revenue),
      profit: toNum(row.profit),
      transactionCount: toNum(row.transaction_count),
      lastOrderDate: (row.last_order_date as string) ?? null,
    }));

    const productProfit: ProductProfit[] = (productRows ?? []).map((row: Record<string, unknown>) => ({
      productName: (row.product_name as string) ?? 'Unknown product',
      unitsSold: toNum(row.units_sold),
      revenue: toNum(row.revenue),
      cost: toNum(row.cost),
      profit: toNum(row.profit),
      marginPct: row.margin_pct === null || row.margin_pct === undefined ? null : toNum(row.margin_pct),
      transactionCount: toNum(row.transaction_count),
    }));

    const unitsSoldByProduct = new Map(productProfit.map(p => [p.productName.trim().toLowerCase(), p.unitsSold]));
    const inventoryForecasts: StockForecast[] = (inventoryRows ?? [])
      .filter((item: Record<string, unknown>) => item.product_name)
      .map((item: Record<string, unknown>) =>
        forecastStock({
          productName: item.product_name as string,
          currentStock: toNum(item.current_stock),
          reorderLevel: toNum(item.reorder_level),
          createdAt: (item.created_at as string) ?? null,
          unitsSoldInWindow: unitsSoldByProduct.get((item.product_name as string).trim().toLowerCase()) ?? 0,
        })
      );

    const unpaidSales = (unpaidSalesRows ?? []).map((row: Record<string, unknown>) => ({
      clientName: (row.client_name as string) ?? null,
      sellingPrice: toNum(row.selling_price),
      date: (row.date as string) ?? null,
    }));

    const quotations = (quotationRows ?? []).map((row: Record<string, unknown>) => ({
      documentNumber: (row.document_number as string) ?? '',
      customerName: (row.customer_name as string) ?? null,
      total: toNum(row.total),
      date: (row.date as string) ?? null,
      status: (row.status as string) ?? null,
    }));

    const topOpportunities = sortOpportunities([
      ...detectOverdueBalances(unpaidSales),
      ...detectDormantCustomers(customerProfit),
      ...detectLowMarginProducts(productProfit),
      ...detectInventoryRisks(inventoryForecasts),
      ...detectForgottenQuotations(quotations),
      ...detectExpenseSpike(currentMetrics, previousMetrics),
    ]).slice(0, 3);

    const healthScore = calculateHealthScore(currentMetrics, previousMetrics);

    // --- Context assembly: only attach the slices this question's -------
    // domains actually need, even though several were fetched as part of
    // the always-on overview baseline above.
    const context: AssistantContextData = {
      healthScore,
      topOpportunities,
    };

    if (needs('revenue_profit') || needs('expenses')) {
      context.metrics = { current: currentMetrics, previous: previousMetrics };
    }

    if (needs('revenue_profit')) {
      const { data: dailyRows } = await supabase.rpc('get_daily_series', { p_start: currentRange.start, p_end: currentRange.end });
      context.dailySeries = (dailyRows ?? []).map((row: Record<string, unknown>) => ({
        day: row.day as string,
        revenue: toNum(row.revenue),
        profit: toNum(row.profit),
        expenses: toNum(row.expenses),
        transactionCount: toNum(row.transaction_count),
      }));
    }

    if (needs('products')) {
      context.productProfit = productProfit;
    }

    if (needs('customers')) {
      context.customerProfit = customerProfit;
    }

    if (needs('inventory')) {
      context.inventoryForecasts = inventoryForecasts;
    }

    if (needs('expenses')) {
      const { data: expenseRows } = await supabase.rpc('get_expense_breakdown', { p_start: currentRange.start, p_end: currentRange.end });
      context.expenseBreakdown = (expenseRows ?? []).map((row: Record<string, unknown>): ExpenseBreakdownEntry => ({
        source: row.source as ExpenseBreakdownEntry['source'],
        category: row.category as string,
        total: toNum(row.total),
        transactionCount: toNum(row.transaction_count),
      }));
    }

    if (needs('receivables')) {
      const { data: invoiceRows } = await supabase.rpc('get_unpaid_invoice_total', { p_start: currentRange.start, p_end: currentRange.end });
      const row = invoiceRows?.[0];
      context.unpaidInvoices = row
        ? ({
            unpaidTotal: toNum(row.unpaid_total),
            unpaidCount: toNum(row.unpaid_count),
            oldestUnpaidDate: (row.oldest_unpaid_date as string) ?? null,
          } satisfies UnpaidInvoiceSummary)
        : { unpaidTotal: 0, unpaidCount: 0, oldestUnpaidDate: null };
    }

    if (needs('payables')) {
      const { data: vendorRows } = await supabase.rpc('get_vendor_balance_summary', { p_limit: 50 });
      context.vendorBalances = (vendorRows ?? []).map((row: Record<string, unknown>): VendorBalance => ({
        vendorName: row.vendor_name as string,
        totalOwed: toNum(row.total_owed),
        totalPaid: toNum(row.total_paid),
        balance: toNum(row.balance),
      }));
    }

    // --- Claude call -----------------------------------------------------
    const userPrompt = buildUserPrompt(context, message);

    let anthropicResult;
    try {
      anthropicResult = await callAssistant({
        apiKey: anthropicApiKey,
        systemPrompt: SYSTEM_PROMPT,
        userPrompt,
        responseSchema: RESPONSE_JSON_SCHEMA as unknown as Record<string, unknown>,
      });
    } catch (err) {
      console.error('ai-business-assistant: Anthropic call failed', err instanceof AnthropicCallError ? err.message : err);
      return json({ error: 'assistant_unavailable' }, 502);
    }

    const parsed = parseAssistantResponse(anthropicResult.toolInput);
    if (!parsed) {
      console.error('ai-business-assistant: response failed schema validation', anthropicResult.toolInput);
      return json({ error: 'assistant_unavailable' }, 502);
    }

    // --- Persistence -------------------------------------------------------
    let convId = conversationId;
    if (!convId) {
      const { data: newConv, error: convError } = await supabase
        .from('ai_conversations')
        .insert({ user_id: user.id, title: message.slice(0, 80) })
        .select('id')
        .single();
      if (convError || !newConv) {
        console.error('ai-business-assistant: failed to create conversation', convError);
        return json({ error: 'assistant_unavailable' }, 502);
      }
      convId = newConv.id;
    }

    const { error: userMessageError } = await supabase.from('ai_messages').insert({ conversation_id: convId, role: 'user', content: message });
    if (userMessageError) {
      console.error('ai-business-assistant: failed to persist user message', userMessageError);
    }

    const { data: assistantMessage, error: assistantInsertError } = await supabase
      .from('ai_messages')
      .insert({
        conversation_id: convId,
        role: 'assistant',
        content: parsed.answer,
        structured_response: {
          ...parsed,
          model: 'claude-sonnet-5',
          inputTokens: anthropicResult.inputTokens,
          outputTokens: anthropicResult.outputTokens,
        },
      })
      .select('id')
      .single();

    if (assistantInsertError || !assistantMessage) {
      console.error('ai-business-assistant: failed to persist assistant message', assistantInsertError);
      return json({ error: 'assistant_unavailable' }, 502);
    }

    await supabase.from('ai_conversations').update({ updated_at: new Date().toISOString() }).eq('id', convId);

    return json({
      conversationId: convId,
      message: {
        id: assistantMessage.id,
        answer: parsed.answer,
        facts: parsed.facts,
        calculatedInsights: parsed.calculatedInsights,
        predictions: parsed.predictions,
        recommendations: parsed.recommendations,
        confidenceNote: parsed.confidenceNote,
        followUpQuestions: parsed.followUpQuestions,
        actionTab: parsed.actionTab,
      },
    });
  } catch (err) {
    console.error('ai-business-assistant error:', err);
    return json({ error: err instanceof Error ? err.message : 'Unexpected error' }, 500);
  }
});
