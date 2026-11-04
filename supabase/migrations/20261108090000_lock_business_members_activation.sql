/*
  # Make team membership the member's own decision

  ## The problem this fixes
  The business_members INSERT and UPDATE policies only checked
  owner_id = auth.uid(). Any signed-in account could therefore write a row
  with member_id = <someone else's uid> and status = 'active'. That account's
  get_business_owner_id() then resolved to the inviter's business: their own
  records disappeared from view, every new record they entered was stamped
  onto the inviter's business, and they could not remove the row (UPDATE and
  DELETE were owner-only). A second route needed only an email address,
  because the app called claim_pending_invite() automatically on every login.

  ## What changes
  1. Owners may only create invites in their initial state:
     member_id NULL, status 'pending', accepted_at NULL.
  2. A BEFORE UPDATE guard stops client roles changing who a row belongs to
     (owner_id, member_id, invited_email, accepted_at, invited_at) and only
     allows status to move to 'revoked'. Owners can still edit permissions,
     restrict_to_own_records and hide_financial_details, and revoke.
     SECURITY DEFINER functions below run as the function owner, not as
     'authenticated', so they are not blocked by the guard.
  3. claim_pending_invite() (no arguments, auto-called) is removed. It is
     replaced by an explicit accept of one named invite, which also requires
     the caller's email to be confirmed and refuses a second active
     membership.
  4. The invitee can list and decline their own pending invites, and an
     active member can leave a business.

  ## Not changed here
  Rows that are already 'active' are left as they are. An operator who wants
  to check for rows created through the old hole can compare accepted_at with
  invited_at and with the member's own activity.
*/

-- 1. Invites can only be created pending and unclaimed ---------------------
DROP POLICY IF EXISTS "business_members_insert" ON public.business_members;
CREATE POLICY "business_members_insert" ON public.business_members FOR INSERT TO authenticated
  WITH CHECK (
    owner_id = auth.uid()
    AND member_id IS NULL
    AND status = 'pending'
    AND accepted_at IS NULL
  );

-- 2. Client roles cannot change membership identity or activate a row ------
CREATE OR REPLACE FUNCTION private.guard_business_members_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon') THEN
    IF NEW.owner_id      IS DISTINCT FROM OLD.owner_id
       OR NEW.member_id     IS DISTINCT FROM OLD.member_id
       OR NEW.invited_email IS DISTINCT FROM OLD.invited_email
       OR NEW.accepted_at   IS DISTINCT FROM OLD.accepted_at
       OR NEW.invited_at    IS DISTINCT FROM OLD.invited_at
       OR (NEW.status IS DISTINCT FROM OLD.status AND NEW.status <> 'revoked') THEN
      RAISE EXCEPTION 'Only the invited person can accept a team invite'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_business_members_update ON public.business_members;
CREATE TRIGGER trg_guard_business_members_update
  BEFORE UPDATE ON public.business_members
  FOR EACH ROW EXECUTE FUNCTION private.guard_business_members_update();

-- 3. Explicit, verified accept replaces the automatic claim -----------------
DROP FUNCTION IF EXISTS public.claim_pending_invite();

CREATE OR REPLACE FUNCTION public.accept_team_invite(p_invite_id uuid)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_email text;
  v_owner_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_signed_in' USING ERRCODE = '42501';
  END IF;

  SELECT email INTO v_email
  FROM auth.users
  WHERE id = auth.uid() AND email_confirmed_at IS NOT NULL;
  IF v_email IS NULL THEN
    RAISE EXCEPTION 'email_not_confirmed' USING ERRCODE = '42501';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.business_members
    WHERE member_id = auth.uid() AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'already_member' USING ERRCODE = '42501';
  END IF;

  UPDATE public.business_members
  SET member_id = auth.uid(), status = 'active', accepted_at = now()
  WHERE id = p_invite_id
    AND lower(invited_email) = lower(v_email)
    AND status = 'pending'
    AND member_id IS NULL
    AND owner_id <> auth.uid()
  RETURNING owner_id INTO v_owner_id;

  IF v_owner_id IS NULL THEN
    RAISE EXCEPTION 'invite_not_found' USING ERRCODE = 'P0002';
  END IF;
  RETURN v_owner_id;
END;
$$;
REVOKE ALL ON FUNCTION public.accept_team_invite(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_team_invite(uuid) TO authenticated;

-- 4a. The invitee can see their own pending invites (they cannot SELECT the
--     rows directly, because member_id is still NULL).
CREATE OR REPLACE FUNCTION public.list_my_team_invites()
RETURNS TABLE (id uuid, business_name text, permissions text[], invited_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT bm.id,
         COALESCE(NULLIF(bs.business_name, ''), NULLIF(p.full_name, ''), 'A TrackWyze business') AS business_name,
         bm.permissions,
         bm.invited_at
  FROM public.business_members bm
  JOIN auth.users u ON u.id = auth.uid() AND u.email_confirmed_at IS NOT NULL
  LEFT JOIN public.business_settings bs ON bs.user_id = bm.owner_id
  LEFT JOIN public.profiles p ON p.id = bm.owner_id
  WHERE lower(bm.invited_email) = lower(u.email)
    AND bm.status = 'pending'
    AND bm.member_id IS NULL
    AND bm.owner_id <> auth.uid()
  ORDER BY bm.invited_at DESC;
$$;
REVOKE ALL ON FUNCTION public.list_my_team_invites() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_my_team_invites() TO authenticated;

-- 4b. Decline one of your own pending invites.
CREATE OR REPLACE FUNCTION public.decline_team_invite(p_invite_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_email text;
BEGIN
  SELECT email INTO v_email FROM auth.users WHERE id = auth.uid() AND email_confirmed_at IS NOT NULL;
  IF v_email IS NULL THEN
    RAISE EXCEPTION 'email_not_confirmed' USING ERRCODE = '42501';
  END IF;

  UPDATE public.business_members
  SET status = 'revoked'
  WHERE id = p_invite_id
    AND lower(invited_email) = lower(v_email)
    AND status = 'pending'
    AND member_id IS NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.decline_team_invite(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.decline_team_invite(uuid) TO authenticated;

-- 4c. An active member can leave the business they work for.
CREATE OR REPLACE FUNCTION public.leave_business()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public.business_members
  SET status = 'revoked'
  WHERE member_id = auth.uid() AND status = 'active';
END;
$$;
REVOKE ALL ON FUNCTION public.leave_business() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.leave_business() TO authenticated;
