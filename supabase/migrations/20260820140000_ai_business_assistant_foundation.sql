/*
  # AI Business Assistant foundation

  ## Why
  Adds the database foundation for a real, Claude-powered conversational
  assistant inside the Business Advisor page. Claude itself never touches
  this database directly — a Supabase Edge Function (added separately)
  fetches only the data a given question needs, using the caller's own
  forwarded JWT so every query runs under normal RLS. This migration adds:
  conversation/message storage, a kill-switch feature flag (default off),
  and three read-only aggregate RPCs that fill genuine gaps in the existing
  business-intelligence RPC set (get_business_metrics, get_profit_by_*) so
  the assistant can answer "what invoices are unpaid", "what do I owe
  vendors", and "where is my expense money going" without ad hoc queries.

  ## Changes
  1. `public.ai_conversations` / `public.ai_messages` — owner-only storage
     (same RLS shape as business_goals/notifications: plain
     `user_id = auth.uid()`, not the team-shared get_business_owner_id()
     indirection), since AI Assistant access is gated on the owner's own
     paid subscription status, not a team permission.
  2. Seed a disabled `ai_business_assistant` feature flag row — the
     assistant stays invisible to end users until explicitly turned on
     after the feature is verified.
  3. Three new SECURITY INVOKER RPCs, scoped via get_business_owner_id() +
     has_permission() for consistency with the existing BI RPCs:
     - get_unpaid_invoice_total: documents has no payment_status column,
       so this uses status NOT IN ('draft','cancelled') AND balance_due > 0.
     - get_vendor_balance_summary: ports the client-side vendor balance
       calc in ExpenseOverview.tsx (owed via sale_items, paid via
       vendor_expenses) into a single server-side aggregate across all
       vendors at once.
     - get_expense_breakdown: unions ad_expenses/vendor_expenses/
       general_expenses into one category breakdown (ad_platform,
       vendor_name, expense_type respectively).

  Purely additive: no existing table, policy, or function is altered.
*/

-- 1. Conversation storage -----------------------------------------------

CREATE TABLE IF NOT EXISTS public.ai_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'New conversation',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ai_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.ai_conversations(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  content text NOT NULL,
  -- {facts, calculatedInsights, predictions, recommendations,
  --  confidenceNote, followUpQuestions, actionTab, model,
  --  inputTokens, outputTokens} on assistant rows.
  structured_response jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_conversations_user ON public.ai_conversations(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_messages_conversation ON public.ai_messages(conversation_id, created_at);

ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_conversations FORCE ROW LEVEL SECURITY;
ALTER TABLE public.ai_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_messages FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ai_conversations_select" ON public.ai_conversations;
CREATE POLICY "ai_conversations_select" ON public.ai_conversations FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "ai_conversations_insert" ON public.ai_conversations;
CREATE POLICY "ai_conversations_insert" ON public.ai_conversations FOR INSERT TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "ai_conversations_update" ON public.ai_conversations;
CREATE POLICY "ai_conversations_update" ON public.ai_conversations FOR UPDATE TO authenticated
  USING (user_id = (select auth.uid())) WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "ai_conversations_delete" ON public.ai_conversations;
CREATE POLICY "ai_conversations_delete" ON public.ai_conversations FOR DELETE TO authenticated
  USING (user_id = (select auth.uid()));

-- ai_messages: ownership resolved via the parent conversation. No UPDATE
-- policy — messages are an immutable record of what Claude actually said.
DROP POLICY IF EXISTS "ai_messages_select" ON public.ai_messages;
CREATE POLICY "ai_messages_select" ON public.ai_messages FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.ai_conversations c WHERE c.id = conversation_id AND c.user_id = (select auth.uid())));

DROP POLICY IF EXISTS "ai_messages_insert" ON public.ai_messages;
CREATE POLICY "ai_messages_insert" ON public.ai_messages FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.ai_conversations c WHERE c.id = conversation_id AND c.user_id = (select auth.uid())));

DROP POLICY IF EXISTS "ai_messages_delete" ON public.ai_messages;
CREATE POLICY "ai_messages_delete" ON public.ai_messages FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.ai_conversations c WHERE c.id = conversation_id AND c.user_id = (select auth.uid())));

CREATE OR REPLACE FUNCTION public.set_ai_conversations_updated_at()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_ai_conversations_updated_at ON public.ai_conversations;
CREATE TRIGGER trg_ai_conversations_updated_at BEFORE UPDATE ON public.ai_conversations
  FOR EACH ROW EXECUTE FUNCTION public.set_ai_conversations_updated_at();

-- 2. Feature flag kill switch, default off -------------------------------

INSERT INTO public.feature_flags (key, name, description, enabled)
VALUES ('ai_business_assistant', 'AI Business Assistant', 'Claude-powered chat in the Business Advisor page', false)
ON CONFLICT (key) DO NOTHING;

-- 3. New aggregate RPCs ---------------------------------------------------

