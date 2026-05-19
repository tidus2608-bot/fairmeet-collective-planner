-- Fix participants RLS: guests hitting 403 when joining via invite code.
--
-- Root cause: the previous migration tightened the INSERT policy to
-- "Organizer can add self" (requiring organizer status) but the
-- join_meetup_by_code SECURITY DEFINER function was relying solely on
-- bypassing RLS. Any direct POST to /rest/v1/participants by a non-
-- organizer (including old cached frontend code) gets a 403.
--
-- Fix:
-- 1. Add a permissive INSERT policy that allows authenticated users to
--    add themselves to any meetup (auth.uid() = user_id). Invite-code
--    validation is the application layer's responsibility (enforced by
--    join_meetup_by_code). The RLS layer only guards identity.
-- 2. Revoke anon/public execute on join_meetup_by_code and
--    is_meetup_participant (security advisors flagged these).
-- 3. Harden join_meetup_by_code with an explicit auth guard.

-- 1. Add the permissive self-join INSERT policy
DROP POLICY IF EXISTS "Users can join" ON public.participants;
DROP POLICY IF EXISTS "Authenticated users can join" ON public.participants;

CREATE POLICY "Authenticated users can join" ON public.participants
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- "Organizer can add self" handled this before — it's now superseded by
-- the broader policy above, so drop it to avoid redundancy.
DROP POLICY IF EXISTS "Organizer can add self" ON public.participants;

-- 2. Revoke anon/public access to SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.join_meetup_by_code(text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.join_meetup_by_code(text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.join_meetup_by_code(text, text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.is_meetup_participant(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_meetup_participant(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.is_meetup_participant(uuid, uuid) TO authenticated;

-- 3. Harden join_meetup_by_code with an explicit auth guard
CREATE OR REPLACE FUNCTION public.join_meetup_by_code(_code text, _name text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _meetup_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT id INTO _meetup_id FROM public.meetups
  WHERE invite_code = upper(trim(_code));

  IF _meetup_id IS NULL THEN
    RAISE EXCEPTION 'Invalid invite code';
  END IF;

  INSERT INTO public.participants (meetup_id, user_id, user_name)
  VALUES (_meetup_id, auth.uid(), _name)
  ON CONFLICT (meetup_id, user_id) DO NOTHING;

  RETURN _meetup_id;
END;
$$;
