import { describe, it, expect, vi } from 'vitest';
import {
  darajaTimestamp,
  friendlyResultMessage,
  nextExpiry,
  normalizeKenyanPhone,
  parseStkCallback,
  readDarajaConfig,
  safeEqual,
  settleStkResult,
  stkPassword,
  stkPush,
  stkQuery,
  type DarajaConfig,
  type PaymentSubmission,
} from './_shared/mpesa';
import { normalizeKenyanPhone as clientNormalize } from '../../src/utils/mpesaPhone';

describe('normalizeKenyanPhone', () => {
  it.each([
    ['0712345678', '254712345678'],
    ['0712 345 678', '254712345678'],
    ['+254 712-345-678', '254712345678'],
    ['254712345678', '254712345678'],
    ['712345678', '254712345678'],
    ['0112345678', '254112345678'],
    ['(0722) 111.222', '254722111222'],
  ])('%s -> %s', (input, expected) => {
    expect(normalizeKenyanPhone(input)).toBe(expected);
  });

  it.each(['', '123', '071234567', '07123456789', '0612345678', 'abc', '+1 415 555 2671', null, undefined])('rejects %s', (input) => {
    expect(normalizeKenyanPhone(input)).toBeNull();
  });

  it('the app and the server agree on every case', () => {
    for (const input of ['0712345678', '+254 112 345 678', '712345678', '254712345678', '0612345678', '1234', 'x', '']) {
      expect(clientNormalize(input)).toBe(normalizeKenyanPhone(input));
    }
  });
});

describe('Daraja request helpers', () => {
  it('timestamps in Nairobi time', () => {
    // 21:30 UTC on 31 Dec is 00:30 on 1 Jan in Nairobi
    expect(darajaTimestamp(new Date('2026-12-31T21:30:05Z'))).toBe('20270101003005');
  });

  it('password is base64 of shortcode + passkey + timestamp', () => {
    expect(stkPassword('174379', 'pass', '20260101000000')).toBe(btoa('174379pass20260101000000'));
  });

  it('safeEqual only matches identical, non-empty secrets', () => {
    expect(safeEqual('abc123', 'abc123')).toBe(true);
    expect(safeEqual('abc123', 'abc124')).toBe(false);
    expect(safeEqual('abc', 'abcd')).toBe(false);
    expect(safeEqual('', '')).toBe(false);
    expect(safeEqual(null, 'x')).toBe(false);
  });

  it('explains result codes in plain words', () => {
    expect(friendlyResultMessage(1032)).toMatch(/cancelled/i);
    expect(friendlyResultMessage(2001)).toMatch(/PIN/);
    expect(friendlyResultMessage(1)).toMatch(/not enough/i);
    expect(friendlyResultMessage(1037)).toMatch(/timed out/i);
    expect(friendlyResultMessage(9999, 'Something odd')).toContain('Something odd');
  });
});

describe('readDarajaConfig', () => {
  const full: Record<string, string> = {
    MPESA_CONSUMER_KEY: 'k',
    MPESA_CONSUMER_SECRET: 's',
    MPESA_SHORTCODE: '174379',
    MPESA_PASSKEY: 'p',
    MPESA_CALLBACK_SECRET: 'cb',
  };
  const get = (env: Record<string, string>) => (key: string) => env[key];

  it('defaults to the sandbox and Paybill', () => {
    const cfg = readDarajaConfig(get(full))!;
    expect(cfg.baseUrl).toBe('https://sandbox.safaricom.co.ke');
    expect(cfg.transactionType).toBe('CustomerPayBillOnline');
    expect(cfg.partyB).toBe('174379');
  });

  it('ignores stray spaces and line breaks in pasted secrets', () => {
    const cfg = readDarajaConfig(get({ ...full, MPESA_SHORTCODE: ' 174379\n', MPESA_CONSUMER_KEY: 'k ', MPESA_ENV: ' sandbox ' }))!;
    expect(cfg.shortcode).toBe('174379');
    expect(cfg.consumerKey).toBe('k');
    expect(cfg.baseUrl).toBe('https://sandbox.safaricom.co.ke');
  });

  it('the sandbox always uses Paybill, whatever the payment-type secret says', () => {
    const cfg = readDarajaConfig(get({ ...full, MPESA_TRANSACTION_TYPE: 'CustomerBuyGoodsOnline', MPESA_PARTY_B: '5551234' }))!;
    expect(cfg.transactionType).toBe('CustomerPayBillOnline');
    expect(cfg.partyB).toBe('174379');
  });

  it('production, Buy Goods and a separate till number', () => {
    const cfg = readDarajaConfig(get({ ...full, MPESA_ENV: 'Production', MPESA_TRANSACTION_TYPE: 'CustomerBuyGoodsOnline', MPESA_PARTY_B: '5551234' }))!;
    expect(cfg.baseUrl).toBe('https://api.safaricom.co.ke');
    expect(cfg.transactionType).toBe('CustomerBuyGoodsOnline');
    expect(cfg.partyB).toBe('5551234');
  });

  it('is null when anything required is missing', () => {
    for (const key of Object.keys(full)) {
      const { [key]: _removed, ...rest } = full;
      expect(readDarajaConfig(get(rest))).toBeNull();
    }
  });
});

