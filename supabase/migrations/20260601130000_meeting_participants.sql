-- Multi-person encounters. A meeting still has one "owner" (meetings.person_id,
-- the profile it was logged from); this table holds the ADDITIONAL people tagged
-- on that encounter. Each row is either a Membr person (person_id set) or a
-- plain name tag for someone not yet in Membr (external_name set) — never both.
-- Tagging a Membr person makes the encounter surface on their profile too.

CREATE TABLE public.meeting_participants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  meeting_id UUID NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  person_id UUID REFERENCES public.persons(id) ON DELETE CASCADE,
  external_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT meeting_participant_identity CHECK (
    (person_id IS NOT NULL AND external_name IS NULL) OR
    (person_id IS NULL AND external_name IS NOT NULL)
  )
);

ALTER TABLE public.meeting_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own meeting_participants" ON public.meeting_participants FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own meeting_participants" ON public.meeting_participants FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own meeting_participants" ON public.meeting_participants FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own meeting_participants" ON public.meeting_participants FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX idx_meeting_participants_meeting ON public.meeting_participants(meeting_id);
CREATE INDEX idx_meeting_participants_person ON public.meeting_participants(person_id) WHERE person_id IS NOT NULL;

-- Don't let the same Membr person be tagged twice on one encounter.
CREATE UNIQUE INDEX idx_meeting_participants_unique_person
  ON public.meeting_participants(meeting_id, person_id) WHERE person_id IS NOT NULL;
