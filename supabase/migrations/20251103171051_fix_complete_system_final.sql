/*
  # Correção Completa do Sistema - Final

  1. Adicionar coluna kit_id em pedido_itens
  2. Corrigir geração de número de pedido único
  3. Atualizar função processar_orcamento_aprovado
  4. Garantir consistência de colunas
*/

-- 1. ADICIONAR COLUNA KIT_ID EM PEDIDO_ITENS
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pedido_itens' AND column_name = 'kit_id'
  ) THEN
    ALTER TABLE pedido_itens ADD COLUMN kit_id UUID REFERENCES kits(id);
  END IF;
END $$;

-- 2. CRIAR FUNÇÃO PARA GERAR NÚMERO ÚNICO DE PEDIDO
CREATE OR REPLACE FUNCTION gerar_numero_pedido()
RETURNS TEXT AS $$
DECLARE
  novo_numero TEXT;
  contador INTEGER := 1;
  ano_atual TEXT := TO_CHAR(CURRENT_DATE, 'YYYY');
BEGIN
  LOOP
    novo_numero := 'PED-' || ano_atual || '-' || LPAD(contador::TEXT, 5, '0');
    
    -- Verificar se já existe
    IF NOT EXISTS (SELECT 1 FROM pedidos WHERE numero = novo_numero) THEN
      RETURN novo_numero;
    END IF;
    
    contador := contador + 1;
    
    -- Proteção contra loop infinito
    IF contador > 99999 THEN
      RAISE EXCEPTION 'Limite de pedidos atingido para o ano';
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- 3. RECRIAR FUNÇÃO PROCESSAR_ORCAMENTO_APROVADO COM NÚMERO ÚNICO
DROP FUNCTION IF EXISTS processar_orcamento_aprovado(UUID);

CREATE OR REPLACE FUNCTION processar_orcamento_aprovado(orcamento_id_param UUID)
RETURNS JSON AS $$
DECLARE
  orcamento_row RECORD;
  item_row RECORD;
  pedido_id UUID;
  numero_pedido TEXT;
  estoque_insuficiente BOOLEAN := false;
  produto_sem_estoque TEXT := '';
BEGIN
  -- Buscar dados do orçamento
  SELECT * INTO orcamento_row
  FROM orcamentos
  WHERE id = orcamento_id_param;

  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Orçamento não encontrado'
    );
  END IF;

  -- Verificar se já foi aprovado
  IF orcamento_row.status = 'aprovado' THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Este orçamento já foi aprovado anteriormente'
    );
  END IF;

  -- Verificar estoque de todos os itens antes de processar
  FOR item_row IN 
    SELECT 
      oi.produto_id,
      oi.quantidade,
      oi.kit_id,
      COALESCE(p.nome, k.nome) as item_nome,
      p.estoque
    FROM orcamento_itens oi
    LEFT JOIN produtos p ON p.id = oi.produto_id
    LEFT JOIN kits k ON k.id = oi.kit_id
    WHERE oi.orcamento_id = orcamento_id_param
  LOOP
    -- Se for produto avulso, verificar estoque direto
    IF item_row.kit_id IS NULL AND item_row.produto_id IS NOT NULL THEN
      IF item_row.estoque < item_row.quantidade THEN
        estoque_insuficiente := true;
        produto_sem_estoque := item_row.item_nome;
        EXIT;
      END IF;
    END IF;
    
    -- Se for kit, verificar estoque dos componentes
    IF item_row.kit_id IS NOT NULL THEN
      DECLARE
        componente_row RECORD;
      BEGIN
        FOR componente_row IN
          SELECT 
            p.nome as produto_nome,
            p.estoque,
            ki.quantidade as qtd_necessaria
          FROM kit_itens ki
          JOIN produtos p ON p.id = ki.produto_id
          WHERE ki.kit_id = item_row.kit_id
        LOOP
          IF componente_row.estoque < (componente_row.qtd_necessaria * item_row.quantidade) THEN
            estoque_insuficiente := true;
            produto_sem_estoque := componente_row.produto_nome || ' (componente do kit ' || item_row.item_nome || ')';
            EXIT;
          END IF;
        END LOOP;
      END;
      
      IF estoque_insuficiente THEN
        EXIT;
      END IF;
    END IF;
  END LOOP;

  -- Se houver estoque insuficiente, retornar erro
  IF estoque_insuficiente THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Estoque insuficiente para: ' || produto_sem_estoque
    );
  END IF;

  -- Gerar número único para o pedido
  numero_pedido := gerar_numero_pedido();

  -- Criar pedido baseado no orçamento
  INSERT INTO pedidos (
    numero,
    cliente_id,
    orcamento_id,
    status,
    valor_total,
    observacoes,
    data,
    created_by
  ) VALUES (
    numero_pedido,
    orcamento_row.cliente_id,
    orcamento_row.id,
    'aguardando_producao',
    orcamento_row.valor_total,
    orcamento_row.observacoes,
    CURRENT_DATE,
    orcamento_row.created_by
  )
  RETURNING id INTO pedido_id;

  -- Copiar itens do orçamento para o pedido
  INSERT INTO pedido_itens (
    pedido_id,
    produto_id,
    kit_id,
    quantidade,
    preco_unitario,
    subtotal
  )
  SELECT
    pedido_id,
    produto_id,
    kit_id,
    quantidade,
    COALESCE(preco_unitario, 0),
    COALESCE(subtotal, quantidade * COALESCE(preco_unitario, 0))
  FROM orcamento_itens
  WHERE orcamento_id = orcamento_id_param;

  -- Debitar estoque dos produtos
  FOR item_row IN 
    SELECT 
      oi.produto_id,
      oi.quantidade,
      oi.kit_id
    FROM orcamento_itens oi
    WHERE oi.orcamento_id = orcamento_id_param
  LOOP
    -- Se for produto avulso, debitar diretamente
    IF item_row.kit_id IS NULL AND item_row.produto_id IS NOT NULL THEN
      UPDATE produtos
      SET estoque = estoque - item_row.quantidade
      WHERE id = item_row.produto_id;
    END IF;
    
    -- Se for kit, debitar componentes
    IF item_row.kit_id IS NOT NULL THEN
      UPDATE produtos p
      SET estoque = estoque - (ki.quantidade * item_row.quantidade)
      FROM kit_itens ki
      WHERE ki.kit_id = item_row.kit_id
        AND p.id = ki.produto_id;
    END IF;
  END LOOP;

  -- Atualizar status do orçamento
  UPDATE orcamentos
  SET status = 'aprovado'
  WHERE id = orcamento_id_param;

  RETURN json_build_object(
    'success', true,
    'message', 'Orçamento aprovado! Pedido ' || numero_pedido || ' criado com sucesso',
    'pedido_id', pedido_id,
    'numero_pedido', numero_pedido
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Erro ao processar orçamento: ' || SQLERRM
    );
