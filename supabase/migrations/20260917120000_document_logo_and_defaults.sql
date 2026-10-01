/*
  # Document logo upload + default notes/terms

  ## Why
  business_settings already had a logo_url column, but nothing in the UI
  ever let a user set it, and DocumentPreview never rendered it even when
  present — the feature was half-built. Also adds default_notes/
  default_terms so a document's Notes/Terms & Conditions fields can start
  pre-filled from what the owner set once in Document Settings, instead of
  retyping the same boilerplate on every quotation/invoice/receipt.

  ## Storage
  New PUBLIC bucket `business-assets` for logos specifically (as opposed to
  the existing private `payment-proofs`/`user-files` buckets) — a logo
  needs to render on a document a customer opens without ever being
  authenticated into TrackWyze, which a private bucket can't do without a
  signed URL per view. Objects are keyed `{user_id}/...`, same convention
  as the other buckets.
*/

ALTER TABLE public.business_settings
  ADD COLUMN IF NOT EXISTS default_notes text,
  ADD COLUMN IF NOT EXISTS default_terms text;

INSERT INTO storage.buckets (id, name, public)
VALUES ('business-assets', 'business-assets', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "business-assets insert own" ON storage.objects;
DROP POLICY IF EXISTS "business-assets update own" ON storage.objects;
DROP POLICY IF EXISTS "business-assets delete own" ON storage.objects;

CREATE POLICY "business-assets insert own"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'business-assets' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "business-assets update own"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'business-assets' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'business-assets' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "business-assets delete own"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'business-assets' AND (storage.foldername(name))[1] = auth.uid()::text);