describe('parseStkCallback', () => {
  const success = {
    Body: {
      stkCallback: {
        MerchantRequestID: '29115-34620561-1',
        CheckoutRequestID: 'ws_CO_191220191020363925',
        ResultCode: 0,
        ResultDesc: 'The service request is processed successfully.',
        CallbackMetadata: {
          Item: [
            { Name: 'Amount', Value: 500 },
            { Name: 'MpesaReceiptNumber', Value: 'NLJ7RT61SV' },
            { Name: 'TransactionDate', Value: 20191219102115 },
            { Name: 'PhoneNumber', Value: 254708374149 },
          ],
        },
      },
    },
  };

  it('reads a successful payment', () => {
    expect(parseStkCallback(success)).toMatchObject({
      checkoutRequestId: 'ws_CO_191220191020363925',
      resultCode: 0,
      amount: 500,
      receipt: 'NLJ7RT61SV',
      phone: '254708374149',
    });
  });

  it('reads a cancelled one (no metadata)', () => {
    const cancelled = { Body: { stkCallback: { MerchantRequestID: 'm', CheckoutRequestID: 'ws_x', ResultCode: 1032, ResultDesc: 'Request cancelled by user' } } };
    expect(parseStkCallback(cancelled)).toMatchObject({ resultCode: 1032, amount: null, receipt: null });
  });

  it.each([null, undefined, {}, { Body: {} }, { Body: { stkCallback: {} } }, 'text', 7])('ignores %j', (body) => {
    expect(parseStkCallback(body)).toBeNull();
  });
});

describe('nextExpiry', () => {
  const now = new Date('2026-11-01T10:00:00Z');

  it('adds the plan length to today when there is no live subscription', () => {
    expect(nextExpiry(null, 30, now).toISOString().slice(0, 10)).toBe('2026-12-01');
    expect(nextExpiry('2026-10-01T00:00:00Z', 30, now).toISOString().slice(0, 10)).toBe('2026-12-01');
  });

  it('adds to the end of a subscription that is still running', () => {
    expect(nextExpiry('2026-11-20T00:00:00Z', 30, now).toISOString().slice(0, 10)).toBe('2026-12-20');
  });

  it('copes with junk', () => {
    expect(nextExpiry('not a date', 30, now).toISOString().slice(0, 10)).toBe('2026-12-01');
  });
});