END;
$$ LANGUAGE plpgsql;

-- 4. ATUALIZAR PRECO_UNITARIO EM PEDIDO_ITENS EXISTENTES
UPDATE pedido_itens pi
SET preco_unitario = COALESCE(
  (SELECT preco FROM produtos WHERE id = pi.produto_id),
  0
)
WHERE preco_unitario IS NULL OR preco_unitario = 0;

-- 5. CRIAR TRIGGER PARA CALCULAR SUBTOTAL EM PEDIDO_ITENS
CREATE OR REPLACE FUNCTION calcular_subtotal_pedido_item()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.preco_unitario IS NULL OR NEW.preco_unitario = 0 THEN
    IF NEW.kit_id IS NOT NULL THEN
      SELECT preco_total INTO NEW.preco_unitario FROM kits WHERE id = NEW.kit_id;
    ELSIF NEW.produto_id IS NOT NULL THEN
      SELECT preco INTO NEW.preco_unitario FROM produtos WHERE id = NEW.produto_id;
    END IF;
  END IF;
  
  NEW.subtotal = NEW.quantidade * COALESCE(NEW.preco_unitario, 0);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_calcular_subtotal_pedido ON pedido_itens;
CREATE TRIGGER trigger_calcular_subtotal_pedido
  BEFORE INSERT OR UPDATE ON pedido_itens
  FOR EACH ROW
  EXECUTE FUNCTION calcular_subtotal_pedido_item();

-- 6. CRIAR FUNÇÃO PARA ATUALIZAR TOTAL DO PEDIDO
CREATE OR REPLACE FUNCTION atualizar_total_pedido()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE pedidos
  SET valor_total = (
    SELECT COALESCE(SUM(subtotal), 0)
    FROM pedido_itens
    WHERE pedido_id = COALESCE(NEW.pedido_id, OLD.pedido_id)
  )
  WHERE id = COALESCE(NEW.pedido_id, OLD.pedido_id);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_atualizar_total_pedido ON pedido_itens;
CREATE TRIGGER trigger_atualizar_total_pedido
  AFTER INSERT OR UPDATE OR DELETE ON pedido_itens
  FOR EACH ROW
  EXECUTE FUNCTION atualizar_total_pedido();

-- 7. GARANTIR QUE TODAS AS VIEWS USAM VALOR_TOTAL
DROP VIEW IF EXISTS vendas_detalhadas;
CREATE OR REPLACE VIEW vendas_detalhadas AS
SELECT 
  v.id,
  v.numero,
  v.data,
  v.status,
  v.valor_total,
  v.observacoes,
  c.nome as cliente_nome,
  c.cpf_cnpj as cliente_cpf_cnpj,
  (
    SELECT json_agg(
      json_build_object(
        'produto_nome', p.nome,
        'quantidade', vi.quantidade,
        'preco_unitario', vi.preco_unitario,
        'subtotal', vi.subtotal
      )
    )
    FROM venda_itens vi
    JOIN produtos p ON p.id = vi.produto_id
    WHERE vi.venda_id = v.id
  ) as itens
FROM vendas v
JOIN clientes c ON c.id = v.cliente_id;
