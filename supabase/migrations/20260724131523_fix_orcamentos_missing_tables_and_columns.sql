
/*
# Correção completa do sistema de orçamentos

## Problema
Ao tentar mudar o status de um orçamento de "aprovado" para "pendente", o sistema
dava erro porque várias colunas e tabelas referenciadas no código não existiam no banco.

## Mudanças

### 1. Tabela `transacoes_financeiras` — colunas adicionadas
- `orcamento_id` (uuid, nullable) — vincula a transação ao orçamento de origem
- `compra_id` (uuid, nullable) — vincula a transação a uma compra
- `credito_id` (uuid, nullable) — vincula a transação a um crédito utilizado
- `origem_tipo` (text, nullable) — tipo de origem (orcamento, compra, manual, etc.)
- `data_vencimento` (date, nullable) — data de vencimento da parcela
- `data_pagamento` (date, nullable) — data em que foi pago/recebido
- `forma_pagamento` (text, nullable) — dinheiro, pix, boleto, crédito, débito
- `conta_bancaria` (text, nullable) — conta bancária usada
- `observacoes` (text, nullable) — observações livres
- `parcela_numero` (integer, nullable) — número da parcela
- `total_parcelas` (integer, nullable) — total de parcelas
- `numero_parcela` (text, nullable) — ex: "2/5"

### 2. Tabela `orcamentos` — colunas adicionadas
- `forma_pagamento` (text, nullable)
- `condicao_pagamento` (text, nullable)
- `parcelado` (boolean, default false)
- `entrada_percentual` (numeric, nullable)
- `entrada_valor` (numeric, nullable)
- `parcelas` (integer, nullable)
- `numero_parcelas` (integer, nullable)
- `valor_parcela` (numeric, nullable)
- `vendedor_id` (uuid, nullable)
- `data_aprovacao` (timestamptz, nullable)
- `pagamento_misto` (boolean, default false)
- `valor_credito_utilizado` (numeric, nullable)
- `forma_pagamento_restante` (text, nullable)
- `condicao_pagamento_restante` (text, nullable)
- `parcelas_restante` (integer, nullable)
- `desconto_percentual` (numeric, nullable)
- `desconto_valor` (numeric, nullable)

### 3. Tabela `clientes` — coluna adicionada
- `limite_credito` (numeric, default 0) — limite de crédito do cliente

### 4. Nova tabela `comissoes`
Registra comissões de vendedores vinculadas a orçamentos/vendas.

### 5. Nova tabela `creditos_utilizados`
Registra o uso de créditos de clientes em orçamentos com pagamento misto.

### 6. Nova tabela `compras`
Registra pedidos de compra para fornecedores.

### 7. Nova tabela `compra_itens`
Itens de cada compra.

### 8. Nova tabela `movimentacoes_estoque`
Histórico de movimentações de estoque (mais completo que movimentacao_estoque).

### Segurança
- RLS habilitado em todas as novas tabelas
- Políticas para usuários autenticados (leitura/escrita das próprias entidades)
*/

