/*
  # Fix orcamento numero column to have default value

  1. Changes
    - Add default value to numero column using gerar_numero_orcamento function
    - Ensure the function is created if not exists
    - Add trigger to auto-generate numero on insert if not provided

  2. Purpose
    - Fix NULL constraint violation on numero column
    - Auto-generate orcamento numbers when not explicitly provided
*/

-- Ensure the function exists and is correct
CREATE OR REPLACE FUNCTION public.gerar_numero_orcamento()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  next_number INTEGER;
  new_numero TEXT;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(numero FROM '[0-9]+') AS INTEGER)), 0) + 1
  INTO next_number
  FROM orcamentos
  WHERE numero ~ '^ORC-[0-9]+$';
  
  new_numero := 'ORC-' || LPAD(next_number::TEXT, 6, '0');
  RETURN new_numero;
END;
$$;

-- Create trigger function to auto-generate numero
CREATE OR REPLACE FUNCTION public.auto_gerar_numero_orcamento()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.numero IS NULL OR NEW.numero = '' THEN
    NEW.numero := gerar_numero_orcamento();
  END IF;
  RETURN NEW;
END;
$$;

-- Drop trigger if exists and create new one
DROP TRIGGER IF EXISTS trigger_auto_gerar_numero_orcamento ON orcamentos;
CREATE TRIGGER trigger_auto_gerar_numero_orcamento
  BEFORE INSERT ON orcamentos
  FOR EACH ROW
  EXECUTE FUNCTION auto_gerar_numero_orcamento();

-- Set default value for numero column (for safety)
ALTER TABLE orcamentos 
  ALTER COLUMN numero SET DEFAULT gerar_numero_orcamento();