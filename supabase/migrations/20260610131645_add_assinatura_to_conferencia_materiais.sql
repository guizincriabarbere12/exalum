-- Add electronic signature fields to conferencia_materiais
-- This allows the client to sign the delivery receipt during material conference

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'conferencia_materiais' AND column_name = 'assinatura_base64'
  ) THEN
    ALTER TABLE conferencia_materiais ADD COLUMN assinatura_base64 text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'conferencia_materiais' AND column_name = 'assinatura_nome'
  ) THEN
    ALTER TABLE conferencia_materiais ADD COLUMN assinatura_nome text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'conferencia_materiais' AND column_name = 'assinatura_cargo'
  ) THEN
    ALTER TABLE conferencia_materiais ADD COLUMN assinatura_cargo text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'conferencia_materiais' AND column_name = 'assinatura_data'
  ) THEN
    ALTER TABLE conferencia_materiais ADD COLUMN assinatura_data timestamptz;
  END IF;
END $$;
