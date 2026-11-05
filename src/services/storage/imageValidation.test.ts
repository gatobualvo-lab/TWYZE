import { describe, it, expect, vi } from 'vitest';
import { ImageUploadError, MAX_IMAGE_PIXELS, prepareImage, sniffImageKind, uniqueFileStem, type ImageCodec } from './imageValidation';

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0];
const JPEG = [0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 0];
const WEBP = [0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50];

const fileOf = (bytes: number[] | string, name: string, type: string, padTo = 0) => {
  const data = typeof bytes === 'string' ? new TextEncoder().encode(bytes) : Uint8Array.from(bytes);
  const padded = padTo > data.length ? Uint8Array.from([...data, ...new Uint8Array(padTo - data.length)]) : data;
  return new File([padded], name, { type });
};

function fakeCodec(width = 800, height = 600, encodedSize = 1000): ImageCodec & { encode: ReturnType<typeof vi.fn> } {
  return {
    decode: vi.fn().mockResolvedValue({ width, height, source: {} }),
    encode: vi.fn().mockImplementation(async () => new Blob([new Uint8Array(encodedSize)])),
  };
}

const options = { maxBytes: 5 * 1024 * 1024, maxDim: 1000 };

describe('sniffImageKind', () => {
  it('recognises the three accepted formats by their first bytes', () => {
    expect(sniffImageKind(Uint8Array.from(PNG))).toBe('png');
    expect(sniffImageKind(Uint8Array.from(JPEG))).toBe('jpeg');
    expect(sniffImageKind(Uint8Array.from(WEBP))).toBe('webp');
  });

  it('recognises nothing else: web pages, scripts, SVG, GIF, PDF, empty', () => {
    const text = (s: string) => new TextEncoder().encode(s);
    for (const bytes of [text('<!DOCTYPE html><script>'), text('<svg xmlns="http://www.w3.org/2000/svg">'), text('GIF89a......'), text('%PDF-1.7.....'), text('MZ\u0090\u0000'), new Uint8Array(0)]) {
      expect(sniffImageKind(bytes)).toBeNull();
    }
  });
});

describe('prepareImage', () => {
  it('refuses a file that only has an image name: a web page called photo.png', async () => {
    const codec = fakeCodec();
    const file = fileOf('<html><script>alert(1)</script></html>', 'photo.png', 'image/png');
    await expect(prepareImage(file, options, codec)).rejects.toThrow('PNG, JPG or WebP');
    expect(codec.decode).not.toHaveBeenCalled();
  });

  it('refuses an SVG even when it says it is a PNG', async () => {
    const file = fileOf('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>', 'logo.png', 'image/png');
    await expect(prepareImage(file, options, fakeCodec())).rejects.toBeInstanceOf(ImageUploadError);
  });

  it('refuses an empty file and one that is too big, before reading it', async () => {
    const codec = fakeCodec();
    await expect(prepareImage(fileOf([], 'a.png', 'image/png'), options, codec)).rejects.toThrow('empty');
    const big = fileOf(PNG, 'a.png', 'image/png', 6 * 1024 * 1024);
    await expect(prepareImage(big, options, codec)).rejects.toThrow('under 5MB');
    expect(codec.decode).not.toHaveBeenCalled();
  });

  it('refuses a real-looking header that does not decode as a picture', async () => {
    const codec = fakeCodec();
    codec.decode = vi.fn().mockRejectedValue(new ImageUploadError('That file could not be read as an image'));
    await expect(prepareImage(fileOf(PNG, 'a.png', 'image/png'), options, codec)).rejects.toThrow('could not be read');
  });

  it('refuses a small file that expands into an enormous picture', async () => {
    const codec = fakeCodec(10_000, Math.ceil(MAX_IMAGE_PIXELS / 10_000) + 1);
    await expect(prepareImage(fileOf(JPEG, 'a.jpg', 'image/jpeg'), options, codec)).rejects.toThrow('too large');
    expect(codec.encode).not.toHaveBeenCalled();
  });

  it('stores a PNG as a PNG and everything else as a JPEG, by what the bytes are, not what the name says', async () => {
    const png = await prepareImage(fileOf(PNG, 'logo.jpg', 'image/jpeg'), options, fakeCodec());
    expect(png).toMatchObject({ type: 'image/png', ext: 'png' });
    const jpeg = await prepareImage(fileOf(JPEG, 'photo.png', 'image/png'), options, fakeCodec());
    expect(jpeg).toMatchObject({ type: 'image/jpeg', ext: 'jpg' });
    const webp = await prepareImage(fileOf(WEBP, 'photo.webp', 'image/webp'), options, fakeCodec());
    expect(webp).toMatchObject({ type: 'image/jpeg', ext: 'jpg' });
  });

  it('can store even a PNG as a JPEG when transparency is not needed (payment screenshots)', async () => {
    const codec = fakeCodec();
    const result = await prepareImage(fileOf(PNG, 's.png', 'image/png'), { ...options, allowTransparency: false }, codec);
    expect(result).toMatchObject({ type: 'image/jpeg', ext: 'jpg' });
    expect(codec.encode.mock.calls[0][5]).toBe(true); // drawn on white
  });

  it('always redraws the picture (so hidden data does not survive) and shrinks it to the longest side', async () => {
    const codec = fakeCodec(4000, 2000);
    await prepareImage(fileOf(JPEG, 'a.jpg', 'image/jpeg'), options, codec);
    expect(codec.encode).toHaveBeenCalledTimes(1);
    const [, width, height] = codec.encode.mock.calls[0];
    expect([width, height]).toEqual([1000, 500]);
  });

  it('does not enlarge a small picture', async () => {
    const codec = fakeCodec(200, 100);
    await prepareImage(fileOf(JPEG, 'a.jpg', 'image/jpeg'), options, codec);
    expect(codec.encode.mock.calls[0].slice(1, 3)).toEqual([200, 100]);
  });

  it('refuses if the redrawn picture is still over the size limit', async () => {
    await expect(prepareImage(fileOf(JPEG, 'a.jpg', 'image/jpeg'), { ...options, maxBytes: 500 }, fakeCodec(800, 600, 2000))).rejects.toThrow('under 1MB');
  });
});

describe('uniqueFileStem', () => {
  it('makes a different, URL-safe name every time', () => {
    const names = new Set(Array.from({ length: 50 }, uniqueFileStem));
    expect(names.size).toBe(50);
    for (const name of names) expect(name).toMatch(/^[a-z0-9-]+$/i);
  });
});
