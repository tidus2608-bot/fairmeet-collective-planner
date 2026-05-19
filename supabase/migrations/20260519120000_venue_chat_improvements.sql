-- ===== Venues: richer detail columns =====
ALTER TABLE public.venue_suggestions
  ADD COLUMN IF NOT EXISTS photo_reference TEXT,
  ADD COLUMN IF NOT EXISTS price_level INTEGER,
  ADD COLUMN IF NOT EXISTS website TEXT,
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS opening_hours JSONB,
  ADD COLUMN IF NOT EXISTS google_place_id TEXT,
  ADD COLUMN IF NOT EXISTS worst_minutes INTEGER,
  ADD COLUMN IF NOT EXISTS added_by UUID;

-- Allow participants to remove venue suggestions (no DELETE policy existed)
CREATE POLICY "Delete venues" ON public.venue_suggestions
  FOR DELETE USING (public.is_meetup_participant(auth.uid(), meetup_id));

-- ===== Chat: message reactions =====
CREATE TABLE public.message_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.chat_messages(id) ON DELETE CASCADE,
  meetup_id UUID NOT NULL REFERENCES public.meetups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  emoji TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(message_id, user_id, emoji)
);
ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View reactions" ON public.message_reactions
  FOR SELECT USING (public.is_meetup_participant(auth.uid(), meetup_id));
CREATE POLICY "Add reaction" ON public.message_reactions
  FOR INSERT WITH CHECK (auth.uid() = user_id AND public.is_meetup_participant(auth.uid(), meetup_id));
CREATE POLICY "Remove reaction" ON public.message_reactions
  FOR DELETE USING (auth.uid() = user_id);

ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reactions;
