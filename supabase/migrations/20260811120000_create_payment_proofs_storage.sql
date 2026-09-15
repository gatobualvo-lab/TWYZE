/*
  # Payment proof screenshots storage

  Users submit payment proof (M-Pesa/bank screenshots) from the new
  /payment-management page. There was previously no bucket for this —
  `user-files` exists but its policies only let the owner read their own
  objects, which would block admins from viewing submitted proof in the
  Payment Approvals panel.

  1. New private bucket `payment-proofs`, objects keyed as `{user_id}/...`.
  2. RLS: a user can insert/read only inside their own folder; admins
     (private.is_admin) can read every object, matching how they can
     already read every payment_submissions row.
*/

INSERT INTO storage.buckets (id, name, public)
VALUES ('payment-proofs', 'payment-proofs', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "payment-proofs insert own" ON storage.objects;
DROP POLICY IF EXISTS "payment-proofs read own or admin" ON storage.objects;

CREATE POLICY "payment-proofs insert own"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'payment-proofs' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "payment-proofs read own or admin"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'payment-proofs'
    AND ((storage.foldername(name))[1] = auth.uid()::text OR private.is_admin(auth.uid()))
  );