describe('Daraja calls', () => {
  const cfg: DarajaConfig = {
    baseUrl: 'https://sandbox.safaricom.co.ke',
    consumerKey: 'k',
    consumerSecret: 's',
    shortcode: '174379',
    passkey: 'pk',
    transactionType: 'CustomerPayBillOnline',
    partyB: '174379',
    callbackSecret: 'cb',
  };

  const reply = (body: unknown, ok = true) => ({ ok, json: async () => body }) as Response;

  it('sends the phone, the amount and the callback address, and returns the request id', async () => {
    const calls: Array<{ url: string; body?: Record<string, unknown> }> = [];
    const fetchFn = vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, body: init?.body ? JSON.parse(String(init.body)) : undefined });
      if (url.includes('/oauth/')) return reply({ access_token: 'tok' });
      return reply({ ResponseCode: '0', CheckoutRequestID: 'ws_CO_1', MerchantRequestID: 'm1', CustomerMessage: 'Success. Request accepted for processing' });
    }) as unknown as typeof fetch;

    const result = await stkPush(cfg, { phone: '254712345678', amount: 500, reference: 'TrackWyze', description: 'Subscription', callbackUrl: 'https://x.test/cb?token=cb' }, fetchFn);
    expect(result).toMatchObject({ ok: true, checkoutRequestId: 'ws_CO_1' });
    const push = calls.find(c => c.url.includes('processrequest'))!;
    expect(push.body).toMatchObject({
      BusinessShortCode: '174379',
      TransactionType: 'CustomerPayBillOnline',
      Amount: 500,
      PartyA: '254712345678',
      PhoneNumber: '254712345678',
      PartyB: '174379',
      CallBackURL: 'https://x.test/cb?token=cb',
    });
    expect(push.body!.Password).toBe(stkPassword('174379', 'pk', String(push.body!.Timestamp)));
  });

  it('reports a rejected request with the reason', async () => {
    const fetchFn = vi.fn(async (url: string) =>
      url.includes('/oauth/') ? reply({ access_token: 'tok' }) : reply({ requestId: 'r', errorCode: '400.002.02', errorMessage: 'Bad Request - Invalid PhoneNumber' }, false)
    ) as unknown as typeof fetch;
    const result = await stkPush(cfg, { phone: '254712345678', amount: 500, reference: 'a', description: 'b', callbackUrl: 'x' }, fetchFn);
    expect(result).toMatchObject({ ok: false });
    expect((result as { message: string }).message).toContain('Bad Request - Invalid PhoneNumber');
    expect((result as { message: string }).message).toContain('CustomerPayBillOnline on sandbox');
  });

  it('fails clearly when the keys are wrong', async () => {
    const fetchFn = vi.fn(async () => reply({ errorMessage: 'Invalid credentials' }, false)) as unknown as typeof fetch;
    await expect(stkPush(cfg, { phone: '254712345678', amount: 500, reference: 'a', description: 'b', callbackUrl: 'x' }, fetchFn)).rejects.toThrow(/consumer key/i);
  });

  it.each([
    [{ ResultCode: '0', ResultDesc: 'ok' }, 'success'],
    [{ ResultCode: '1032', ResultDesc: 'Request cancelled by user' }, 'failed'],
    [{ errorCode: '500.001.1001', errorMessage: 'The transaction is being processed' }, 'pending'],
    [{}, 'pending'],
  ])('query %j -> %s', async (body, state) => {
    const fetchFn = vi.fn(async (url: string) => (url.includes('/oauth/') ? reply({ access_token: 'tok' }) : reply(body))) as unknown as typeof fetch;
    expect((await stkQuery(cfg, 'ws_CO_1', fetchFn)).state).toBe(state);
  });

  it('a network failure is "pending", never a false success', async () => {
    const fetchFn = vi.fn(async () => { throw new Error('offline'); }) as unknown as typeof fetch;
    expect((await stkQuery(cfg, 'ws_CO_1', fetchFn)).state).toBe('pending');
  });
});

// A tiny stand-in for the database, enough to check the settle step.
type Row = Record<string, unknown>;

function fakeDb(tables: Record<string, Row[]>) {
  const log: Array<{ table: string; op: string; values?: Row; filters?: Row }> = [];
  function from(table: string) {
    tables[table] ??= [];
    const filters: Row = {};
    let mode: 'select' | 'update' | 'insert' = 'select';
    let values: Row = {};
    let wantRows = false;
    const matches = () => tables[table].filter(r => Object.entries(filters).every(([k, v]) => r[k] === v));
    const run = () => {
      if (mode === 'update') {
        const rows = matches();
        rows.forEach(r => Object.assign(r, values));
        log.push({ table, op: 'update', values, filters: { ...filters } });
        return { data: wantRows ? rows.map(r => ({ id: r.id })) : null, error: null };
      }
      if (mode === 'insert') {
        tables[table].push(values);
        log.push({ table, op: 'insert', values });
        return { data: null, error: null };
      }
      return { data: matches(), error: null };
    };
    const chain: Record<string, unknown> = {
      update(v: Row) { mode = 'update'; values = v; return chain; },
      insert(v: Row) { mode = 'insert'; values = v; return chain; },
      select() { wantRows = true; return chain; },
      eq(k: string, v: unknown) { filters[k] = v; return chain; },
      maybeSingle: async () => ({ data: matches()[0] ?? null, error: null }),
      then(resolve: (value: unknown) => unknown) { return Promise.resolve(run()).then(resolve); },
    };
    return chain;
  }
  return { client: { from }, tables, log };
}

