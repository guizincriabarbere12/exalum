/*
  # Sistema de Catálogo e Pedidos para Clientes

  1. Modificar tabela pedidos para aceitar pedidos de clientes
  2. Criar função para processar pedido do cliente
  3. Garantir débito de estoque ao confirmar pedido
  4. Criar RLS para clientes acessarem seus pedidos
*/

-- 1. ADICIONAR COLUNA DE ORIGEM DO PEDIDO
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pedidos' AND column_name = 'origem'
  ) THEN
    ALTER TABLE pedidos ADD COLUMN origem TEXT DEFAULT 'admin';
  END IF;
END $$;

COMMENT ON COLUMN pedidos.origem IS 'admin (criado pelo admin) ou catalogo (criado pelo cliente via catálogo)';

-- 2. ATUALIZAR STATUS DO PEDIDO PARA INCLUIR NOVOS ESTADOS
ALTER TABLE pedidos ALTER COLUMN status SET DEFAULT 'pendente';

COMMENT ON COLUMN pedidos.status IS 'pendente (aguardando aprovação), aprovado, aguardando_producao, em_producao, finalizado, cancelado';

-- 3. CRIAR FUNÇÃO PARA CLIENTE CRIAR PEDIDO DO CATÁLOGO
CREATE OR REPLACE FUNCTION criar_pedido_catalogo(
  cliente_id_param UUID,
  itens_json JSON,
  observacoes_param TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  pedido_id UUID;
  numero_pedido TEXT;
  item JSON;
  estoque_atual INTEGER;
  produto_nome TEXT;
  total_calculado NUMERIC := 0;
BEGIN
  -- Gerar número único para o pedido
  numero_pedido := gerar_numero_pedido();

  -- Verificar estoque de todos os itens antes de criar pedido
  FOR item IN SELECT * FROM json_array_elements(itens_json)
  LOOP
    -- Verificar se é produto
    IF (item->>'produto_id') IS NOT NULL THEN
      SELECT estoque, nome INTO estoque_atual, produto_nome
      FROM produtos
      WHERE id = (item->>'produto_id')::UUID;

      IF estoque_atual < (item->>'quantidade')::INTEGER THEN
        RETURN json_build_object(
          'success', false,
          'message', 'Estoque insuficiente para: ' || produto_nome
        );
      END IF;
    END IF;

    -- Verificar se é kit
    IF (item->>'kit_id') IS NOT NULL THEN
      DECLARE
        componente_row RECORD;
        kit_nome TEXT;
      BEGIN
        SELECT nome INTO kit_nome FROM kits WHERE id = (item->>'kit_id')::UUID;

        FOR componente_row IN
          SELECT 
            p.nome as produto_nome,
            p.estoque,
            ki.quantidade as qtd_necessaria
          FROM kit_itens ki
          JOIN produtos p ON p.id = ki.produto_id
          WHERE ki.kit_id = (item->>'kit_id')::UUID
        LOOP
          IF componente_row.estoque < (componente_row.qtd_necessaria * (item->>'quantidade')::INTEGER) THEN
            RETURN json_build_object(
              'success', false,
              'message', 'Estoque insuficiente para componente: ' || componente_row.produto_nome || ' do kit ' || kit_nome
            );
          END IF;
        END LOOP;
      END;
    END IF;

    -- Calcular total
    total_calculado := total_calculado + ((item->>'preco_unitario')::NUMERIC * (item->>'quantidade')::INTEGER);
  END LOOP;

  -- Criar pedido com status pendente (aguardando aprovação do admin)
  INSERT INTO pedidos (
    numero,
    cliente_id,
    status,
    valor_total,
    observacoes,
    data,
    origem,
    created_by
  ) VALUES (
    numero_pedido,
    cliente_id_param,
    'pendente',
    total_calculado,
    observacoes_param,
    CURRENT_DATE,
    'catalogo',
    cliente_id_param
  )
  RETURNING id INTO pedido_id;

  -- Adicionar itens do pedido
  FOR item IN SELECT * FROM json_array_elements(itens_json)
  LOOP
    INSERT INTO pedido_itens (
      pedido_id,
      produto_id,
      kit_id,
      quantidade,
      preco_unitario,
      subtotal
    ) VALUES (
      pedido_id,
      CASE WHEN (item->>'produto_id') IS NOT NULL THEN (item->>'produto_id')::UUID ELSE NULL END,
      CASE WHEN (item->>'kit_id') IS NOT NULL THEN (item->>'kit_id')::UUID ELSE NULL END,
      (item->>'quantidade')::INTEGER,
      (item->>'preco_unitario')::NUMERIC,
      (item->>'preco_unitario')::NUMERIC * (item->>'quantidade')::INTEGER
    );
  END LOOP;

  RETURN json_build_object(
    'success', true,
    'message', 'Pedido ' || numero_pedido || ' criado com sucesso! Aguardando aprovação.',
    'pedido_id', pedido_id,
    'numero_pedido', numero_pedido
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Erro ao criar pedido: ' || SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. CRIAR FUNÇÃO PARA APROVAR PEDIDO DO CATÁLOGO (ADMIN)
CREATE OR REPLACE FUNCTION aprovar_pedido_catalogo(pedido_id_param UUID)
RETURNS JSON AS $$
DECLARE
  pedido_row RECORD;
  item_row RECORD;
BEGIN
  -- Buscar dados do pedido
  SELECT * INTO pedido_row FROM pedidos WHERE id = pedido_id_param;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'message', 'Pedido não encontrado');
  END IF;

  IF pedido_row.status != 'pendente' THEN
    RETURN json_build_object('success', false, 'message', 'Pedido já foi processado');
  END IF;

  -- Debitar estoque dos produtos
  FOR item_row IN 
    SELECT pi.produto_id, pi.kit_id, pi.quantidade
    FROM pedido_itens pi
    WHERE pi.pedido_id = pedido_id_param
  LOOP
    -- Se for produto avulso
    IF item_row.produto_id IS NOT NULL AND item_row.kit_id IS NULL THEN
      UPDATE produtos
      SET estoque = estoque - item_row.quantidade
      WHERE id = item_row.produto_id;
    END IF;

    -- Se for kit
    IF item_row.kit_id IS NOT NULL THEN
      UPDATE produtos p
      SET estoque = estoque - (ki.quantidade * item_row.quantidade)
      FROM kit_itens ki
      WHERE ki.kit_id = item_row.kit_id AND p.id = ki.produto_id;
    END IF;
  END LOOP;

  -- Atualizar status do pedido
  UPDATE pedidos
  SET status = 'aprovado'
  WHERE id = pedido_id_param;

  RETURN json_build_object(
    'success', true,
    'message', 'Pedido aprovado! Estoque debitado com sucesso.'
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'message', 'Erro: ' || SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. POLÍTICAS RLS PARA PEDIDOS
ALTER TABLE pedidos ENABLE ROW LEVEL SECURITY;

-- Admin vê todos os pedidos
DROP POLICY IF EXISTS "Admins can view all pedidos" ON pedidos;
CREATE POLICY "Admins can view all pedidos"
  ON pedidos FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Cliente vê apenas seus próprios pedidos
DROP POLICY IF EXISTS "Clients can view own pedidos" ON pedidos;
CREATE POLICY "Clients can view own pedidos"
  ON pedidos FOR SELECT
  TO authenticated
  USING (cliente_id = auth.uid());

-- Cliente pode criar pedidos via catálogo
DROP POLICY IF EXISTS "Clients can create own pedidos" ON pedidos;
CREATE POLICY "Clients can create own pedidos"
  ON pedidos FOR INSERT
  TO authenticated
  WITH CHECK (cliente_id = auth.uid() AND origem = 'catalogo');

-- Admin pode criar, atualizar e deletar pedidos
DROP POLICY IF EXISTS "Admins can manage pedidos" ON pedidos;
CREATE POLICY "Admins can manage pedidos"
  ON pedidos FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- 6. POLÍTICAS RLS PARA PEDIDO_ITENS
ALTER TABLE pedido_itens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own pedido itens" ON pedido_itens;
CREATE POLICY "Users can view own pedido itens"
  ON pedido_itens FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM pedidos p
      WHERE p.id = pedido_itens.pedido_id
      AND (
        p.cliente_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM user_roles
          WHERE user_id = auth.uid() AND role = 'admin'
        )
      )
    )
  );

DROP POLICY IF EXISTS "Users can insert own pedido itens" ON pedido_itens;
CREATE POLICY "Users can insert own pedido itens"
  ON pedido_itens FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM pedidos p
      WHERE p.id = pedido_itens.pedido_id
      AND p.cliente_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Admins can manage pedido itens" ON pedido_itens;
CREATE POLICY "Admins can manage pedido itens"
  ON pedido_itens FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );
