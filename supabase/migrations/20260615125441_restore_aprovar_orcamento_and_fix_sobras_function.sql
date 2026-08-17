-- Restaura a função original + adiciona geração de sobras ao final
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
    ELSE
      FOR kit_item IN
        SELECT ki.produto_id, ki.quantidade FROM kit_itens ki WHERE ki.kit_id = item.kit_id
      LOOP
        UPDATE produtos SET estoque = estoque - (kit_item.quantidade * item.quantidade), updated_at = now()
        WHERE id = kit_item.produto_id;
        
        INSERT INTO movimentacao_estoque (produto_id, tipo, quantidade, observacao, created_by)
        VALUES (kit_item.produto_id, 'saida', kit_item.quantidade * item.quantidade,
                'Orçamento aprovado (kit): ' || orc.numero, auth.uid());
      END LOOP;
    END IF;
  END LOOP;
  
  UPDATE orcamentos SET status = 'aprovado', updated_at = now() WHERE id = orcamento_id_param;
  
  RETURN json_build_object(
    'success', true,
    'message', 'Orçamento aprovado, venda criada e estoque atualizado com sucesso',
    'venda_id', venda_id,
    'numero_venda', numero_venda
  );
END;
$$;

-- Atualiza gerar_sobras_orcamento para aceitar localizacao por item via json
-- A função agora aceita um array de localizações opcionais por produto_id
CREATE OR REPLACE FUNCTION gerar_sobras_orcamento(
  p_orcamento_id uuid,
  p_localizacoes json DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_item RECORD;
  v_sobra_mm numeric;
  v_comprimento_barra_mm numeric;
  v_localizacao text;
  v_count integer := 0;
BEGIN
  FOR v_item IN
    SELECT
      oi.id AS item_id,
      oi.produto_id,
      oi.quantidade,
      oi.comprimento_solicitado_mm,
      p.codigo,
      p.nome AS nome_perfil,
      p.categoria,
      p.cor,
      p.peso_kg_m,
      p.comprimento_barra,
      p.preco_por_kg,
      p.preco,
      p.localizacao
    FROM orcamento_itens oi
    JOIN produtos p ON p.id = oi.produto_id
    WHERE oi.orcamento_id = p_orcamento_id
      AND p.peso_kg_m IS NOT NULL
      AND p.peso_kg_m > 0
      AND oi.comprimento_solicitado_mm IS NOT NULL
      AND oi.comprimento_solicitado_mm > 0
  LOOP
    v_comprimento_barra_mm := COALESCE(v_item.comprimento_barra, 6) * 1000;

    IF v_item.comprimento_solicitado_mm < v_comprimento_barra_mm THEN
      v_sobra_mm := v_comprimento_barra_mm - v_item.comprimento_solicitado_mm;

      -- Pega localização do json de localizações passado, ou usa a do produto
      v_localizacao := v_item.localizacao;
      IF p_localizacoes IS NOT NULL THEN
        SELECT value INTO v_localizacao
        FROM json_each_text(p_localizacoes)
        WHERE key = v_item.produto_id::text;
        IF v_localizacao IS NULL THEN
          v_localizacao := v_item.localizacao;
        END IF;
      END IF;

      FOR i IN 1..v_item.quantidade LOOP
        INSERT INTO sobras_perfis (
          codigo_perfil, nome_perfil, categoria, cor, comprimento_mm, peso_kg_m,
          valor_por_kg, data_geracao, origem, orcamento_id, localizacao, status
        ) VALUES (
          v_item.codigo,
          v_item.nome_perfil,
          v_item.categoria,
          v_item.cor,
          v_sobra_mm,
          v_item.peso_kg_m,
          COALESCE(v_item.preco_por_kg, v_item.preco / NULLIF((v_item.peso_kg_m * COALESCE(v_item.comprimento_barra, 6)), 0), 0),
          CURRENT_DATE,
          'Orçamento',
          p_orcamento_id,
          v_localizacao,
          'disponivel'
        );
        v_count := v_count + 1;
      END LOOP;
    END IF;
  END LOOP;
  
  RETURN v_count;
END;
$$;
