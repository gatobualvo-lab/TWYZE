// Loads Flutterwave's official Inline.js checkout script on demand and
// wraps window.FlutterwaveCheckout with types. Deliberately dependency-free:
// the npm wrapper (flutterwave-react-v3) pulls in an ancient, vulnerable
// axios (SSRF / prototype-pollution CVEs) it doesn't even need for this —
// the vanilla script tag is what Flutterwave's own docs recommend and is a
// fraction of the dependency surface.

const SCRIPT_SRC = 'https://checkout.flutterwave.com/v3.js';

let scriptLoadPromise: Promise<void> | null = null;

function loadScript(): Promise<void> {
  if (scriptLoadPromise) return scriptLoadPromise;
  scriptLoadPromise = new Promise((resolve, reject) => {
    if (window.FlutterwaveCheckout) {
      resolve();
      return;
    }
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_SRC}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('Failed to load Flutterwave checkout script')));
      return;
    }
    const script = document.createElement('script');
    script.src = SCRIPT_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Flutterwave checkout script'));
    document.head.appendChild(script);
  });
  return scriptLoadPromise;
}

export interface FlutterwaveCallbackResponse {
  status: string;
  transaction_id?: number | string;
  tx_ref: string;
}

export interface FlutterwaveCheckoutOptions {
  publicKey: string;
  txRef: string;
  amount: number;
  currency: string;
  paymentOptions: 'mpesa' | 'card';
  customer: { email: string; name?: string; phone?: string };
  title: string;
  description: string;
  onComplete: (response: FlutterwaveCallbackResponse) => void;
  onClose: () => void;
}

export async function openFlutterwaveCheckout(options: FlutterwaveCheckoutOptions): Promise<void> {
  await loadScript();
  if (!window.FlutterwaveCheckout) {
    throw new Error('Flutterwave checkout script failed to initialize');
  }

  window.FlutterwaveCheckout({
    public_key: options.publicKey,
    tx_ref: options.txRef,
    amount: options.amount,
    currency: options.currency,
    payment_options: options.paymentOptions,
    customer: options.customer,
    customizations: {
      title: options.title,
      description: options.description,
    },
    callback: (response: FlutterwaveCallbackResponse) => {
      options.onComplete(response);
    },
    onclose: () => {
      options.onClose();
    },
  });
}

declare global {
  interface Window {
    FlutterwaveCheckout?: (config: Record<string, unknown>) => void;
  }
}
