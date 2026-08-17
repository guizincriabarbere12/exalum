-- Adiciona comprimento_solicitado_mm em orcamento_itens para calcular sobra automaticamente
ALTER TABLE orcamento_itens
  ADD COLUMN IF NOT EXISTS comprimento_solicitado_mm numeric;

-- Função que gera sobras automaticamente ao aprovar um orçamento
CREATE OR REPLACE FUNCTION gerar_sobras_orcamento(p_orcamento_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_item RECORD;
  v_sobra_mm numeric;
  v_comprimento_barra_mm numeric;
  v_codigo_sobra text;
BEGIN
  -- Percorre todos os itens do orçamento que têm produto com peso_kg_m
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
    -- Comprimento da barra padrão em mm
    v_comprimento_barra_mm := COALESCE(v_item.comprimento_barra, 6) * 1000;

    -- Para cada unidade no item, verifica se há sobra
    -- Sobra = barra inteira - comprimento solicitado
    -- Só gera sobra se o comprimento solicitado for menor que a barra
    IF v_item.comprimento_solicitado_mm < v_comprimento_barra_mm THEN
      v_sobra_mm := v_comprimento_barra_mm - v_item.comprimento_solicitado_mm;

      -- Gera uma sobra para cada unidade do item
      FOR i IN 1..v_item.quantidade LOOP
        v_codigo_sobra := v_item.codigo || '-S' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(FLOOR(RANDOM() * 9999)::text, 4, '0');

        INSERT INTO sobras_perfis (
          codigo_perfil,
          nome_perfil,
          categoria,
          cor,
          comprimento_mm,
          peso_kg_m,
          valor_por_kg,
          data_geracao,
          origem,
          orcamento_id,
          localizacao,
          status
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
          v_item.localizacao,
          'disponivel'
        );
      END LOOP;
    END IF;
  END LOOP;
END;
$$;

-- Atualiza a função de aprovar orçamento para gerar sobras
CREATE OR REPLACE FUNCTION aprovar_orcamento_simples(orcamento_id_param uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_orcamento RECORD;
  v_result json;
BEGIN
  SELECT * INTO v_orcamento FROM orcamentos WHERE id = orcamento_id_param;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'message', 'Orçamento não encontrado');
  END IF;

  IF v_orcamento.status NOT IN ('pendente', 'em_analise') THEN
    -- Se já estiver aprovado ou outro status, apenas retorna sucesso
    RETURN json_build_object('success', true, 'message', 'Orçamento processado');
  END IF;

  -- Aprova o orçamento
  UPDATE orcamentos SET status = 'aprovado', updated_at = NOW() WHERE id = orcamento_id_param;

  -- Gera sobras automaticamente
  PERFORM gerar_sobras_orcamento(orcamento_id_param);

  RETURN json_build_object('success', true, 'message', 'Orçamento aprovado e sobras geradas');
END;
$$;
