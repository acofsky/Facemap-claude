-- Smart Import v1.
-- Stores raw imported stubs (Contacts / LinkedIn CSV / Calendar / Photo OCR)
-- before they're promoted to first-class People rows. Survives navigation
-- and restart so the "More imports" drawer keeps working across sessions.

CREATE TABLE IF NOT EXISTS public.import_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  filter_text TEXT,
  sources TEXT[] NOT NULL DEFAULT '{}',
  candidates_count INTEGER NOT NULL DEFAULT 0,
  promoted_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.import_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own import sessions" ON public.import_sessions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own import sessions" ON public.import_sessions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own import sessions" ON public.import_sessions
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own import sessions" ON public.import_sessions
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_import_sessions_user ON public.import_sessions(user_id, created_at DESC);


CREATE TABLE IF NOT EXISTS public.import_candidates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  session_id UUID NOT NULL REFERENCES public.import_sessions(id) ON DELETE CASCADE,
  source TEXT NOT NULL CHECK (source IN ('contacts','linkedin','calendar','photo_ocr')),
  raw JSONB NOT NULL DEFAULT '{}'::jsonb,
  name TEXT NOT NULL DEFAULT '',
  email TEXT,
  phone TEXT,
  company TEXT,
  title TEXT,
  photo_path TEXT,
  ai_relevance_score NUMERIC,
  ai_rationale TEXT,
  ai_bullets JSONB,
  dedupe_key TEXT,
  promoted_person_id UUID REFERENCES public.persons(id) ON DELETE SET NULL,
  promoted BOOLEAN NOT NULL DEFAULT FALSE,
  dismissed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.import_candidates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own import candidates" ON public.import_candidates
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own import candidates" ON public.import_candidates
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own import candidates" ON public.import_candidates
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own import candidates" ON public.import_candidates
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_import_candidates_session
  ON public.import_candidates(session_id);
CREATE INDEX IF NOT EXISTS idx_import_candidates_user_unpromoted
  ON public.import_candidates(user_id) WHERE promoted = FALSE AND dismissed = FALSE;
CREATE INDEX IF NOT EXISTS idx_import_candidates_dedupe
  ON public.import_candidates(user_id, dedupe_key);

NOTIFY pgrst, 'reload schema';
