-- Criar função para processar orçamento aprovado
CREATE OR REPLACE FUNCTION public.processar_orcamento_aprovado(orcamento_id_param uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  item RECORD;
  estoque_atual NUMERIC;
  resultado JSONB;
  itens_faltando JSONB[] := '{}';
  orcamento_status TEXT;
  kit_item RECORD;
BEGIN
  -- Check current status
  SELECT status INTO orcamento_status
  FROM orcamentos
  WHERE id = orcamento_id_param;
  
  -- If already processed, return success
  IF orcamento_status = 'aprovado' THEN
    RETURN jsonb_build_object(
      'success', true,
      'message', 'Orçamento já foi processado anteriormente'
    );
  END IF;
  
  -- Check if all PRODUCTS are available
  FOR item IN 
    SELECT oi.produto_id, oi.quantidade, p.descricao
    FROM orcamento_itens oi
    JOIN produtos p ON p.id = oi.produto_id
    WHERE oi.orcamento_id = orcamento_id_param
    AND oi.produto_id IS NOT NULL
  LOOP
    SELECT quantidade INTO estoque_atual
    FROM estoque
    WHERE produto_id = item.produto_id;
    
    IF estoque_atual IS NULL OR estoque_atual < item.quantidade THEN
      itens_faltando := array_append(itens_faltando, 
        jsonb_build_object(
          'produto_id', item.produto_id,
          'descricao', item.descricao,
          'necessario', item.quantidade,
          'disponivel', COALESCE(estoque_atual, 0)
        )
      );
    END IF;
  END LOOP;
  
  -- Check if all KITS are available
  FOR item IN 
    SELECT oi.kit_id, oi.quantidade, k.nome as descricao, kd.produto_id, kd.quantidade as quantidade_por_kit
    FROM orcamento_itens oi
    JOIN kits k ON k.id = oi.kit_id
    JOIN kit_detalhes kd ON kd.kit_id = oi.kit_id
    WHERE oi.orcamento_id = orcamento_id_param
    AND oi.kit_id IS NOT NULL
  LOOP
    -- Calculate total needed for this product across all kits
    SELECT quantidade INTO estoque_atual
    FROM estoque
    WHERE produto_id = item.produto_id;
    
    -- Total needed = kit quantity * product quantity per kit
    DECLARE
      total_necessario NUMERIC := item.quantidade * item.quantidade_por_kit;
    BEGIN
      IF estoque_atual IS NULL OR estoque_atual < total_necessario THEN
        itens_faltando := array_append(itens_faltando, 
          jsonb_build_object(
            'produto_id', item.produto_id,
            'descricao', 'Componente do kit: ' || item.descricao,
            'necessario', total_necessario,
            'disponivel', COALESCE(estoque_atual, 0)
          )
        );
      END IF;
    END;
  END LOOP;
  
  -- If there are missing items, return error
  IF array_length(itens_faltando, 1) > 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Estoque insuficiente',
      'itens_faltando', to_jsonb(itens_faltando)
    );
  END IF;
  
  -- Process stock updates for PRODUCTS
  FOR item IN 
    SELECT oi.produto_id, oi.quantidade, p.descricao
    FROM orcamento_itens oi
    JOIN produtos p ON p.id = oi.produto_id
    WHERE oi.orcamento_id = orcamento_id_param
    AND oi.produto_id IS NOT NULL
  LOOP
    -- Update stock
    UPDATE estoque
    SET quantidade = quantidade - item.quantidade
    WHERE produto_id = item.produto_id;
    
    -- Register stock movement
    INSERT INTO movimentacao_estoque (produto_id, tipo, quantidade, observacao, created_by)
    VALUES (
      item.produto_id,
      'saida',
      item.quantidade,
      'Orçamento aprovado #' || (SELECT numero FROM orcamentos WHERE id = orcamento_id_param),
      auth.uid()
    );
  END LOOP;
  
  -- Process stock updates for KITS
  FOR item IN 
    SELECT oi.kit_id, oi.quantidade, k.nome as descricao, kd.produto_id, kd.quantidade as quantidade_por_kit
    FROM orcamento_itens oi
    JOIN kits k ON k.id = oi.kit_id
    JOIN kit_detalhes kd ON kd.kit_id = oi.kit_id
    WHERE oi.orcamento_id = orcamento_id_param
    AND oi.kit_id IS NOT NULL
  LOOP
    -- Calculate total to deduct
    DECLARE
      total_deduzir NUMERIC := item.quantidade * item.quantidade_por_kit;
    BEGIN
      -- Update stock for each component
      UPDATE estoque
      SET quantidade = quantidade - total_deduzir
      WHERE produto_id = item.produto_id;
      
      -- Register stock movement
      INSERT INTO movimentacao_estoque (produto_id, tipo, quantidade, observacao, created_by)
      VALUES (
        item.produto_id,
        'saida',
        total_deduzir,
        'Kit aprovado: ' || item.descricao || ' - Orçamento #' || (SELECT numero FROM orcamentos WHERE id = orcamento_id_param),
        auth.uid()
      );
    END;
  END LOOP;
  
  -- Update budget status
  UPDATE orcamentos
  SET status = 'aprovado',
      updated_at = now()
  WHERE id = orcamento_id_param;
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Orçamento aprovado e estoque atualizado'
  );
END;
$$;