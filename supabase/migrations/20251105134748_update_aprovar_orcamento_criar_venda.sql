/*
  # Atualizar Aprovação de Orçamento para Criar Venda
  
  ## Descrição
  Modifica a função aprovar_orcamento_simples para que, ao aprovar um orçamento,
  seja criada automaticamente uma venda correspondente para aparecer nas estatísticas
  do dashboard.
  
  ## Alterações
  1. Cria uma venda quando o orçamento é aprovado
  2. Cria os itens da venda baseados nos itens do orçamento
  3. Mantém o débito de estoque e movimentações
  
  ## Impacto
  - Orçamentos aprovados agora aparecerão nas vendas do mês no dashboard
  - Mantém rastreabilidade entre orçamento e venda
*/

CREATE OR REPLACE FUNCTION public.aprovar_orcamento_simples(orcamento_id_param uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  item RECORD;
  kit_item RECORD;
  itens_faltando json[] := '{}';
  orc RECORD;
  venda_id uuid;
BEGIN
  -- Buscar dados do orçamento
  SELECT * INTO orc FROM orcamentos WHERE id = orcamento_id_param;
  
  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Orçamento não encontrado'
    );
  END IF;
  
  -- Verificar disponibilidade de todos os itens
  FOR item IN
    SELECT oi.*, p.estoque, p.nome as produto_nome
    FROM orcamento_itens oi
    LEFT JOIN produtos p ON p.id = oi.produto_id
    WHERE oi.orcamento_id = orcamento_id_param
  LOOP
    IF item.produto_id IS NOT NULL THEN
      -- Item é um produto
      IF item.estoque < item.quantidade THEN
        itens_faltando := array_append(
          itens_faltando,
          json_build_object(
            'produto', item.produto_nome,
            'necessario', item.quantidade,
            'disponivel', item.estoque,
            'faltando', item.quantidade - item.estoque
          )
        );
      END IF;
    ELSE
      -- Item é um kit - verificar componentes
      FOR kit_item IN
        SELECT ki.quantidade as qtd_componente, p.id, p.nome, p.estoque
        FROM kit_itens ki
        JOIN produtos p ON p.id = ki.produto_id
        WHERE ki.kit_id = item.kit_id
      LOOP
        IF kit_item.estoque < (kit_item.qtd_componente * item.quantidade) THEN
          itens_faltando := array_append(
            itens_faltando,
            json_build_object(
              'produto', kit_item.nome,
              'necessario', kit_item.qtd_componente * item.quantidade,
              'disponivel', kit_item.estoque,
              'faltando', (kit_item.qtd_componente * item.quantidade) - kit_item.estoque
            )
          );
        END IF;
      END LOOP;
    END IF;
  END LOOP;
  
  -- Se houver itens faltando, retornar erro
  IF array_length(itens_faltando, 1) > 0 THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Estoque insuficiente para alguns itens',
      'itens_faltando', array_to_json(itens_faltando)
    );
  END IF;
  
  -- Criar venda
  INSERT INTO vendas (
    cliente_id,
    valor_total,
    observacoes,
    created_by
  ) VALUES (
    orc.cliente_id,
    orc.valor_total,
    'Orçamento aprovado: ' || orc.numero,
    auth.uid()
  ) RETURNING id INTO venda_id;
  
  -- Copiar itens do orçamento para a venda
  FOR item IN
    SELECT oi.*
    FROM orcamento_itens oi
    WHERE oi.orcamento_id = orcamento_id_param
  LOOP
    INSERT INTO venda_itens (
      venda_id,
      produto_id,
      kit_id,
      quantidade,
      preco_unitario,
      desconto,
      peso
    ) VALUES (
      venda_id,
      item.produto_id,
      item.kit_id,
      item.quantidade,
      item.preco_unitario,
      COALESCE(item.desconto, 0),
      item.peso
    );
  END LOOP;
  
  -- Debitar estoque
  FOR item IN
    SELECT oi.*
    FROM orcamento_itens oi
    WHERE oi.orcamento_id = orcamento_id_param
  LOOP
    IF item.produto_id IS NOT NULL THEN
      -- Debitar produto
      UPDATE produtos
      SET estoque = estoque - item.quantidade,
          updated_at = now()
      WHERE id = item.produto_id;
      
      -- Registrar movimentação
      INSERT INTO movimentacao_estoque (produto_id, tipo, quantidade, observacao, created_by)
      VALUES (
        item.produto_id, 
        'saida', 
        item.quantidade, 
        'Orçamento aprovado: ' || orc.numero,
        auth.uid()
      );
    ELSE
      -- Debitar componentes do kit
      FOR kit_item IN
        SELECT ki.produto_id, ki.quantidade
        FROM kit_itens ki
        WHERE ki.kit_id = item.kit_id
      LOOP
        UPDATE produtos
        SET estoque = estoque - (kit_item.quantidade * item.quantidade),
            updated_at = now()
        WHERE id = kit_item.produto_id;
        
        -- Registrar movimentação
        INSERT INTO movimentacao_estoque (produto_id, tipo, quantidade, observacao, created_by)
        VALUES (
          kit_item.produto_id, 
          'saida', 
          kit_item.quantidade * item.quantidade, 
          'Orçamento aprovado (kit): ' || orc.numero,
          auth.uid()
        );
      END LOOP;
    END IF;
  END LOOP;
  
  -- Atualizar status do orçamento
  UPDATE orcamentos
  SET status = 'aprovado',
      updated_at = now()
  WHERE id = orcamento_id_param;
  
  RETURN json_build_object(
    'success', true,
    'message', 'Orçamento aprovado, venda criada e estoque atualizado com sucesso',
    'venda_id', venda_id
  );
END;
$$;
