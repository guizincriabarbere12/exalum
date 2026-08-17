
-- Marca sobras_perfis como vendidas ao aprovar orçamento que as usa
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
  numero_venda text;
  contador integer;
  sobras_geradas integer := 0;
BEGIN
  SELECT * INTO orc FROM orcamentos WHERE id = orcamento_id_param;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'message', 'Orçamento não encontrado');
  END IF;
  
  -- Verificar disponibilidade dos itens de produto/kit
  FOR item IN
    SELECT oi.*, p.estoque, p.nome as produto_nome
    FROM orcamento_itens oi
    LEFT JOIN produtos p ON p.id = oi.produto_id
    WHERE oi.orcamento_id = orcamento_id_param
  LOOP
    IF item.produto_id IS NOT NULL THEN
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
    ELSIF item.kit_id IS NOT NULL THEN
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
  
  IF array_length(itens_faltando, 1) > 0 THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Estoque insuficiente para alguns itens',
      'itens_faltando', array_to_json(itens_faltando)
    );
  END IF;
  
  SELECT COUNT(*) + 1 INTO contador FROM vendas;
  numero_venda := 'VEN-' || LPAD(contador::text, 6, '0');
  
  INSERT INTO vendas (
    numero, cliente_id, orcamento_id, valor_total, status, observacoes, created_by
  ) VALUES (
    numero_venda, orc.cliente_id, orcamento_id_param, orc.valor_total, 'pendente',
    'Orçamento aprovado: ' || orc.numero, auth.uid()
  ) RETURNING id INTO venda_id;
  
  FOR item IN
    SELECT oi.* FROM orcamento_itens oi WHERE oi.orcamento_id = orcamento_id_param
  LOOP
    INSERT INTO venda_itens (venda_id, produto_id, quantidade, preco_unitario, subtotal)
    VALUES (venda_id, item.produto_id, item.quantidade, item.preco_unitario, item.subtotal);
  END LOOP;
  
  FOR item IN
    SELECT oi.* FROM orcamento_itens oi WHERE oi.orcamento_id = orcamento_id_param
  LOOP
    IF item.produto_id IS NOT NULL THEN
      UPDATE produtos SET estoque = estoque - item.quantidade, updated_at = now()
      WHERE id = item.produto_id;
      
      INSERT INTO movimentacao_estoque (produto_id, tipo, quantidade, observacao, created_by)
      VALUES (item.produto_id, 'saida', item.quantidade, 'Orçamento aprovado: ' || orc.numero, auth.uid());
    ELSIF item.kit_id IS NOT NULL THEN
      FOR kit_item IN
        SELECT ki.produto_id, ki.quantidade FROM kit_itens ki WHERE ki.kit_id = item.kit_id
      LOOP
        UPDATE produtos SET estoque = estoque - (kit_item.quantidade * item.quantidade), updated_at = now()
        WHERE id = kit_item.produto_id;
        
        INSERT INTO movimentacao_estoque (produto_id, tipo, quantidade, observacao, created_by)
        VALUES (kit_item.produto_id, 'saida', kit_item.quantidade * item.quantidade,
                'Orçamento aprovado (kit): ' || orc.numero, auth.uid());
      END LOOP;
    ELSIF item.sobra_id IS NOT NULL THEN
      -- Marcar sobra como vendida
      UPDATE sobras_perfis SET status = 'vendida', updated_at = now()
      WHERE id = item.sobra_id;
    END IF;
  END LOOP;

  -- Gerar sobras automaticamente para perfis com comprimento_solicitado_mm
  SELECT gerar_sobras_orcamento(orcamento_id_param, NULL) INTO sobras_geradas;
  
  UPDATE orcamentos SET status = 'aprovado', updated_at = now() WHERE id = orcamento_id_param;
  
  RETURN json_build_object(
    'success', true,
    'message', 'Orçamento aprovado, venda criada e estoque atualizado com sucesso',
    'venda_id', venda_id,
    'numero_venda', numero_venda,
    'sobras_geradas', sobras_geradas
  );
END;
$$;
