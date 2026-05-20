-- Live updates for the whole meetup, not just chat.
-- Without these, a venue search / vote / join only appears for the person who
-- triggered it; other participants see a stale page until they reload.

-- REPLICA IDENTITY FULL so postgres_changes DELETE/UPDATE events carry the
-- meetup_id needed for client-side row filtering.
ALTER TABLE public.venue_suggestions REPLICA IDENTITY FULL;
ALTER TABLE public.participants REPLICA IDENTITY FULL;
ALTER TABLE public.poll_votes REPLICA IDENTITY FULL;
ALTER TABLE public.meetups REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'venue_suggestions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.venue_suggestions;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'participants'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.participants;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'poll_votes'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.poll_votes;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'meetups'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.meetups;
  END IF;
END $$;