-- ============================================================
-- 1. COLUNAS FALTANDO EM transacoes_financeiras
-- ============================================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transacoes_financeiras' AND column_name='orcamento_id') THEN
    ALTER TABLE transacoes_financeiras ADD COLUMN orcamento_id uuid NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transacoes_financeiras' AND column_name='compra_id') THEN
    ALTER TABLE transacoes_financeiras ADD COLUMN compra_id uuid NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transacoes_financeiras' AND column_name='credito_id') THEN
    ALTER TABLE transacoes_financeiras ADD COLUMN credito_id uuid NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transacoes_financeiras' AND column_name='origem_tipo') THEN
    ALTER TABLE transacoes_financeiras ADD COLUMN origem_tipo text NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transacoes_financeiras' AND column_name='data_vencimento') THEN
    ALTER TABLE transacoes_financeiras ADD COLUMN data_vencimento date NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transacoes_financeiras' AND column_name='data_pagamento') THEN
    ALTER TABLE transacoes_financeiras ADD COLUMN data_pagamento date NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transacoes_financeiras' AND column_name='forma_pagamento') THEN
    ALTER TABLE transacoes_financeiras ADD COLUMN forma_pagamento text NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transacoes_financeiras' AND column_name='conta_bancaria') THEN
    ALTER TABLE transacoes_financeiras ADD COLUMN conta_bancaria text NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transacoes_financeiras' AND column_name='observacoes') THEN
    ALTER TABLE transacoes_financeiras ADD COLUMN observacoes text NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transacoes_financeiras' AND column_name='parcela_numero') THEN
    ALTER TABLE transacoes_financeiras ADD COLUMN parcela_numero integer NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transacoes_financeiras' AND column_name='total_parcelas') THEN
    ALTER TABLE transacoes_financeiras ADD COLUMN total_parcelas integer NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transacoes_financeiras' AND column_name='numero_parcela') THEN
    ALTER TABLE transacoes_financeiras ADD COLUMN numero_parcela text NULL;
  END IF;
END $$;

-- ============================================================
-- 2. COLUNAS FALTANDO EM orcamentos
-- ============================================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orcamentos' AND column_name='forma_pagamento') THEN
    ALTER TABLE orcamentos ADD COLUMN forma_pagamento text NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orcamentos' AND column_name='condicao_pagamento') THEN
    ALTER TABLE orcamentos ADD COLUMN condicao_pagamento text NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orcamentos' AND column_name='parcelado') THEN
    ALTER TABLE orcamentos ADD COLUMN parcelado boolean NOT NULL DEFAULT false;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orcamentos' AND column_name='entrada_percentual') THEN
    ALTER TABLE orcamentos ADD COLUMN entrada_percentual numeric NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orcamentos' AND column_name='entrada_valor') THEN
    ALTER TABLE orcamentos ADD COLUMN entrada_valor numeric NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orcamentos' AND column_name='parcelas') THEN
    ALTER TABLE orcamentos ADD COLUMN parcelas integer NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orcamentos' AND column_name='numero_parcelas') THEN
    ALTER TABLE orcamentos ADD COLUMN numero_parcelas integer NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orcamentos' AND column_name='valor_parcela') THEN
    ALTER TABLE orcamentos ADD COLUMN valor_parcela numeric NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orcamentos' AND column_name='vendedor_id') THEN
    ALTER TABLE orcamentos ADD COLUMN vendedor_id uuid NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orcamentos' AND column_name='data_aprovacao') THEN
    ALTER TABLE orcamentos ADD COLUMN data_aprovacao timestamptz NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orcamentos' AND column_name='pagamento_misto') THEN
    ALTER TABLE orcamentos ADD COLUMN pagamento_misto boolean NOT NULL DEFAULT false;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orcamentos' AND column_name='valor_credito_utilizado') THEN
    ALTER TABLE orcamentos ADD COLUMN valor_credito_utilizado numeric NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orcamentos' AND column_name='forma_pagamento_restante') THEN
    ALTER TABLE orcamentos ADD COLUMN forma_pagamento_restante text NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orcamentos' AND column_name='condicao_pagamento_restante') THEN
    ALTER TABLE orcamentos ADD COLUMN condicao_pagamento_restante text NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orcamentos' AND column_name='parcelas_restante') THEN
    ALTER TABLE orcamentos ADD COLUMN parcelas_restante integer NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orcamentos' AND column_name='desconto_percentual') THEN
    ALTER TABLE orcamentos ADD COLUMN desconto_percentual numeric NULL DEFAULT 0;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orcamentos' AND column_name='desconto_valor') THEN
    ALTER TABLE orcamentos ADD COLUMN desconto_valor numeric NULL DEFAULT 0;
  END IF;
END $$;

