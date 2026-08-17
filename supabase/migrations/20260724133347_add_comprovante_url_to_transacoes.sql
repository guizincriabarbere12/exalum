-- Add comprovante_url column to transacoes_financeiras for payment receipts
ALTER TABLE public.transacoes_financeiras
ADD COLUMN IF NOT EXISTS comprovante_url text;

-- Insert storage bucket for comprovantes if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('comprovantes', 'comprovantes', false)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for the comprovantes storage bucket
-- Allow authenticated users to upload comprovantes
CREATE POLICY "allow_upload_comprovantes" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'comprovantes');

-- Allow authenticated users to read their own comprovantes
CREATE POLICY "allow_read_comprovantes" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'comprovantes');

-- Allow authenticated users to update their own comprovantes
CREATE POLICY "allow_update_comprovantes" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'comprovantes')
  WITH CHECK (bucket_id = 'comprovantes');

-- Allow authenticated users to delete their own comprovantes
CREATE POLICY "allow_delete_comprovantes" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'comprovantes');
