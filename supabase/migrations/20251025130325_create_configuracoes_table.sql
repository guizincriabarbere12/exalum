/*
  # Create Configuracoes Table

  1. New Tables
    - `configuracoes`
      - `id` (uuid, primary key)
      - `nome_empresa` (text, company name)
      - `cnpj` (text, optional)
      - `telefone` (text, optional)
      - `email` (text, optional)
      - `endereco` (text, optional)
      - `logo_url` (text, optional)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `configuracoes` table
    - Add policy for authenticated users to view settings
    - Add policy for admins to update settings
*/

CREATE TABLE IF NOT EXISTS public.configuracoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_empresa text NOT NULL DEFAULT 'Exalum',
  cnpj text,
  telefone text,
  email text,
  endereco text,
  logo_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.configuracoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view company settings"
  ON public.configuracoes
  FOR SELECT
  USING (true);

CREATE POLICY "Admins can update settings"
  ON public.configuracoes
  FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Insert default configuration
INSERT INTO public.configuracoes (nome_empresa)
VALUES ('Exalum')
ON CONFLICT (id) DO NOTHING;
