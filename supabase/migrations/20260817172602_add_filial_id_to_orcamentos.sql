/*
# Add filial_id to orcamentos for branch-level stock tracking

## What this migration does
Adds an optional `filial_id` column to the `orcamentos` table so each
orçamento can be associated with a specific filial (branch/unit). This lets
stock debit/return on approval/reversal target the correct unit's stock
(`estoque_filial`) instead of always touching the global `produtos.estoque`
("Matriz").

## Changes
1. `orcamentos` table:
   - Added `filial_id` column (uuid, nullable, references `filiais(id) ON DELETE SET NULL`)

## Notes
- Nullable and defaults to NULL, meaning "Matriz" (no filial selected).
  Existing orçamentos are unaffected and keep behaving exactly as before
  (stock movements against `produtos.estoque`).
- No backfill needed/performed.
- Security: No new RLS policies needed — existing policies cover the new column.
- Idempotent: safe to run multiple times.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orcamentos' AND column_name = 'filial_id'
  ) THEN
    ALTER TABLE orcamentos
    ADD COLUMN filial_id uuid REFERENCES filiais(id) ON DELETE SET NULL;
  END IF;
END $$;
