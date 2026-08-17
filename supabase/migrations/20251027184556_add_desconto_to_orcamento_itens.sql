/*
  # Add discount field to budget items table

  1. Changes
    - Add `desconto` column to `orcamento_itens` table
      - Type: numeric (decimal value for discount amount per item)
      - Default: 0
      - Not null
    - Add `desconto_percentual` column to `orcamento_itens` table
      - Type: numeric (percentage value)
      - Default: 0
      - Not null
    - Add `valor_com_desconto` column for the final value after discount
    
  2. Purpose
    - Allow administrators to apply discounts per item in budgets
    - Support both fixed amount and percentage discounts per item
    - Discount will be applied to each item's subtotal
*/

-- Add desconto (fixed discount amount) column to orcamento_itens
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orcamento_itens' AND column_name = 'desconto'
  ) THEN
    ALTER TABLE orcamento_itens ADD COLUMN desconto numeric DEFAULT 0 NOT NULL;
  END IF;
END $$;

-- Add desconto_percentual (percentage discount) column to orcamento_itens
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orcamento_itens' AND column_name = 'desconto_percentual'
  ) THEN
    ALTER TABLE orcamento_itens ADD COLUMN desconto_percentual numeric DEFAULT 0 NOT NULL;
  END IF;
END $$;

-- Add valor_com_desconto column to orcamento_itens
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orcamento_itens' AND column_name = 'valor_com_desconto'
  ) THEN
    ALTER TABLE orcamento_itens ADD COLUMN valor_com_desconto numeric;
  END IF;
END $$;

-- Create function to calculate item value with discount
CREATE OR REPLACE FUNCTION calcular_valor_item_com_desconto(
  subtotal_param numeric,
  desconto_param numeric,
  desconto_percentual_param numeric
)
RETURNS numeric
LANGUAGE plpgsql
AS $$
DECLARE
  valor_final numeric;
  desconto_total numeric;
BEGIN
  -- Calculate percentage discount
  desconto_total := (subtotal_param * desconto_percentual_param / 100);
  
  -- Add fixed discount
  desconto_total := desconto_total + desconto_param;
  
  -- Calculate final value
  valor_final := subtotal_param - desconto_total;
  
  -- Ensure value is not negative
  IF valor_final < 0 THEN
    valor_final := 0;
  END IF;
  
  RETURN valor_final;
END;
$$;

-- Create trigger to automatically update valor_com_desconto for items
CREATE OR REPLACE FUNCTION atualizar_valor_item_com_desconto()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.valor_com_desconto := calcular_valor_item_com_desconto(
    NEW.subtotal,
    NEW.desconto,
    NEW.desconto_percentual
  );
  RETURN NEW;
END;
$$;

-- Drop trigger if exists and create new one
DROP TRIGGER IF EXISTS trigger_atualizar_valor_item_com_desconto ON orcamento_itens;
CREATE TRIGGER trigger_atualizar_valor_item_com_desconto
  BEFORE INSERT OR UPDATE OF subtotal, desconto, desconto_percentual
  ON orcamento_itens
  FOR EACH ROW
  EXECUTE FUNCTION atualizar_valor_item_com_desconto();