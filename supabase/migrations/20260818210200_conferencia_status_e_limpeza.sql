-- Achado no próprio banco (3 rascunhos abandonados diferentes de uma
-- implementação anterior dessa mesma feature, nunca ligados a nenhuma
-- tela) confirmam a intenção original: quando todos os itens são
-- conferidos, o orçamento muda de status para 'conferido'. Ativando isso.
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

  UPDATE public.orcamentos
  SET status = 'conferido', updated_at = now()
  WHERE id = v_conferencia.orcamento_id;

  RETURN json_build_object('success', true, 'message', 'Conferência finalizada e estoque atualizado');
END;
$$;

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

  UPDATE public.orcamentos
  SET status = 'aprovado', updated_at = now()
  WHERE id = v_orcamento_id AND status = 'conferido';

  RETURN json_build_object('success', true, 'message', 'Conferência revertida e estoque devolvido');
END;
$$;

-- Limpeza: rascunhos abandonados da mesma feature, nunca chamados por
-- nenhuma tela. Um deles debitava de uma tabela "estoque" legada que o
-- app não usa mais (o app real lê/escreve produtos.estoque), o que teria
-- causado uma baixa "invisível" se algum dia fosse chamado sem querer.
DROP FUNCTION IF EXISTS public.finalizar_conferencia(uuid, uuid);
DROP FUNCTION IF EXISTS public.processar_conferencia_item(uuid, uuid, integer, uuid);
DROP FUNCTION IF EXISTS public.processar_conferencia_item(uuid, numeric, uuid);
DROP FUNCTION IF EXISTS public.inserir_foto_conferencia(uuid, varchar, varchar, text);
