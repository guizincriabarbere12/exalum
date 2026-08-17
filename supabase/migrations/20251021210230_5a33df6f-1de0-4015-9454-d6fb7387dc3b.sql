-- Create storage bucket for product photos
INSERT INTO storage.buckets (id, name, public) 
VALUES ('produtos', 'produtos', true);

-- Create policies for product photos
CREATE POLICY "Product photos are publicly accessible" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'produtos');

CREATE POLICY "Admins can upload product photos" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'produtos' AND has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update product photos" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'produtos' AND has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete product photos" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'produtos' AND has_role(auth.uid(), 'admin'));