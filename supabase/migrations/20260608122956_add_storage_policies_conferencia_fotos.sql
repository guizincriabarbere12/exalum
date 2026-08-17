-- RLS policies for conferencia-fotos storage bucket
CREATE POLICY "allow_authenticated_upload_conferencia_fotos" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'conferencia-fotos');

CREATE POLICY "allow_authenticated_read_conferencia_fotos" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'conferencia-fotos');

CREATE POLICY "allow_public_read_conferencia_fotos" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'conferencia-fotos');
