-- Drop existing function to recreate with new return type
DROP FUNCTION IF EXISTS finalizar_conferencia(uuid, uuid);
DROP FUNCTION IF EXISTS processar_conferencia_item(uuid, uuid, numeric, uuid);

-- Add conference tracking fields to orcamento_itens
ALTER TABLE orcamento_itens ADD COLUMN IF NOT EXISTS quantidade_conferida numeric DEFAULT 0;
ALTER TABLE orcamento_itens ADD COLUMN IF NOT EXISTS status_conferencia text DEFAULT 'pendente' CHECK (status_conferencia IN ('pendente', 'parcial', 'conferido'));

-- Add 'conferido' and 'separado' status options to orcamentos
ALTER TABLE orcamentos DROP CONSTRAINT IF EXISTS orcamentos_status_check;
ALTER TABLE orcamentos ADD CONSTRAINT orcamentos_status_check CHECK (status IN ('pendente', 'aprovado', 'rejeitado', 'cancelado', 'conferido', 'separado'));

-- Create conferencia_historico table
CREATE TABLE IF NOT EXISTS conferencia_historico (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  orcamento_id uuid NOT NULL REFERENCES orcamentos(id) ON DELETE CASCADE,
  produto_id uuid REFERENCES produtos(id) ON DELETE SET NULL,
  kit_id uuid REFERENCES kits(id) ON DELETE SET NULL,
  quantidade numeric NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('conferencia', 'estorno')),
  observacao text,
  conferido_por uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE conferencia_historico ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_conferencia_historico" ON conferencia_historico FOR SELECT
  TO authenticated USING (true);
CREATE POLICY "insert_conferencia_historico" ON conferencia_historico FOR INSERT
  TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "update_conferencia_historico" ON conferencia_historico FOR UPDATE
  TO authenticated USING (auth.uid() = conferido_por);
CREATE POLICY "delete_conferencia_historico" ON conferencia_historico FOR DELETE
  TO authenticated USING (auth.uid() = conferido_por);

CREATE POLICY "update_orcamento_itens_conferencia" ON orcamento_itens FOR UPDATE
  TO authenticated USING (true);

-- Function to process conference item
CREATE OR REPLACE FUNCTION processar_conferencia_item(
  p_orcamento_id uuid,
  p_produto_id uuid,
  p_quantidade numeric,
  p_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_estoque_disponivel numeric;
  v_quantidade_restante numeric;
  v_quantidade_conferida_atual numeric;
  v_quantidade_necessaria numeric;
BEGIN
  SELECT estoque INTO v_estoque_disponivel FROM produtos WHERE id = p_produto_id;
  IF v_estoque_disponivel IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Produto não encontrado');
  END IF;

  SELECT quantidade_conferida, quantidade INTO v_quantidade_conferida_atual, v_quantidade_necessaria
  FROM orcamento_itens WHERE orcamento_id = p_orcamento_id AND produto_id = p_produto_id;
  IF v_quantidade_conferida_atual IS NULL THEN v_quantidade_conferida_atual := 0; END IF;

  v_quantidade_restante := v_quantidade_necessaria - v_quantidade_conferida_atual;
  IF v_quantidade_restante <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Item já completamente conferido');
  END IF;
  IF p_quantidade > v_quantidade_restante THEN p_quantidade := v_quantidade_restante; END IF;

  IF v_estoque_disponivel < p_quantidade THEN
    RETURN jsonb_build_object('success', false, 'error', 'Estoque insuficiente', 'disponivel', v_estoque_disponivel, 'necessario', p_quantidade);
  END IF;

  UPDATE produtos SET estoque = estoque - p_quantidade WHERE id = p_produto_id;
  INSERT INTO movimentacao_estoque (produto_id, tipo, quantidade, observacao, created_by)
  VALUES (p_produto_id, 'saida', p_quantidade, 'Conferência de materiais', p_user_id);

  v_quantidade_conferida_atual := v_quantidade_conferida_atual + p_quantidade;
  UPDATE orcamento_itens SET quantidade_conferida = v_quantidade_conferida_atual,
    status_conferencia = CASE WHEN v_quantidade_conferida_atual >= quantidade THEN 'conferido' WHEN v_quantidade_conferida_atual > 0 THEN 'parcial' ELSE 'pendente' END
  WHERE orcamento_id = p_orcamento_id AND produto_id = p_produto_id;

  INSERT INTO conferencia_historico (orcamento_id, produto_id, quantidade, tipo, conferido_por, observacao)
  VALUES (p_orcamento_id, p_produto_id, p_quantidade, 'conferencia', p_user_id, 'Conferência via sistema');

  RETURN jsonb_build_object('success', true, 'quantidade_conferida', p_quantidade, 'total_conferido', v_quantidade_conferida_atual,
    'status', CASE WHEN v_quantidade_conferida_atual >= v_quantidade_necessaria THEN 'conferido' WHEN v_quantidade_conferida_atual > 0 THEN 'parcial' ELSE 'pendente' END);
END;
$$;

-- Function to finalize conference
CREATE OR REPLACE FUNCTION finalizar_conferencia(
  p_orcamento_id uuid,
  p_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_pendentes integer;
  v_parciais integer;
BEGIN
  SELECT COUNT(*) FILTER (WHERE status_conferencia = 'pendente'), COUNT(*) FILTER (WHERE status_conferencia = 'parcial')
  INTO v_pendentes, v_parciais FROM orcamento_itens WHERE orcamento_id = p_orcamento_id;

  IF v_pendentes > 0 OR v_parciais > 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Itens pendentes ou parciais', 'pendentes', v_pendentes, 'parciais', v_parciais);
  END IF;

  UPDATE orcamentos SET status = 'conferido' WHERE id = p_orcamento_id;
  RETURN jsonb_build_object('success', true, 'message', 'Conferência finalizada');
END;
$$;
