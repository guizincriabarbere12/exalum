-- Conferência de Materiais: add conferencia status to orcamentos and create conferencia tracking table

-- Add new status option: 'conferido' (already exists as text column, just need to support it in app)
-- Add conferencia tracking columns to orcamento_itens
ALTER TABLE orcamento_itens ADD COLUMN IF NOT EXISTS quantidade_conferida numeric DEFAULT 0;
ALTER TABLE orcamento_itens ADD COLUMN IF NOT EXISTS status_conferencia text DEFAULT 'pendente' CHECK (status_conferencia IN ('pendente', 'parcial', 'conferido'));

-- Create conferencia_materiais table for tracking the conference session
CREATE TABLE IF NOT EXISTS conferencia_materiais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  orcamento_id uuid NOT NULL REFERENCES orcamentos(id) ON DELETE CASCADE,
  conferido_por uuid REFERENCES auth.users(id),
  status text DEFAULT 'em_andamento' CHECK (status IN ('em_andamento', 'finalizada', 'cancelada')),
  data_inicio timestamptz DEFAULT now(),
  data_fim timestamptz,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

-- Create conferencia_baixas table for tracking individual stock debits during conference
CREATE TABLE IF NOT EXISTS conferencia_baixas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conferencia_id uuid NOT NULL REFERENCES conferencia_materiais(id) ON DELETE CASCADE,
  orcamento_item_id uuid NOT NULL REFERENCES orcamento_itens(id) ON DELETE CASCADE,
  produto_id uuid NOT NULL REFERENCES produtos(id),
  quantidade_baixada numeric NOT NULL DEFAULT 0,
  estoque_antes numeric,
  estoque_depois numeric,
  observacao text,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE conferencia_materiais ENABLE ROW LEVEL SECURITY;
ALTER TABLE conferencia_baixas ENABLE ROW LEVEL SECURITY;

-- RLS policies for conferencia_materiais
CREATE POLICY "select_own_conferencia_materiais" ON conferencia_materiais FOR SELECT
  TO authenticated USING (true);
CREATE POLICY "insert_own_conferencia_materiais" ON conferencia_materiais FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "update_own_conferencia_materiais" ON conferencia_materiais FOR UPDATE
  TO authenticated USING (auth.uid() = created_by);
CREATE POLICY "delete_own_conferencia_materiais" ON conferencia_materiais FOR DELETE
  TO authenticated USING (auth.uid() = created_by);

-- RLS policies for conferencia_baixas
CREATE POLICY "select_own_conferencia_baixas" ON conferencia_baixas FOR SELECT
  TO authenticated USING (true);
CREATE POLICY "insert_own_conferencia_baixas" ON conferencia_baixas FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "update_own_conferencia_baixas" ON conferencia_baixas FOR UPDATE
  TO authenticated USING (auth.uid() = created_by);
CREATE POLICY "delete_own_conferencia_baixas" ON conferencia_baixas FOR DELETE
  TO authenticated USING (auth.uid() = created_by);

-- Create function to process conference item (debit stock + register movement + update item)
CREATE OR REPLACE FUNCTION processar_conferencia_item(
  p_orcamento_item_id uuid,
  p_quantidade_conferida numeric,
  p_user_id uuid
)
RETURNS json
LANGUAGE plpgsql
AS $$
DECLARE
  v_orcamento_id uuid;
  v_produto_id uuid;
  v_quantidade_necessaria numeric;
  v_quantidade_ja_conferida numeric;
  v_estoque_atual numeric;
  v_nova_quantidade_conferida numeric;
  v_status_item text;
  v_conferencia_id uuid;
  v_estoque_antes numeric;
  v_estoque_depois numeric;
