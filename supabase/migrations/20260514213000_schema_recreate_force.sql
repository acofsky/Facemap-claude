-- ROUND 4 of the schema-cache fight. Three earlier migrations (m2c_events,
-- pgrst_reload, pgrst_aggressive_reload) plus a Management-API project
-- restart have all failed to clear "Could not find the 'tone' column of
-- 'circles'" and "Could not find the table 'public.events'" on writes.
--
-- A full project restart *will* rebuild PostgREST's schema cache from the
-- live database. Since that's been done and the error persists, the only
-- coherent explanation is that the DDL never actually ran in the database
-- — most likely because an earlier failed run left the migration row in
-- supabase_migrations.schema_migrations while the DDL rolled back, making
-- subsequent `supabase db push` runs skip the file entirely. The IF NOT
-- EXISTS guards in the original migration then prevent the column/table
-- from being created on retry.
--
-- This migration sidesteps the migration-history machinery by using a DO
-- block with explicit existence checks. It runs every time it's pushed,
-- regardless of what previous runs claim. RAISE NOTICE statements surface
-- the actual database state in the workflow logs so we can confirm.

DO $$
DECLARE
  has_tone_col   boolean;
  has_events_tbl boolean;
  has_pe_tbl     boolean;
BEGIN
  -- ---- Diagnose current state ----
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'circles' AND column_name = 'tone'
  ) INTO has_tone_col;

  SELECT to_regclass('public.events')        IS NOT NULL INTO has_events_tbl;
  SELECT to_regclass('public.person_events') IS NOT NULL INTO has_pe_tbl;

  RAISE NOTICE 'BEFORE: circles.tone exists = %, public.events exists = %, public.person_events exists = %',
    has_tone_col, has_events_tbl, has_pe_tbl;

  -- ---- circles.tone: add if missing ----
  IF NOT has_tone_col THEN
    EXECUTE 'ALTER TABLE public.circles ADD COLUMN tone TEXT NOT NULL DEFAULT ''red''';
    RAISE NOTICE 'Added circles.tone';
  END IF;

  -- ---- events table: create if missing ----
  IF NOT has_events_tbl THEN
    EXECUTE $ddl$
      CREATE TABLE public.events (
        id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
        user_id UUID NOT NULL,
        name TEXT NOT NULL,
        tone TEXT NOT NULL DEFAULT 'red',
        start_date DATE,
        end_date DATE,
        archived_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
      )
    $ddl$;
    EXECUTE 'ALTER TABLE public.events ENABLE ROW LEVEL SECURITY';
    EXECUTE $p$CREATE POLICY "Users can view own events"   ON public.events FOR SELECT TO authenticated USING (auth.uid() = user_id)$p$;
    EXECUTE $p$CREATE POLICY "Users can insert own events" ON public.events FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id)$p$;
    EXECUTE $p$CREATE POLICY "Users can update own events" ON public.events FOR UPDATE TO authenticated USING (auth.uid() = user_id)$p$;
    EXECUTE $p$CREATE POLICY "Users can delete own events" ON public.events FOR DELETE TO authenticated USING (auth.uid() = user_id)$p$;
    EXECUTE 'CREATE INDEX idx_events_user     ON public.events(user_id)';
    EXECUTE 'CREATE INDEX idx_events_archived ON public.events(user_id, archived_at)';
    EXECUTE 'CREATE TRIGGER update_events_updated_at BEFORE UPDATE ON public.events FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column()';
    RAISE NOTICE 'Created public.events + RLS + indexes + trigger';
  END IF;

  -- ---- person_events join: create if missing ----
  IF NOT has_pe_tbl THEN
    EXECUTE $ddl$
      CREATE TABLE public.person_events (
        id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
        user_id UUID NOT NULL,
        person_id UUID NOT NULL REFERENCES public.persons(id) ON DELETE CASCADE,
        event_id UUID NOT NULL REFERENCES public.events(id)  ON DELETE CASCADE,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        UNIQUE(person_id, event_id)
      )
    $ddl$;
    EXECUTE 'ALTER TABLE public.person_events ENABLE ROW LEVEL SECURITY';
    EXECUTE $p$CREATE POLICY "Users can view own person_events"   ON public.person_events FOR SELECT TO authenticated USING (auth.uid() = user_id)$p$;
    EXECUTE $p$CREATE POLICY "Users can insert own person_events" ON public.person_events FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id)$p$;
    EXECUTE $p$CREATE POLICY "Users can delete own person_events" ON public.person_events FOR DELETE TO authenticated USING (auth.uid() = user_id)$p$;
    EXECUTE 'CREATE INDEX idx_person_events_event  ON public.person_events(event_id)';
    EXECUTE 'CREATE INDEX idx_person_events_person ON public.person_events(person_id)';
    RAISE NOTICE 'Created public.person_events + RLS + indexes';
  END IF;

  -- ---- Verify final state ----
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'circles' AND column_name = 'tone'
  ) INTO has_tone_col;
  SELECT to_regclass('public.events')        IS NOT NULL INTO has_events_tbl;
  SELECT to_regclass('public.person_events') IS NOT NULL INTO has_pe_tbl;

  RAISE NOTICE 'AFTER:  circles.tone exists = %, public.events exists = %, public.person_events exists = %',
    has_tone_col, has_events_tbl, has_pe_tbl;

  -- Fail loudly if anything is still missing so the workflow surfaces it.
  IF NOT has_tone_col OR NOT has_events_tbl OR NOT has_pe_tbl THEN
    RAISE EXCEPTION 'Schema repair failed: tone=%, events=%, person_events=%',
      has_tone_col, has_events_tbl, has_pe_tbl;
  END IF;
END
$$;

-- Bump catalog so PostgREST detects a schema delta on its next reload.
COMMENT ON COLUMN public.circles.tone        IS 'Named tile-palette key. Round-4 schema repair.';
COMMENT ON TABLE  public.events              IS 'Time-bounded scenes. Round-4 schema repair.';
COMMENT ON TABLE  public.person_events       IS 'Person↔Event join. Round-4 schema repair.';

NOTIFY pgrst, 'reload schema';
SELECT pg_notify('pgrst', 'reload schema');
