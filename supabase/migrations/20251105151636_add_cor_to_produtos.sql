/*
  # Add color field to products

  1. Changes
    - Add `cor` column to `produtos` table
    - Column is optional (nullable) to maintain compatibility
    - Add index for better search performance
  
  2. Purpose
    - Allow tracking product colors
    - Support color-based filtering and search
    - Enhance product cataloging
*/

-- Add cor column to produtos
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'produtos' AND column_name = 'cor'
  ) THEN
    ALTER TABLE produtos ADD COLUMN cor text;
  END IF;
END $$;

-- Create index for better search performance
CREATE INDEX IF NOT EXISTS idx_produtos_cor ON produtos(cor);
