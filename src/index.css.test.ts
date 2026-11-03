import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const css = readFileSync(resolve(__dirname, 'index.css'), 'utf8');

describe('global styles', () => {
  it('do not cut off ordinary text: Tailwind\'s .break-words is left alone', () => {
    // A rule on .break-words that clamps lines hid the end of every paragraph using it on a phone.
    const rules = [...css.matchAll(/(^|\n)\s*\.break-words\s*\{([^}]*)\}/g)].map(m => m[2]);
    for (const body of rules) {
      expect(body).not.toMatch(/line-clamp|max-height|overflow:\s*hidden/);
    }
  });

  it('the sales card clamp has its own class', () => {
    expect(css).toMatch(/\.clamp-2-mobile\s*\{[^}]*-webkit-line-clamp:\s*2/);
  });
});
