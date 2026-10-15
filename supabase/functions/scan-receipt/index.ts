// Reads a photo of a receipt and returns structured expense fields (vendor,
// date, total, suggested expense type) so the expense form can be prefilled.
// The user always reviews and saves the result themselves; nothing is written
// to the database here. Reuses the same ANTHROPIC_API_KEY secret as
// ai-business-assistant, so the key never reaches the browser.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const MODEL = 'claude-sonnet-5';
const TOOL_NAME = 'record_receipt';
const MAX_IMAGE_BASE64_CHARS = 6_000_000; // ~4.5MB of image data
const RATE_LIMIT_MAX = 15;
const RATE_LIMIT_WINDOW_SECONDS = 3600;
const ALLOWED_MEDIA_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const EXPENSE_TYPES = [
  'Rent', 'Utilities', 'Salaries', 'Internet', 'Transport', 'Packaging', 'Office Supplies',
  'Maintenance', 'Insurance', 'Licenses', 'Subscriptions', 'Marketing Materials',
  'Professional Services', 'Bank Charges', 'Other',
];

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'not_authenticated' }, 401);

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return json({ error: 'not_authenticated' }, 401);

    // Costs money per call, so gate server-side (never trust the client).
    const { data: profile } = await supabase
      .from('profiles')
      .select('subscription_status')
      .eq('id', user.id)
      .maybeSingle();
    if (!['active', 'trial'].includes(profile?.subscription_status ?? '')) {
      return json({ error: 'subscription_required' }, 403);
    }

    // Fails CLOSED: this guards a metered third-party call.
    const { data: withinLimit, error: rateLimitError } = await supabase.rpc('check_rate_limit', {
      p_action: 'receipt.scan',
      p_max: RATE_LIMIT_MAX,
      p_window_seconds: RATE_LIMIT_WINDOW_SECONDS,
      p_anon_key: '',
    });
    if (rateLimitError) {
      console.error('scan-receipt: rate limit RPC failed', rateLimitError.message);
      return json({ error: 'rate_limited' }, 429);
    }
    if (withinLimit !== true) return json({ error: 'rate_limited' }, 429);

    const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!apiKey) return json({ error: 'not_configured' }, 503);

    const body = await req.json().catch(() => ({}));
    const { image, mediaType } = body as { image?: string; mediaType?: string };
    if (typeof image !== 'string' || image.length === 0 || image.length > MAX_IMAGE_BASE64_CHARS) {
      return json({ error: 'invalid_image' }, 400);
    }
    if (!mediaType || !ALLOWED_MEDIA_TYPES.includes(mediaType)) {
      return json({ error: 'invalid_image' }, 400);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45000);
    let response: Response;
    try {
      response = await fetch(ANTHROPIC_API_URL, {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': ANTHROPIC_VERSION,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: 1024,
          system:
            'You read photos of business receipts for a small-business bookkeeping app used mainly in Kenya ' +
            '(amounts are usually KES; VAT is 16%; M-Pesa and eTIMS receipts are common). Extract only what is ' +
            'clearly visible. "total" is the final amount actually paid, including tax. Never guess a number you ' +
            'cannot read: if the image is not a receipt or the total is unreadable, set is_receipt to false and total to 0.',
          messages: [
            {
              role: 'user',
              content: [
                { type: 'image', source: { type: 'base64', media_type: mediaType, data: image } },
                { type: 'text', text: 'Extract this receipt by calling the record_receipt tool.' },
              ],
            },
          ],
          tools: [
            {
              name: TOOL_NAME,
              description: 'Record the fields read from the receipt.',
              input_schema: {
                type: 'object',
                properties: {
                  is_receipt: { type: 'boolean', description: 'False if the image is not a readable receipt/invoice.' },
                  vendor: { type: 'string', description: 'Merchant or supplier name, or empty.' },
                  date: { type: 'string', description: 'Transaction date as YYYY-MM-DD, or empty if not visible.' },
                  total: { type: 'number', description: 'Final amount paid including tax; 0 if unreadable.' },
                  currency: { type: 'string', description: '3-letter currency code if shown, else empty.' },
                  expense_type: { type: 'string', enum: EXPENSE_TYPES, description: 'Best-fitting expense category.' },
                  items: {
                    type: 'array',
                    items: { type: 'string' },
                    maxItems: 8,
                    description: 'Short descriptions of the main items bought.',
                  },
                },
                required: ['is_receipt', 'total', 'expense_type'],
              },
            },
          ],
          tool_choice: { type: 'tool', name: TOOL_NAME },
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      console.error('scan-receipt: Anthropic error', response.status, errText.slice(0, 300));
      return json({ error: 'scan_failed' }, 502);
    }

    const data = await response.json();
    const block = (data?.content ?? []).find(
      (b: { type: string; name?: string }) => b.type === 'tool_use' && b.name === TOOL_NAME,
    );
    if (!block?.input) return json({ error: 'scan_failed' }, 502);

    const input = block.input as Record<string, unknown>;
    const total = Number(input.total);
    const date = typeof input.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input.date) ? input.date : '';
    const expenseType = EXPENSE_TYPES.includes(String(input.expense_type)) ? String(input.expense_type) : 'Other';

    return json({
      isReceipt: input.is_receipt === true && Number.isFinite(total) && total > 0,
      vendor: typeof input.vendor === 'string' ? input.vendor.slice(0, 120) : '',
      date,
      total: Number.isFinite(total) && total > 0 ? Math.round(total * 100) / 100 : 0,
      currency: typeof input.currency === 'string' ? input.currency.slice(0, 3).toUpperCase() : '',
      expenseType,
      items: Array.isArray(input.items) ? input.items.slice(0, 8).map((i) => String(i).slice(0, 80)) : [],
    });
  } catch (err) {
    console.error('scan-receipt error:', err instanceof Error ? err.message : err);
    return json({ error: 'scan_failed' }, 500);
  }
});