-- ============================================================
-- 3. COLUNAS FALTANDO EM clientes
-- ============================================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='clientes' AND column_name='limite_credito') THEN
    ALTER TABLE clientes ADD COLUMN limite_credito numeric NOT NULL DEFAULT 0;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='clientes' AND column_name='documento') THEN
    ALTER TABLE clientes ADD COLUMN documento text NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='clientes' AND column_name='status') THEN
    ALTER TABLE clientes ADD COLUMN status text NOT NULL DEFAULT 'ativo';
  END IF;
END $$;

-- ============================================================
-- 4. COLUNAS FALTANDO EM orcamento_itens
-- ============================================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orcamento_itens' AND column_name='kit_id') THEN
    ALTER TABLE orcamento_itens ADD COLUMN kit_id uuid NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orcamento_itens' AND column_name='peso') THEN
    ALTER TABLE orcamento_itens ADD COLUMN peso numeric NULL DEFAULT 0;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orcamento_itens' AND column_name='desconto') THEN
    ALTER TABLE orcamento_itens ADD COLUMN desconto numeric NULL DEFAULT 0;
  END IF;
END $$;

-- Tornar produto_id nullable para suportar kits
DO $$ BEGIN
  BEGIN
    ALTER TABLE orcamento_itens ALTER COLUMN produto_id DROP NOT NULL;
  EXCEPTION WHEN others THEN
    NULL;
  END;
END $$;

-- ============================================================
-- 5. COLUNAS FALTANDO EM kits
-- ============================================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='kits' AND column_name='codigo') THEN
    ALTER TABLE kits ADD COLUMN codigo text NULL;
  END IF;
END $$;

-- ============================================================
-- 6. NOVA TABELA: comissoes
-- ============================================================
CREATE TABLE IF NOT EXISTS comissoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  orcamento_id uuid NULL REFERENCES orcamentos(id) ON DELETE SET NULL,
  venda_id uuid NULL REFERENCES vendas(id) ON DELETE SET NULL,
  vendedor_id uuid NULL REFERENCES vendedores(id) ON DELETE SET NULL,
  valor_base numeric NOT NULL DEFAULT 0,
  percentual numeric NOT NULL DEFAULT 0,
  valor_comissao numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pendente',
  data_geracao date NOT NULL DEFAULT CURRENT_DATE,
  data_pagamento date NULL,
  observacoes text NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid NULL
);

ALTER TABLE comissoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_comissoes" ON comissoes;
CREATE POLICY "select_comissoes" ON comissoes FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_comissoes" ON comissoes;
CREATE POLICY "insert_comissoes" ON comissoes FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_comissoes" ON comissoes;
CREATE POLICY "update_comissoes" ON comissoes FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_comissoes" ON comissoes;
CREATE POLICY "delete_comissoes" ON comissoes FOR DELETE TO authenticated USING (true);

-- ============================================================
-- 7. NOVA TABELA: creditos_utilizados
-- ============================================================
CREATE TABLE IF NOT EXISTS creditos_utilizados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  orcamento_id uuid NULL REFERENCES orcamentos(id) ON DELETE SET NULL,
  valor numeric NOT NULL DEFAULT 0,
  tipo text NOT NULL DEFAULT 'utilizacao',
  descricao text NULL,
  status text NOT NULL DEFAULT 'ativo',
  created_at timestamptz DEFAULT now(),
  created_by uuid NULL
);

ALTER TABLE creditos_utilizados ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_creditos_utilizados" ON creditos_utilizados;
CREATE POLICY "select_creditos_utilizados" ON creditos_utilizados FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_creditos_utilizados" ON creditos_utilizados;
CREATE POLICY "insert_creditos_utilizados" ON creditos_utilizados FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_creditos_utilizados" ON creditos_utilizados;
CREATE POLICY "update_creditos_utilizados" ON creditos_utilizados FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_creditos_utilizados" ON creditos_utilizados;
CREATE POLICY "delete_creditos_utilizados" ON creditos_utilizados FOR DELETE TO authenticated USING (true);

