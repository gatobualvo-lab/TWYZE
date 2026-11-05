// Everything a person types or uploads must be made inert before it is shown anywhere it could be read
// as code. React already escapes text it renders. These helpers cover the places that do not: HTML
// built as a string (printed documents, receipts and statements), image addresses taken from saved
// data, and spreadsheet exports.

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/**
 * Turns text into something that can sit inside an HTML string (in text or in a quoted attribute) and
 * can only ever be shown, never run. Use it on every value a person entered, with no exceptions.
 */
export const escapeHtml = (value: unknown): string => {
  const str = value === null || value === undefined ? '' : String(value);
  return str.replace(/[&<>"']/g, ch => HTML_ESCAPES[ch]);
};

const DATA_IMAGE = /^data:image\/(?:png|jpeg|webp);base64,[a-z0-9+/=]+$/i;

/** The address images are served from: this project's public storage, nothing else. */
function storageOrigin(): string | null {
  try {
    // Written out in full so the build can fill it in.
    const base = import.meta.env.VITE_SUPABASE_URL as string | undefined;
    return base ? new URL(base).origin : null;
  } catch {
    return null;
  }
}

/**
 * True only for an image this app could have stored itself: a small inline PNG, JPEG or WebP, or a file in
 * this project's public storage. Anything else (another website, a script address, an SVG, an odd
 * protocol) is refused, so saved data cannot make a printed page or PDF reach out to somewhere else.
 */
export function isSafeImageUrl(url: unknown): url is string {
  if (typeof url !== 'string' || url.length === 0 || url.length > 2_000_000) return false;
  if (DATA_IMAGE.test(url)) return true;
  const origin = storageOrigin();
  if (!origin) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && parsed.origin === origin && parsed.pathname.startsWith('/storage/v1/object/public/');
  } catch {
    return false;
  }
}

/** The image address to put in an HTML attribute, escaped, or an empty string when it is not a safe one. */
export const safeImageSrc = (url: unknown): string => (isSafeImageUrl(url) ? escapeHtml(url) : '');

const PLAIN_NUMBER = /^[-+]?(?:\d{1,3}(?:,\d{3})+|\d+)?(?:\.\d+)?(?:e[-+]?\d+)?$/i;

/**
 * One value for a CSV cell. A text value that starts with =, +, - or @ (or a tab or line break) would be
 * run as a formula when the file is opened in Excel or Sheets, so it gets a leading apostrophe. Real
 * numbers, including negative ones, are left alone. The value is then quoted and its quotes doubled.
 */
export function csvCell(value: unknown): string {
  let text = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(text) && !PLAIN_NUMBER.test(text.trim())) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}
