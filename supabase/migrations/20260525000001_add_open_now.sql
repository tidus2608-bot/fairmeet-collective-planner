ALTER TABLE public.user_preferences
  ADD COLUMN IF NOT EXISTS open_now BOOLEAN NOT NULL DEFAULT false;
