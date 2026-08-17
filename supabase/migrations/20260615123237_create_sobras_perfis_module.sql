-- Tabela principal de sobras de perfis de alumínio
CREATE TABLE IF NOT EXISTS sobras_perfis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo_perfil text NOT NULL,
  nome_perfil text NOT NULL,
  categoria text,
  cor text,
  comprimento_mm numeric NOT NULL CHECK (comprimento_mm > 0),
  peso_kg_m numeric,
  peso_total_kg numeric GENERATED ALWAYS AS (
    CASE WHEN peso_kg_m IS NOT NULL THEN ROUND((comprimento_mm / 1000.0 * peso_kg_m)::numeric, 4) ELSE NULL END
  ) STORED,
  valor_por_kg numeric DEFAULT 0,
  valor_calculado numeric GENERATED ALWAYS AS (
    CASE WHEN peso_kg_m IS NOT NULL AND valor_por_kg IS NOT NULL
      THEN ROUND((comprimento_mm / 1000.0 * peso_kg_m * valor_por_kg)::numeric, 2)
      ELSE 0 END
  ) STORED,
  data_geracao date NOT NULL DEFAULT CURRENT_DATE,
  origem text NOT NULL DEFAULT 'Manual' CHECK (origem IN ('Orçamento', 'Produção', 'Manual')),
  orcamento_id uuid REFERENCES orcamentos(id) ON DELETE SET NULL,
  observacoes text,
  localizacao text,
  status text NOT NULL DEFAULT 'disponivel' CHECK (status IN ('disponivel', 'vendido', 'descartado', 'reservado')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Tabela de vendas de sobras
CREATE TABLE IF NOT EXISTS sobras_vendas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sobra_id uuid NOT NULL REFERENCES sobras_perfis(id) ON DELETE CASCADE,
  cliente_id uuid REFERENCES clientes(id) ON DELETE SET NULL,
  cliente_nome text,
  valor_venda numeric NOT NULL DEFAULT 0,
  data_venda timestamptz NOT NULL DEFAULT now(),
  observacoes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_sobras_perfis_status ON sobras_perfis(status);
CREATE INDEX IF NOT EXISTS idx_sobras_perfis_codigo ON sobras_perfis(codigo_perfil);
CREATE INDEX IF NOT EXISTS idx_sobras_perfis_categoria ON sobras_perfis(categoria);
CREATE INDEX IF NOT EXISTS idx_sobras_vendas_sobra ON sobras_vendas(sobra_id);

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_sobras_perfis_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sobras_perfis_updated_at ON sobras_perfis;
CREATE TRIGGER trg_sobras_perfis_updated_at
  BEFORE UPDATE ON sobras_perfis
  FOR EACH ROW EXECUTE FUNCTION update_sobras_perfis_updated_at();

-- RLS
ALTER TABLE sobras_perfis ENABLE ROW LEVEL SECURITY;
ALTER TABLE sobras_vendas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_sobras_perfis" ON sobras_perfis FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_sobras_perfis" ON sobras_perfis FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "update_sobras_perfis" ON sobras_perfis FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_sobras_perfis" ON sobras_perfis FOR DELETE TO authenticated USING (true);

CREATE POLICY "select_sobras_vendas" ON sobras_vendas FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_sobras_vendas" ON sobras_vendas FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "update_sobras_vendas" ON sobras_vendas FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_sobras_vendas" ON sobras_vendas FOR DELETE TO authenticated USING (true);