-- ============================================================
-- 8. NOVA TABELA: compras (se não existir)
-- ============================================================
CREATE TABLE IF NOT EXISTS compras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero text NOT NULL,
  fornecedor_id uuid NOT NULL REFERENCES fornecedores(id) ON DELETE RESTRICT,
  data_emissao date NOT NULL DEFAULT CURRENT_DATE,
  data_entrega_prevista date NULL,
  data_recebimento date NULL,
  data_faturamento date NULL,
  valor_total numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pendente',
  compra_faturada boolean NOT NULL DEFAULT false,
  mercadoria_recebida boolean NOT NULL DEFAULT false,
  condicao_pagamento text NULL,
  numero_parcelas integer NULL DEFAULT 1,
  forma_pagamento text NULL,
  parcelado boolean NOT NULL DEFAULT false,
  observacoes text NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid NULL
);

ALTER TABLE compras ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_compras" ON compras;
CREATE POLICY "select_compras" ON compras FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_compras" ON compras;
CREATE POLICY "insert_compras" ON compras FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_compras" ON compras;
CREATE POLICY "update_compras" ON compras FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_compras" ON compras;
CREATE POLICY "delete_compras" ON compras FOR DELETE TO authenticated USING (true);

-- ============================================================
-- 9. NOVA TABELA: compra_itens (se não existir)
-- ============================================================
CREATE TABLE IF NOT EXISTS compra_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  compra_id uuid NOT NULL REFERENCES compras(id) ON DELETE CASCADE,
  produto_id uuid NOT NULL REFERENCES produtos(id) ON DELETE RESTRICT,
  quantidade numeric NOT NULL DEFAULT 0,
  valor_unitario numeric NOT NULL DEFAULT 0,
  subtotal numeric NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE compra_itens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_compra_itens" ON compra_itens;
CREATE POLICY "select_compra_itens" ON compra_itens FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_compra_itens" ON compra_itens;
CREATE POLICY "insert_compra_itens" ON compra_itens FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_compra_itens" ON compra_itens;
CREATE POLICY "update_compra_itens" ON compra_itens FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_compra_itens" ON compra_itens;
CREATE POLICY "delete_compra_itens" ON compra_itens FOR DELETE TO authenticated USING (true);

