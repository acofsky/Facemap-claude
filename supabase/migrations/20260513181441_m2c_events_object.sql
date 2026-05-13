-- M2 Phase C — Events object + named tone column for Circles.
-- Events are time-bounded scenes (one-off dinners, trips, conferences) as
-- opposed to Circles which are ongoing identity-based groups.

-- ----- Circles: named tone column -----
-- Circles already have a free-form `color` (HSL string) from v1. We add a
-- separate `tone` column that holds one of the eight named palette options
-- from the Visual Brief. The app renders gradients from `tone`; `color`
-- stays untouched for backward compatibility.
ALTER TABLE public.circles
  ADD COLUMN IF NOT EXISTS tone TEXT NOT NULL DEFAULT 'red';

-- ----- Events table -----
CREATE TABLE IF NOT EXISTS public.events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  tone TEXT NOT NULL DEFAULT 'red',
  start_date DATE,
  end_date DATE,
  archived_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own events" ON public.events
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own events" ON public.events
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own events" ON public.events
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own events" ON public.events
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_events_user ON public.events(user_id);
CREATE INDEX IF NOT EXISTS idx_events_archived ON public.events(user_id, archived_at);

-- Reuse the existing updated_at trigger function set up in the first migration.
DROP TRIGGER IF EXISTS update_events_updated_at ON public.events;
CREATE TRIGGER update_events_updated_at
  BEFORE UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ----- person_events join -----
CREATE TABLE IF NOT EXISTS public.person_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  person_id UUID NOT NULL REFERENCES public.persons(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(person_id, event_id)
);

ALTER TABLE public.person_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own person_events" ON public.person_events
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own person_events" ON public.person_events
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own person_events" ON public.person_events
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_person_events_event ON public.person_events(event_id);
CREATE INDEX IF NOT EXISTS idx_person_events_person ON public.person_events(person_id);
