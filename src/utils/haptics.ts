// Short vibration cues for Android phones (and anything else that supports the
// Vibration API). Used sparingly: a confirmed sale, a barcode that was read.
// Silently does nothing on iPhone, desktop, or when the browser blocks it.

const PATTERNS = {
  /** A light tick: something was recognised. */
  tap: 12,
  /** Two quick pulses: something important just succeeded. */
  success: [18, 45, 26],
} as const;

export function haptic(kind: keyof typeof PATTERNS): void {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(PATTERNS[kind] as number | number[]);
    }
  } catch {
    // Not available or not allowed right now; the visual feedback still happens.
  }
}
