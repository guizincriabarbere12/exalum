/*
  # Correção de Aprovação de Orçamento e Colunas

  1. Adicionar coluna preco_unitario em orcamento_itens
    - Permitir edição de preço no orçamento
    
  2. Recriar função processar_orcamento_aprovado
    - Retornar JSON com success
    - Debitar estoque ao aprovar
    - Criar pedido automaticamente
    
  3. Garantir coluna total existe onde necessário
*/

-- 1. ADICIONAR COLUNA PRECO_UNITARIO EM ORCAMENTO_ITENS
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orcamento_itens' AND column_name = 'preco_unitario'
  ) THEN
    ALTER TABLE orcamento_itens ADD COLUMN preco_unitario NUMERIC DEFAULT 0;
  END IF;
END $$;

-- Atualizar preço unitário com base no produto (para registros existentes)
UPDATE orcamento_itens oi
SET preco_unitario = COALESCE(
  (SELECT preco FROM produtos WHERE id = oi.produto_id),
  0
)
WHERE preco_unitario IS NULL OR preco_unitario = 0;

-- 2. RECRIAR FUNÇÃO PROCESSAR_ORCAMENTO_APROVADO
DROP FUNCTION IF EXISTS processar_orcamento_aprovado(UUID);

CREATE OR REPLACE FUNCTION processar_orcamento_aprovado(orcamento_id_param UUID)
RETURNS JSON AS $$
DECLARE
  orcamento_row RECORD;
  item_row RECORD;
  pedido_id UUID;
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

  -- Verificar estoque de todos os itens antes de processar
  FOR item_row IN 
    SELECT 
      oi.produto_id,
      oi.quantidade,
      oi.kit_id,
      p.nome as produto_nome,
      p.estoque
    FROM orcamento_itens oi
    LEFT JOIN produtos p ON p.id = oi.produto_id
    WHERE oi.orcamento_id = orcamento_id_param
  LOOP
    -- Se for produto avulso, verificar estoque direto
    IF item_row.kit_id IS NULL AND item_row.produto_id IS NOT NULL THEN
      IF item_row.estoque < item_row.quantidade THEN
        estoque_insuficiente := true;
        produto_sem_estoque := item_row.produto_nome;
        EXIT;
      END IF;
    END IF;
    
    -- Se for kit, verificar estoque dos componentes
    IF item_row.kit_id IS NOT NULL THEN
      -- Verificar cada componente do kit
      FOR item_row IN
        SELECT 
          p.nome as produto_nome,
          p.estoque,
          ki.quantidade as qtd_necessaria
        FROM kit_itens ki
        JOIN produtos p ON p.id = ki.produto_id
        WHERE ki.kit_id = item_row.kit_id
      LOOP
        IF item_row.estoque < (item_row.qtd_necessaria * item_row.quantidade) THEN
          estoque_insuficiente := true;
          produto_sem_estoque := item_row.produto_nome;
          EXIT;
        END IF;
      END LOOP;
      
      IF estoque_insuficiente THEN
        EXIT;
      END IF;
    END IF;
  END LOOP;

  -- Se houver estoque insuficiente, retornar erro
  IF estoque_insuficiente THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Estoque insuficiente para o produto: ' || produto_sem_estoque
    );
  END IF;

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
    'PED-' || orcamento_row.numero,
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
    quantidade * COALESCE(preco_unitario, 0)
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
    'message', 'Orçamento aprovado e pedido criado com sucesso! Número: PED-' || orcamento_row.numero,
    'pedido_id', pedido_id
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Erro ao processar orçamento: ' || SQLERRM
    );
END;
$$ LANGUAGE plpgsql;

-- 3. GARANTIR QUE TRIGGER NÃO DEBITE DUAS VEZES
-- Remover trigger de débito automático no pedido_itens (já feito pela função acima)
DROP TRIGGER IF EXISTS trigger_debitar_estoque_kit ON pedido_itens;

-- 4. ATUALIZAR TRIGGER PARA CALCULAR SUBTOTAL NO ORCAMENTO_ITENS
CREATE OR REPLACE FUNCTION calcular_subtotal_orcamento_item()
RETURNS TRIGGER AS $$
BEGIN
  -- Se tem preço unitário, usar ele, senão buscar do produto
  IF NEW.preco_unitario IS NULL OR NEW.preco_unitario = 0 THEN
    IF NEW.kit_id IS NOT NULL THEN
      -- Se for kit, usar preco_total do kit
      SELECT preco_total INTO NEW.preco_unitario
      FROM kits
      WHERE id = NEW.kit_id;
    ELSIF NEW.produto_id IS NOT NULL THEN
      -- Se for produto, usar preco do produto
      SELECT preco INTO NEW.preco_unitario
      FROM produtos
      WHERE id = NEW.produto_id;
    END IF;
  END IF;
  
  -- Calcular subtotal
  NEW.subtotal = NEW.quantidade * COALESCE(NEW.preco_unitario, 0);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_calcular_subtotal_orcamento ON orcamento_itens;
CREATE TRIGGER trigger_calcular_subtotal_orcamento
  BEFORE INSERT OR UPDATE ON orcamento_itens
  FOR EACH ROW
  EXECUTE FUNCTION calcular_subtotal_orcamento_item();

-- 5. CRIAR FUNÇÃO PARA ATUALIZAR TOTAL DO ORÇAMENTO
CREATE OR REPLACE FUNCTION atualizar_total_orcamento()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE orcamentos
  SET valor_total = (
    SELECT COALESCE(SUM(subtotal), 0)
    FROM orcamento_itens
    WHERE orcamento_id = COALESCE(NEW.orcamento_id, OLD.orcamento_id)
  )
  WHERE id = COALESCE(NEW.orcamento_id, OLD.orcamento_id);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_atualizar_total_orcamento ON orcamento_itens;
CREATE TRIGGER trigger_atualizar_total_orcamento
  AFTER INSERT OR UPDATE OR DELETE ON orcamento_itens
  FOR EACH ROW
  EXECUTE FUNCTION atualizar_total_orcamento();
