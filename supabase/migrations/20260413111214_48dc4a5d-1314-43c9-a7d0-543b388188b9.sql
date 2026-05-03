
-- Create persons table
CREATE TABLE public.persons (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  nickname TEXT,
  photos TEXT[] NOT NULL DEFAULT '{}',
  how_we_met TEXT,
  where_when TEXT,
  date_met DATE,
  physical_description TEXT,
  important_info TEXT,
  misc_notes TEXT,
  reminder_date DATE,
  reminder_note TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create circles table
CREATE TABLE public.circles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  emoji TEXT NOT NULL DEFAULT '📌',
  color TEXT NOT NULL DEFAULT 'hsl(16, 65%, 55%)',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create person_circles join table
CREATE TABLE public.person_circles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  person_id UUID NOT NULL REFERENCES public.persons(id) ON DELETE CASCADE,
  circle_id UUID NOT NULL REFERENCES public.circles(id) ON DELETE CASCADE,
  UNIQUE(person_id, circle_id)
);

-- Create connections table (two people who know each other)
CREATE TABLE public.connections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  person_a_id UUID NOT NULL REFERENCES public.persons(id) ON DELETE CASCADE,
  person_b_id UUID NOT NULL REFERENCES public.persons(id) ON DELETE CASCADE,
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CHECK (person_a_id < person_b_id)
);

-- Enable RLS on all tables
ALTER TABLE public.persons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.circles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.person_circles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.connections ENABLE ROW LEVEL SECURITY;

-- Open RLS policies for testing (no auth required)
CREATE POLICY "Allow all access to persons" ON public.persons FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to circles" ON public.circles FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to person_circles" ON public.person_circles FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to connections" ON public.connections FOR ALL USING (true) WITH CHECK (true);

-- Timestamp update function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_persons_updated_at
  BEFORE UPDATE ON public.persons
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default circles
INSERT INTO public.circles (name, emoji, color) VALUES
  ('Work', '💼', 'hsl(16, 65%, 55%)'),
  ('College', '🎓', 'hsl(35, 60%, 70%)'),
  ('High School', '🏫', 'hsl(145, 50%, 42%)'),
  ('Family', '🏠', 'hsl(280, 50%, 55%)'),
  ('Gym', '💪', 'hsl(200, 60%, 50%)'),
  ('Travel', '✈️', 'hsl(30, 80%, 65%)'),
  ('Neighborhood', '🏘️', 'hsl(100, 40%, 50%)'),
  ('Randoms', '🎲', 'hsl(0, 0%, 55%)');

-- Create storage bucket for person photos
INSERT INTO storage.buckets (id, name, public) VALUES ('person-photos', 'person-photos', true);

-- Storage policies for photos (open for testing)
CREATE POLICY "Anyone can view person photos" ON storage.objects FOR SELECT USING (bucket_id = 'person-photos');
CREATE POLICY "Anyone can upload person photos" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'person-photos');
CREATE POLICY "Anyone can update person photos" ON storage.objects FOR UPDATE USING (bucket_id = 'person-photos');
CREATE POLICY "Anyone can delete person photos" ON storage.objects FOR DELETE USING (bucket_id = 'person-photos');
