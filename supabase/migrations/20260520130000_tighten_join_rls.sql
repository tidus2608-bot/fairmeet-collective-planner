-- Gate meetup access behind the invite code again.
--
-- Two policies had been loosened so an older direct-insert join flow would
-- work. The app now joins exclusively through join_meetup_by_code (a
-- SECURITY DEFINER RPC that bypasses RLS), so these can be tightened:
--
--   * meetups SELECT was USING (true) — any logged-in user (incl. anonymous
--     guests) could read every meetup, including invite_code, names and
--     final venues. Restrict to participants and the organizer.
--   * participants INSERT allowed any user to self-add to any meetup by UUID.
--     Restrict direct inserts to the organizer (meetup creation); everyone
--     else joins via the RPC.

DROP POLICY IF EXISTS "Authenticated users can read any meetup" ON public.meetups;

DROP POLICY IF EXISTS "Authenticated users can join" ON public.participants;
DROP POLICY IF EXISTS "Users can join" ON public.participants;
DROP POLICY IF EXISTS "Organizer can add self" ON public.participants;

CREATE POLICY "Organizer can add self" ON public.participants FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.meetups m
      WHERE m.id = meetup_id AND m.organizer_id = auth.uid()
    )
  );
