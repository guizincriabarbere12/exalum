-- Ativa o fluxo de conferência de materiais que já existia no schema
-- (conferencia_materiais/historico/baixas/fotos) mas nunca teve
-- funções nem tela: orçamento aprovado -> conferência item a item,
-- com foto e assinatura -> só aí o estoque é baixado de fato.

-- Liga cada linha de histórico à conferência específica em que foi
-- registrada (antes só se sabia o orçamento, não a sessão de conferência).
ALTER TABLE public.conferencia_historico
  ADD COLUMN IF NOT EXISTS conferencia_id uuid REFERENCES public.conferencia_materiais(id) ON DELETE CASCADE;

ALTER TABLE public.conferencia_historico ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_conferencia_historico" ON public.conferencia_historico;
DROP POLICY IF EXISTS "insert_conferencia_historico" ON public.conferencia_historico;

CREATE POLICY "select_conferencia_historico"
  ON public.conferencia_historico FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "insert_conferencia_historico"
  ON public.conferencia_historico FOR INSERT
  TO authenticated
  WITH CHECK (conferido_por = auth.uid());

-- Expande um kit recursivamente (suporta sub-kits) em produtos-base e a
-- quantidade total necessária. Mesma lógica usada em requisições de material.
CREATE OR REPLACE FUNCTION public.expandir_kit_conferencia(kit_id_param uuid, multiplicador integer)
RETURNS TABLE(produto_id uuid, quantidade_total integer) AS $$
BEGIN
  RETURN QUERY
  WITH RECURSIVE expansao AS (
    SELECT ki.produto_id, ki.sub_kit_id, (ki.quantidade * multiplicador) AS quantidade
    FROM public.kit_itens ki
    WHERE ki.kit_id = kit_id_param
    UNION ALL
    SELECT ki2.produto_id, ki2.sub_kit_id, (ki2.quantidade * e.quantidade) AS quantidade
    FROM public.kit_itens ki2
    JOIN expansao e ON ki2.kit_id = e.sub_kit_id
  )
  SELECT e.produto_id, SUM(e.quantidade)::integer
  FROM expansao e
  WHERE e.produto_id IS NOT NULL
  GROUP BY e.produto_id;
END;
$$ LANGUAGE plpgsql STABLE;

-- Abre (ou retoma) a conferência de um orçamento aprovado.
CREATE OR REPLACE FUNCTION public.iniciar_conferencia(orcamento_id_param uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_status text;
  v_conferencia_id uuid;
BEGIN
  SELECT status INTO v_status FROM public.orcamentos WHERE id = orcamento_id_param;

  IF v_status IS NULL THEN
    RETURN json_build_object('success', false, 'message', 'Orçamento não encontrado');
  END IF;

  IF v_status != 'aprovado' THEN
    RETURN json_build_object('success', false, 'message', 'Só é possível conferir orçamentos aprovados');
  END IF;

  SELECT id INTO v_conferencia_id
  FROM public.conferencia_materiais
  WHERE orcamento_id = orcamento_id_param AND status IN ('em_andamento', 'finalizada')
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_conferencia_id IS NOT NULL THEN
    RETURN json_build_object('success', true, 'conferencia_id', v_conferencia_id);
  END IF;

  INSERT INTO public.conferencia_materiais (orcamento_id, created_by, status)
  VALUES (orcamento_id_param, auth.uid(), 'em_andamento')
  RETURNING id INTO v_conferencia_id;

  RETURN json_build_object('success', true, 'conferencia_id', v_conferencia_id);
END;
$$;

-- Registra a conferência de um item (produto ou kit) da lista do orçamento.
-- Só grava o progresso; o estoque só é debitado em finalizar_conferencia.
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

  RETURN json_build_object('success', true);
END;
$$;

-- Finaliza a conferência: exige que todo item tenha sido conferido com a
-- quantidade correta, aí sim debita o estoque (expandindo kits) e grava a
-- assinatura de quem recebeu/conferiu.
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

  -- Itens do orçamento cuja quantidade conferida (soma do histórico) é menor que a pedida
  FOR rec IN
    SELECT
      oi.id,
      COALESCE(p.nome, k.nome) AS nome,
      oi.quantidade AS esperado,
      COALESCE((
        SELECT SUM(ch.quantidade) FROM public.conferencia_historico ch
        WHERE ch.conferencia_id = conferencia_id_param
          AND ((oi.produto_id IS NOT NULL AND ch.produto_id = oi.produto_id) OR (oi.kit_id IS NOT NULL AND ch.kit_id = oi.kit_id))
      ), 0) AS conferido
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

  -- Total por produto (um mesmo produto pode aparecer em mais de um item,
  -- direto e dentro de kit ao mesmo tempo) — é essa soma que sai do estoque.
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
  SELECT
    conferencia_id_param,
    n.orcamento_item_id,
    n.produto_id,
    n.quantidade,
    NULL,
    NULL,
    auth.uid()
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

-- Reverte uma conferência já finalizada (devolve o estoque debitado).
-- Usado quando um orçamento já conferido acaba sendo desaprovado/cancelado.
CREATE OR REPLACE FUNCTION public.reverter_conferencia(conferencia_id_param uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_status text;
BEGIN
  SELECT status INTO v_status FROM public.conferencia_materiais WHERE id = conferencia_id_param;

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

  UPDATE public.conferencia_materiais
  SET status = 'cancelada'
  WHERE id = conferencia_id_param;

  RETURN json_build_object('success', true, 'message', 'Conferência revertida e estoque devolvido');
END;
$$;
