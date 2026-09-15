/*
  # Payment gateway columns on payment_submissions

  ## Why
  payment_submissions was built for manual proof-of-payment review (a user
  types in an amount/reference and an admin eyeballs it). Automated gateway
  checkout (Flutterwave: M-Pesa STK Push + cards) needs the same table to
  also represent transactions that are verified server-to-server instead of
  by a human, without duplicating the whole approval/audit trail already
  built around this table.

  ## Changes
  1. `source` — 'manual' (existing behavior, default) or 'gateway'.
  2. `gateway` — provider name, e.g. 'flutterwave'. Null for manual rows.
  3. `gateway_reference` — the tx_ref we mint server-side when creating a
     checkout session. Unique so a replayed webhook can never double-process
     (idempotency key).
  4. `gateway_transaction_id` — the provider's own transaction id, filled in
     once the webhook/verify call succeeds.
  5. `currency` — defaults to KES; kept explicit since gateway responses
     always carry one and we verify it matches.
*/

ALTER TABLE public.payment_submissions
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS gateway text,
  ADD COLUMN IF NOT EXISTS gateway_reference text,
  ADD COLUMN IF NOT EXISTS gateway_transaction_id text,
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'KES';

ALTER TABLE public.payment_submissions
  DROP CONSTRAINT IF EXISTS payment_submissions_source_check;
ALTER TABLE public.payment_submissions
  ADD CONSTRAINT payment_submissions_source_check CHECK (source IN ('manual', 'gateway'));

CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_submissions_gateway_reference
  ON public.payment_submissions (gateway_reference)
  WHERE gateway_reference IS NOT NULL;
