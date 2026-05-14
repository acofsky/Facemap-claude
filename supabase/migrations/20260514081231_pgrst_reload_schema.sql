-- PostgREST keeps an in-process schema cache that doesn't always pick up
-- newly added tables / columns from a prior migration in the same deploy
-- session. The fix is a NOTIFY that tells the PostgREST instance to reload.
--
-- Symptoms before this migration ran:
--   * "Could not find the 'tone' column of 'circles' in the schema cache"
--   * "Could not find the table 'public.events' in the schema cache"
-- Both came from the M2 Phase C migration succeeding at the DB level but
-- the API tier not reloading until prompted.
NOTIFY pgrst, 'reload schema';
