// Scheduled emails, run by a cron job every 15 minutes:
//   1. Task reminders: emails each user the tasks whose reminder time has
//      arrived (business_tasks.remind_at), once.
//   2. Business reports: on the first days of each quarter / half-year / year,
//      emails every active user a summary of the period that just ended. A
//      report is logged in period_report_log so it can never be sent twice, and
//      if several are due on the same day (1 January) they go in ONE email.
//
// Self-contained on purpose (no ../_shared imports) so it can be pasted into the
// Supabase dashboard editor as a single file.
//
// Who may call it: the service role key (what the cron job sends) or a signed-in
// admin. Secrets used: SENDGRID_API_KEY (same one the other email functions use);
// SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are provided by Supabase.
//
// Manual test (admin or service role), body JSON:
//   { "task": "reports", "date": "2027-01-02", "dryRun": true }   -> lists what WOULD be sent
//   { "task": "reports", "onlyUser": "<user uuid>", "force": true } -> resend to one user
//
// Pure helpers are exported at the bottom of the logic so they can be unit tested.

const FROM_EMAIL = 'notifications@trackwyze.com';
const FROM_NAME = 'TrackWyze';
const SENDGRID_API_URL = 'https://api.sendgrid.com/v3/mail/send';
const APP_URL = 'https://trackwyze.com';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

/** Per run caps, so one invocation always finishes well inside the function time limit. */
const MAX_REPORT_USERS_PER_RUN = 150;
const MAX_REMINDERS_PER_RUN = 300;
/** A reminder this old (the cron was down, or the user turned reminders on late) is not worth an email. */
const STALE_REMINDER_MS = 3 * 24 * 60 * 60 * 1000;
/** Reports are sent in the first N days of a new period, so a failed run can retry on later days. */
const REPORT_WINDOW_DAYS = 10;

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

export type PeriodKind = 'quarterly' | 'semiannual' | 'yearly';

export interface DuePeriod {
  kind: PeriodKind;
  start: string; // YYYY-MM-DD
  end: string; // YYYY-MM-DD
  label: string;
}

const iso = (d: Date) => d.toISOString().slice(0, 10);
const utc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m, d));

/** Reports that are due today: the period that ended just before the current quarter / half / year began. */
export function duePeriods(today: Date): DuePeriod[] {
  const y = today.getUTCFullYear();
  const m = today.getUTCMonth();
  const d = today.getUTCDate();
  if (d > REPORT_WINDOW_DAYS) return [];

  const periods: DuePeriod[] = [];

  if (m % 3 === 0) {
    const start = utc(y, m - 3, 1);
    const end = utc(y, m, 0);
    const q = Math.floor(start.getUTCMonth() / 3) + 1;
    periods.push({ kind: 'quarterly', start: iso(start), end: iso(end), label: `Q${q} ${start.getUTCFullYear()}` });
  }
  if (m === 0 || m === 6) {
    const start = utc(y, m - 6, 1);
    const end = utc(y, m, 0);
    const half = start.getUTCMonth() === 0 ? 'First half' : 'Second half';
    periods.push({ kind: 'semiannual', start: iso(start), end: iso(end), label: `${half} of ${start.getUTCFullYear()}` });
  }
  if (m === 0) {
    periods.push({ kind: 'yearly', start: iso(utc(y - 1, 0, 1)), end: iso(utc(y - 1, 11, 31)), label: `Full year ${y - 1}` });
  }
  return periods;
}

/** The period of the same length immediately before `start`, for "vs last time" comparisons. */
export function previousPeriod(start: string, end: string): { start: string; end: string } {
  const s = new Date(`${start}T00:00:00Z`);
  const e = new Date(`${end}T00:00:00Z`);
  const days = Math.round((e.getTime() - s.getTime()) / 86_400_000) + 1;
  const prevEnd = new Date(s.getTime() - 86_400_000);
  const prevStart = new Date(prevEnd.getTime() - (days - 1) * 86_400_000);
  return { start: iso(prevStart), end: iso(prevEnd) };
}

export function pctChange(current: number, previous: number): number | null {
  if (!Number.isFinite(current) || !Number.isFinite(previous) || previous === 0) return null;
  return Math.round(((current - previous) / Math.abs(previous)) * 1000) / 10;
}

