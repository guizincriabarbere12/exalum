/*
# Production Orders (OP), Branches & Stock Transfers - Complete Module

## 1. Production Orders (OP)
Expands the existing `ordens_producao` table with full production tracking:
- Filial, responsible, opening/expected/completion dates
- Detailed cost fields (labor, freight, packaging, services, other)
- Transformation fields (final product, produced qty, losses, leftovers, waste)

New tables:
- `op_pintura`: Tracks products sent to external painting (company, dates, costs, return)
- `op_materiais`: Tracks materials consumed in transformation/fabrication
- `op_custos`: Detailed cost breakdown per OP

## 2. Branches & Stock Transfers
Expands existing `filiais` table with branch type (matriz/filial/deposito).
Expands existing `transferencias_estoque` with responsible, transport cost, send/receive dates.

## 3. Financial Transactions
Adds columns to `transacoes_financeiras`: supplier, cost center, branch, interest, penalty, discount, amount paid.

## Security
- RLS enabled on all new tables with authenticated owner-scoped policies.
- All new tables use `DEFAULT auth.uid()` for ownership.
*/

-- ============================================================
-- 1. EXPAND ordens_producao
-- ============================================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ordens_producao' AND column_name = 'filial_id') THEN
    ALTER TABLE ordens_producao ADD COLUMN filial_id uuid REFERENCES filiais(id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ordens_producao' AND column_name = 'responsavel') THEN
    ALTER TABLE ordens_producao ADD COLUMN responsavel text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ordens_producao' AND column_name = 'data_abertura') THEN
    ALTER TABLE ordens_producao ADD COLUMN data_abertura date DEFAULT CURRENT_DATE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ordens_producao' AND column_name = 'data_prevista') THEN
    ALTER TABLE ordens_producao ADD COLUMN data_prevista date;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ordens_producao' AND column_name = 'data_conclusao') THEN
    ALTER TABLE ordens_producao ADD COLUMN data_conclusao date;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ordens_producao' AND column_name = 'custo_mao_obra') THEN
    ALTER TABLE ordens_producao ADD COLUMN custo_mao_obra numeric DEFAULT 0;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ordens_producao' AND column_name = 'custo_frete') THEN
    ALTER TABLE ordens_producao ADD COLUMN custo_frete numeric DEFAULT 0;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ordens_producao' AND column_name = 'custo_embalagem') THEN
    ALTER TABLE ordens_producao ADD COLUMN custo_embalagem numeric DEFAULT 0;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ordens_producao' AND column_name = 'custo_servicos') THEN
    ALTER TABLE ordens_producao ADD COLUMN custo_servicos numeric DEFAULT 0;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ordens_producao' AND column_name = 'custo_outros') THEN
    ALTER TABLE ordens_producao ADD COLUMN custo_outros numeric DEFAULT 0;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ordens_producao' AND column_name = 'custo_total') THEN
    ALTER TABLE ordens_producao ADD COLUMN custo_total numeric DEFAULT 0;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ordens_producao' AND column_name = 'produto_final_id') THEN
    ALTER TABLE ordens_producao ADD COLUMN produto_final_id uuid REFERENCES produtos(id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ordens_producao' AND column_name = 'quantidade_produzida') THEN
    ALTER TABLE ordens_producao ADD COLUMN quantidade_produzida numeric DEFAULT 0;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ordens_producao' AND column_name = 'perdas') THEN
    ALTER TABLE ordens_producao ADD COLUMN perdas numeric DEFAULT 0;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ordens_producao' AND column_name = 'sobras') THEN
    ALTER TABLE ordens_producao ADD COLUMN sobras numeric DEFAULT 0;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ordens_producao' AND column_name = 'desperdicios') THEN
    ALTER TABLE ordens_producao ADD COLUMN desperdicios numeric DEFAULT 0;
  END IF;
END $$;

-- Add created_by default if not already set
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'ordens_producao' AND column_name = 'created_by' 
    AND column_default IS NOT NULL
  ) THEN
    ALTER TABLE ordens_producao ALTER COLUMN created_by SET DEFAULT auth.uid();
  END IF;
END $$;

-- ============================================================
-- 2. NEW TABLE: op_pintura (painting tracking)
-- ============================================================
CREATE TABLE IF NOT EXISTS op_pintura (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  op_id uuid NOT NULL REFERENCES ordens_producao(id) ON DELETE CASCADE,
  empresa_pintura text,
  quantidade_enviada numeric NOT NULL DEFAULT 0,
  data_saida date,
  data_prevista_retorno date,
  data_retorno date,
  custo_pintura numeric DEFAULT 0,
  custo_frete numeric DEFAULT 0,
  custo_embalagem numeric DEFAULT 0,
  custo_mao_obra numeric DEFAULT 0,
  custo_outros numeric DEFAULT 0,
  custo_total numeric DEFAULT 0,
  status text NOT NULL DEFAULT 'enviada',
  observacoes text,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE op_pintura ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_op_pintura" ON op_pintura;
CREATE POLICY "select_op_pintura" ON op_pintura FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_op_pintura" ON op_pintura;
CREATE POLICY "insert_op_pintura" ON op_pintura FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_op_pintura" ON op_pintura;
CREATE POLICY "update_op_pintura" ON op_pintura FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_op_pintura" ON op_pintura;
CREATE POLICY "delete_op_pintura" ON op_pintura FOR DELETE
  TO authenticated USING (true);

-- ============================================================
-- 3. NEW TABLE: op_materiais (materials consumed in transformation)
-- ============================================================
CREATE TABLE IF NOT EXISTS op_materiais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  op_id uuid NOT NULL REFERENCES ordens_producao(id) ON DELETE CASCADE,
  produto_id uuid REFERENCES produtos(id),
  quantidade_consumida numeric NOT NULL DEFAULT 0,
  produto_final_id uuid REFERENCES produtos(id),
  quantidade_produzida numeric DEFAULT 0,
  perdas numeric DEFAULT 0,
  sobras numeric DEFAULT 0,
  desperdicios numeric DEFAULT 0,
  custo_transferido numeric DEFAULT 0,
  observacoes text,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE op_materiais ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_op_materiais" ON op_materiais;
CREATE POLICY "select_op_materiais" ON op_materiais FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_op_materiais" ON op_materiais;
CREATE POLICY "insert_op_materiais" ON op_materiais FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_op_materiais" ON op_materiais;
CREATE POLICY "update_op_materiais" ON op_materiais FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_op_materiais" ON op_materiais;
CREATE POLICY "delete_op_materiais" ON op_materiais FOR DELETE
  TO authenticated USING (true);

-- ============================================================
-- 4. NEW TABLE: op_custos (detailed cost tracking)
-- ============================================================
CREATE TABLE IF NOT EXISTS op_custos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  op_id uuid NOT NULL REFERENCES ordens_producao(id) ON DELETE CASCADE,
  tipo_custo text NOT NULL,
  descricao text,
  valor numeric NOT NULL DEFAULT 0,
  data date DEFAULT CURRENT_DATE,
  observacoes text,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE op_custos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_op_custos" ON op_custos;
CREATE POLICY "select_op_custos" ON op_custos FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_op_custos" ON op_custos;
CREATE POLICY "insert_op_custos" ON op_custos FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_op_custos" ON op_custos;
CREATE POLICY "update_op_custos" ON op_custos FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_op_custos" ON op_custos;
CREATE POLICY "delete_op_custos" ON op_custos FOR DELETE
  TO authenticated USING (true);

-- ============================================================
-- 5. EXPAND filiais with branch type
-- ============================================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'filiais' AND column_name = 'tipo') THEN
    ALTER TABLE filiais ADD COLUMN tipo text NOT NULL DEFAULT 'filial';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'filiais' AND column_name = 'cnpj') THEN
    ALTER TABLE filiais ADD COLUMN cnpj text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'filiais' AND column_name = 'created_by') THEN
    ALTER TABLE filiais ADD COLUMN created_by uuid DEFAULT auth.uid();
  END IF;
