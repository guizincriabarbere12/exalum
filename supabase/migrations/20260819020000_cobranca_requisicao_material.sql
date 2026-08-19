-- Permite ao admin, ao aprovar uma requisição de material do serralheiro,
-- escolher se o material é uso interno (fluxo atual, sem cobrança) ou se
-- deve ser cobrado de um cliente — nesse caso vira um orçamento normal
-- (com preço, passando pelo fluxo de aprovação/conferência de sempre) em
-- vez de debitar o estoque direto pela requisição.

ALTER TABLE public.requisicoes_material
  ADD COLUMN IF NOT EXISTS orcamento_id uuid REFERENCES public.orcamentos(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.converter_requisicao_em_orcamento(
  requisicao_id_param uuid,
  cliente_id_param uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_requisicao RECORD;
  v_item RECORD;
  v_orcamento_id uuid;
  v_numero_orcamento text;
  v_preco numeric;
  v_subtotal numeric;
  v_valor_total numeric := 0;
BEGIN
  IF NOT is_admin() THEN
    RETURN json_build_object('success', false, 'message', 'Apenas administradores podem fazer isso');
  END IF;

  SELECT * INTO v_requisicao FROM public.requisicoes_material WHERE id = requisicao_id_param;

  IF v_requisicao IS NULL OR v_requisicao.status != 'pendente' THEN
    RETURN json_build_object('success', false, 'message', 'Requisição não encontrada ou já processada');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.clientes WHERE id = cliente_id_param) THEN
    RETURN json_build_object('success', false, 'message', 'Cliente não encontrado');
  END IF;

  v_numero_orcamento := public.gerar_numero_orcamento();

  INSERT INTO public.orcamentos (numero, cliente_id, valor_total, status, observacoes, created_by)
  VALUES (v_numero_orcamento, cliente_id_param, 0, 'pendente', 'Gerado a partir da requisição de material ' || v_requisicao.numero, auth.uid())
  RETURNING id INTO v_orcamento_id;

  FOR v_item IN
    SELECT ri.produto_id, ri.kit_id, ri.quantidade
    FROM public.requisicao_itens ri
    WHERE ri.requisicao_id = requisicao_id_param
  LOOP
    IF v_item.produto_id IS NOT NULL THEN
      SELECT preco INTO v_preco FROM public.produtos WHERE id = v_item.produto_id;
    ELSE
      SELECT preco_total INTO v_preco FROM public.kits WHERE id = v_item.kit_id;
    END IF;

    v_preco := COALESCE(v_preco, 0);
    v_subtotal := v_preco * v_item.quantidade;
    v_valor_total := v_valor_total + v_subtotal;

    INSERT INTO public.orcamento_itens (orcamento_id, produto_id, kit_id, quantidade, preco_unitario, desconto, subtotal)
    VALUES (v_orcamento_id, v_item.produto_id, v_item.kit_id, v_item.quantidade, v_preco, 0, v_subtotal);
  END LOOP;

  UPDATE public.orcamentos SET valor_total = v_valor_total WHERE id = v_orcamento_id;

  UPDATE public.requisicoes_material
  SET status = 'aprovado',
      orcamento_id = v_orcamento_id,
      aprovado_por = auth.uid(),
      aprovado_em = now(),
      updated_at = now()
  WHERE id = requisicao_id_param;

  RETURN json_build_object(
    'success', true,
    'message', 'Requisição convertida em orçamento com sucesso',
    'orcamento_id', v_orcamento_id,
    'orcamento_numero', v_numero_orcamento
  );
END;
$$;
