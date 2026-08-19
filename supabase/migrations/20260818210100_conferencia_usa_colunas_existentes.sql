-- orcamento_itens já tinha quantidade_conferida/status_conferencia (pendente/
-- parcial/conferido) prontas para isso, mas nada as atualizava. Passa a usar
-- essas colunas como fonte de verdade do progresso por item, em vez de somar
-- conferencia_historico toda hora.

CREATE OR REPLACE FUNCTION public.registrar_item_conferencia(
  conferencia_id_param uuid,
  orcamento_item_id_param uuid,
  quantidade_param integer,
  observacao_param text DEFAULT NULL,
  foto_base64_param text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_conferencia RECORD;
  v_item RECORD;
  v_nova_quantidade numeric;
BEGIN
  SELECT * INTO v_conferencia FROM public.conferencia_materiais WHERE id = conferencia_id_param;

  IF v_conferencia IS NULL OR v_conferencia.status != 'em_andamento' THEN
    RETURN json_build_object('success', false, 'message', 'Conferência não encontrada ou já finalizada');
  END IF;

  SELECT oi.*, COALESCE(p.nome, k.nome) AS nome, COALESCE(p.codigo, k.codigo) AS codigo
  INTO v_item
  FROM public.orcamento_itens oi
  LEFT JOIN public.produtos p ON p.id = oi.produto_id
  LEFT JOIN public.kits k ON k.id = oi.kit_id
  WHERE oi.id = orcamento_item_id_param AND oi.orcamento_id = v_conferencia.orcamento_id;

  IF v_item IS NULL THEN
    RETURN json_build_object('success', false, 'message', 'Item não pertence a este orçamento');
  END IF;

  INSERT INTO public.conferencia_historico (conferencia_id, orcamento_id, produto_id, kit_id, quantidade, tipo, observacao, conferido_por)
  VALUES (conferencia_id_param, v_conferencia.orcamento_id, v_item.produto_id, v_item.kit_id, quantidade_param, 'conferencia', observacao_param, auth.uid());

  IF foto_base64_param IS NOT NULL THEN
    INSERT INTO public.conferencia_fotos (orcamento_id, produto_codigo, produto_nome, foto_base64)
    VALUES (v_conferencia.orcamento_id, v_item.codigo, v_item.nome, foto_base64_param);
  END IF;

  v_nova_quantidade := COALESCE(v_item.quantidade_conferida, 0) + quantidade_param;

  UPDATE public.orcamento_itens
  SET quantidade_conferida = v_nova_quantidade,
      status_conferencia = CASE WHEN v_nova_quantidade >= quantidade THEN 'conferido' ELSE 'parcial' END
  WHERE id = orcamento_item_id_param;

  RETURN json_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.finalizar_conferencia(
  conferencia_id_param uuid,
  assinatura_base64_param text DEFAULT NULL,
  assinatura_nome_param text DEFAULT NULL,
  assinatura_cargo_param text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_conferencia RECORD;
  v_pendentes json[] := '{}';
  v_faltando json[] := '{}';
  rec RECORD;
BEGIN
  SELECT * INTO v_conferencia FROM public.conferencia_materiais WHERE id = conferencia_id_param;

  IF v_conferencia IS NULL OR v_conferencia.status != 'em_andamento' THEN
    RETURN json_build_object('success', false, 'message', 'Conferência não encontrada ou já finalizada');
  END IF;

  FOR rec IN
    SELECT COALESCE(p.nome, k.nome) AS nome, oi.quantidade AS esperado, COALESCE(oi.quantidade_conferida, 0) AS conferido
    FROM public.orcamento_itens oi
    LEFT JOIN public.produtos p ON p.id = oi.produto_id
    LEFT JOIN public.kits k ON k.id = oi.kit_id
    WHERE oi.orcamento_id = v_conferencia.orcamento_id
  LOOP
    IF rec.conferido < rec.esperado THEN
      v_pendentes := array_append(v_pendentes, json_build_object('item', rec.nome, 'esperado', rec.esperado, 'conferido', rec.conferido));
    END IF;
  END LOOP;

  IF array_length(v_pendentes, 1) > 0 THEN
    RETURN json_build_object('success', false, 'message', 'Ainda há itens não conferidos por completo', 'itens_pendentes', array_to_json(v_pendentes));
  END IF;

  CREATE TEMP TABLE necessidade ON COMMIT DROP AS
  WITH itens AS (
    SELECT id AS orcamento_item_id, produto_id, kit_id, quantidade
    FROM public.orcamento_itens
    WHERE orcamento_id = v_conferencia.orcamento_id
  ),
  diretos AS (
    SELECT orcamento_item_id, produto_id, quantidade FROM itens WHERE produto_id IS NOT NULL
  ),
  kits_expandidos AS (
    SELECT i.orcamento_item_id, ek.produto_id, ek.quantidade_total AS quantidade
    FROM itens i
    CROSS JOIN LATERAL public.expandir_kit_conferencia(i.kit_id, i.quantidade) ek
    WHERE i.kit_id IS NOT NULL
  )
  SELECT orcamento_item_id, produto_id, SUM(quantidade)::integer AS quantidade
  FROM (SELECT * FROM diretos UNION ALL SELECT * FROM kits_expandidos) t
  GROUP BY orcamento_item_id, produto_id;

  CREATE TEMP TABLE necessidade_total ON COMMIT DROP AS
  SELECT produto_id, SUM(quantidade)::integer AS quantidade
  FROM necessidade
  GROUP BY produto_id;

  FOR rec IN
    SELECT n.produto_id, n.quantidade AS necessario, p.estoque, p.nome
    FROM necessidade_total n JOIN public.produtos p ON p.id = n.produto_id
    WHERE p.estoque < n.quantidade
  LOOP
    v_faltando := array_append(v_faltando, json_build_object('produto', rec.nome, 'necessario', rec.necessario, 'disponivel', rec.estoque));
  END LOOP;

  IF array_length(v_faltando, 1) > 0 THEN
    RETURN json_build_object('success', false, 'message', 'Estoque insuficiente para finalizar a conferência', 'itens_faltando', array_to_json(v_faltando));
  END IF;

  UPDATE public.produtos p
  SET estoque = p.estoque - n.quantidade,
      updated_at = now()
  FROM necessidade_total n
  WHERE p.id = n.produto_id;

  INSERT INTO public.conferencia_baixas (conferencia_id, orcamento_item_id, produto_id, quantidade_baixada, estoque_antes, estoque_depois, created_by)
  SELECT conferencia_id_param, n.orcamento_item_id, n.produto_id, n.quantidade, NULL, NULL, auth.uid()
  FROM necessidade n;

  UPDATE public.conferencia_materiais
  SET status = 'finalizada',
      data_fim = now(),
      conferido_por = auth.uid(),
      assinatura_base64 = assinatura_base64_param,
      assinatura_nome = assinatura_nome_param,
      assinatura_cargo = assinatura_cargo_param,
      assinatura_data = CASE WHEN assinatura_base64_param IS NOT NULL THEN now() ELSE NULL END
  WHERE id = conferencia_id_param;

  RETURN json_build_object('success', true, 'message', 'Conferência finalizada e estoque atualizado');
END;
$$;

-- Ao reverter, também limpa o progresso registrado nos itens do orçamento,
-- para permitir uma nova conferência do zero.
CREATE OR REPLACE FUNCTION public.reverter_conferencia(conferencia_id_param uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_orcamento_id uuid;
  v_status text;
BEGIN
  SELECT status, orcamento_id INTO v_status, v_orcamento_id FROM public.conferencia_materiais WHERE id = conferencia_id_param;

  IF v_status IS NULL OR v_status != 'finalizada' THEN
    RETURN json_build_object('success', false, 'message', 'Conferência não encontrada ou não está finalizada');
  END IF;

  UPDATE public.produtos p
  SET estoque = p.estoque + t.total,
      updated_at = now()
  FROM (
    SELECT produto_id, SUM(quantidade_baixada) AS total
    FROM public.conferencia_baixas
    WHERE conferencia_id = conferencia_id_param
    GROUP BY produto_id
  ) t
  WHERE p.id = t.produto_id;

  UPDATE public.orcamento_itens
  SET quantidade_conferida = 0,
      status_conferencia = 'pendente'
  WHERE orcamento_id = v_orcamento_id;

  UPDATE public.conferencia_materiais
  SET status = 'cancelada'
  WHERE id = conferencia_id_param;

  RETURN json_build_object('success', true, 'message', 'Conferência revertida e estoque devolvido');
END;
$$;
