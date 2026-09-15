/*
  # Track which plan a gateway payment was for

  Deriving the plan from the amount alone (e.g. "500 must mean month2-3")
  is fragile the moment prices change or overlap. Store the plan key the
  checkout was created for so the webhook handler can extend the
  subscription correctly without guessing.
*/

ALTER TABLE public.payment_submissions
  ADD COLUMN IF NOT EXISTS plan_key text;
