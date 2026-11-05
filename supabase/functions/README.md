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

## M-Pesa STK push for subscriptions (`stk-push`, `stk-callback`, `stk-status`)

Pays for a TrackWyze subscription by a PIN prompt on the customer's phone (Safaricom Daraja). One
TrackWyze Paybill or Till receives every payment. Shared code is in `_shared/mpesa.ts`.

- **`stk-push`** (signed-in users): picks the price from `BILLING_PLANS`, saves a pending
  `payment_submissions` row (`gateway = 'mpesa'`), and asks Daraja to prompt the phone.
- **`stk-callback`** (public, deploy with **Verify JWT off**): where Safaricom reports the result. The
  address carries `?token=MPESA_CALLBACK_SECRET`. A report is never trusted by itself: the payment is
  only settled after Daraja confirms it when asked directly (STK query) and the amount matches.
- **`stk-status`** (signed-in users): the app calls it while the customer waits, so a late or missing
  report still settles. Both paths use `settleStkResult()`, which claims the pending row first so a
  subscription can never be extended twice.

Secrets (Edge Functions → Secrets), none of them ever in `.env` or the app:

| Secret | Value |
| --- | --- |
| `MPESA_ENV` | `sandbox` (default) or `production` |
| `MPESA_CONSUMER_KEY`, `MPESA_CONSUMER_SECRET` | from the Daraja app |
| `MPESA_SHORTCODE` | the Paybill (sandbox test: `174379`). For Buy Goods, the head-office number |
| `MPESA_PASSKEY` | the Lipa Na M-Pesa passkey for that shortcode |
| `MPESA_CALLBACK_SECRET` | any long random letters/digits you invent (it is part of the callback address) |
| `MPESA_TRANSACTION_TYPE` | optional: `CustomerPayBillOnline` (default) or `CustomerBuyGoodsOnline` |
| `MPESA_PARTY_B` | optional: the Till number when using Buy Goods (defaults to the shortcode) |

Until these are set, `stk-push` answers `MPESA_NOT_CONFIGURED` and the app falls back to the existing
Flutterwave M-Pesa checkout.

## Plans (Free, Starter, Business)

The first month is free with every feature. After that there are three permanent tiers: **Free**
(40 sales a month, 20 products, 15 customers, 1 user), **Starter** (KES 500) and **Business**
(KES 1,000, up to 5 users). What each tier includes is defined once, in
`src/services/subscription/entitlements.ts`; prices are `BILLING_PLANS` in `src/utils/subscription.ts`
with a copy in `_shared/plans.ts` (keep them in step). Plan keys stored on payments and profiles are
`starter` and `business`; the earlier `month2-3` / `month4+` keys are still understood (they keep every
feature until the paid month ends).

Server-side, only the emails are plan-aware: `scheduled-emails` sends task reminders to Starter and up,
and business reports to Business (including the free month). It carries a copy of the tier rules
(`tierOf`), and `emailTemplate.test.ts` checks it agrees with the app. Free-plan limits themselves are
enforced in the app, not by the database.

## Unsubscribing from emails

Every email has an "Unsubscribe" link in its footer (payment receipts say "Email preferences" and note that
receipts still arrive), plus the mail app's own one-click Unsubscribe button (`List-Unsubscribe` headers).

- **Signup**: the form has an "Email me reminders, business reports and tips" tick box, off by default. Its
  value travels as `email_opt_in` in the signup details and the `private.handle_new_user` trigger saves it
  (`notification_preferences.emails_unsubscribed`).
- **The link** is `https://trackwyze.com/unsubscribe?u=<user id>&t=<token>`. The token is an HMAC of the user id
  made with the `UNSUBSCRIBE_SECRET` secret, so it works without logging in and cannot be forged. The page
  asks for confirmation (opening a link changes nothing, because mail scanners open links) and calls
  **`email-unsubscribe`**, which must be deployed with **Verify JWT off** (mail apps send no login).
- **Who is skipped**: anyone with `emails_unsubscribed = true` gets no welcome email, alerts, reminders,
  business reports or announcements. Payment confirmations and the "subscription expired" notice are always sent.
- **Secret**: `UNSUBSCRIBE_SECRET`, any long random text. Without it, emails link to the in-app notification
  settings instead of a signed link.
- Same master switch in the app: Notification Center, Settings, "Send me emails from TrackWyze".

## Replying to a TrackWyze email

Every email sends from `notifications@trackwyze.com`, which only sends — `trackwyze.com` has no mail
server of its own, so a reply straight to that address bounces. Every send (`_shared/sendgrid.ts`) carries
a `Reply-To` of `support@trackwyze.com` instead.

**`support@trackwyze.com` needs to actually work**, or replies bounce there too. The free way, without
moving `trackwyze.com`'s DNS off Netlify:

1. Make a free account at [improvmx.com](https://improvmx.com), add `trackwyze.com`, and set an alias
   forwarding `support` to the inbox you want replies to land in.
2. In Netlify (Domains → `trackwyze.com` → DNS records), add the MX and TXT records ImprovMX shows you —
   typically `mx1.improvmx.com` (priority 10) and `mx2.improvmx.com` (priority 20) as MX records on `@`,
   plus a TXT record `v=spf1 include:spf.improvmx.com ~all` on `@`. `trackwyze.com` had no SPF record at
   all as of November 2026, so this one can be added as-is; if one is ever added later, merge into it
   instead of adding a second TXT record (two SPF records on one name breaks SPF).
3. Wait for DNS to propagate (Netlify is usually fast), then verify the domain in ImprovMX.

Separately: `trackwyze.com` also has no SPF or DKIM record authorising SendGrid to send as it, which can
hurt deliverability (mail landing in spam) independent of the reply problem above. That's a SendGrid
domain-authentication setup, not covered here.

## TrackWyze Guide (`app-help`)

The floating Help button in the app opens a chat that explains how to use TrackWyze, opens the right page,
and offers the team on WhatsApp. It is separate from the AI Business Advisor: the Guide never reads a person's
sales, stock, customers or money, only the conversation, the page they are on and their plan.

- **Function**: `app-help` (signed-in users; leave "Verify JWT" ON). Uses the existing `ANTHROPIC_API_KEY`
  secret and the existing `check_rate_limit` database function (30 questions an hour, 120 a day per person;
  a failed check blocks the question rather than risk unbounded spending). Uses the small, fast
  `claude-haiku-5-5` model.
- **What it knows**: `_shared/helpAssistant.ts` (`HELP_PAGES`, the plan facts and the how-to text). When a page,
  a plan lock or a limit changes in the app, update it there; `helpAssistant.test.ts` fails if the page list,
  the plan locks, the prices or the Free limits drift from the app.
- **Safety**: the model must answer through one forced tool, can only name real page ids, is told to never
  accept passwords/PINs, to give no financial or legal advice, and to hand over to the team for payment
  problems, login problems, lost data and bugs. Messages are capped (10 messages, 600 characters each).
- **Handing over to the team**: every "Talk to our team" link opens WhatsApp with a message already written
  (email, plan, page and the person's last question; see `src/services/helpAssistant/supportLink.ts`). The
  person sees and can edit it before sending. No business data goes in it.
- **Feedback**: each answer has a thumbs up/down, saved to `guide_feedback` (migration
  `20261103090000_guide_feedback.sql`: question, start of the answer, page, plan). People can only add their
  own rows; only admins can read them, and rows older than 90 days are removed as new ones arrive. To see what
  the Guide gets wrong, in the SQL editor run
  `select created_at, page, question, answer from guide_feedback where rating = 'down' order by created_at desc;`
  and then fix the matching text in `_shared/helpAssistant.ts`.

## Question limits for the two AIs

The Guide (`app-help`) and the AI Business Advisor (`ai-business-assistant`) cost money per question, so each plan
has a limit per hour, per day and per month (rolling windows: the last hour, 24 hours and 30 days).

- **The numbers** are in `_shared/aiLimits.ts` (`AI_LIMITS`) and, for showing "questions left" in the app, in
  `src/services/subscription/aiLimits.ts`. A test fails if the two differ. Free: Guide 5 a day, no Advisor.
  Starter: Guide 20 a day, no Advisor. Business (and the free month): Guide 40 a day, Advisor 10 a day.
  A limit of 0 means the plan does not include that assistant.
- **Enforced on the server**: the function works out the plan from the account itself (never from the browser) and
  calls the `consume_ai_quota` database function, which counts and records the question. If that check fails the
  question is refused (it fails closed).
- **Migration**: `20261104090000_ai_usage_limits.sql` (table `ai_usage_events`, functions `consume_ai_quota` and
  `ai_usage`). Run it before deploying the two functions. Usage per person is visible to admins in
  `ai_usage_events`.
- After changing a limit, redeploy both functions and release the app.
