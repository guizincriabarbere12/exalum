-- Add preco_por_kg column to produtos table if not exists
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS preco_por_kg numeric;

-- Create table for financial transactions
CREATE TABLE IF NOT EXISTS transacoes_financeiras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL CHECK (tipo IN ('receita', 'despesa')),
  descricao text NOT NULL,
  valor numeric NOT NULL,
  categoria text,
  data date NOT NULL DEFAULT CURRENT_DATE,
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'recebido', 'pago', 'cancelado')),
  venda_id uuid REFERENCES vendas(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Create table for product kits
CREATE TABLE IF NOT EXISTS kits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  descricao text,
  preco_venda numeric NOT NULL,
  ativo boolean DEFAULT true,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Create table for kit items
CREATE TABLE IF NOT EXISTS kit_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kit_id uuid NOT NULL REFERENCES kits(id) ON DELETE CASCADE,
  produto_id uuid NOT NULL REFERENCES produtos(id) ON DELETE CASCADE,
  quantidade numeric NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE transacoes_financeiras ENABLE ROW LEVEL SECURITY;
ALTER TABLE kits ENABLE ROW LEVEL SECURITY;
ALTER TABLE kit_itens ENABLE ROW LEVEL SECURITY;

-- RLS Policies for transacoes_financeiras
CREATE POLICY "Authenticated users can view transacoes"
  ON transacoes_financeiras FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can insert transacoes"
  ON transacoes_financeiras FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update transacoes"
  ON transacoes_financeiras FOR UPDATE
  USING (true);

CREATE POLICY "Admins can delete transacoes"
  ON transacoes_financeiras FOR DELETE
  USING (has_role(auth.uid(), 'admin'));

-- RLS Policies for kits
CREATE POLICY "Authenticated users can view kits"
  ON kits FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage kits"
  ON kits FOR ALL
  USING (has_role(auth.uid(), 'admin'));

-- RLS Policies for kit_itens
CREATE POLICY "Authenticated users can view kit_itens"
  ON kit_itens FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage kit_itens"
  ON kit_itens FOR ALL
  USING (has_role(auth.uid(), 'admin'));

-- Create trigger for updated_at
CREATE TRIGGER update_transacoes_updated_at
  BEFORE UPDATE ON transacoes_financeiras
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_kits_updated_at
  BEFORE UPDATE ON kits
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create function to check kit availability
CREATE OR REPLACE FUNCTION check_kit_availability(kit_id_param uuid)
RETURNS TABLE(produto_id uuid, produto_nome text, necessario numeric, disponivel numeric, faltando numeric)
LANGUAGE sql
STABLE
AS $$
  SELECT 
    ki.produto_id,
    p.descricao as produto_nome,
    ki.quantidade as necessario,
    COALESCE(e.quantidade, 0) as disponivel,
    GREATEST(ki.quantidade - COALESCE(e.quantidade, 0), 0) as faltando
  FROM kit_itens ki
  JOIN produtos p ON p.id = ki.produto_id
  LEFT JOIN estoque e ON e.produto_id = ki.produto_id
  WHERE ki.kit_id = kit_id_param;
$$;

-- Create function to get dashboard stats
CREATE OR REPLACE FUNCTION get_dashboard_stats()
RETURNS json
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  result json;
BEGIN
  SELECT json_build_object(
    'total_produtos', (SELECT COUNT(*) FROM produtos),
    'total_kg_aluminio', (SELECT COALESCE(SUM(e.quantidade * p.peso), 0) FROM estoque e JOIN produtos p ON p.id = e.produto_id),
    'valor_total_estoque', (SELECT COALESCE(SUM(e.quantidade * p.preco_venda), 0) FROM estoque e JOIN produtos p ON p.id = e.produto_id),
    'receitas_mes', (SELECT COALESCE(SUM(valor), 0) FROM transacoes_financeiras WHERE tipo = 'receita' AND EXTRACT(MONTH FROM data) = EXTRACT(MONTH FROM CURRENT_DATE) AND EXTRACT(YEAR FROM data) = EXTRACT(YEAR FROM CURRENT_DATE)),
    'despesas_mes', (SELECT COALESCE(SUM(valor), 0) FROM transacoes_financeiras WHERE tipo = 'despesa' AND EXTRACT(MONTH FROM data) = EXTRACT(MONTH FROM CURRENT_DATE) AND EXTRACT(YEAR FROM data) = EXTRACT(YEAR FROM CURRENT_DATE)),
    'vendas_mes', (SELECT COALESCE(SUM(valor_total), 0) FROM vendas WHERE EXTRACT(MONTH FROM created_at) = EXTRACT(MONTH FROM CURRENT_DATE) AND EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM CURRENT_DATE))
  ) INTO result;
  
  RETURN result;
END;
$$;