BEGIN
  -- Get item details
  SELECT orcamento_id, produto_id, quantidade, quantidade_conferida
  INTO v_orcamento_id, v_produto_id, v_quantidade_necessaria, v_quantidade_ja_conferida
  FROM orcamento_itens
  WHERE id = p_orcamento_item_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'message', 'Item não encontrado');
  END IF;

  -- Calculate new total conferida
  v_nova_quantidade_conferida := v_quantidade_ja_conferida + p_quantidade_conferida;

  -- Check if exceeding needed quantity
  IF v_nova_quantidade_conferida > v_quantidade_necessaria THEN
    RETURN json_build_object('success', false, 'message', 'Quantidade conferida excede a quantidade necessária');
  END IF;

  -- Check current stock
  SELECT quantidade INTO v_estoque_atual
  FROM estoque
  WHERE produto_id = v_produto_id;

  IF v_estoque_atual IS NULL THEN
    RETURN json_build_object('success', false, 'message', 'Produto não possui registro de estoque');
  END IF;

  IF v_estoque_atual < p_quantidade_conferida THEN
    RETURN json_build_object('success', false, 'message', 'Estoque insuficiente. Disponível: ' || v_estoque_atual || ', Necessário: ' || p_quantidade_conferida, 'estoque_disponivel', v_estoque_atual);
  END IF;

  -- Debit stock
  v_estoque_antes := v_estoque_atual;
  UPDATE estoque SET quantidade = quantidade - p_quantidade_conferida, updated_at = now()
  WHERE produto_id = v_produto_id
  RETURNING quantidade INTO v_estoque_depois;

  -- Register movement
  INSERT INTO movimentacao_estoque (produto_id, quantidade, tipo, created_by, observacao)
  VALUES (v_produto_id, p_quantidade_conferida, 'saida', p_user_id, 'Baixa por conferência de materiais - Orçamento ' || v_orcamento_id);

  -- Determine new status
  IF v_nova_quantidade_conferida >= v_quantidade_necessaria THEN
    v_status_item := 'conferido';
  ELSE
    v_status_item := 'parcial';
  END IF;

  -- Update orcamento_item
  UPDATE orcamento_itens
  SET quantidade_conferida = v_nova_quantidade_conferida,
      status_conferencia = v_status_item
  WHERE id = p_orcamento_item_id;

  -- Get or create conferencia session
  SELECT id INTO v_conferencia_id
  FROM conferencia_materiais
  WHERE orcamento_id = v_orcamento_id AND status = 'em_andamento'
  LIMIT 1;

  IF v_conferencia_id IS NULL THEN
    INSERT INTO conferencia_materiais (orcamento_id, conferido_por, created_by)
    VALUES (v_orcamento_id, p_user_id, p_user_id)
    RETURNING id INTO v_conferencia_id;
  END IF;

  -- Register baixa
  INSERT INTO conferencia_baixas (conferencia_id, orcamento_item_id, produto_id, quantidade_baixada, estoque_antes, estoque_depois, created_by)
  VALUES (v_conferencia_id, p_orcamento_item_id, v_produto_id, p_quantidade_conferida, v_estoque_antes, v_estoque_depois, p_user_id);

  -- Check if all items are conferido
  PERFORM 1 FROM orcamento_itens
  WHERE orcamento_id = v_orcamento_id AND status_conferencia != 'conferido';

  IF NOT FOUND THEN
    -- All items conferido, update orcamento status
    UPDATE orcamentos SET status = 'conferido', updated_at = now() WHERE id = v_orcamento_id;
    -- Finalize conferencia session
    UPDATE conferencia_materiais SET status = 'finalizada', data_fim = now() WHERE id = v_conferencia_id;
  END IF;

  RETURN json_build_object(
    'success', true,
    'message', 'Item conferido com sucesso',
    'status_conferencia', v_status_item,
    'estoque_disponivel', v_estoque_depois
  );
END;
$$;

-- Create function to finalize conference manually
CREATE OR REPLACE FUNCTION finalizar_conferencia(
  p_orcamento_id uuid,
  p_user_id uuid
)
RETURNS json
LANGUAGE plpgsql
AS $$
DECLARE
  v_pendentes integer;
  v_conferencia_id uuid;
BEGIN
  -- Check for pending items
  SELECT count(*) INTO v_pendentes
  FROM orcamento_itens
  WHERE orcamento_id = p_orcamento_id AND status_conferencia != 'conferido';

  IF v_pendentes > 0 THEN
    RETURN json_build_object('success', false, 'message', 'Existem ' || v_pendentes || ' item(ns) não conferido(s)');
  END IF;

  -- Update orcamento status
  UPDATE orcamentos SET status = 'conferido', updated_at = now() WHERE id = p_orcamento_id;

  -- Finalize conferencia session
  SELECT id INTO v_conferencia_id
  FROM conferencia_materiais
  WHERE orcamento_id = p_orcamento_id AND status = 'em_andamento'
  LIMIT 1;

  IF v_conferencia_id IS NOT NULL THEN
    UPDATE conferencia_materiais SET status = 'finalizada', data_fim = now() WHERE id = v_conferencia_id;
  END IF;

  RETURN json_build_object('success', true, 'message', 'Conferência finalizada com sucesso');
END;
$$;
