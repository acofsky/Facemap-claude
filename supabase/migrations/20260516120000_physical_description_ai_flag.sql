-- Track whether a person's physical_description was AI-generated.
-- The AIBadge on the profile page hangs off this flag so it only shows
-- next to descriptions Membr actually generated, not ones the user typed.
--
-- Defaults FALSE for existing rows — we can't retroactively know what was
-- AI-generated before this column existed, and false is the conservative
-- pick (no badge unless we know for sure).
ALTER TABLE public.persons
  ADD COLUMN IF NOT EXISTS physical_description_ai_generated BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.persons.physical_description_ai_generated IS
  'True when physical_description came from describe-from-photo and the user has not edited it since.';

NOTIFY pgrst, 'reload schema';
