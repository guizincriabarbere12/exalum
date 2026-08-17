/*
  # Criar Função para Converter Pedido em Orçamento
  
  ## Descrição
  Cria função que converte um pedido do catálogo em orçamento editável,
  permitindo que o admin ajuste valores e dê descontos antes da aprovação.
  
  ## Alterações
  1. Função `converter_pedido_em_orcamento` - Converte pedido em orçamento
  2. Copia todos os itens do pedido para o orçamento
  3. Atualiza status do pedido para 'convertido'
  4. Gera número sequencial para o orçamento
  
  ## Fluxo
  1. Cliente faz pedido pelo catálogo (status: pendente)
  2. Admin vê pedido e clica "Converter em Orçamento"
  3. Sistema cria orçamento com os mesmos itens
  4. Admin pode editar valores e dar descontos
  5. Admin aprova orçamento
  6. Sistema cria venda e debita estoque
  
  ## Retorno
  - success: true/false
  - message: Mensagem de sucesso ou erro
  - orcamento_id: ID do orçamento criado
  - orcamento_numero: Número do orçamento criado
*/

CREATE OR REPLACE FUNCTION public.converter_pedido_em_orcamento(pedido_id_param uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  item RECORD;
  pedido RECORD;
  orcamento_id uuid;
  numero_orcamento text;
  contador integer;
BEGIN
  -- Buscar dados do pedido
  SELECT * INTO pedido FROM pedidos WHERE id = pedido_id_param;
  
  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Pedido não encontrado'
    );
  END IF;
  
  -- Verificar se pedido já foi convertido
  IF pedido.status != 'pendente' AND pedido.status != 'confirmado' THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Este pedido não pode ser convertido em orçamento'
    );
  END IF;
  
  -- Gerar número sequencial para o orçamento
  SELECT COUNT(*) + 1 INTO contador FROM orcamentos;
  numero_orcamento := 'ORC-' || LPAD(contador::text, 4, '0');
  
  -- Criar orçamento
  INSERT INTO orcamentos (
    numero,
    cliente_id,
    valor_total,
    status,
    observacoes,
    created_by
  ) VALUES (
    numero_orcamento,
    pedido.cliente_id,
    pedido.valor_total,
    'pendente',
    'Criado a partir do pedido: ' || pedido.numero || COALESCE(' - ' || pedido.observacoes, ''),
    auth.uid()
  ) RETURNING id INTO orcamento_id;
  
  -- Copiar itens do pedido para o orçamento
  FOR item IN
    SELECT pi.*
    FROM pedido_itens pi
    WHERE pi.pedido_id = pedido_id_param
  LOOP
    INSERT INTO orcamento_itens (
      orcamento_id,
      produto_id,
      kit_id,
      quantidade,
      preco_unitario,
      desconto,
      peso,
      subtotal
    ) VALUES (
      orcamento_id,
      item.produto_id,
      item.kit_id,
      item.quantidade,
      item.preco_unitario,
      0,
      NULL,
      item.subtotal
    );
  END LOOP;
  
  -- Atualizar status do pedido
  UPDATE pedidos
  SET status = 'confirmado',
      updated_at = now()
  WHERE id = pedido_id_param;
  
  RETURN json_build_object(
    'success', true,
    'message', 'Pedido convertido em orçamento com sucesso',
    'orcamento_id', orcamento_id,
    'orcamento_numero', numero_orcamento
  );
END;
$$;
