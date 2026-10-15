/*
  # Product images, service items, and storage fixes

  ## 1. Product images (optional)
  inventory_items.image_url / user_products.image_url hold a public URL for an
  optional product photo, stored in a new public `product-images` bucket
  (objects keyed `{user_id}/...`, same convention as the other buckets).

  ## 2. Services in inventory
  inventory_items.item_type / user_products.item_type: 'goods' (default,
  tracked stock) or 'service' (no stock, never counted as low stock).

  ## 3. Storage fixes
  - business-assets had no SELECT policy. Replacing/removing an existing file
    needs one, so logo uploads that overwrite (upsert) failed with "new row
    violates row-level security policy". Adds the missing SELECT policy.
  - Both image buckets now enforce size and type limits server-side (PNG, JPEG
    or WebP, 5MB) instead of relying on the browser's checks; this also blocks
    SVG uploads to a public bucket.
*/

-- 1 + 2. columns ---------------------------------------------------------------

ALTER TABLE public.inventory_items
  ADD COLUMN IF NOT EXISTS image_url text,
  ADD COLUMN IF NOT EXISTS item_type text NOT NULL DEFAULT 'goods';

ALTER TABLE public.inventory_items DROP CONSTRAINT IF EXISTS inventory_items_item_type_chk;
ALTER TABLE public.inventory_items
  ADD CONSTRAINT inventory_items_item_type_chk CHECK (item_type IN ('goods', 'service'));

ALTER TABLE public.user_products
  ADD COLUMN IF NOT EXISTS image_url text,
  ADD COLUMN IF NOT EXISTS item_type text NOT NULL DEFAULT 'goods';

ALTER TABLE public.user_products DROP CONSTRAINT IF EXISTS user_products_item_type_chk;
ALTER TABLE public.user_products
  ADD CONSTRAINT user_products_item_type_chk CHECK (item_type IN ('goods', 'service'));

-- 3. storage ---------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('product-images', 'product-images', true, 5242880, ARRAY['image/png', 'image/jpeg', 'image/webp'])
ON CONFLICT (id) DO UPDATE
  SET public = true,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

UPDATE storage.buckets
SET file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/webp']
WHERE id = 'business-assets';

DROP POLICY IF EXISTS "business-assets select own" ON storage.objects;
CREATE POLICY "business-assets select own"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'business-assets' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "product-images select own" ON storage.objects;
DROP POLICY IF EXISTS "product-images insert own" ON storage.objects;
DROP POLICY IF EXISTS "product-images update own" ON storage.objects;
DROP POLICY IF EXISTS "product-images delete own" ON storage.objects;

CREATE POLICY "product-images select own"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'product-images' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "product-images insert own"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'product-images' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "product-images update own"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'product-images' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'product-images' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "product-images delete own"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'product-images' AND (storage.foldername(name))[1] = auth.uid()::text);

-- 4. per-document currency ---------------------------------------------------------
-- Amounts on a document stay stored in KES so every report keeps adding up.
-- `currency` is what the customer sees; `exchange_rate` is KES per 1 unit of
-- that currency (e.g. USD at 129.5), used to convert for display and PDFs.

ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'KES',
  ADD COLUMN IF NOT EXISTS exchange_rate numeric NOT NULL DEFAULT 1;

ALTER TABLE public.documents DROP CONSTRAINT IF EXISTS documents_currency_chk;
ALTER TABLE public.documents
  ADD CONSTRAINT documents_currency_chk CHECK (currency ~ '^[A-Z]{3}$');

ALTER TABLE public.documents DROP CONSTRAINT IF EXISTS documents_exchange_rate_chk;
ALTER TABLE public.documents
  ADD CONSTRAINT documents_exchange_rate_chk CHECK (exchange_rate > 0);
