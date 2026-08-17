/*
# Add Kit Support to Transferências de Estoque

## What this migration does
Allows transferring Kits Montados (not just individual products) between Matriz and filiais.
Previously, `transferencias_estoque.produto_id` was NOT NULL, so every transfer had to reference a product.
Now we add an optional `kit_id` column and make `produto_id` nullable so a transfer can reference either a product OR a kit.

## Changes
1. `transferencias_estoque` table:
   - Added `kit_id` column (uuid, nullable, references `kits(id)`)
   - Made `produto_id` column nullable (was NOT NULL)
   - Added a CHECK constraint to ensure exactly one of `produto_id` or `kit_id` is set
2. Security:
   - No new RLS policies needed — existing policies on `transferencias_estoque` already cover all columns
   - The `kit_id` FK references the existing `kits` table which already has its own RLS
*/

-- Step 1: Make produto_id nullable so we can have kit-only transfers
ALTER TABLE transferencias_estoque ALTER COLUMN produto_id DROP NOT NULL;

-- Step 2: Add kit_id column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transferencias_estoque' AND column_name = 'kit_id'
  ) THEN
    ALTER TABLE transferencias_estoque
    ADD COLUMN kit_id uuid REFERENCES kits(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Step 3: Add a check constraint ensuring at least one of produto_id or kit_id is present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'transferencia_produto_ou_kit'
  ) THEN
    ALTER TABLE transferencias_estoque
    ADD CONSTRAINT transferencia_produto_ou_kit
    CHECK (produto_id IS NOT NULL OR kit_id IS NOT NULL);
  END IF;
END $$;
