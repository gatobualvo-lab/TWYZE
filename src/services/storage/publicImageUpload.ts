import { supabase } from '../../utils/supabase';
import { ImageUploadError, prepareImage, uniqueFileStem } from './imageValidation';

export { ImageUploadError };

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
 *
 * The picture is checked and redrawn first (see imageValidation.ts), so what is stored is always a clean
 * PNG or JPEG whose name and type were chosen here, not taken from the person's file. The bucket also
 * refuses anything that is not a PNG, JPEG or WebP of 5MB or less, whatever the app sends.
 *
 * Every upload gets a fresh unique name instead of overwriting: replacing a file needs an extra read
 * permission on the bucket, and a new URL also sidesteps stale browser/CDN caches.
 */
export async function uploadPublicImage(options: UploadPublicImageOptions): Promise<string> {
  const { bucket, userId, prefix, file, maxDim = 1000, maxBytes = 8 * 1024 * 1024, previousUrl } = options;

  const { blob, ext, type } = await prepareImage(file, { maxBytes, maxDim });
  const path = `${userId}/${prefix.replace(/[^a-z0-9-]/gi, '')}-${uniqueFileStem()}.${ext}`;

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
