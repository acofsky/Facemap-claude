-- Smart Import feedback.
-- Captures free-text "How'd we do?" feedback from the import review screen.
-- One row per submission. Stored in the user's own Supabase project so the
-- founder can read it via the dashboard / SQL (no email provider wired yet).
-- Scoped to 'smart_import' via `surface` so the same table can collect
-- feedback from other features later without a schema change.

CREATE TABLE IF NOT EXISTS public.feedback (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  surface TEXT NOT NULL DEFAULT 'smart_import',
  message TEXT NOT NULL,
  app_version TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

-- Users can write their own feedback and read it back; they cannot see
-- anyone else's. The founder reads everything via the service role in the
-- Supabase dashboard, which bypasses RLS.
CREATE POLICY "Users can insert own feedback" ON public.feedback
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view own feedback" ON public.feedback
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_feedback_created ON public.feedback(created_at DESC);
