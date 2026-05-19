-- ===== Invite/join flow =====
-- SECURITY DEFINER function lets a non-participant redeem an invite code
-- despite RLS blocking them from reading the meetup directly.
CREATE OR REPLACE FUNCTION public.join_meetup_by_code(_code text, _name text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _meetup_id uuid;
BEGIN
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

GRANT EXECUTE ON FUNCTION public.join_meetup_by_code(text, text) TO authenticated;

-- Tighten the participants INSERT policy. The old "Users can join" policy
-- (WITH CHECK auth.uid() = user_id) let anyone self-add to any meetup by UUID.
-- Direct inserts are now organizer-only (meetup creation); all other joins go
-- through join_meetup_by_code, which bypasses RLS as SECURITY DEFINER.
DROP POLICY IF EXISTS "Users can join" ON public.participants;
CREATE POLICY "Organizer can add self" ON public.participants FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.meetups m
      WHERE m.id = meetup_id AND m.organizer_id = auth.uid()
    )
  );

-- ===== Meetup scheduling =====
ALTER TABLE public.meetups ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ;
