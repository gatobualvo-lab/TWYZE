// Checks that an uploaded image really is the type it says it is, by reading its first bytes. A file's
// declared type is only a label the sender chose; the bytes are what it is. Used by scan-receipt before the
// photo is sent on to Claude. (The app also checks and redraws the picture before sending; this is for
// anyone calling the function directly.)

export type ImageMediaType = 'image/jpeg' | 'image/png' | 'image/webp';

const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;

/** The first bytes of a base64 string, or null if it is not valid base64. */
function headBytes(base64: string, count = 12): Uint8Array | null {
  if (!BASE64.test(base64)) return null;
  try {
    // 4 base64 characters carry 3 bytes; take a few more than needed.
    const chunk = base64.slice(0, Math.ceil((count * 4) / 3) + 4);
    const binary = atob(chunk.slice(0, chunk.length - (chunk.length % 4)));
    return Uint8Array.from(binary, c => c.charCodeAt(0));
  } catch {
    return null;
  }
}

/** The image type the bytes show, or null when they are none of the three we accept. */
export function sniffBase64Image(base64: string): ImageMediaType | null {
  const bytes = headBytes(base64);
  if (!bytes) return null;
  const startsWith = (...sig: number[]) => sig.every((b, i) => bytes[i] === b);
  if (startsWith(0xff, 0xd8, 0xff)) return 'image/jpeg';
  if (startsWith(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return 'image/png';
  if (startsWith(0x52, 0x49, 0x46, 0x46) && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return 'image/webp';
  return null;
}

/** True only when the base64 text is valid and its bytes are an image of exactly the declared type. */
export function isImageOfType(base64: string, declared: string): boolean {
  return sniffBase64Image(base64) === declared;
}
