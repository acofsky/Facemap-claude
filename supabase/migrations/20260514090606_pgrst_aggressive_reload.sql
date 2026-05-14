-- More aggressive PostgREST schema-cache reload. The previous NOTIFY-only
-- migration didn't take effect for the user, suggesting either the deploy
-- didn't re-run after the migration was added, or PostgREST cached a
-- "missing column" lookup more stubbornly than NOTIFY clears.
--
-- This migration:
--   1. Touches the catalog by adding COMMENTs on the new columns/tables.
--      COMMENT statements bump pg_class / pg_attribute and force PostgREST
--      to detect a schema delta on its next reload.
--   2. Emits NOTIFY through two equivalent calls so it survives any
--      Supabase routing oddity.
--
-- After this migration applies, writes to `circles.tone` and reads of
-- `public.events` should succeed without the "schema cache" error.

COMMENT ON COLUMN public.circles.tone IS
  'Named palette key for the v2 tile gradient system. One of: red, blue, purple, green, amber, slate, rose, teal. Default red.';

COMMENT ON TABLE public.events IS
  'Time-bounded scenes (trips, dinners, conferences). M2 Phase C addition. See spec §CIRCLES-01.';

COMMENT ON COLUMN public.events.tone IS
  'Named palette key matching circles.tone.';

COMMENT ON COLUMN public.events.archived_at IS
  'When the event was archived. NULL = active.';

COMMENT ON TABLE public.person_events IS
  'Many-to-many join between persons and events.';

NOTIFY pgrst, 'reload schema';
SELECT pg_notify('pgrst', 'reload schema');
SELECT pg_notify('pgrst', 'reload config');
