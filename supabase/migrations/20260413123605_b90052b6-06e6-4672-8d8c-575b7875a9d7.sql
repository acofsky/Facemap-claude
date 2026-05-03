
-- Add user_id to persons
ALTER TABLE public.persons ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Add user_id to circles
ALTER TABLE public.circles ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Add user_id to connections
ALTER TABLE public.connections ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Drop old permissive policies
DROP POLICY IF EXISTS "Allow all access to persons" ON public.persons;
DROP POLICY IF EXISTS "Allow all access to circles" ON public.circles;
DROP POLICY IF EXISTS "Allow all access to connections" ON public.connections;
DROP POLICY IF EXISTS "Allow all access to person_circles" ON public.person_circles;

-- Persons RLS
CREATE POLICY "Users can view own persons" ON public.persons FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own persons" ON public.persons FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own persons" ON public.persons FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own persons" ON public.persons FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Circles RLS
CREATE POLICY "Users can view own circles" ON public.circles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own circles" ON public.circles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own circles" ON public.circles FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own circles" ON public.circles FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Connections RLS
CREATE POLICY "Users can view own connections" ON public.connections FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own connections" ON public.connections FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own connections" ON public.connections FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own connections" ON public.connections FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Person_circles: access if user owns the person
CREATE POLICY "Users can view own person_circles" ON public.person_circles FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.persons WHERE persons.id = person_circles.person_id AND persons.user_id = auth.uid()));
CREATE POLICY "Users can insert own person_circles" ON public.person_circles FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.persons WHERE persons.id = person_circles.person_id AND persons.user_id = auth.uid()));
CREATE POLICY "Users can delete own person_circles" ON public.person_circles FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.persons WHERE persons.id = person_circles.person_id AND persons.user_id = auth.uid()));
