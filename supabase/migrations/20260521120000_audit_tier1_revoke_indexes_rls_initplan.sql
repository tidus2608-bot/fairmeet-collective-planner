-- Apply via: drop into supabase/migrations/ and run `supabase db push`,
-- or (as already done) via Supabase MCP apply_migration on project
-- ntdxzuochwwrdezfrwuq.

-- ===== Tier 1.1: REVOKE EXECUTE on rls_auto_enable from external roles =====
-- rls_auto_enable() is an event-trigger function and should not be RPC-callable.
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM anon;
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM authenticated;

-- ===== Tier 1.2: Add 4 missing FK indexes =====
CREATE INDEX IF NOT EXISTS idx_chat_messages_meetup_id      ON public.chat_messages(meetup_id);
CREATE INDEX IF NOT EXISTS idx_message_reactions_meetup_id  ON public.message_reactions(meetup_id);
CREATE INDEX IF NOT EXISTS idx_poll_votes_venue_id          ON public.poll_votes(venue_id);
CREATE INDEX IF NOT EXISTS idx_venue_suggestions_meetup_id  ON public.venue_suggestions(meetup_id);

-- ===== Tier 1.3: Wrap auth.uid() calls in (SELECT ...) for initplan =====
-- Behavior-preserving optimization recommended by Supabase advisor
-- (auth_rls_initplan). Postgres now evaluates auth.uid() once per query
-- instead of once per row.

-- chat_messages
ALTER POLICY "Send messages" ON public.chat_messages
  WITH CHECK (((select auth.uid()) = user_id)
              AND is_meetup_participant((select auth.uid()), meetup_id));
ALTER POLICY "View messages" ON public.chat_messages
  USING (is_meetup_participant((select auth.uid()), meetup_id));

-- meetups
ALTER POLICY "Auth users can create meetups" ON public.meetups
  WITH CHECK ((select auth.uid()) = organizer_id);
ALTER POLICY "Organizer can delete meetup" ON public.meetups
  USING ((select auth.uid()) = organizer_id);
ALTER POLICY "Organizer can update meetup" ON public.meetups
  USING ((select auth.uid()) = organizer_id);
ALTER POLICY "Organizer can view own meetup" ON public.meetups
  USING ((select auth.uid()) = organizer_id);
ALTER POLICY "Participants can view meetups" ON public.meetups
  USING (is_meetup_participant((select auth.uid()), id));

-- message_reactions
ALTER POLICY "Add reaction" ON public.message_reactions
  WITH CHECK (((select auth.uid()) = user_id)
              AND is_meetup_participant((select auth.uid()), meetup_id));
ALTER POLICY "Remove reaction" ON public.message_reactions
  USING ((select auth.uid()) = user_id);
ALTER POLICY "View reactions" ON public.message_reactions
  USING (is_meetup_participant((select auth.uid()), meetup_id));

-- participants
ALTER POLICY "Organizer can add self" ON public.participants
  WITH CHECK (((select auth.uid()) = user_id)
              AND EXISTS (
                SELECT 1 FROM public.meetups m
                WHERE m.id = participants.meetup_id
                  AND m.organizer_id = (select auth.uid())
              ));
ALTER POLICY "Users can leave" ON public.participants
  USING ((select auth.uid()) = user_id);
ALTER POLICY "Users can update own" ON public.participants
  USING ((select auth.uid()) = user_id);
ALTER POLICY "View co-participants" ON public.participants
  USING (is_meetup_participant((select auth.uid()), meetup_id));

-- poll_votes
ALTER POLICY "Cast vote" ON public.poll_votes
  WITH CHECK (((select auth.uid()) = user_id)
              AND is_meetup_participant((select auth.uid()), meetup_id));
ALTER POLICY "Change vote" ON public.poll_votes
  USING ((select auth.uid()) = user_id);
ALTER POLICY "Remove vote" ON public.poll_votes
  USING ((select auth.uid()) = user_id);
ALTER POLICY "View votes" ON public.poll_votes
  USING (is_meetup_participant((select auth.uid()), meetup_id));

-- user_preferences
ALTER POLICY "Delete own prefs" ON public.user_preferences
  USING ((select auth.uid()) = user_id);
ALTER POLICY "Insert own prefs" ON public.user_preferences
  WITH CHECK ((select auth.uid()) = user_id);
ALTER POLICY "Update own prefs" ON public.user_preferences
  USING ((select auth.uid()) = user_id);
ALTER POLICY "View own prefs" ON public.user_preferences
  USING ((select auth.uid()) = user_id);

-- venue_suggestions
ALTER POLICY "Add venues" ON public.venue_suggestions
  WITH CHECK (is_meetup_participant((select auth.uid()), meetup_id));
ALTER POLICY "Delete venues" ON public.venue_suggestions
  USING (is_meetup_participant((select auth.uid()), meetup_id));
ALTER POLICY "Update venues" ON public.venue_suggestions
  USING (is_meetup_participant((select auth.uid()), meetup_id));
ALTER POLICY "View venues" ON public.venue_suggestions
  USING (is_meetup_participant((select auth.uid()), meetup_id));
