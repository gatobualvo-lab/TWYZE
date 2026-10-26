import { supabase } from '../../utils/supabase';

export interface ScannedReceipt {
  isReceipt: boolean;
  vendor: string;
  /** YYYY-MM-DD, or empty when the date wasn't visible. */
  date: string;
  total: number;
  currency: string;
  expenseType: string;
  items: string[];
}

export class ReceiptScanError extends Error {}

const MAX_DIM = 1600;

/** Phone photos are huge; a 1600px JPEG is plenty for reading a receipt and keeps the upload small. */
export async function toJpegBase64(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new ReceiptScanError('That file could not be read as an image'));
      el.src = url;
    });
    const ratio = Math.min(1, MAX_DIM / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.naturalWidth * ratio);
    canvas.height = Math.round(img.naturalHeight * ratio);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new ReceiptScanError('Could not process the image');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.82).split(',')[1];
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function readErrorCode(error: unknown): Promise<{ status?: number; code?: string }> {
  const context = (error as { context?: Response })?.context;
  if (!context || typeof context.json !== 'function') return {};
  try {
    const body = await context.json();
    return { status: context.status, code: body?.error };
  } catch {
    return { status: context.status };
  }
}

export async function scanReceiptImage(file: File): Promise<ScannedReceipt> {
  if (!file.type.startsWith('image/')) throw new ReceiptScanError('Please choose a photo of the receipt');
  const image = await toJpegBase64(file);

  const { data, error } = await supabase.functions.invoke('scan-receipt', {
    body: { image, mediaType: 'image/jpeg' },
  });

  if (error) {
    // A function that isn't deployed yet fails at the network level (the
    // gateway's 404 carries no CORS headers), so it surfaces as a fetch error.
    if ((error as { name?: string }).name === 'FunctionsFetchError') {
      throw new ReceiptScanError(
        typeof navigator !== 'undefined' && navigator.onLine === false
          ? "You're offline. Receipt scanning needs a connection"
          : 'Receipt scanning is not available yet'
      );
    }
    const { status, code } = await readErrorCode(error);
    if (status === 404) throw new ReceiptScanError('Receipt scanning is not set up yet');
    if (code === 'rate_limited' || status === 429) throw new ReceiptScanError('Too many scans for now — try again in a while');
    if (code === 'subscription_required') throw new ReceiptScanError('Receipt scanning needs an active plan or trial');
    if (code === 'not_configured') throw new ReceiptScanError('Receipt scanning is not set up yet');
    throw new ReceiptScanError('Could not read the receipt. Please try again');
  }
  return data as ScannedReceipt;
}
