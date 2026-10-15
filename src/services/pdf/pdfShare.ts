import React from 'react';
import toast from 'react-hot-toast';
import { buildWhatsAppLink } from '../../utils/whatsapp';

export function pdfFilename(base: string): string {
  const cleaned = base.replace(/[^\w.-]+/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
  return `${cleaned || 'document'}.pdf`;
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

export interface SharePdfOptions {
  blob: Blob;
  filename: string;
  title: string;
  /** Short caption sent along with the file. */
  text?: string;
  /** Customer phone — only used by the desktop fallback to open the right chat. */
  phone?: string | null;
}

export type SharePdfResult = 'shared' | 'downloaded' | 'cancelled';

function canShareFile(file: File): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] });
}

/**
 * Sends the PDF as an actual file. On phones the system share sheet lists
 * WhatsApp, which then receives a document rather than pasted text. Where
 * file sharing isn't available (most desktop browsers, the Electron app) the
 * PDF is downloaded and WhatsApp is opened so it can be attached.
 */
export async function sharePdf(options: SharePdfOptions): Promise<SharePdfResult> {
  const { blob, filename, title, text, phone } = options;
  const file = new File([blob], filename, { type: 'application/pdf' });

  if (canShareFile(file)) {
    try {
      await navigator.share({ files: [file], title, text });
      return 'shared';
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled';
      if (error instanceof DOMException && error.name === 'NotAllowedError') {
        // Building the PDF took long enough that the browser no longer treats
        // this as a direct tap (strict on iPhone). Offer a fresh tap instead.
        toast.custom(
          (t) =>
            React.createElement(
              'div',
              { className: 'bg-white rounded-lg shadow-lg border border-gray-200 px-4 py-3 flex items-center gap-3' },
              React.createElement('span', { className: 'text-sm text-gray-800' }, 'PDF ready'),
              React.createElement(
                'button',
                {
                  className: 'text-sm font-medium text-green-600',
                  onClick: () => {
                    toast.dismiss(t.id);
                    navigator.share({ files: [file], title, text }).catch(() => {});
                  },
                },
                'Tap to share'
              )
            ),
          { duration: 15000 }
        );
        return 'shared';
      }
      // Any other share failure: fall through to the download path below.
    }
  }

  downloadBlob(blob, filename);
  const caption = text || title;
  const link = (phone && buildWhatsAppLink(phone, caption)) || `https://wa.me/?text=${encodeURIComponent(caption)}`;
  window.open(link, '_blank');
  toast.success('PDF downloaded — attach it in WhatsApp');
  return 'downloaded';
}
