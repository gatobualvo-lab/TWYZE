import { describe, it, expect } from 'vitest';
import { normalizeKenyanPhone, buildWhatsAppLink } from './whatsapp';

describe('normalizeKenyanPhone', () => {
  it('converts a local 07... number to the 254 country code form', () => {
    expect(normalizeKenyanPhone('0712345678')).toBe('254712345678');
  });

  it('leaves an already-international number as-is', () => {
    expect(normalizeKenyanPhone('254712345678')).toBe('254712345678');
  });

  it('strips a leading + and spacing/dashes', () => {
    expect(normalizeKenyanPhone('+254 712-345-678')).toBe('254712345678');
  });

  it('adds the country code to a bare 9-digit number', () => {
    expect(normalizeKenyanPhone('712345678')).toBe('254712345678');
  });

  it('returns null for an empty or non-numeric string', () => {
    expect(normalizeKenyanPhone('')).toBeNull();
    expect(normalizeKenyanPhone('n/a')).toBeNull();
  });
});

describe('buildWhatsAppLink', () => {
  it('builds a wa.me link with the message URL-encoded', () => {
    const link = buildWhatsAppLink('0712345678', 'Hello there!');
    expect(link).toBe('https://wa.me/254712345678?text=Hello%20there!');
  });

  it('returns null when the phone number is too short to be valid', () => {
    expect(buildWhatsAppLink('123', 'Hi')).toBeNull();
  });
});