const WHOLE_UNIT_CURRENCIES = new Set(['KES', 'UGX', 'TZS', 'RWF', 'XOF', 'IDR']);

export function money(amount: number, currency: string): string {
  const digits = WHOLE_UNIT_CURRENCIES.has(currency) ? 0 : 2;
  const n = Number.isFinite(amount) ? amount : 0;
  return `${currency} ${n.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
}

export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export interface ReportData {
  revenue: number;
  gross_profit: number;
  expenses: number;
  net_profit: number;
  sales_count: number;
  receivables: number;
  top_products: Array<{ name: string; units: number; revenue: number; profit: number }>;
  top_customers: Array<{ name: string; revenue: number; orders: number }>;
}

export interface ReportSection {
  period: DuePeriod;
  data: ReportData;
  previous: ReportData | null;
}

export function hasActivity(data: ReportData): boolean {
  return data.sales_count > 0 || data.revenue > 0 || data.expenses > 0;
}

function changeBadge(current: number, previous: ReportData | null, pick: (d: ReportData) => number, goodWhenUp = true): string {
  if (!previous) return '';
  const change = pctChange(current, pick(previous));
  if (change === null) return '';
  const up = change >= 0;
  const good = up === goodWhenUp;
  const color = change === 0 ? '#6b7280' : good ? '#059669' : '#dc2626';
  return ` <span style="font-size:12px;color:${color};">${up ? '▲' : '▼'} ${Math.abs(change)}% vs previous</span>`;
}

function sectionHtml(section: ReportSection, currency: string): string {
  const { data, previous, period } = section;
  const row = (label: string, value: string, extra = '', bold = false) =>
    `<tr><td style="padding:6px 0;color:#4b5563;">${label}</td><td style="padding:6px 0;text-align:right;${bold ? 'font-weight:700;' : ''}">${value}${extra}</td></tr>`;

  const products = data.top_products.length
    ? `<p style="margin:14px 0 4px;font-weight:600;">Best sellers</p><ol style="margin:0;padding-left:20px;color:#374151;">${data.top_products
        .map(p => `<li>${escapeHtml(p.name)} <span style="color:#6b7280;">(${money(p.revenue, currency)})</span></li>`)
        .join('')}</ol>`
    : '';
  const customers = data.top_customers.length
    ? `<p style="margin:14px 0 4px;font-weight:600;">Top customers</p><ol style="margin:0;padding-left:20px;color:#374151;">${data.top_customers
        .map(c => `<li>${escapeHtml(c.name)} <span style="color:#6b7280;">(${money(c.revenue, currency)}, ${c.orders} ${c.orders === 1 ? 'order' : 'orders'})</span></li>`)
        .join('')}</ol>`
    : '';

  return `
    <div style="margin:0 0 24px;padding:16px;border:1px solid #e5e7eb;border-radius:8px;">
      <h3 style="margin:0 0 2px;font-size:16px;">${escapeHtml(period.label)}</h3>
      <p style="margin:0 0 10px;font-size:12px;color:#9ca3af;">${period.start} to ${period.end}</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        ${row('Sales', money(data.revenue, currency), changeBadge(data.revenue, previous, d => d.revenue), true)}
        ${row('Number of sales', String(data.sales_count), changeBadge(data.sales_count, previous, d => d.sales_count))}
        ${row('Gross profit', money(data.gross_profit, currency), changeBadge(data.gross_profit, previous, d => d.gross_profit))}
        ${row('Expenses', money(data.expenses, currency), changeBadge(data.expenses, previous, d => d.expenses, false))}
        ${row('Net profit', money(data.net_profit, currency), changeBadge(data.net_profit, previous, d => d.net_profit), true)}
        ${row('Still owed to you', money(data.receivables, currency))}
      </table>
      ${products}
      ${customers}
    </div>`;
}

function emailLayout(title: string, bodyHtml: string): string {
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 520px; margin: 0 auto; color: #1f2937;">
      <div style="padding: 24px 0; text-align: center; border-bottom: 2px solid #f3f4f6;">
        <h1 style="font-size: 20px; margin: 0; color: #1e40af;">TrackWyze</h1>
      </div>
      <div style="padding: 24px 4px;">
        <h2 style="font-size: 18px; margin: 0 0 12px;">${title}</h2>
        ${bodyHtml}
      </div>
      <div style="padding: 16px 4px; border-top: 1px solid #f3f4f6; font-size: 12px; color: #9ca3af; text-align: center;">
        TrackWyze — Track Smart. Profit Wise.<br>
        You can turn these emails off in Notification Settings inside the app.
      </div>
    </div>`;
}

