import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { isImageOfType, sniffBase64Image } from './_shared/imageCheck';

const b64 = (bytes: number[] | string) => Buffer.from(typeof bytes === 'string' ? bytes : Uint8Array.from(bytes)).toString('base64');

const PNG = b64([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 73, 72, 68, 82]);
const JPEG = b64([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1]);
const WEBP = b64([0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x20]);

describe('sniffBase64Image', () => {
  it('knows the three accepted types from their first bytes', () => {
    expect(sniffBase64Image(PNG)).toBe('image/png');
    expect(sniffBase64Image(JPEG)).toBe('image/jpeg');
    expect(sniffBase64Image(WEBP)).toBe('image/webp');
  });

  it('knows nothing else: pages, scripts, SVG, GIF, PDF, or text that is not base64 at all', () => {
    for (const value of [b64('<html><script>alert(1)</script></html>'), b64('<svg xmlns="http://www.w3.org/2000/svg"/>'), b64('GIF89a......'), b64('%PDF-1.7.....'), 'not base64!!', '', 'a'.repeat(3)]) {
      expect(sniffBase64Image(value), value).toBeNull();
    }
  });
});

describe('isImageOfType', () => {
  it('needs the bytes to match the type the sender declared', () => {
    expect(isImageOfType(JPEG, 'image/jpeg')).toBe(true);
    expect(isImageOfType(PNG, 'image/jpeg')).toBe(false);
    expect(isImageOfType(b64('<html></html>'), 'image/png')).toBe(false);
  });
});

describe('scan-receipt', () => {
  it('checks the real bytes of the photo, not just the type it claims', () => {
    const source = readFileSync(resolve(__dirname, 'scan-receipt/index.ts'), 'utf8');
    expect(source).toContain("isImageOfType(image, mediaType)");
  });
});
