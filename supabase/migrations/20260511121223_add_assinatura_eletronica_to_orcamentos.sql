/*
  # Add electronic signature to orcamentos

  1. New Columns
    - `assinatura_base64` (text, nullable) - Base64-encoded signature image
    - `assinatura_nome` (text, nullable) - Name of the person who signed
    - `assinatura_cargo` (text, nullable) - Role/title of the signer
    - `assinatura_data` (timestamptz, nullable) - Timestamp of when the signature was made

  2. Security
    - RLS already exists on orcamentos table
    - Only authenticated users can insert/update signatures

  3. Important Notes
    1. Signature is optional - nullable columns
    2. Once signed, the signature data is stored directly on the orcamento record
    3. The signature image is stored as base64 PNG (canvas output)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orcamentos' AND column_name = 'assinatura_base64'
  ) THEN
    ALTER TABLE orcamentos ADD COLUMN assinatura_base64 text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orcamentos' AND column_name = 'assinatura_nome'
  ) THEN
    ALTER TABLE orcamentos ADD COLUMN assinatura_nome text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orcamentos' AND column_name = 'assinatura_cargo'
  ) THEN
    ALTER TABLE orcamentos ADD COLUMN assinatura_cargo text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orcamentos' AND column_name = 'assinatura_data'
  ) THEN
    ALTER TABLE orcamentos ADD COLUMN assinatura_data timestamptz;
  END IF;
END $$;
