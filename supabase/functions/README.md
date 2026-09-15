# Supabase Edge Functions

Seven functions live here:

- **`create-checkout`** — mints a pending payment submission and hands back what the client needs to open Flutterwave's hosted checkout. User-invoked, JWT-authenticated.
- **`flutterwave-webhook`** — receives payment confirmations from Flutterwave. Unauthenticated (verified via a shared-secret header instead), service-role key. Also sends the payment-confirmation email inline once a payment is approved.
- **`ai-business-assistant`** — the AI Business Assistant's server-side intelligence layer. User-invoked, JWT-authenticated. Holds the Anthropic API key; the browser never sees it.
- **`send-transactional-email`** — sends a welcome, subscription-expiry-warning, or opportunity-alert (low stock / overdue invoice, triggered from `notificationSync.ts`) email to the *calling* user's own address only. User-invoked, JWT-authenticated.
- **`send-payment-approved-email`** — sends a payment-confirmation email after an admin manually approves a payment (the recipient is a different person than the caller, so this one explicitly checks the caller is an admin via `check_user_role` before using the service-role key for the lookup).
- **`send-broadcast-email`** — sends an admin-composed announcement to every user matching an audience filter (all / active / trial / expired). Same admin-check pattern as `send-payment-approved-email`, but fans out to many recipients via `_shared/sendgrid.ts`'s `sendBulkEmail`. Invoked from `src/components/admin/BroadcastEmail.tsx`; the send log lives in the `email_broadcasts` table, written by the admin's own client after a successful send.

`_shared/` holds code used by more than one function:
- `cors.ts` — the CORS headers every function returns.
- `plans.ts` — Deno-side duplicate of `src/utils/subscription.ts`'s `BILLING_PLANS` (Deno can't import from `src/`, so this is kept manually in sync).
- `businessLogic/` and `aiAssistant/` — Deno-side duplicates of the pure, framework-free logic under `src/services/opportunities/`, `src/services/metrics/`, `src/services/inventory/`, and `src/services/aiAssistant/`. Each file has a `SOURCE OF TRUTH` comment pointing at the `src/` file it mirrors — if you change the math in one place, change it in both.
- `anthropicClient.ts` — thin wrapper around the Anthropic Messages API.
- `sendgrid.ts` — thin wrapper around SendGrid's v3 Mail Send API (`sendEmail` for one recipient, `sendBulkEmail` chunked for many), plus a shared HTML email layout.

## Local development

```bash
supabase functions serve --env-file .env.local
```

`.env.local` here is **not** the project-root `.env` (that one only holds `VITE_*` client-bundled variables and is loaded by Vite, not Deno). Create a separate `supabase/functions/.env.local` (already gitignored — never commit it) with:

```
SUPABASE_URL=<your project URL>
SUPABASE_ANON_KEY=<your anon key>
SUPABASE_SERVICE_ROLE_KEY=<only needed for flutterwave-webhook>
FLUTTERWAVE_PUBLIC_KEY=<...>
FLUTTERWAVE_SECRET_KEY=<...>
FLUTTERWAVE_WEBHOOK_HASH=<...>
ANTHROPIC_API_KEY=<...>
SENDGRID_API_KEY=<...>
```

## Production secrets

Set once per environment via the Supabase CLI (never committed, never in `.env`/`.env.example`, never `VITE_`-prefixed — those are client-bundled and would leak the value into the browser):

```bash
supabase secrets set ANTHROPIC_API_KEY=sk-ant-... --project-ref <your-project-ref>
supabase secrets set SENDGRID_API_KEY=SG.... --project-ref <your-project-ref>
```

Same pattern for the existing `FLUTTERWAVE_*` and `SUPABASE_SERVICE_ROLE_KEY` secrets if they haven't been set on a given environment yet. Note: `send-transactional-email`/`send-payment-approved-email`/`send-broadcast-email`/the `flutterwave-webhook` confirmation email all check for `SENDGRID_API_KEY` at runtime and fail soft (no crash, just no email sent, logged to the function's console) if it isn't set — so the app works fine before you configure this, it just won't send email yet. The "from" address is hardcoded to `notifications@trackwyze.com` in `_shared/sendgrid.ts` — that domain needs to be verified in your SendGrid account (Sender Authentication) or sends will be rejected.

## AI Business Assistant specifically

- Before enabling it for real users, confirm `feature_flags.ai_business_assistant.enabled = false` in the target environment (it seeds disabled), then flip it on only after the manual injection/abuse QA pass described in the implementation plan (`.claude/plans/radiant-sprouting-toast.md` if still present, or see the project's AI Business Assistant summary) has been run against that environment with a real `ANTHROPIC_API_KEY` configured.
- Set an Anthropic Console usage/spend alert on the workspace as a backstop above the function's own per-user rate limit (20 questions/hour, enforced server-side via the `check_rate_limit` RPC — see `ai-business-assistant/index.ts`).
- The function fails closed on both the subscription/feature-flag gate and the rate limit — a misconfiguration here means the feature stops working, not that it becomes unrestricted.
