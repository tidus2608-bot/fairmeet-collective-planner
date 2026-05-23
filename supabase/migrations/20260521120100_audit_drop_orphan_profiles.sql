-- Drop unused public.profiles.
--
-- As of 2026-05-21, the table had 0 rows across 19 auth.users, no
-- auth.users→profiles trigger, and no code path in src/ referenced it.
-- src/pages/Settings.tsx writes display_name to auth.users.user_metadata
-- via supabase.auth.updateUser({ data: { display_name } }) instead.
--
-- CASCADE removes the dependent updated_at trigger and the
-- "Profiles are viewable by everyone" / "Users can insert their own
-- profile" / "Users can update their own profile" RLS policies.

DROP TABLE IF EXISTS public.profiles CASCADE;
