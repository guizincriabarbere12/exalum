-- pedido_itens.subtotal é coluna gerada (round(quantidade*preco_unitario -
-- desconto, 2)); essa função tentava inserir um valor nela, o que sempre
-- falhava ("cannot insert a non-DEFAULT value into column subtotal").
-- Isso quebrava o checkout do catálogo do cliente logado.
CREATE OR REPLACE FUNCTION public.criar_pedido_catalogo(cliente_id_param uuid, itens_json json, observacoes_param text DEFAULT NULL::text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  pedido_id uuid;
  numero_pedido text;
  item json;
  v_valor_total numeric := 0;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM clientes WHERE id = cliente_id_param) THEN
    RETURN json_build_object('success', false, 'message', 'Cliente não encontrado');
  END IF;

  numero_pedido := gerar_numero_pedido();

  INSERT INTO pedidos (numero, cliente_id, status, observacoes, origem, data_pedido)
  VALUES (numero_pedido, cliente_id_param, 'pendente', observacoes_param, 'catalogo', CURRENT_DATE)
  RETURNING id INTO pedido_id;

  FOR item IN SELECT * FROM json_array_elements(itens_json)
  LOOP
    INSERT INTO pedido_itens (
      pedido_id,
      produto_id,
      kit_id,
      quantidade,
      preco_unitario
    )
    VALUES (
      pedido_id,
      (item->>'produto_id')::uuid,
      (item->>'kit_id')::uuid,
      (item->>'quantidade')::integer,
      (item->>'preco_unitario')::numeric
    );

    v_valor_total := v_valor_total + ((item->>'quantidade')::integer * (item->>'preco_unitario')::numeric);
  END LOOP;

  UPDATE pedidos SET valor_total = v_valor_total WHERE id = pedido_id;

  RETURN json_build_object(
    'success', true,
    'message', 'Pedido criado com sucesso! Aguardando aprovação.',
    'pedido_numero', numero_pedido
  );
END;
$function$;
