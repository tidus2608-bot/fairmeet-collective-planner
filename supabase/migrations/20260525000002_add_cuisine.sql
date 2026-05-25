ALTER TABLE public.user_preferences
  ADD COLUMN IF NOT EXISTS cuisine TEXT NOT NULL DEFAULT '';
