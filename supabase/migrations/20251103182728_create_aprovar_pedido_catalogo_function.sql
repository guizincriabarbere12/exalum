/*
  # Create function to approve catalog orders
  
  1. New Function
    - `aprovar_pedido_catalogo` - Approves a pending catalog order
    - Validates stock for all items (products and kits)
    - Debits stock from products and kit components
    - Changes status to 'confirmado'
    - Returns success/error message
  
  2. Security
    - Validates order exists and is pending
    - Validates sufficient stock before processing
    - Atomic operation (all or nothing)
*/

CREATE OR REPLACE FUNCTION aprovar_pedido_catalogo(pedido_id_param UUID)
RETURNS JSON
LANGUAGE plpgsql
AS $$
DECLARE
  pedido_row RECORD;
  item_row RECORD;
  estoque_insuficiente BOOLEAN := false;
  produto_sem_estoque TEXT := '';
BEGIN
  -- Get pedido data
  SELECT * INTO pedido_row
  FROM pedidos
  WHERE id = pedido_id_param;

  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Pedido não encontrado'
    );
  END IF;

  -- Check if already confirmed
  IF pedido_row.status != 'pendente' THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Este pedido não está pendente'
    );
  END IF;

  -- Validate stock for all items before processing
  FOR item_row IN 
    SELECT 
      pi.produto_id,
      pi.quantidade,
      pi.kit_id,
      COALESCE(p.nome, k.nome) as item_nome,
      p.estoque
    FROM pedido_itens pi
    LEFT JOIN produtos p ON p.id = pi.produto_id
    LEFT JOIN kits k ON k.id = pi.kit_id
    WHERE pi.pedido_id = pedido_id_param
  LOOP
    -- If it's a standalone product, check stock directly
    IF item_row.kit_id IS NULL AND item_row.produto_id IS NOT NULL THEN
      IF item_row.estoque < item_row.quantidade THEN
        estoque_insuficiente := true;
        produto_sem_estoque := item_row.item_nome;
        EXIT;
      END IF;
    END IF;

    -- If it's a kit, check stock of components
    IF item_row.kit_id IS NOT NULL THEN
      DECLARE
        componente_row RECORD;
      BEGIN
        FOR componente_row IN
          SELECT 
            p.nome as produto_nome,
            p.estoque,
            ki.quantidade as qtd_necessaria
          FROM kit_itens ki
          JOIN produtos p ON p.id = ki.produto_id
          WHERE ki.kit_id = item_row.kit_id
        LOOP
          IF componente_row.estoque < (componente_row.qtd_necessaria * item_row.quantidade) THEN
            estoque_insuficiente := true;
            produto_sem_estoque := componente_row.produto_nome || ' (componente do kit ' || item_row.item_nome || ')';
            EXIT;
          END IF;
        END LOOP;
      END;

      IF estoque_insuficiente THEN
        EXIT;
      END IF;
    END IF;
  END LOOP;

  -- If insufficient stock, return error
  IF estoque_insuficiente THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Estoque insuficiente para: ' || produto_sem_estoque
    );
  END IF;

  -- Debit stock from products
  FOR item_row IN 
    SELECT 
      pi.produto_id,
      pi.quantidade,
      pi.kit_id
    FROM pedido_itens pi
    WHERE pi.pedido_id = pedido_id_param
  LOOP
    -- If standalone product, debit directly
    IF item_row.kit_id IS NULL AND item_row.produto_id IS NOT NULL THEN
      UPDATE produtos
      SET estoque = estoque - item_row.quantidade
      WHERE id = item_row.produto_id;
    END IF;

    -- If kit, debit components
    IF item_row.kit_id IS NOT NULL THEN
      UPDATE produtos p
      SET estoque = estoque - (ki.quantidade * item_row.quantidade)
      FROM kit_itens ki
      WHERE ki.kit_id = item_row.kit_id
        AND p.id = ki.produto_id;
    END IF;
  END LOOP;

  -- Update pedido status
  UPDATE pedidos
  SET status = 'confirmado'
  WHERE id = pedido_id_param;

  RETURN json_build_object(
    'success', true,
    'message', 'Pedido aprovado! Estoque debitado com sucesso'
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Erro ao aprovar pedido: ' || SQLERRM
    );
END;
$$;

-- Function to reject catalog order
CREATE OR REPLACE FUNCTION rejeitar_pedido_catalogo(pedido_id_param UUID)
RETURNS JSON
LANGUAGE plpgsql
AS $$
DECLARE
  pedido_row RECORD;
BEGIN
  -- Get pedido data
  SELECT * INTO pedido_row
  FROM pedidos
  WHERE id = pedido_id_param;

  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Pedido não encontrado'
    );
  END IF;

  -- Check if pending
  IF pedido_row.status != 'pendente' THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Este pedido não está pendente'
    );
  END IF;

  -- Update status to cancelado
  UPDATE pedidos
  SET status = 'cancelado'
  WHERE id = pedido_id_param;

  RETURN json_build_object(
    'success', true,
    'message', 'Pedido rejeitado'
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Erro ao rejeitar pedido: ' || SQLERRM
    );
END;
$$;
