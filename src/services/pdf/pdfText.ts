/**
 * jsPDF's built-in fonts only cover Latin-1, so anything outside it (emoji,
 * non-breaking spaces from Intl, curly quotes) would render as garbage.
 * Normalise before drawing.
 */
export function pdfText(value: unknown): string {
  return String(value ?? '')
    .replace(/[   ]/g, ' ')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/[^\x00-\xFF]/g, '?');
}
