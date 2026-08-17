/*
# Add Product Transformation, Filiais, and Stock Transfers

## Purpose
1. OP Enhancement: When a product goes to painting, it can transform into a different product (different color). The original product is debited from stock and the destination product is credited back.
2. Filiais: Multi-branch support with a filiais table for branch management.
3. Stock Transfers: Transfer stock between branches, with full audit trail.

## New Columns

### ordens_producao (modified)
- produto_destino_id: UUID FK to produtos (nullable). When set, the returning product is the destination product instead of the original.

## New Tables

### filiais
- id, nome, codigo, endereco, cidade, estado, telefone, email, ativo, created_at, updated_at

### estoque_filial
- id, filial_id (FK filiais), produto_id (FK produtos), quantidade
- Unique constraint on (filial_id, produto_id)
- This tracks per-branch stock levels.

### transferencias_estoque
- id, numero, filial_origem_id, filial_destino_id, produto_id, quantidade, data_transferencia, status, observacoes, created_by, created_at
- status: 'pendente', 'em_transito', 'concluida', 'cancelada'

### transferencias_estoque_historico
- id, transferencia_id (FK), status_anterior, status_novo, observacoes, usuario_id, created_at

## Security
- RLS enabled on all new tables
- Authenticated users can perform CRUD (multi-user app with sign-in)

## Important Notes
1. When an OP has produto_destino_id set, on return: original product stock is NOT returned; instead, destination product stock is incremented.
2. estoque_filial tracks stock per branch. The main produtos.estoque column remains as the "matriz" (headquarters) stock.
3. Transfers move stock from one branch to another, recording movements in movimentacoes_estoque.
*/

-- ============================================================
-- 1. ADD produto_destino_id TO ordens_producao
-- ============================================================
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ordens_producao' AND column_name = 'produto_destino_id'
  ) THEN
    ALTER TABLE ordens_producao ADD COLUMN produto_destino_id uuid REFERENCES produtos(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ============================================================
-- 2. CREATE filiais TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS filiais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  codigo text,
  endereco text,
  cidade text,
  estado text,
  telefone text,
  email text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_filiais_ativo ON filiais(ativo);

-- ============================================================
-- 3. CREATE estoque_filial TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS estoque_filial (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  filial_id uuid NOT NULL REFERENCES filiais(id) ON DELETE CASCADE,
  produto_id uuid NOT NULL REFERENCES produtos(id) ON DELETE CASCADE,
  quantidade integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'estoque_filial_filial_id_produto_id_key'
  ) THEN
    ALTER TABLE estoque_filial ADD CONSTRAINT estoque_filial_filial_id_produto_id_key UNIQUE (filial_id, produto_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_estoque_filial_filial ON estoque_filial(filial_id);
CREATE INDEX IF NOT EXISTS idx_estoque_filial_produto ON estoque_filial(produto_id);

-- ============================================================
-- 4. CREATE transferencias_estoque TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS transferencias_estoque (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero text NOT NULL,
  filial_origem_id uuid NOT NULL REFERENCES filiais(id) ON DELETE RESTRICT,
  filial_destino_id uuid NOT NULL REFERENCES filiais(id) ON DELETE RESTRICT,
  produto_id uuid NOT NULL REFERENCES produtos(id) ON DELETE RESTRICT,
  quantidade integer NOT NULL CHECK (quantidade > 0),
  data_transferencia date NOT NULL DEFAULT CURRENT_DATE,
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'em_transito', 'concluida', 'cancelada')),
  observacoes text,
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT transferencias_estoque_filiais_diferentes CHECK (filial_origem_id <> filial_destino_id)
);

CREATE INDEX IF NOT EXISTS idx_transferencias_status ON transferencias_estoque(status);
CREATE INDEX IF NOT EXISTS idx_transferencias_origem ON transferencias_estoque(filial_origem_id);
CREATE INDEX IF NOT EXISTS idx_transferencias_destino ON transferencias_estoque(filial_destino_id);

