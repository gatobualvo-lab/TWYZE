# Backup & Restore Runbook

This is a checklist to run yourself in the Supabase dashboard — it needs
project owner access that isn't available to an AI assistant working in
this repo, so it can't be verified automatically. "Backups exist" and
"we've actually tested restoring from one" are different claims; this
runbook is for confirming the second one, not just the first.

## 1. Confirm backups are actually enabled

1. Supabase Dashboard → your project → **Database → Backups**.
2. Confirm your plan includes daily backups (free tier: 7-day retention on
   some plans, none on others — check what your current plan actually
   includes; Pro tier and above include Point-in-Time Recovery, PITR).
3. If you're on a plan without backups/PITR, this is the single highest-
   priority item on this whole list — everything else assumes there's a
   way to recover from a bad migration or accidental deletion, and right
   now there might not be.

## 2. Confirm PITR window matches your risk tolerance

If PITR is available: note the retention window (e.g. 7 days). Ask
yourself — if a bad migration or a mistaken bulk-delete went unnoticed for
longer than that window, would you be able to recover? If not, consider
increasing the retention window or adding a second, longer-retention
backup mechanism (e.g. a scheduled `pg_dump` to external storage).

## 3. Actually test a restore (the step people skip)

Do this on a **separate test/staging Supabase project**, never against
production:

1. Create a new, throwaway Supabase project (or use a staging project if
   you set one up).
2. Restore a backup or a PITR snapshot from production into it, following
   Supabase's restore flow for your plan.
3. Confirm the restored project actually has real data in it — spot-check
   a few tables (`sales`, `profiles`, `ai_conversations` if the AI
   Assistant is live) for row counts and recent timestamps.
4. Confirm RLS policies and Edge Functions came through intact, not just
   the raw table data — a restore that loses your RLS policies would
   silently break tenant isolation.
5. Delete the throwaway project once you're satisfied (or keep it as a
   proper staging environment going forward).
6. Write down the date you did this test and the result, so "when did we
   last verify our backups actually work" has a real answer next time
   someone asks.

## 4. Know your recovery time

Time how long step 3 actually took, end to end. That's roughly how long
your app would be degraded/unavailable during a real incident — worth
knowing before you need it, not during an outage.

## 5. Repeat periodically

Backups can silently stop working (a config change, a plan downgrade, a
schema change that breaks the restore process). Re-run this checklist
every few months, or after any major schema migration, not just once.

---

**Bottom line:** don't treat "Supabase backs up automatically" as
sufficient on its own. Confirm the plan actually includes it, confirm the
retention window, and confirm a restore genuinely works by actually doing
one — ideally before you're relying on it under pressure.
