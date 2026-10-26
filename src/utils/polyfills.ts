// Small fills for features that older phones (iPhones before iOS 15.4, older Android
// WebViews) and non-HTTPS test setups do not have. The app creates record IDs with
// crypto.randomUUID() in many places, so a missing one would stop sales being saved.

interface CryptoLike {
  getRandomValues?: (array: Uint8Array) => Uint8Array;
  randomUUID?: () => string;
}

/** Defines crypto.randomUUID() (RFC 4122 version 4) if the browser lacks it. */
export function ensureRandomUUID(cryptoObject: CryptoLike | undefined = globalThis.crypto as CryptoLike | undefined): void {
  if (!cryptoObject || typeof cryptoObject.randomUUID === 'function' || typeof cryptoObject.getRandomValues !== 'function') return;

  cryptoObject.randomUUID = () => {
    const bytes = new Uint8Array(16);
    cryptoObject.getRandomValues!(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
    bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10xx
    const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0'));
    return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex.slice(6, 8).join('')}-${hex.slice(8, 10).join('')}-${hex.slice(10).join('')}`;
  };
}