export function buildReportEmail(name: string, currency: string, sections: ReportSection[]): { subject: string; html: string; text: string } {
  const labels = sections.map(s => s.period.label);
  const subject =
    sections.length === 1 ? `Your business report: ${labels[0]}` : `Your business reports: ${labels.join(' · ')}`;
  const greeting = `Hi ${escapeHtml(name || 'there')},`;
  const intro = `<p>${greeting}</p><p>Here is how your business did. These numbers come from the sales and expenses you recorded in TrackWyze.</p>`;
  const html = emailLayout(escapeHtml(subject), intro + sections.map(s => sectionHtml(s, currency)).join('') + `<p style="margin-top:8px;"><a href="${APP_URL}" style="color:#1e40af;">Open TrackWyze</a> for the full reports.</p>`);

  const text = [
    `Hi ${name || 'there'},`,
    '',
    ...sections.flatMap(s => [
      `${s.period.label} (${s.period.start} to ${s.period.end})`,
      `  Sales: ${money(s.data.revenue, currency)} (${s.data.sales_count} sales)`,
      `  Gross profit: ${money(s.data.gross_profit, currency)}`,
      `  Expenses: ${money(s.data.expenses, currency)}`,
      `  Net profit: ${money(s.data.net_profit, currency)}`,
      '',
    ]),
    `Open TrackWyze: ${APP_URL}`,
  ].join('\n');
  return { subject, html, text };
}

export interface ReminderTask {
  title: string;
  due_date: string | null;
  due_time: string | null;
}

export function buildReminderEmail(name: string, tasks: ReminderTask[]): { subject: string; html: string; text: string } {
  const when = (t: ReminderTask) => [t.due_date, t.due_time].filter(Boolean).join(' ');
  const subject = tasks.length === 1 ? `Reminder: ${tasks[0].title}` : `Reminder: ${tasks.length} tasks need your attention`;
  const items = tasks
    .map(t => `<li style="margin:4px 0;">${escapeHtml(t.title)}${when(t) ? ` <span style="color:#6b7280;">(${escapeHtml(when(t))})</span>` : ''}</li>`)
    .join('');
  const html = emailLayout(
    escapeHtml(subject),
    `<p>Hi ${escapeHtml(name || 'there')},</p><p>This is your reminder:</p><ul style="padding-left:20px;">${items}</ul><p><a href="${APP_URL}" style="color:#1e40af;">Open TrackWyze</a></p>`
  );
  const text = [`Hi ${name || 'there'},`, '', 'This is your reminder:', ...tasks.map(t => `- ${t.title}${when(t) ? ` (${when(t)})` : ''}`), '', APP_URL].join('\n');
  return { subject, html, text };
}

// ---------------------------------------------------------------------------
// Runtime (Deno / Supabase Edge Functions)
// ---------------------------------------------------------------------------

declare const Deno: {
  env: { get(key: string): string | undefined };
  serve(handler: (req: Request) => Response | Promise<Response>): void;
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function sendEmail(apiKey: string, to: string, mail: { subject: string; html: string; text: string }): Promise<void> {
  const response = await fetch(SENDGRID_API_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }] }],
      from: { email: FROM_EMAIL, name: FROM_NAME },
      subject: mail.subject,
      content: [
        { type: 'text/plain', value: mail.text },
        { type: 'text/html', value: mail.html },
      ],
    }),
  });
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`SendGrid error ${response.status}: ${body.slice(0, 300)}`);
  }
}

interface RunOptions {
  task: 'all' | 'reports' | 'reminders';
  today: Date;
  dryRun: boolean;
  force: boolean;
  onlyUser?: string;
}