-- Unpaid invoice total. documents has no payment_status column — status is
-- a free enum ('draft'|'sent'|'paid'|'overdue'|'cancelled'|'accepted'|
-- 'rejected') and the actual amount owed lives in balance_due. Excluding
-- draft/cancelled avoids counting documents that were never real
-- obligations; requiring balance_due > 0 is the authoritative "still owed"
-- signal regardless of whether status bookkeeping is perfectly in sync.
CREATE OR REPLACE FUNCTION public.get_unpaid_invoice_total(p_start text, p_end text)
RETURNS TABLE (unpaid_total numeric, unpaid_count bigint, oldest_unpaid_date text)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public, pg_temp
AS $$
  SELECT
    COALESCE(SUM(balance_due), 0),
    COUNT(*),
    to_char(MIN(created_at::date), 'YYYY-MM-DD')
  FROM public.documents
  WHERE user_id = public.get_business_owner_id()
    AND public.has_permission('documents')
    AND document_type = 'invoice'
    AND status NOT IN ('draft', 'cancelled')
    AND COALESCE(balance_due, 0) > 0
    AND created_at::date BETWEEN p_start::date AND p_end::date;
$$;
REVOKE ALL ON FUNCTION public.get_unpaid_invoice_total(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_unpaid_invoice_total(text, text) TO authenticated;

-- Vendor balance aggregate across ALL vendors — ports the client-side
-- balances[vendor] = totalOwed - totalExpenses calc from
-- ExpenseOverview.tsx into SQL (VendorStatement.tsx only computes one
-- vendor at a time). sale_items has both `vendor` and `vendor_name`
-- columns (legacy + current); COALESCE handles either being populated.
CREATE OR REPLACE FUNCTION public.get_vendor_balance_summary(p_limit int DEFAULT 50)
RETURNS TABLE (vendor_name text, total_owed numeric, total_paid numeric, balance numeric)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public, pg_temp
AS $$
  WITH owed AS (
    SELECT COALESCE(NULLIF(si.vendor_name, ''), NULLIF(si.vendor, ''), 'Unknown') AS vendor_name,
           SUM(COALESCE(si.buying_price, 0) * COALESCE(si.quantity, 0)) AS total_owed
    FROM public.sale_items si
    JOIN public.sales s ON s.id = si.sale_id
    WHERE si.user_id = public.get_business_owner_id() AND COALESCE(si.is_deleted, false) = false
      AND COALESCE(s.is_deleted, false) = false AND s.is_archived = false
    GROUP BY 1
  ), paid AS (
    SELECT COALESCE(NULLIF(vendor_name, ''), 'Unknown') AS vendor_name,
           SUM(amount_kes) AS total_paid
    FROM public.vendor_expenses
    WHERE created_by = public.get_business_owner_id() AND is_deleted = false
    GROUP BY 1
  )
  SELECT
    COALESCE(owed.vendor_name, paid.vendor_name),
    COALESCE(owed.total_owed, 0),
    COALESCE(paid.total_paid, 0),
    COALESCE(owed.total_owed, 0) - COALESCE(paid.total_paid, 0) AS balance
  FROM owed FULL OUTER JOIN paid ON owed.vendor_name = paid.vendor_name
  WHERE public.has_permission('suppliers') AND public.has_permission('expenses')
  ORDER BY balance DESC
  LIMIT p_limit;
$$;
REVOKE ALL ON FUNCTION public.get_vendor_balance_summary(int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_vendor_balance_summary(int) TO authenticated;

-- Expense breakdown across all three expense tables. Column names verified
-- against database.types.ts: ad_expenses.ad_platform (not "platform"),
-- general_expenses.expense_type (not "category") — vendor_expenses.vendor_name
-- is correct as-is.
CREATE OR REPLACE FUNCTION public.get_expense_breakdown(p_start text, p_end text)
RETURNS TABLE (source text, category text, total numeric, transaction_count bigint)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public, pg_temp
AS $$
  SELECT 'ad' AS source, COALESCE(NULLIF(ad_platform, ''), 'Other'), SUM(amount_kes), COUNT(*)
  FROM public.ad_expenses
  WHERE created_by = public.get_business_owner_id() AND public.has_permission('expenses')
    AND is_deleted = false AND is_archived = false
    AND occurred_on::date BETWEEN p_start::date AND p_end::date
  GROUP BY 2
  UNION ALL
  SELECT 'vendor', COALESCE(NULLIF(vendor_name, ''), 'Other'), SUM(amount_kes), COUNT(*)
  FROM public.vendor_expenses
  WHERE created_by = public.get_business_owner_id() AND public.has_permission('expenses')
    AND is_deleted = false
    AND occurred_on::date BETWEEN p_start::date AND p_end::date
  GROUP BY 2
  UNION ALL
  SELECT 'general', COALESCE(NULLIF(expense_type, ''), 'Other'), SUM(amount), COUNT(*)
  FROM public.general_expenses
  WHERE user_id = public.get_business_owner_id() AND public.has_permission('expenses')
    AND COALESCE(is_deleted, false) = false AND is_archived = false
    AND date::date BETWEEN p_start::date AND p_end::date
  GROUP BY 2;
$$;
REVOKE ALL ON FUNCTION public.get_expense_breakdown(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_expense_breakdown(text, text) TO authenticated;
