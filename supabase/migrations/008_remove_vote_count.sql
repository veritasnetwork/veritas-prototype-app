-- Remove the opinion_total_votes column since we're not using vote counts anymore
-- Also remove opinion_question since questions are now in the main content

ALTER TABLE posts DROP COLUMN IF EXISTS opinion_total_votes;
ALTER TABLE posts DROP COLUMN IF EXISTS opinion_question;