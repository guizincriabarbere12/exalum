
-- Remove the CHECK constraint that requires produto_id or kit_id
-- so that sobra items (without a produto) can be added to orçamentos
ALTER TABLE orcamento_itens DROP CONSTRAINT IF EXISTS orcamento_itens_produto_id_kit_id_check;

-- Add sobra_id column to link orçamento items back to sobras_perfis
ALTER TABLE orcamento_itens ADD COLUMN IF NOT EXISTS sobra_id uuid REFERENCES sobras_perfis(id) ON DELETE SET NULL;