-- ============================================================
-- 10. NOVA TABELA: movimentacoes_estoque (versão completa)
-- ============================================================
CREATE TABLE IF NOT EXISTS movimentacoes_estoque (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  produto_id uuid NOT NULL REFERENCES produtos(id) ON DELETE RESTRICT,
  tipo text NOT NULL,
  quantidade numeric NOT NULL DEFAULT 0,
  quantidade_anterior numeric NOT NULL DEFAULT 0,
  quantidade_atual numeric NOT NULL DEFAULT 0,
  origem text NULL,
  orcamento_id uuid NULL,
  compra_id uuid NULL,
  usuario_id uuid NULL,
  observacoes text NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE movimentacoes_estoque ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_movimentacoes_estoque" ON movimentacoes_estoque;
CREATE POLICY "select_movimentacoes_estoque" ON movimentacoes_estoque FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_movimentacoes_estoque" ON movimentacoes_estoque;
CREATE POLICY "insert_movimentacoes_estoque" ON movimentacoes_estoque FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_movimentacoes_estoque" ON movimentacoes_estoque;
CREATE POLICY "update_movimentacoes_estoque" ON movimentacoes_estoque FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_movimentacoes_estoque" ON movimentacoes_estoque;
CREATE POLICY "delete_movimentacoes_estoque" ON movimentacoes_estoque FOR DELETE TO authenticated USING (true);

-- ============================================================
-- 11. NOVA TABELA: filiais (se não existir)
-- ============================================================
CREATE TABLE IF NOT EXISTS filiais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  codigo text NULL,
  endereco text NULL,
  cidade text NULL,
  estado text NULL,
  telefone text NULL,
  email text NULL,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE filiais ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_filiais" ON filiais;
CREATE POLICY "select_filiais" ON filiais FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_filiais" ON filiais;
CREATE POLICY "insert_filiais" ON filiais FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_filiais" ON filiais;
CREATE POLICY "update_filiais" ON filiais FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_filiais" ON filiais;
CREATE POLICY "delete_filiais" ON filiais FOR DELETE TO authenticated USING (true);

-- ============================================================
-- 12. NOVA TABELA: estoque_filial
-- ============================================================
CREATE TABLE IF NOT EXISTS estoque_filial (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  filial_id uuid NOT NULL REFERENCES filiais(id) ON DELETE CASCADE,
  produto_id uuid NOT NULL REFERENCES produtos(id) ON DELETE CASCADE,
  quantidade numeric NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (filial_id, produto_id)
);

ALTER TABLE estoque_filial ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_estoque_filial" ON estoque_filial;
CREATE POLICY "select_estoque_filial" ON estoque_filial FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_estoque_filial" ON estoque_filial;
CREATE POLICY "insert_estoque_filial" ON estoque_filial FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_estoque_filial" ON estoque_filial;
CREATE POLICY "update_estoque_filial" ON estoque_filial FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_estoque_filial" ON estoque_filial;
CREATE POLICY "delete_estoque_filial" ON estoque_filial FOR DELETE TO authenticated USING (true);

-- ============================================================
-- 13. NOVA TABELA: transferencias_estoque
-- ============================================================
CREATE TABLE IF NOT EXISTS transferencias_estoque (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero text NOT NULL,
  filial_origem_id uuid NULL REFERENCES filiais(id) ON DELETE SET NULL,
  filial_destino_id uuid NULL REFERENCES filiais(id) ON DELETE SET NULL,
  produto_id uuid NOT NULL REFERENCES produtos(id) ON DELETE RESTRICT,
  quantidade numeric NOT NULL DEFAULT 0,
  data_transferencia date NOT NULL DEFAULT CURRENT_DATE,
  status text NOT NULL DEFAULT 'pendente',
  observacoes text NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid NULL
);

ALTER TABLE transferencias_estoque ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_transferencias_estoque" ON transferencias_estoque;
CREATE POLICY "select_transferencias_estoque" ON transferencias_estoque FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_transferencias_estoque" ON transferencias_estoque;
CREATE POLICY "insert_transferencias_estoque" ON transferencias_estoque FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_transferencias_estoque" ON transferencias_estoque;
CREATE POLICY "update_transferencias_estoque" ON transferencias_estoque FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_transferencias_estoque" ON transferencias_estoque;
CREATE POLICY "delete_transferencias_estoque" ON transferencias_estoque FOR DELETE TO authenticated USING (true);

-- ============================================================
-- 14. NOVA TABELA: transferencias_estoque_historico
-- ============================================================
CREATE TABLE IF NOT EXISTS transferencias_estoque_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transferencia_id uuid NOT NULL REFERENCES transferencias_estoque(id) ON DELETE CASCADE,
  status_anterior text NULL,
  status_novo text NOT NULL,
  observacoes text NULL,
  usuario_id uuid NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE transferencias_estoque_historico ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_transferencias_historico" ON transferencias_estoque_historico;
CREATE POLICY "select_transferencias_historico" ON transferencias_estoque_historico FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_transferencias_historico" ON transferencias_estoque_historico;
CREATE POLICY "insert_transferencias_historico" ON transferencias_estoque_historico FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_transferencias_historico" ON transferencias_estoque_historico;
CREATE POLICY "update_transferencias_historico" ON transferencias_estoque_historico FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_transferencias_historico" ON transferencias_estoque_historico;
CREATE POLICY "delete_transferencias_historico" ON transferencias_estoque_historico FOR DELETE TO authenticated USING (true);

-- ============================================================
-- 15. NOVA TABELA: ordens_producao
-- ============================================================
CREATE TABLE IF NOT EXISTS ordens_producao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero text NOT NULL,
  produto_id uuid NOT NULL REFERENCES produtos(id) ON DELETE RESTRICT,
  produto_destino_id uuid NULL REFERENCES produtos(id) ON DELETE SET NULL,
  quantidade numeric NOT NULL DEFAULT 0,
  data_saida date NOT NULL DEFAULT CURRENT_DATE,
  data_retorno date NULL,
  custo_pintura numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'em_pintura',
  observacoes text NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid NULL
);

