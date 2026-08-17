-- Make filial_origem_id and filial_destino_id nullable to allow Matriz (NULL = Matriz)
ALTER TABLE transferencias_estoque ALTER COLUMN filial_origem_id DROP NOT NULL;
ALTER TABLE transferencias_estoque ALTER COLUMN filial_destino_id DROP NOT NULL;

-- Replace the CHECK constraint to use IS DISTINCT FROM (handles NULLs correctly)
ALTER TABLE transferencias_estoque DROP CONSTRAINT IF EXISTS transferencias_estoque_filiais_diferentes;
ALTER TABLE transferencias_estoque ADD CONSTRAINT transferencias_estoque_filiais_diferentes
  CHECK (filial_origem_id IS DISTINCT FROM filial_destino_id);

-- Make the FK columns accept SET NULL on the origin side too (already RESTRICT, keep as is)
-- But we need ON DELETE SET NULL for nullable columns
ALTER TABLE transferencias_estoque DROP CONSTRAINT IF EXISTS transferencias_estoque_filial_origem_id_fkey;
ALTER TABLE transferencias_estoque ADD CONSTRAINT transferencias_estoque_filial_origem_id_fkey
  FOREIGN KEY (filial_origem_id) REFERENCES filiais(id) ON DELETE SET NULL;

ALTER TABLE transferencias_estoque DROP CONSTRAINT IF EXISTS transferencias_estoque_filial_destino_id_fkey;
ALTER TABLE transferencias_estoque ADD CONSTRAINT transferencias_estoque_filial_destino_id_fkey
  FOREIGN KEY (filial_destino_id) REFERENCES filiais(id) ON DELETE SET NULL;
