-- Remove the "Park" venue category from user preferences.
-- Update the column default and strip 'Park' from any existing saved rows.
ALTER TABLE public.user_preferences
  ALTER COLUMN categories SET DEFAULT ARRAY['Food','Coffee','Drinks']::text[];

UPDATE public.user_preferences
SET categories = array_remove(categories, 'Park')
WHERE 'Park' = ANY(categories);