describe('settleStkResult', () => {
  const now = new Date('2026-11-01T10:00:00Z');
  const submission = (over: Partial<PaymentSubmission> = {}): PaymentSubmission => ({
    id: 'pay1',
    user_id: 'u1',
    amount: 1000,
    currency: 'KES',
    plan_key: 'business',
    status: 'pending',
    gateway_reference: 'mp_1',
    gateway_transaction_id: 'ws_1',
    ...over,
  });
  const setup = (sub = submission(), profile: Row = { id: 'u1', subscription_status: 'expired', subscription_expiry: '2026-10-01T00:00:00Z', email: null }) =>
    fakeDb({ payment_submissions: [{ ...sub }], profiles: [{ ...profile }], audit_log: [] });

  it('approves a paid request: marks it approved and activates the subscription', async () => {
    const db = setup();
    const result = await settleStkResult(db.client, submission(), { resultCode: 0, resultDesc: 'ok', amount: 1000, receipt: 'NLJ7RT61SV' }, now);
    expect(result).toBe('approved');
    expect(db.tables.payment_submissions[0]).toMatchObject({ status: 'approved', transaction_reference: 'NLJ7RT61SV' });
    const profile = db.tables.profiles[0];
    expect(profile.subscription_status).toBe('active');
    expect(profile.current_billing_cycle).toBe('business');
    expect(String(profile.subscription_expiry).slice(0, 10)).toBe('2026-12-01');
    expect(db.tables.audit_log.some(a => a.action === 'gateway_payment_approved')).toBe(true);
  });

  it('extends from the end of a subscription that is still running', async () => {
    const db = setup(submission(), { id: 'u1', subscription_status: 'active', subscription_expiry: '2026-11-20T00:00:00Z' });
    await settleStkResult(db.client, submission(), { resultCode: 0, resultDesc: 'ok' }, now);
    expect(String(db.tables.profiles[0].subscription_expiry).slice(0, 10)).toBe('2026-12-20');
  });

  it('settling twice never extends the subscription twice', async () => {
    const db = setup();
    const first = await settleStkResult(db.client, submission(), { resultCode: 0, resultDesc: 'ok' }, now);
    const expiryAfterFirst = db.tables.profiles[0].subscription_expiry;
    // the second caller still holds the old "pending" copy, as when a report and a status check overlap
    const second = await settleStkResult(db.client, submission(), { resultCode: 0, resultDesc: 'ok' }, now);
    expect(first).toBe('approved');
    expect(second).toBe('ignored');
    expect(db.tables.profiles[0].subscription_expiry).toBe(expiryAfterFirst);
  });

  it('rejects a payment whose amount does not match, without touching the subscription', async () => {
    const db = setup();
    const result = await settleStkResult(db.client, submission(), { resultCode: 0, resultDesc: 'ok', amount: 1 }, now);
    expect(result).toBe('rejected');
    expect(db.tables.payment_submissions[0].status).toBe('rejected');
    expect(db.tables.profiles[0].subscription_status).toBe('expired');
  });

  it('a cancelled request is rejected with a plain reason and activates nothing', async () => {
    const db = setup();
    const result = await settleStkResult(db.client, submission(), { resultCode: 1032, resultDesc: 'Request cancelled by user' }, now);
    expect(result).toBe('rejected');
    expect(String(db.tables.payment_submissions[0].admin_notes)).toMatch(/cancelled/i);
    expect(db.tables.profiles[0].subscription_status).toBe('expired');
  });

  it('a payment that is no longer pending is left alone', async () => {
    const db = setup(submission({ status: 'approved' }));
    expect(await settleStkResult(db.client, submission({ status: 'approved' }), { resultCode: 1032, resultDesc: 'x' }, now)).toBe('ignored');
    expect(db.tables.payment_submissions[0].status).toBe('approved');
  });

  it('a late failure report cannot overwrite a payment that was approved in the meantime', async () => {
    const db = setup();
    db.tables.payment_submissions[0].status = 'approved'; // approved by someone else after this caller read it
    expect(await settleStkResult(db.client, submission(), { resultCode: 1032, resultDesc: 'x' }, now)).toBe('ignored');
    expect(db.tables.payment_submissions[0].status).toBe('approved');
  });

  it('falls back to Starter if the stored plan is unknown', async () => {
    const db = setup(submission({ plan_key: 'nonsense' }));
    await settleStkResult(db.client, submission({ plan_key: 'nonsense' }), { resultCode: 0, resultDesc: 'ok' }, now);
    expect(db.tables.profiles[0].current_billing_cycle).toBe('starter');
  });

  it('a payment started under the earlier plans is read as the matching tier', async () => {
    const early = setup(submission({ plan_key: 'month2-3', amount: 500 }));
    await settleStkResult(early.client, submission({ plan_key: 'month2-3', amount: 500 }), { resultCode: 0, resultDesc: 'ok' }, now);
    expect(early.tables.profiles[0].current_billing_cycle).toBe('starter');
    const regular = setup(submission({ plan_key: 'month4+' }));
    await settleStkResult(regular.client, submission({ plan_key: 'month4+' }), { resultCode: 0, resultDesc: 'ok' }, now);
    expect(regular.tables.profiles[0].current_billing_cycle).toBe('business');
  });
});
