CREATE TABLE public.user_preferences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  categories TEXT[] NOT NULL DEFAULT ARRAY['Food','Coffee','Drinks','Park']::text[],
  min_rating NUMERIC NOT NULL DEFAULT 0,
  max_travel_minutes INTEGER NOT NULL DEFAULT 60,
  price_levels INTEGER[] NOT NULL DEFAULT ARRAY[0,1,2,3,4]::int[],
  keyword TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View own prefs" ON public.user_preferences
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Insert own prefs" ON public.user_preferences
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Update own prefs" ON public.user_preferences
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Delete own prefs" ON public.user_preferences
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_user_preferences_updated_at
BEFORE UPDATE ON public.user_preferences
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();