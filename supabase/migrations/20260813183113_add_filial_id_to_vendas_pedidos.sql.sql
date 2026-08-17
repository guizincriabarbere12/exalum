/*
# Add filial_id to vendas and pedidos for branch-level sales tracking

## What this migration does
Adds an optional `filial_id` column to both `vendas` and `pedidos` tables so each sale or order can be associated with a specific filial (branch). This enables filtering sales by branch and managing branch-level operations.

## Changes
1. `vendas` table:
   - Added `filial_id` column (uuid, nullable, references `filiais(id) ON DELETE SET NULL`)
2. `pedidos` table:
   - Added `filial_id` column (uuid, nullable, references `filiais(id) ON DELETE SET NULL`)
3. Security:
   - No new RLS policies needed — existing policies cover the new column
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vendas' AND column_name = 'filial_id'
  ) THEN
    ALTER TABLE vendas
    ADD COLUMN filial_id uuid REFERENCES filiais(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pedidos' AND column_name = 'filial_id'
  ) THEN
    ALTER TABLE pedidos
    ADD COLUMN filial_id uuid REFERENCES filiais(id) ON DELETE SET NULL;
  END IF;
END $$;
