-- 1. Lock down the person-photos bucket: make it private and scope all access by user folder
UPDATE storage.buckets SET public = false WHERE id = 'person-photos';

-- Drop any existing permissive policies on person-photos
DROP POLICY IF EXISTS "Public read access for person-photos" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload person photos" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can update person photos" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can delete person photos" ON storage.objects;
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "person-photos public read" ON storage.objects;
DROP POLICY IF EXISTS "person-photos public insert" ON storage.objects;
DROP POLICY IF EXISTS "person-photos public update" ON storage.objects;
DROP POLICY IF EXISTS "person-photos public delete" ON storage.objects;

-- New scoped policies: files must live under a folder matching auth.uid()
CREATE POLICY "Users can view their own person photos"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'person-photos'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can upload their own person photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'person-photos'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can update their own person photos"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'person-photos'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own person photos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'person-photos'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- 2. Add the missing UPDATE policy on person_circles
CREATE POLICY "Users can update own person_circles"
ON public.person_circles FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.persons
    WHERE persons.id = person_circles.person_id
      AND persons.user_id = auth.uid()
  )
);