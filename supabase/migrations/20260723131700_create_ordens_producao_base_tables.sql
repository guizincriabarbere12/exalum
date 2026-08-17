-- Exalum-specific: unlike Kits do Brasil, this database never had `ordens_producao` /
-- `ordens_producao_historico` (they predate the migrations tracked in this repo on the
-- Kits do Brasil side). Create the base shape here so the next migration
-- (add_filiais_transferencias_produto_destino) can safely ALTER it.
CREATE TABLE IF NOT EXISTS ordens_producao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero text NOT NULL,
  produto_id uuid NOT NULL REFERENCES produtos(id) ON DELETE RESTRICT,
  quantidade numeric NOT NULL CHECK (quantidade > 0),
  data_saida date NOT NULL DEFAULT CURRENT_DATE,
  data_retorno date,
  custo_pintura numeric DEFAULT 0,
  status text NOT NULL DEFAULT 'em_pintura' CHECK (status IN ('em_pintura', 'retornado', 'cancelada')),
  observacoes text,
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ordens_producao_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  op_id uuid NOT NULL REFERENCES ordens_producao(id) ON DELETE CASCADE,
  status_anterior text,
  status_novo text NOT NULL,
  observacoes text,
  usuario_id uuid,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE ordens_producao ENABLE ROW LEVEL SECURITY;
ALTER TABLE ordens_producao_historico ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_ordens_producao" ON ordens_producao;
CREATE POLICY "select_ordens_producao" ON ordens_producao FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "insert_ordens_producao" ON ordens_producao;
CREATE POLICY "insert_ordens_producao" ON ordens_producao FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "update_ordens_producao" ON ordens_producao;
CREATE POLICY "update_ordens_producao" ON ordens_producao FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "delete_ordens_producao" ON ordens_producao;
CREATE POLICY "delete_ordens_producao" ON ordens_producao FOR DELETE TO authenticated USING (true);

DROP POLICY IF EXISTS "select_op_historico" ON ordens_producao_historico;
CREATE POLICY "select_op_historico" ON ordens_producao_historico FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "insert_op_historico" ON ordens_producao_historico;
CREATE POLICY "insert_op_historico" ON ordens_producao_historico FOR INSERT TO authenticated WITH CHECK (true);
