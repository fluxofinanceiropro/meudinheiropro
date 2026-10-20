ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url text;
INSERT INTO storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
VALUES ('profile-photos','profile-photos',true,2097152,ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO NOTHING;
DO $$
BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='profile photos upload own') THEN
CREATE POLICY "profile photos upload own" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id='profile-photos' AND (storage.foldername(name))[1]=auth.uid()::text);
END IF;
IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='profile photos delete own') THEN
CREATE POLICY "profile photos delete own" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id='profile-photos' AND (storage.foldername(name))[1]=auth.uid()::text);
END IF;
IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='profile photos public read') THEN
CREATE POLICY "profile photos public read" ON storage.objects FOR SELECT TO public
USING (bucket_id='profile-photos');
END IF;
END $$;