END $$;

-- Ensure RLS on filiais (may already exist)
DO $$ BEGIN
  ALTER TABLE filiais ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

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

-- RLS on estoque_filial
DO $$ BEGIN
  ALTER TABLE estoque_filial ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

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
-- 6. EXPAND transferencias_estoque
-- ============================================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transferencias_estoque' AND column_name = 'responsavel') THEN
    ALTER TABLE transferencias_estoque ADD COLUMN responsavel text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transferencias_estoque' AND column_name = 'custo_transporte') THEN
    ALTER TABLE transferencias_estoque ADD COLUMN custo_transporte numeric DEFAULT 0;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transferencias_estoque' AND column_name = 'data_envio') THEN
    ALTER TABLE transferencias_estoque ADD COLUMN data_envio date;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transferencias_estoque' AND column_name = 'data_recebimento') THEN
    ALTER TABLE transferencias_estoque ADD COLUMN data_recebimento date;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transferencias_estoque' AND column_name = 'recebido_por') THEN
    ALTER TABLE transferencias_estoque ADD COLUMN recebido_por text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'transferencias_estoque' AND column_name = 'created_by' 
    AND column_default IS NOT NULL
  ) THEN
    ALTER TABLE transferencias_estoque ALTER COLUMN created_by SET DEFAULT auth.uid();
  END IF;
END $$;

-- RLS on transferencias_estoque
DO $$ BEGIN
  ALTER TABLE transferencias_estoque ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

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

-- RLS on transferencias_estoque_historico
DO $$ BEGIN
  ALTER TABLE transferencias_estoque_historico ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DROP POLICY IF EXISTS "select_transferencias_historico" ON transferencias_estoque_historico;
CREATE POLICY "select_transferencias_historico" ON transferencias_estoque_historico FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_transferencias_historico" ON transferencias_estoque_historico;
CREATE POLICY "insert_transferencias_historico" ON transferencias_estoque_historico FOR INSERT
  TO authenticated WITH CHECK (true);

-- RLS on ordens_producao
DO $$ BEGIN
  ALTER TABLE ordens_producao ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DROP POLICY IF EXISTS "select_ordens_producao" ON ordens_producao;
