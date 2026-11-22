import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { BUSINESS_CATEGORIES, REFERRAL_SOURCES } from '../../src/constants/businessCategory';

// The signup trigger only keeps the business types and "how did you hear" answers the form offers. These
// lists are written out in the SQL, so this fails if the form and the database stop agreeing. Migrations
// are never edited in place, so each time the allowed categories change it's a new migration that
// redefines private.handle_new_user() — this reads whichever one did it most recently (filenames sort by
// timestamp) rather than a fixed path, so this test doesn't need touching again next time that happens.
const migrationsDir = resolve(__dirname, '../migrations');
const allMigrationFiles = readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();

/** The most recent migration containing `marker` — each fact below lives wherever the function
 * that owns it was last redefined, which needn't be the same file as any other fact here. */
function latestFileContaining(marker: string): string {
  const contents = new Map(allMigrationFiles.map(f => [f, readFileSync(resolve(migrationsDir, f), 'utf8')]));
  const match = [...contents.entries()].reverse().find(([, text]) => text.includes(marker));
  if (!match) throw new Error(`No migration contains "${marker}"`);
  return match[1];
}

const handleNewUserSql = latestFileContaining('v_category NOT IN (');
const guardTriggerSql = latestFileContaining('IS DISTINCT FROM OLD.terms_accepted_at');

function listAfter(sql: string, marker: string): string[] {
  const start = sql.indexOf(marker);
  expect(start, `"${marker}" is missing from the migration`).toBeGreaterThan(-1);
  const body = sql.slice(start, sql.indexOf(')', start));
  return [...body.matchAll(/'([a-z_]+)'/g)].map(m => m[1]);
}

describe('signup trigger lists', () => {
  it('accept exactly the business types the form offers', () => {
    expect(listAfter(handleNewUserSql, 'v_category NOT IN (').sort()).toEqual(BUSINESS_CATEGORIES.map(c => c.value).sort());
  });

  it('accept exactly the "how did you hear" answers the form offers', () => {
    expect(listAfter(handleNewUserSql, 'v_referral NOT IN (').sort()).toEqual(REFERRAL_SOURCES.map(r => r.value).sort());
  });

  it('keeps the under-18 refusal and the consent record', () => {
    expect(handleNewUserSql).toContain("= 'under_18'");
    expect(handleNewUserSql).toContain('terms_accepted_at');
    expect(handleNewUserSql).toContain('email_consent_at');
  });

  it('stops people editing their own consent record', () => {
    expect(guardTriggerSql).toMatch(/NEW\.terms_accepted_at\s+IS DISTINCT FROM OLD\.terms_accepted_at/);
    expect(guardTriggerSql).toMatch(/NEW\.terms_version\s+IS DISTINCT FROM OLD\.terms_version/);
  });
});
