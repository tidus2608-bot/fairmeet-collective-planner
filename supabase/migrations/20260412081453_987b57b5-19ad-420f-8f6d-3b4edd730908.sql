
-- Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);

-- Meetups table
CREATE TABLE public.meetups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  organizer_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'Planning',
  invite_code TEXT NOT NULL UNIQUE DEFAULT upper(substr(md5(random()::text), 1, 6)),
  final_venue JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.meetups ENABLE ROW LEVEL SECURITY;

-- Participants table (created BEFORE the helper function)
CREATE TABLE public.participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meetup_id UUID NOT NULL REFERENCES public.meetups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  user_name TEXT NOT NULL,
  avatar_url TEXT,
  location JSONB,
  address TEXT,
  transport_mode TEXT NOT NULL DEFAULT 'driving',
  status TEXT NOT NULL DEFAULT 'awaiting',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(meetup_id, user_id)
);
ALTER TABLE public.participants ENABLE ROW LEVEL SECURITY;

-- Venue suggestions
CREATE TABLE public.venue_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meetup_id UUID NOT NULL REFERENCES public.meetups(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Food',
  rating NUMERIC NOT NULL DEFAULT 0,
  address TEXT NOT NULL,
  location JSONB NOT NULL,
  travel_times JSONB,
  ai_theme TEXT,
  in_poll BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.venue_suggestions ENABLE ROW LEVEL SECURITY;

-- Poll votes
CREATE TABLE public.poll_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meetup_id UUID NOT NULL REFERENCES public.meetups(id) ON DELETE CASCADE,
  venue_id UUID NOT NULL REFERENCES public.venue_suggestions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(meetup_id, user_id)
);
ALTER TABLE public.poll_votes ENABLE ROW LEVEL SECURITY;

-- Chat messages
CREATE TABLE public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meetup_id UUID NOT NULL REFERENCES public.meetups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  user_name TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Helper function (now participants table exists)
CREATE OR REPLACE FUNCTION public.is_meetup_participant(_user_id UUID, _meetup_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.participants WHERE user_id = _user_id AND meetup_id = _meetup_id
  )
$$;

-- Meetup RLS policies
CREATE POLICY "Participants can view meetups" ON public.meetups FOR SELECT USING (public.is_meetup_participant(auth.uid(), id));
CREATE POLICY "Organizer can update meetup" ON public.meetups FOR UPDATE USING (auth.uid() = organizer_id);
CREATE POLICY "Organizer can delete meetup" ON public.meetups FOR DELETE USING (auth.uid() = organizer_id);
CREATE POLICY "Auth users can create meetups" ON public.meetups FOR INSERT WITH CHECK (auth.uid() = organizer_id);

-- Participants RLS
CREATE POLICY "View co-participants" ON public.participants FOR SELECT USING (public.is_meetup_participant(auth.uid(), meetup_id));
CREATE POLICY "Users can join" ON public.participants FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own" ON public.participants FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can leave" ON public.participants FOR DELETE USING (auth.uid() = user_id);

-- Venue RLS
CREATE POLICY "View venues" ON public.venue_suggestions FOR SELECT USING (public.is_meetup_participant(auth.uid(), meetup_id));
CREATE POLICY "Add venues" ON public.venue_suggestions FOR INSERT WITH CHECK (public.is_meetup_participant(auth.uid(), meetup_id));
CREATE POLICY "Update venues" ON public.venue_suggestions FOR UPDATE USING (public.is_meetup_participant(auth.uid(), meetup_id));

-- Poll votes RLS
CREATE POLICY "View votes" ON public.poll_votes FOR SELECT USING (public.is_meetup_participant(auth.uid(), meetup_id));
CREATE POLICY "Cast vote" ON public.poll_votes FOR INSERT WITH CHECK (auth.uid() = user_id AND public.is_meetup_participant(auth.uid(), meetup_id));
CREATE POLICY "Change vote" ON public.poll_votes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Remove vote" ON public.poll_votes FOR DELETE USING (auth.uid() = user_id);

-- Chat RLS
CREATE POLICY "View messages" ON public.chat_messages FOR SELECT USING (public.is_meetup_participant(auth.uid(), meetup_id));
CREATE POLICY "Send messages" ON public.chat_messages FOR INSERT WITH CHECK (auth.uid() = user_id AND public.is_meetup_participant(auth.uid(), meetup_id));

-- Realtime for chat
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_meetups_updated_at BEFORE UPDATE ON public.meetups FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