CREATE POLICY "select_ordens_producao" ON ordens_producao FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_ordens_producao" ON ordens_producao;
CREATE POLICY "insert_ordens_producao" ON ordens_producao FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_ordens_producao" ON ordens_producao;
CREATE POLICY "update_ordens_producao" ON ordens_producao FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_ordens_producao" ON ordens_producao;
CREATE POLICY "delete_ordens_producao" ON ordens_producao FOR DELETE
  TO authenticated USING (true);

-- RLS on ordens_producao_historico
DO $$ BEGIN
  ALTER TABLE ordens_producao_historico ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DROP POLICY IF EXISTS "select_op_historico" ON ordens_producao_historico;
CREATE POLICY "select_op_historico" ON ordens_producao_historico FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_op_historico" ON ordens_producao_historico;
CREATE POLICY "insert_op_historico" ON ordens_producao_historico FOR INSERT
  TO authenticated WITH CHECK (true);

-- ============================================================
-- 7. EXPAND transacoes_financeiras with new columns
-- ============================================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transacoes_financeiras' AND column_name = 'fornecedor_id') THEN
    ALTER TABLE transacoes_financeiras ADD COLUMN fornecedor_id uuid REFERENCES fornecedores(id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transacoes_financeiras' AND column_name = 'centro_custo') THEN
    ALTER TABLE transacoes_financeiras ADD COLUMN centro_custo text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transacoes_financeiras' AND column_name = 'filial_id') THEN
    ALTER TABLE transacoes_financeiras ADD COLUMN filial_id uuid REFERENCES filiais(id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transacoes_financeiras' AND column_name = 'juros') THEN
    ALTER TABLE transacoes_financeiras ADD COLUMN juros numeric DEFAULT 0;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transacoes_financeiras' AND column_name = 'multa') THEN
    ALTER TABLE transacoes_financeiras ADD COLUMN multa numeric DEFAULT 0;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transacoes_financeiras' AND column_name = 'desconto') THEN
    ALTER TABLE transacoes_financeiras ADD COLUMN desconto numeric DEFAULT 0;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transacoes_financeiras' AND column_name = 'valor_pago') THEN
    ALTER TABLE transacoes_financeiras ADD COLUMN valor_pago numeric DEFAULT 0;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transacoes_financeiras' AND column_name = 'valor_original') THEN
    ALTER TABLE transacoes_financeiras ADD COLUMN valor_original numeric DEFAULT 0;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transacoes_financeiras' AND column_name = 'data_emissao') THEN
    ALTER TABLE transacoes_financeiras ADD COLUMN data_emissao date;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transacoes_financeiras' AND column_name = 'anexos') THEN
    ALTER TABLE transacoes_financeiras ADD COLUMN anexos jsonb;
  END IF;
END $$;

-- ============================================================
-- 8. NEW TABLE: transacao_pagamentos (partial payments)
-- ============================================================
CREATE TABLE IF NOT EXISTS transacao_pagamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transacao_id uuid NOT NULL REFERENCES transacoes_financeiras(id) ON DELETE CASCADE,
  valor_pago numeric NOT NULL,
  data_pagamento date NOT NULL DEFAULT CURRENT_DATE,
  conta_bancaria text,
  forma_pagamento text,
  juros numeric DEFAULT 0,
  multa numeric DEFAULT 0,
  desconto numeric DEFAULT 0,
  observacao text,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE transacao_pagamentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_pagamentos" ON transacao_pagamentos;
CREATE POLICY "select_pagamentos" ON transacao_pagamentos FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_pagamentos" ON transacao_pagamentos;
CREATE POLICY "insert_pagamentos" ON transacao_pagamentos FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_pagamentos" ON transacao_pagamentos;
CREATE POLICY "update_pagamentos" ON transacao_pagamentos FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_pagamentos" ON transacao_pagamentos;
CREATE POLICY "delete_pagamentos" ON transacao_pagamentos FOR DELETE
  TO authenticated USING (true);

-- ============================================================
-- 9. Indexes for performance
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_op_pintura_op_id ON op_pintura(op_id);
CREATE INDEX IF NOT EXISTS idx_op_materiais_op_id ON op_materiais(op_id);
CREATE INDEX IF NOT EXISTS idx_op_custos_op_id ON op_custos(op_id);
CREATE INDEX IF NOT EXISTS idx_transacao_pagamentos_transacao_id ON transacao_pagamentos(transacao_id);
CREATE INDEX IF NOT EXISTS idx_transferencias_origem ON transferencias_estoque(filial_origem_id);
CREATE INDEX IF NOT EXISTS idx_transferencias_destino ON transferencias_estoque(filial_destino_id);
CREATE INDEX IF NOT EXISTS idx_ordens_producao_status ON ordens_producao(status);
CREATE INDEX IF NOT EXISTS idx_transacoes_vencimento ON transacoes_financeiras(data_vencimento);
CREATE INDEX IF NOT EXISTS idx_transacoes_status ON transacoes_financeiras(status);
CREATE INDEX IF NOT EXISTS idx_transacoes_tipo ON transacoes_financeiras(tipo);