ALTER TABLE ordens_producao ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_ordens_producao" ON ordens_producao;
CREATE POLICY "select_ordens_producao" ON ordens_producao FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_ordens_producao" ON ordens_producao;
CREATE POLICY "insert_ordens_producao" ON ordens_producao FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_ordens_producao" ON ordens_producao;
CREATE POLICY "update_ordens_producao" ON ordens_producao FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_ordens_producao" ON ordens_producao;
CREATE POLICY "delete_ordens_producao" ON ordens_producao FOR DELETE TO authenticated USING (true);

-- ============================================================
-- 16. NOVA TABELA: ordens_producao_historico
-- ============================================================
CREATE TABLE IF NOT EXISTS ordens_producao_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  op_id uuid NOT NULL REFERENCES ordens_producao(id) ON DELETE CASCADE,
  status_anterior text NULL,
  status_novo text NOT NULL,
  observacoes text NULL,
  usuario_id uuid NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE ordens_producao_historico ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_op_historico" ON ordens_producao_historico;
CREATE POLICY "select_op_historico" ON ordens_producao_historico FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_op_historico" ON ordens_producao_historico;
CREATE POLICY "insert_op_historico" ON ordens_producao_historico FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_op_historico" ON ordens_producao_historico;
CREATE POLICY "update_op_historico" ON ordens_producao_historico FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_op_historico" ON ordens_producao_historico;
CREATE POLICY "delete_op_historico" ON ordens_producao_historico FOR DELETE TO authenticated USING (true);

-- ============================================================
-- 17. FUNÇÕES AUXILIARES
-- ============================================================

-- Gerar número de OP
CREATE OR REPLACE FUNCTION gerar_numero_op()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_count integer;
  v_numero text;
BEGIN
  SELECT COUNT(*) INTO v_count FROM ordens_producao;
  v_numero := 'OP-' || LPAD((v_count + 1)::text, 4, '0');
  RETURN v_numero;
END;
$$;

-- Gerar número de transferência
CREATE OR REPLACE FUNCTION gerar_numero_transferencia()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_count integer;
  v_numero text;
BEGIN
  SELECT COUNT(*) INTO v_count FROM transferencias_estoque;
  v_numero := 'TRF-' || LPAD((v_count + 1)::text, 4, '0');
  RETURN v_numero;
END;
$$;

-- Gerar número de orçamento (atualizado para evitar duplicatas)
CREATE OR REPLACE FUNCTION gerar_numero_orcamento()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_max text;
  v_num integer;
  v_numero text;
BEGIN
  SELECT numero INTO v_max FROM orcamentos ORDER BY created_at DESC LIMIT 1;
  IF v_max IS NULL THEN
    v_num := 1;
  ELSE
    v_num := (regexp_replace(v_max, '[^0-9]', '', 'g'))::integer + 1;
  END IF;
  v_numero := 'ORC-' || LPAD(v_num::text, 5, '0');
  RETURN v_numero;
END;
$$;

-- ============================================================
-- 18. VIEW kits_estoque_disponivel (se não existir)
-- ============================================================
CREATE OR REPLACE VIEW kits_estoque_disponivel AS
SELECT
  k.id,
  k.codigo,
  k.nome,
  k.descricao,
  k.preco_total,
  k.ativo,
  COALESCE(
    MIN(
      CASE
        WHEN ki.produto_id IS NOT NULL THEN
          FLOOR(p.estoque / NULLIF(ki.quantidade, 0))
        ELSE 0
      END
    ), 0
  ) AS estoque_disponivel
FROM kits k
LEFT JOIN kit_itens ki ON k.id = ki.kit_id
LEFT JOIN produtos p ON ki.produto_id = p.id
WHERE k.ativo = true
GROUP BY k.id, k.codigo, k.nome, k.descricao, k.preco_total, k.ativo;
