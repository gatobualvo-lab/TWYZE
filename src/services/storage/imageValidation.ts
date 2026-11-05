// Every image a person uploads goes through here before it is stored. The browser's idea of a file's type
// comes from its name, so it proves nothing. Instead the file is checked for size, its first bytes must
// match a real PNG, JPEG or WebP, it must decode as a picture, and it is then redrawn from scratch. The
// stored file is always a clean new image: any hidden data (a script, a second file glued on, a GPS
// location in the photo's details) does not survive, and its name and type are chosen here, never taken
// from the person's file.

export type ImageKind = 'png' | 'jpeg' | 'webp';

export class ImageUploadError extends Error {}

export const ALLOWED_IMAGE_TYPES_LABEL = 'a PNG, JPG or WebP image';

/** Cheap protection against a tiny file that expands into a huge picture and freezes the phone. */
export const MAX_IMAGE_PIXELS = 40_000_000;

/** Which image format the first bytes of a file say it is, or null when they match none we accept. */
export function sniffImageKind(bytes: Uint8Array): ImageKind | null {
  const startsWith = (...sig: number[]) => sig.every((b, i) => bytes[i] === b);
  if (bytes.length >= 8 && startsWith(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return 'png';
  if (bytes.length >= 3 && startsWith(0xff, 0xd8, 0xff)) return 'jpeg';
  if (
    bytes.length >= 12 &&
    startsWith(0x52, 0x49, 0x46, 0x46) && // "RIFF"
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50 // "WEBP"
  ) {
    return 'webp';
  }
  return null;
}

function readHead(file: Blob, length = 16): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
    reader.onerror = () => reject(new ImageUploadError('That file could not be read'));
    reader.readAsArrayBuffer(file.slice(0, length));
  });
}

export interface DecodedImage {
  width: number;
  height: number;
  /** What the encoder draws from (an image element in the browser). */
  source: unknown;
}

/** The browser-only parts, so the checks around them can be tested without a browser. */
export interface ImageCodec {
  decode(file: Blob): Promise<DecodedImage>;
  encode(image: DecodedImage, width: number, height: number, type: 'image/png' | 'image/jpeg', quality: number, opaque: boolean): Promise<Blob>;
}

export const browserCodec: ImageCodec = {
  decode(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve({ width: img.naturalWidth, height: img.naturalHeight, source: img });
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new ImageUploadError('That file could not be read as an image'));
      };
      img.src = url;
    });
  },
  async encode(image, width, height, type, quality, opaque) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new ImageUploadError('Could not process the image');
    if (opaque) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
    }
    ctx.drawImage(image.source as CanvasImageSource, 0, 0, width, height);
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, type, quality));
    if (!blob) throw new ImageUploadError('Could not process the image');
    return blob;
  },
};

export interface PrepareImageOptions {
  /** The largest file accepted, in bytes (checked before anything is read). */
  maxBytes: number;
  /** The longest side of the stored picture, in pixels. */
  maxDim: number;
  /** Keep transparency (logos, stamps). When false everything is stored as a JPEG on white. */
  allowTransparency?: boolean;
  quality?: number;
}

export interface PreparedImage {
  blob: Blob;
  /** The type the file is stored and served as. */
  type: 'image/png' | 'image/jpeg';
  /** The file extension to store it under. */
  ext: 'png' | 'jpg';
}

const megabytes = (bytes: number) => Math.max(1, Math.round(bytes / (1024 * 1024)));

/**
 * Checks an uploaded picture and returns a clean copy to store. Throws an ImageUploadError, with a message
 * fit to show the person, when the file is empty, too big, not really an image of a type we accept, or
 * too large in pixels.
 */
export async function prepareImage(file: File, options: PrepareImageOptions, codec: ImageCodec = browserCodec): Promise<PreparedImage> {
  const { maxBytes, maxDim, allowTransparency = true, quality = 0.85 } = options;

  if (file.size === 0) throw new ImageUploadError('That file is empty');
  if (file.size > maxBytes) throw new ImageUploadError(`Image must be under ${megabytes(maxBytes)}MB`);

  const kind = sniffImageKind(await readHead(file));
  if (!kind) throw new ImageUploadError(`Please choose ${ALLOWED_IMAGE_TYPES_LABEL}`);

  const image = await codec.decode(file);
  if (!(image.width > 0 && image.height > 0)) throw new ImageUploadError('That file could not be read as an image');
  if (image.width * image.height > MAX_IMAGE_PIXELS) throw new ImageUploadError('That image is too large. Please choose a smaller one');

  const ratio = Math.min(1, maxDim / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * ratio));
  const height = Math.max(1, Math.round(image.height * ratio));

  const keepPng = kind === 'png' && allowTransparency;
  const type = keepPng ? 'image/png' : 'image/jpeg';
  const blob = await codec.encode(image, width, height, type, quality, !keepPng);
  if (blob.size > maxBytes) throw new ImageUploadError(`Image must be under ${megabytes(maxBytes)}MB`);

  return { blob, type, ext: keepPng ? 'png' : 'jpg' };
}

/** A name nobody can guess or collide with, made here and never taken from the uploaded file's name. */
export function uniqueFileStem(): string {
  const random = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return random;
}
