import { describe, it, expect } from 'vitest';
import { ensureRandomUUID } from './polyfills';

const fakeCrypto = () => ({
  getRandomValues: (array: Uint8Array) => {
    for (let i = 0; i < array.length; i++) array[i] = Math.floor(Math.random() * 256);
    return array;
  },
} as { getRandomValues: (a: Uint8Array) => Uint8Array; randomUUID?: () => string });

describe('ensureRandomUUID', () => {
  it('adds a valid version-4 UUID generator when the browser has none', () => {
    const c = fakeCrypto();
    ensureRandomUUID(c);
    const id = c.randomUUID!();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('produces different ids each time', () => {
    const c = fakeCrypto();
    ensureRandomUUID(c);
    const ids = new Set(Array.from({ length: 200 }, () => c.randomUUID!()));
    expect(ids.size).toBe(200);
  });

  it('leaves a native implementation alone', () => {
    const c = fakeCrypto();
    const native = () => 'native';
    c.randomUUID = native;
    ensureRandomUUID(c);
    expect(c.randomUUID).toBe(native);
  });

  it('does nothing when there is no crypto at all', () => {
    expect(() => ensureRandomUUID(undefined)).not.toThrow();
  });
});
