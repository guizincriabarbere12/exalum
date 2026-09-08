-- ============================================================================
-- 1) NÚMERO DE ORÇAMENTO CURTO (ORC-0202, ORC-0203, ...)
-- ----------------------------------------------------------------------------
-- O formato longo baseado em timestamp ("ORC-20260803172010933123-456") tinha
-- sido adotado para escapar de um bug de colisão do LPAD. Aqui voltamos ao
-- formato curto sequencial usando uma SEQUENCE do Postgres, que é atômica e
-- não colide mesmo com dois orçamentos criados no mesmo instante.
-- A sequence começa depois do maior número curto de 4 dígitos já existente
-- (ORC-0201 -> começa em 202). O loop de segurança pula qualquer número que
-- por acaso já exista (ex.: os poucos "ORC-20260..." legados).
-- ============================================================================

CREATE SEQUENCE IF NOT EXISTS public.orcamento_numero_seq;

SELECT setval(
  'public.orcamento_numero_seq',
  COALESCE(
    (SELECT MAX(substring(numero from 5)::int)
     FROM public.orcamentos
     WHERE numero ~ '^ORC-[0-9]{4}$'),
    0
  ) + 1,
  false
);

CREATE OR REPLACE FUNCTION public.gerar_numero_orcamento()
RETURNS text
LANGUAGE plpgsql
AS $function$
DECLARE
  v_num integer;
  v_numero text;
BEGIN
  LOOP
    v_num := nextval('public.orcamento_numero_seq');
    v_numero := 'ORC-' || lpad(v_num::text, 4, '0');
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.orcamentos WHERE numero = v_numero);
  END LOOP;
  RETURN v_numero;
END;
$function$;

-- ============================================================================
-- 2) ASSINATURA DO PEDIDO VIA LINK PÚBLICO
-- ----------------------------------------------------------------------------
-- O orçamento aprovado vira "Pedido". O cliente recebe um link
-- (/assinar-pedido?token=<assinatura_token>) e assina — desenhando no
-- canvas (manuscrita) ou apenas confirmando com o nome (digital).
-- As colunas assinatura_base64 / assinatura_nome / assinatura_cargo /
-- assinatura_data já existiam; acrescentamos o token e o tipo.
-- ============================================================================

ALTER TABLE public.orcamentos
  ADD COLUMN IF NOT EXISTS assinatura_token uuid NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS assinatura_tipo text;

CREATE UNIQUE INDEX IF NOT EXISTS orcamentos_assinatura_token_idx
  ON public.orcamentos (assinatura_token);

-- ----------------------------------------------------------------------------
-- Carrega os dados do pedido para a página pública de assinatura.
-- Só devolve pedidos de orçamentos APROVADOS. Mesmo padrão SECURITY DEFINER
-- de consultar_pedido_publico.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.buscar_pedido_assinatura(token_param uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  orc RECORD;
  itens json;
  empresa text;
BEGIN
  SELECT o.*, c.nome AS cliente_nome
  INTO orc
  FROM orcamentos o
  JOIN clientes c ON c.id = o.cliente_id
  WHERE o.assinatura_token = token_param
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'message', 'Link inválido ou expirado.');
  END IF;

  IF orc.status <> 'aprovado' THEN
    RETURN json_build_object('success', false, 'message', 'Este pedido ainda não está liberado para assinatura.');
  END IF;

  SELECT json_agg(json_build_object(
    'nome', COALESCE(prod.nome, kit.nome, '-'),
    'quantidade', oi.quantidade,
    'preco_unitario', oi.preco_unitario,
    'subtotal', oi.subtotal
  ) ORDER BY oi.created_at)
  INTO itens
  FROM orcamento_itens oi
  LEFT JOIN produtos prod ON prod.id = oi.produto_id
  LEFT JOIN kits kit ON kit.id = oi.kit_id
  WHERE oi.orcamento_id = orc.id;

  SELECT nome_empresa INTO empresa FROM configuracoes LIMIT 1;

  RETURN json_build_object(
    'success', true,
    'numero', orc.numero,
    'valor_total', orc.valor_total,
    'observacoes', orc.observacoes,
    'cliente_nome', orc.cliente_nome,
    'empresa', COALESCE(empresa, 'Empresa'),
    'ja_assinado', orc.assinatura_data IS NOT NULL,
    'assinatura_nome', orc.assinatura_nome,
    'assinatura_data', orc.assinatura_data,
    'itens', COALESCE(itens, '[]'::json)
  );
END;
$$;

-- ----------------------------------------------------------------------------
-- Registra a assinatura. Uma única vez por pedido.
-- tipo_param: 'manuscrita' (exige imagem_param, o dataURL do canvas) ou
-- 'digital' (só nome, sem desenho).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.assinar_pedido(
  token_param uuid,
  nome_param text,
  tipo_param text,
  cargo_param text DEFAULT NULL,
  imagem_param text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  orc RECORD;
BEGIN
  SELECT * INTO orc FROM orcamentos WHERE assinatura_token = token_param LIMIT 1;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'message', 'Link inválido.');
  END IF;

  IF orc.status <> 'aprovado' THEN
    RETURN json_build_object('success', false, 'message', 'Pedido não está liberado para assinatura.');
  END IF;

  IF orc.assinatura_data IS NOT NULL THEN
    RETURN json_build_object('success', false, 'message', 'Este pedido já foi assinado.');
  END IF;

  IF nome_param IS NULL OR length(btrim(nome_param)) < 3 THEN
    RETURN json_build_object('success', false, 'message', 'Informe o nome de quem está assinando.');
  END IF;

  IF tipo_param NOT IN ('digital', 'manuscrita') THEN
    RETURN json_build_object('success', false, 'message', 'Tipo de assinatura inválido.');
  END IF;

  IF tipo_param = 'manuscrita' AND (imagem_param IS NULL OR imagem_param = '') THEN
    RETURN json_build_object('success', false, 'message', 'Desenhe a assinatura antes de enviar.');
  END IF;

  IF imagem_param IS NOT NULL AND length(imagem_param) > 800000 THEN
    RETURN json_build_object('success', false, 'message', 'Imagem da assinatura muito grande.');
  END IF;

  UPDATE orcamentos
  SET assinatura_nome   = btrim(nome_param),
      assinatura_cargo  = NULLIF(btrim(COALESCE(cargo_param, '')), ''),
      assinatura_tipo   = tipo_param,
      assinatura_base64 = CASE WHEN tipo_param = 'manuscrita' THEN imagem_param ELSE NULL END,
      assinatura_data   = now(),
      updated_at        = now()
  WHERE assinatura_token = token_param;

  RETURN json_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.buscar_pedido_assinatura(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.assinar_pedido(uuid, text, text, text, text) TO anon, authenticated;
