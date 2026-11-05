import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { BUSINESS_CATEGORIES, REFERRAL_SOURCES } from '../../src/constants/businessCategory';

// The signup trigger only keeps the business types and "how did you hear" answers the form offers. These
// lists are written out in the SQL, so this fails if the form and the database stop agreeing.
const sql = readFileSync(resolve(__dirname, '../migrations/20261106090000_signup_consent_and_validation.sql'), 'utf8');

function listAfter(marker: string): string[] {
  const start = sql.indexOf(marker);
  expect(start, `"${marker}" is missing from the migration`).toBeGreaterThan(-1);
  const body = sql.slice(start, sql.indexOf(')', start));
  return [...body.matchAll(/'([a-z_]+)'/g)].map(m => m[1]);
}

describe('signup trigger lists', () => {
  it('accept exactly the business types the form offers', () => {
    expect(listAfter('v_category NOT IN (').sort()).toEqual(BUSINESS_CATEGORIES.map(c => c.value).sort());
  });

  it('accept exactly the "how did you hear" answers the form offers', () => {
    expect(listAfter('v_referral NOT IN (').sort()).toEqual(REFERRAL_SOURCES.map(r => r.value).sort());
  });

  it('keeps the under-18 refusal and the consent record', () => {
    expect(sql).toContain("= 'under_18'");
    expect(sql).toContain('terms_accepted_at');
    expect(sql).toContain('email_consent_at');
  });

  it('stops people editing their own consent record', () => {
    expect(sql).toMatch(/NEW\.terms_accepted_at\s+IS DISTINCT FROM OLD\.terms_accepted_at/);
    expect(sql).toMatch(/NEW\.terms_version\s+IS DISTINCT FROM OLD\.terms_version/);
  });
});
