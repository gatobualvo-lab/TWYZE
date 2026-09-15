// Kenyan phone numbers get entered in a mix of formats (0712345678,
// +254712345678, 254712345678, with spaces/dashes). wa.me links need a
// bare country-code-prefixed number with no punctuation, so normalize
// before building the link rather than trusting whatever was typed.
export function normalizeKenyanPhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return null;
  if (digits.startsWith('254')) return digits;
  if (digits.startsWith('0')) return `254${digits.slice(1)}`;
  if (digits.length === 9) return `254${digits}`;
  return digits;
}

export function buildWhatsAppLink(phone: string, message: string): string | null {
  const normalized = normalizeKenyanPhone(phone);
  if (!normalized || normalized.length < 11) return null;
  return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;
}