-- ============================================================
-- 5. CREATE transferencias_estoque_historico TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS transferencias_estoque_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transferencia_id uuid NOT NULL REFERENCES transferencias_estoque(id) ON DELETE CASCADE,
  status_anterior text,
  status_novo text NOT NULL,
  observacoes text,
  usuario_id uuid,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_transf_historico_transf ON transferencias_estoque_historico(transferencia_id);

-- ============================================================
-- 6. ENABLE RLS
-- ============================================================
ALTER TABLE filiais ENABLE ROW LEVEL SECURITY;
ALTER TABLE estoque_filial ENABLE ROW LEVEL SECURITY;
ALTER TABLE transferencias_estoque ENABLE ROW LEVEL SECURITY;
ALTER TABLE transferencias_estoque_historico ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 7. RLS POLICIES - filiais
-- ============================================================
DROP POLICY IF EXISTS "select_filiais" ON filiais;
CREATE POLICY "select_filiais" ON filiais FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_filiais" ON filiais;
CREATE POLICY "insert_filiais" ON filiais FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_filiais" ON filiais;
CREATE POLICY "update_filiais" ON filiais FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_filiais" ON filiais;
CREATE POLICY "delete_filiais" ON filiais FOR DELETE
  TO authenticated USING (true);

-- ============================================================
-- 8. RLS POLICIES - estoque_filial
-- ============================================================
DROP POLICY IF EXISTS "select_estoque_filial" ON estoque_filial;
CREATE POLICY "select_estoque_filial" ON estoque_filial FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_estoque_filial" ON estoque_filial;
CREATE POLICY "insert_estoque_filial" ON estoque_filial FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_estoque_filial" ON estoque_filial;
CREATE POLICY "update_estoque_filial" ON estoque_filial FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_estoque_filial" ON estoque_filial;
CREATE POLICY "delete_estoque_filial" ON estoque_filial FOR DELETE
  TO authenticated USING (true);

-- ============================================================
-- 9. RLS POLICIES - transferencias_estoque
-- ============================================================
DROP POLICY IF EXISTS "select_transferencias" ON transferencias_estoque;
CREATE POLICY "select_transferencias" ON transferencias_estoque FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_transferencias" ON transferencias_estoque;
CREATE POLICY "insert_transferencias" ON transferencias_estoque FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_transferencias" ON transferencias_estoque;
CREATE POLICY "update_transferencias" ON transferencias_estoque FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_transferencias" ON transferencias_estoque;
CREATE POLICY "delete_transferencias" ON transferencias_estoque FOR DELETE
  TO authenticated USING (true);

-- ============================================================
-- 10. RLS POLICIES - transferencias_estoque_historico
-- ============================================================
DROP POLICY IF EXISTS "select_transf_historico" ON transferencias_estoque_historico;
CREATE POLICY "select_transf_historico" ON transferencias_estoque_historico FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_transf_historico" ON transferencias_estoque_historico;
CREATE POLICY "insert_transf_historico" ON transferencias_estoque_historico FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "delete_transf_historico" ON transferencias_estoque_historico;
CREATE POLICY "delete_transf_historico" ON transferencias_estoque_historico FOR DELETE
  TO authenticated USING (true);

-- ============================================================
-- 11. AUTO-GENERATE TRANSFER NUMBER
-- ============================================================
CREATE OR REPLACE FUNCTION gerar_numero_transferencia()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_numero text;
  v_seq integer;
BEGIN
  SELECT COALESCE(MAX(CAST(REPLACE(numero, 'TR-', '') AS integer)), 0) + 1
  INTO v_seq
  FROM transferencias_estoque
  WHERE numero ~ '^TR-[0-9]+$';

  v_numero := 'TR-' || lpad(v_seq::text, 4, '0');
  RETURN v_numero;
END;
$$;
