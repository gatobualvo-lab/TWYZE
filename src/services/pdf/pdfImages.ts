export interface PdfImage {
  dataUrl: string;
  format: 'PNG' | 'JPEG';
  width: number;
  height: number;
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function loadBitmap(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not decode image'));
    img.src = dataUrl;
  });
}

/**
 * Fetches an image (e.g. the business logo) and returns it in a format jsPDF
 * accepts. WebP and other formats are redrawn to PNG through a canvas.
 * Returns null on any failure — a missing logo must never block a receipt.
 */
export async function loadImageForPdf(url: string | null | undefined): Promise<PdfImage | null> {
  if (!url) return null;
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const blob = await response.blob();
    let dataUrl = await blobToDataUrl(blob);
    const img = await loadBitmap(dataUrl);

    let format: 'PNG' | 'JPEG' = blob.type === 'image/jpeg' ? 'JPEG' : 'PNG';
    if (blob.type !== 'image/png' && blob.type !== 'image/jpeg') {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      ctx.drawImage(img, 0, 0);
      dataUrl = canvas.toDataURL('image/png');
      format = 'PNG';
    }
    return { dataUrl, format, width: img.naturalWidth, height: img.naturalHeight };
  } catch {
    return null;
  }
}
