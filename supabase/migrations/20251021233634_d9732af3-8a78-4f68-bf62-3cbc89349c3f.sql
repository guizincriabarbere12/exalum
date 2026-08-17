-- Create table for customer orders (pedidos dos clientes)
CREATE TABLE IF NOT EXISTS public.pedidos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  numero TEXT NOT NULL UNIQUE,
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'confirmado', 'em_separacao', 'enviado', 'entregue', 'cancelado')),
  valor_total NUMERIC NOT NULL DEFAULT 0,
  observacoes TEXT,
  data_pedido TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  data_confirmacao TIMESTAMP WITH TIME ZONE,
  data_envio TIMESTAMP WITH TIME ZONE,
  data_entrega TIMESTAMP WITH TIME ZONE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for order items
CREATE TABLE IF NOT EXISTS public.pedido_itens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pedido_id UUID NOT NULL REFERENCES public.pedidos(id) ON DELETE CASCADE,
  produto_id UUID NOT NULL REFERENCES public.produtos(id) ON DELETE RESTRICT,
  quantidade NUMERIC NOT NULL CHECK (quantidade > 0),
  preco_unitario NUMERIC NOT NULL,
  subtotal NUMERIC NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on pedidos
ALTER TABLE public.pedidos ENABLE ROW LEVEL SECURITY;

-- Enable RLS on pedido_itens
ALTER TABLE public.pedido_itens ENABLE ROW LEVEL SECURITY;

-- RLS Policies for pedidos
CREATE POLICY "Authenticated users can view pedidos"
  ON public.pedidos FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert pedidos"
  ON public.pedidos FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update pedidos"
  ON public.pedidos FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Admins can delete pedidos"
  ON public.pedidos FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- RLS Policies for pedido_itens
CREATE POLICY "Authenticated users can view pedido_itens"
  ON public.pedido_itens FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert pedido_itens"
  ON public.pedido_itens FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update pedido_itens"
  ON public.pedido_itens FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Admins can delete pedido_itens"
  ON public.pedido_itens FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- Create trigger for updated_at on pedidos
CREATE TRIGGER update_pedidos_updated_at
  BEFORE UPDATE ON public.pedidos
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_pedidos_cliente_id ON public.pedidos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_status ON public.pedidos(status);
CREATE INDEX IF NOT EXISTS idx_pedidos_created_at ON public.pedidos(created_at);
CREATE INDEX IF NOT EXISTS idx_pedido_itens_pedido_id ON public.pedido_itens(pedido_id);
CREATE INDEX IF NOT EXISTS idx_pedido_itens_produto_id ON public.pedido_itens(produto_id);

-- Create function to check stock availability for an order
CREATE OR REPLACE FUNCTION public.check_pedido_availability(pedido_id_param UUID)
RETURNS TABLE(produto_id UUID, produto_nome TEXT, necessario NUMERIC, disponivel NUMERIC, faltando NUMERIC)
LANGUAGE sql
STABLE
AS $$
  SELECT 
    pi.produto_id,
    p.descricao as produto_nome,
    pi.quantidade as necessario,
    COALESCE(e.quantidade, 0) as disponivel,
    GREATEST(pi.quantidade - COALESCE(e.quantidade, 0), 0) as faltando
  FROM pedido_itens pi
  JOIN produtos p ON p.id = pi.produto_id
  LEFT JOIN estoque e ON e.produto_id = pi.produto_id
  WHERE pi.pedido_id = pedido_id_param;
$$;

-- Create function to process order and update stock
CREATE OR REPLACE FUNCTION public.processar_pedido(pedido_id_param UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  item RECORD;
  estoque_atual NUMERIC;
  resultado JSONB;
  itens_faltando JSONB[] := '{}';
BEGIN
  -- Check if all items are available
  FOR item IN 
    SELECT pi.produto_id, pi.quantidade, p.descricao
    FROM pedido_itens pi
    JOIN produtos p ON p.id = pi.produto_id
    WHERE pi.pedido_id = pedido_id_param
  LOOP
    SELECT quantidade INTO estoque_atual
    FROM estoque
    WHERE produto_id = item.produto_id;
    
    IF estoque_atual IS NULL OR estoque_atual < item.quantidade THEN
      itens_faltando := array_append(itens_faltando, 
        jsonb_build_object(
          'produto_id', item.produto_id,
          'descricao', item.descricao,
          'necessario', item.quantidade,
          'disponivel', COALESCE(estoque_atual, 0)
        )
      );
    END IF;
  END LOOP;
  
  -- If there are missing items, return error
  IF array_length(itens_faltando, 1) > 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Estoque insuficiente',
      'itens_faltando', to_jsonb(itens_faltando)
    );
  END IF;
  
  -- Process stock updates
  FOR item IN 
    SELECT pi.produto_id, pi.quantidade
    FROM pedido_itens pi
    WHERE pi.pedido_id = pedido_id_param
  LOOP
    -- Update stock
    UPDATE estoque
    SET quantidade = quantidade - item.quantidade
    WHERE produto_id = item.produto_id;
    
    -- Register stock movement
    INSERT INTO movimentacao_estoque (produto_id, tipo, quantidade, observacao, created_by)
    VALUES (
      item.produto_id,
      'saida',
      item.quantidade,
      'Pedido #' || (SELECT numero FROM pedidos WHERE id = pedido_id_param),
      auth.uid()
    );
  END LOOP;
  
  -- Update order status
  UPDATE pedidos
  SET status = 'confirmado',
      data_confirmacao = now()
  WHERE id = pedido_id_param;
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Pedido processado com sucesso'
  );
END;
$$;

-- Create function to generate next order number
CREATE OR REPLACE FUNCTION public.gerar_numero_pedido()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  next_number INTEGER;
  new_numero TEXT;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(numero FROM '[0-9]+') AS INTEGER)), 0) + 1
  INTO next_number
  FROM pedidos
  WHERE numero ~ '^PED-[0-9]+$';
  
  new_numero := 'PED-' || LPAD(next_number::TEXT, 6, '0');
  RETURN new_numero;
END;
$$;

-- Create function to calculate order total
CREATE OR REPLACE FUNCTION public.calcular_total_pedido()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE pedidos
  SET valor_total = (
    SELECT COALESCE(SUM(subtotal), 0)
    FROM pedido_itens
    WHERE pedido_id = NEW.pedido_id
  )
  WHERE id = NEW.pedido_id;
  
  RETURN NEW;
END;
$$;

-- Create trigger to update order total when items change
CREATE TRIGGER update_pedido_total_on_insert
  AFTER INSERT ON public.pedido_itens
  FOR EACH ROW
  EXECUTE FUNCTION public.calcular_total_pedido();

CREATE TRIGGER update_pedido_total_on_update
  AFTER UPDATE ON public.pedido_itens
  FOR EACH ROW
  EXECUTE FUNCTION public.calcular_total_pedido();

CREATE TRIGGER update_pedido_total_on_delete
  AFTER DELETE ON public.pedido_itens
  FOR EACH ROW
  EXECUTE FUNCTION public.calcular_total_pedido();