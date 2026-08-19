-- Consulta pública de status de pedido (sem login): exige numero + telefone
-- coincidindo, pra evitar que qualquer pessoa varra pedidos de terceiros só
-- sabendo o número. Mesmo padrão já usado no kitsdobrasil.
CREATE OR REPLACE FUNCTION public.consultar_pedido_publico(numero_param text, telefone_param text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  pedido RECORD;
  orcamento_status text;
  itens json;
BEGIN
  SELECT p.*, c.telefone AS cliente_telefone
  INTO pedido
  FROM pedidos p
  JOIN clientes c ON c.id = p.cliente_id
  WHERE p.numero = numero_param
    AND regexp_replace(c.telefone, '\D', '', 'g') = regexp_replace(telefone_param, '\D', '', 'g')
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'message', 'Pedido não encontrado. Confira o número e o telefone informados.');
  END IF;

  IF pedido.orcamento_id IS NOT NULL THEN
    SELECT status INTO orcamento_status FROM orcamentos WHERE id = pedido.orcamento_id;
  END IF;

  SELECT json_agg(json_build_object(
    'nome', COALESCE(prod.nome, kit.nome),
    'quantidade', pi.quantidade
  ))
  INTO itens
  FROM pedido_itens pi
  LEFT JOIN produtos prod ON prod.id = pi.produto_id
  LEFT JOIN kits kit ON kit.id = pi.kit_id
  WHERE pi.pedido_id = pedido.id;

  RETURN json_build_object(
    'success', true,
    'numero', pedido.numero,
    'status', pedido.status,
    'orcamento_status', orcamento_status,
    'data_pedido', pedido.data_pedido,
    'valor_total', pedido.valor_total,
    'observacoes', pedido.observacoes,
    'itens', COALESCE(itens, '[]'::json)
  );
END;
$$;
