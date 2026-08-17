/*
  # Add peso column to orcamento_itens table

  1. Changes
    - Add `peso` column to `orcamento_itens` table
      - Type: numeric (allows decimal values for weight in kg)
      - Nullable: true (not all products have weight)
    
  2. Purpose
    - Allow storing custom weight per item in budgets
    - Users can adjust the weight/kg value for each product in the budget
    - This is useful for products sold by weight where the final weight may vary
*/

-- Add peso column to orcamento_itens
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orcamento_itens' AND column_name = 'peso'
  ) THEN
    ALTER TABLE orcamento_itens ADD COLUMN peso numeric;
  END IF;
END $$;