// deno-lint-ignore no-explicit-any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

async function runReminders(db: Db, apiKey: string, opts: RunOptions) {
  const now = opts.today;
  let query = db
    .from('business_tasks')
    .select('id, user_id, title, due_date, due_time, remind_at')
    .is('reminder_sent_at', null)
    .not('remind_at', 'is', null)
    .lte('remind_at', now.toISOString())
    .or('completed.is.null,completed.eq.false')
    .order('remind_at')
    .limit(MAX_REMINDERS_PER_RUN);
  if (opts.onlyUser) query = query.eq('user_id', opts.onlyUser);
  const { data: tasks, error } = await query;
  if (error) throw new Error(`reminders query: ${error.message}`);

  const byUser = new Map<string, Array<{ id: string; title: string; due_date: string | null; due_time: string | null; remind_at: string }>>();
  for (const t of tasks ?? []) {
    const list = byUser.get(t.user_id) ?? [];
    list.push(t);
    byUser.set(t.user_id, list);
  }

  let sent = 0;
  let skipped = 0;
  const markDone = async (ids: string[]) => {
    if (opts.dryRun || ids.length === 0) return;
    await db.from('business_tasks').update({ reminder_sent_at: now.toISOString() }).in('id', ids);
  };

  for (const [userId, userTasks] of byUser) {
    const fresh = userTasks.filter(t => now.getTime() - new Date(t.remind_at).getTime() < STALE_REMINDER_MS);
    const staleIds = userTasks.filter(t => !fresh.includes(t)).map(t => t.id);

    const [{ data: profile }, { data: prefs }] = await Promise.all([
      db.from('profiles').select('email, full_name, subscription_status').eq('id', userId).maybeSingle(),
      db.from('notification_preferences').select('task_reminders_enabled').eq('user_id', userId).maybeSingle(),
    ]);
    const allowed =
      !!profile?.email &&
      ['active', 'trial'].includes(profile?.subscription_status ?? '') &&
      (prefs?.task_reminders_enabled ?? true);

    if (!allowed || fresh.length === 0) {
      skipped += userTasks.length;
      await markDone(userTasks.map(t => t.id));
      continue;
    }

    if (!opts.dryRun) {
      try {
        await sendEmail(apiKey, profile.email, buildReminderEmail(profile.full_name ?? '', fresh));
      } catch (err) {
        console.error('reminder email failed for', userId, err instanceof Error ? err.message : err);
        continue; // leave unsent so the next run retries
      }
    }
    sent += fresh.length;
    await markDone([...fresh.map(t => t.id), ...staleIds]);
  }
  return { sent, skipped };
}

async function fetchReport(db: Db, userId: string, start: string, end: string): Promise<ReportData | null> {
  const { data, error } = await db.rpc('period_report_data', { p_user: userId, p_start: start, p_end: end });
  if (error || !data) return null;
  return data as ReportData;
}

