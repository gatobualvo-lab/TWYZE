import { supabase } from '../../utils/supabase';

const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

export class ImageUploadError extends Error {}

function loadImage(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new ImageUploadError('That file could not be read as an image'));
    };
    img.src = url;
  });
}

/**
 * Phone photos are often 3-6MB. Shrinks to maxDim on the longest side, keeping
 * PNG (logos with transparency) as PNG and re-encoding everything else as JPEG.
 */
async function shrink(file: File, maxDim: number): Promise<{ blob: Blob; ext: string; type: string }> {
  const img = await loadImage(file);
  const ratio = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
  const keepPng = file.type === 'image/png';
  if (ratio === 1 && file.size <= 1.5 * 1024 * 1024) {
    return { blob: file, ext: file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg', type: file.type };
  }
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.naturalWidth * ratio);
  canvas.height = Math.round(img.naturalHeight * ratio);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new ImageUploadError('Could not process the image');
  if (!keepPng) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const type = keepPng ? 'image/png' : 'image/jpeg';
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.85));
  if (!blob) throw new ImageUploadError('Could not process the image');
  return { blob, ext: keepPng ? 'png' : 'jpg', type };
}

function pathFromPublicUrl(bucket: string, url: string): string | null {
  const marker = `/storage/v1/object/public/${bucket}/`;
  const i = url.indexOf(marker);
  if (i < 0) return null;
  return decodeURIComponent(url.slice(i + marker.length).split('?')[0]);
}

export interface UploadPublicImageOptions {
  bucket: string;
  userId: string;
  /** File-name prefix, e.g. "logo" or "product". */
  prefix: string;
  file: File;
  maxDim?: number;
  maxBytes?: number;
  /** Previous image URL; its file is removed (best effort) after a successful upload. */
  previousUrl?: string | null;
}

/**
 * Uploads to a public bucket under `{userId}/...` and returns the public URL.
 * Every upload gets a fresh unique name instead of overwriting: replacing a
 * file needs an extra read permission on the bucket, and a new URL also
 * sidesteps stale browser/CDN caches.
 */
export async function uploadPublicImage(options: UploadPublicImageOptions): Promise<string> {
  const { bucket, userId, prefix, file, maxDim = 1000, maxBytes = 8 * 1024 * 1024, previousUrl } = options;

  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new ImageUploadError('Please choose a PNG, JPG or WebP image');
  }
  if (file.size > maxBytes) {
    throw new ImageUploadError(`Image must be under ${Math.round(maxBytes / (1024 * 1024))}MB`);
  }

  const { blob, ext, type } = await shrink(file, maxDim);
  const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const path = `${userId}/${prefix}-${unique}.${ext}`;

  const { error } = await supabase.storage.from(bucket).upload(path, blob, { contentType: type, cacheControl: '31536000' });
  if (error) throw error;

  if (previousUrl) {
    const oldPath = pathFromPublicUrl(bucket, previousUrl);
    if (oldPath && oldPath.startsWith(`${userId}/`) && oldPath !== path) {
      supabase.storage.from(bucket).remove([oldPath]).catch(() => {});
    }
  }

  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}
