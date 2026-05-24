-- Add preference columns to participants for the PreferencesTab
ALTER TABLE public.participants
  ADD COLUMN IF NOT EXISTS max_travel_time int DEFAULT 60,
  ADD COLUMN IF NOT EXISTS fairness_importance float DEFAULT 0.5,
  ADD COLUMN IF NOT EXISTS venue_types text[] DEFAULT '{}';
