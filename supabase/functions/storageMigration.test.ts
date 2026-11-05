import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const sql = readFileSync(resolve(__dirname, '../migrations/20261107090000_storage_upload_limits.sql'), 'utf8');

describe('storage upload limits', () => {
  it('limits every bucket that takes uploads to small images (and PDFs only in user-files)', () => {
    for (const id of ['payment-proofs', 'user-files', 'product-images', 'business-assets']) {
      expect(sql, id).toContain(`'${id}'`);
    }
    expect(sql).toMatch(/payment-proofs[\s\S]*?5242880[\s\S]*?image\/png/);
    expect(sql).toMatch(/user-files[\s\S]*?10485760[\s\S]*?application\/pdf/);
  });

  it('never allows web pages, scripts or SVG as a stored type', () => {
    expect(sql).not.toMatch(/'(text\/html|image\/svg\+xml|application\/javascript|text\/javascript)'/);
    const code = sql.replace(/--.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
    expect(code).not.toMatch(/\.(html?|svg|js)\b/i);
  });

  it('adds restrictive rules (on top of the own-folder rules) for creating and renaming files', () => {
    expect(sql).toMatch(/AS RESTRICTIVE FOR INSERT/);
    expect(sql).toMatch(/AS RESTRICTIVE FOR UPDATE/);
    expect(sql).toContain("\\.(png|jpe?g|webp)$");
  });

  it('keeps the private buckets private', () => {
    expect(sql).toMatch(/SET public = false,\s+file_size_limit = 5242880,[\s\S]*?WHERE id = 'payment-proofs'/);
    expect(sql).toMatch(/SET public = false,\s+file_size_limit = 10485760,[\s\S]*?WHERE id = 'user-files'/);
  });
});
