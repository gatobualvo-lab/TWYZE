/*
  # Storage: only small, real images, and only under names that end like one

  The app checks every upload before sending it (size, real file type, redrawn as a clean picture, name and
  type chosen by the app). Nothing stops someone calling the storage API directly, though, so the storage
  itself now refuses anything else:

  1. Bucket limits
     - payment-proofs   private   5MB, PNG / JPEG / WebP only (it had no limit at all)
     - user-files       private   10MB, PNG / JPEG / WebP / PDF only (it had no limit at all)
     - product-images and business-assets already have 5MB and PNG / JPEG / WebP; stated again here so every
       bucket's limits are written down in one place.
     A file of another type (a web page, a script, an SVG) is rejected by storage, so it can never be saved
     and then opened from a link.

  2. File names
     A restrictive rule on storage.objects: a file in these buckets can only be created or renamed to a name
     ending in .png, .jpg, .jpeg or .webp (.pdf too in user-files). Restrictive rules are ANDed with the
     existing "only inside your own folder" rules, so those are untouched.

  Files are served from Supabase Storage on its own address, never run on a server, and the types above are
  never run by a browser either.
*/

UPDATE storage.buckets
SET public = false,
    file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/webp']
WHERE id = 'payment-proofs';

UPDATE storage.buckets
SET public = false,
    file_size_limit = 10485760,
    allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/webp', 'application/pdf']
WHERE id = 'user-files';

UPDATE storage.buckets
SET file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/webp']
WHERE id IN ('product-images', 'business-assets');

DROP POLICY IF EXISTS "uploads must be safe image names (insert)" ON storage.objects;
CREATE POLICY "uploads must be safe image names (insert)"
  ON storage.objects AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id NOT IN ('payment-proofs', 'product-images', 'business-assets', 'user-files')
    OR (bucket_id IN ('payment-proofs', 'product-images', 'business-assets') AND lower(name) ~ '\.(png|jpe?g|webp)$')
    OR (bucket_id = 'user-files' AND lower(name) ~ '\.(png|jpe?g|webp|pdf)$')
  );

DROP POLICY IF EXISTS "uploads must be safe image names (update)" ON storage.objects;
CREATE POLICY "uploads must be safe image names (update)"
  ON storage.objects AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (
    bucket_id NOT IN ('payment-proofs', 'product-images', 'business-assets', 'user-files')
    OR (bucket_id IN ('payment-proofs', 'product-images', 'business-assets') AND lower(name) ~ '\.(png|jpe?g|webp)$')
    OR (bucket_id = 'user-files' AND lower(name) ~ '\.(png|jpe?g|webp|pdf)$')
  );