async function runReports(db: Db, apiKey: string, opts: RunOptions) {
  const periods = duePeriods(opts.today);
  if (periods.length === 0) return { periods: [], sent: 0, skipped: 0, note: 'No report is due today' };

  let profilesQuery = db
    .from('profiles')
    .select('id, email, full_name, currency, subscription_status')
    .in('subscription_status', ['active', 'trial'])
    .not('email', 'is', null)
    .order('id')
    .limit(2000);
  if (opts.onlyUser) profilesQuery = profilesQuery.eq('id', opts.onlyUser);
  const { data: profiles, error } = await profilesQuery;
  if (error) throw new Error(`profiles query: ${error.message}`);

  let sent = 0;
  let skipped = 0;
  const wouldSend: string[] = [];

  for (const profile of profiles ?? []) {
    if (sent >= MAX_REPORT_USERS_PER_RUN) break; // the next run continues from the log

    const { data: prefs } = await db
      .from('notification_preferences')
      .select('period_reports_enabled')
      .eq('user_id', profile.id)
      .maybeSingle();
    if (prefs && prefs.period_reports_enabled === false) {
      skipped++;
      continue;
    }

    const { data: logged } = await db
      .from('period_report_log')
      .select('period_kind, period_start')
      .eq('user_id', profile.id)
      .in('period_start', periods.map(p => p.start));
    const already = new Set((logged ?? []).map((r: { period_kind: string; period_start: string }) => `${r.period_kind}:${r.period_start}`));
    const pending = opts.force ? periods : periods.filter(p => !already.has(`${p.kind}:${p.start}`));
    if (pending.length === 0) {
      skipped++;
      continue;
    }

    const sections: ReportSection[] = [];
    for (const period of pending) {
      const data = await fetchReport(db, profile.id, period.start, period.end);
      if (!data || !hasActivity(data)) continue;
      const prev = previousPeriod(period.start, period.end);
      const previous = await fetchReport(db, profile.id, prev.start, prev.end);
      sections.push({ period, data, previous: previous && hasActivity(previous) ? previous : null });
    }

    // Nothing to report (new or idle account): remember that, so we don't re-check all week.
    const logRows = pending.map(p => ({ user_id: profile.id, period_kind: p.kind, period_start: p.start }));
    if (sections.length === 0) {
      skipped++;
      if (!opts.dryRun) await db.from('period_report_log').upsert(logRows);
      continue;
    }

    if (opts.dryRun) {
      wouldSend.push(`${profile.email}: ${sections.map(s => s.period.label).join(', ')}`);
      sent++;
      continue;
    }

    try {
      const mail = buildReportEmail(profile.full_name ?? '', (profile.currency as string) || 'KES', sections);
      await sendEmail(apiKey, profile.email, mail);
      await db.from('period_report_log').upsert(logRows);
      sent++;
    } catch (err) {
      console.error('report email failed for', profile.id, err instanceof Error ? err.message : err);
    }
  }

  return { periods: periods.map(p => p.label), sent, skipped, wouldSend: opts.dryRun ? wouldSend : undefined };
}

async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    // A non-literal specifier keeps tooling that cannot resolve jsr: from choking on this file in tests.
    const sdk = 'jsr:@supabase/supabase-js@2';
    const { createClient } = await import(/* @vite-ignore */ sdk);
    const db: Db = createClient(supabaseUrl, serviceKey);

    // Caller must be the service role (cron) or a signed-in admin.
    const authHeader = req.headers.get('Authorization') ?? '';
    const token = authHeader.replace(/^Bearer\s+/i, '');
    let authorised = token !== '' && token === serviceKey;
    if (!authorised && token) {
      const { data: userData } = await db.auth.getUser(token);
      if (userData?.user) {
        const { data: caller } = await db.from('profiles').select('role').eq('id', userData.user.id).maybeSingle();
        authorised = caller?.role === 'admin';
      }
    }
    if (!authorised) return json({ error: 'Not allowed' }, 403);

    const apiKey = Deno.env.get('SENDGRID_API_KEY');
    if (!apiKey) return json({ error: 'Email is not configured yet' }, 503);

    const body = await req.json().catch(() => ({}));
    const task = body.task === 'reports' || body.task === 'reminders' ? body.task : 'all';
    const parsedDate = typeof body.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.date) ? new Date(`${body.date}T12:00:00Z`) : new Date();
    const opts: RunOptions = {
      task,
      today: parsedDate,
      dryRun: body.dryRun === true,
      force: body.force === true,
      onlyUser: typeof body.onlyUser === 'string' ? body.onlyUser : undefined,
    };

    const result: Record<string, unknown> = { dryRun: opts.dryRun };
    if (task === 'all' || task === 'reminders') result.reminders = await runReminders(db, apiKey, opts);
    // Reports are only worth checking once a day (the log makes extra checks harmless, just wasteful).
    const dailyWindow = opts.today.getUTCHours() === 3 && opts.today.getUTCMinutes() < 15;
    if (task === 'reports' || (task === 'all' && (dailyWindow || body.date || opts.onlyUser))) {
      result.reports = await runReports(db, apiKey, opts);
    }
    return json(result);
  } catch (err) {
    console.error('scheduled-emails error:', err);
    return json({ error: err instanceof Error ? err.message : 'Unexpected error' }, 500);
  }
}

if (typeof Deno !== 'undefined' && typeof Deno.serve === 'function') {
  Deno.serve(handler);
}
