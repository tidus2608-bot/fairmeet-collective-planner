-- Change poll_votes from single-choice (one venue per user per meetup)
-- to per-venue thumbs up / thumbs down votes.
--
-- Old constraint: UNIQUE(meetup_id, user_id)  → one venue choice per meetup
-- New constraint: UNIQUE(venue_id, user_id, vote_type) → one up/down per venue per user

ALTER TABLE public.poll_votes
  DROP CONSTRAINT IF EXISTS poll_votes_meetup_id_user_id_key;

ALTER TABLE public.poll_votes
  ADD COLUMN IF NOT EXISTS vote_type text NOT NULL DEFAULT 'up'
    CHECK (vote_type IN ('up', 'down'));

ALTER TABLE public.poll_votes
  DROP CONSTRAINT IF EXISTS poll_votes_participant_venue_type_unique;

ALTER TABLE public.poll_votes
  ADD CONSTRAINT poll_votes_participant_venue_type_unique
    UNIQUE (venue_id, user_id, vote_type);
