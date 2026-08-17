/*
  # Melhorias no Sistema Financeiro e Integração Automática
  
  ## Descrição
  Adiciona campos e triggers para integração automática do financeiro com vendas e orçamentos aprovados.
  
  ## Mudanças
  
  1. Novos Campos na Tabela `transacoes_financeiras`:
     - `orcamento_id` (uuid) - Referência ao orçamento relacionado
     - `forma_pagamento` (text) - Como foi pago (dinheiro, pix, cartão, etc)
     - `data_vencimento` (date) - Data de vencimento para recebíveis
     - `data_pagamento` (date) - Data efetiva do pagamento/recebimento
     - `numero_parcela` (text) - Número da parcela (ex: 1/3)
     - `observacoes` (text) - Observações adicionais
  
  2. Triggers Automáticos:
     - Criar receita automaticamente quando venda é criada
     - Criar receita automaticamente quando orçamento é aprovado
  
  ## Segurança
  - Mantém RLS existente na tabela
  - Triggers executam com privilégios adequados
*/

-- Adicionar campos à tabela transacoes_financeiras
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transacoes_financeiras' AND column_name = 'orcamento_id'
  ) THEN
    ALTER TABLE transacoes_financeiras ADD COLUMN orcamento_id uuid REFERENCES orcamentos(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transacoes_financeiras' AND column_name = 'forma_pagamento'
  ) THEN
    ALTER TABLE transacoes_financeiras ADD COLUMN forma_pagamento text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transacoes_financeiras' AND column_name = 'data_vencimento'
  ) THEN
    ALTER TABLE transacoes_financeiras ADD COLUMN data_vencimento date;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transacoes_financeiras' AND column_name = 'data_pagamento'
  ) THEN
    ALTER TABLE transacoes_financeiras ADD COLUMN data_pagamento date;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transacoes_financeiras' AND column_name = 'numero_parcela'
  ) THEN
    ALTER TABLE transacoes_financeiras ADD COLUMN numero_parcela text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transacoes_financeiras' AND column_name = 'observacoes'
  ) THEN
    ALTER TABLE transacoes_financeiras ADD COLUMN observacoes text;
  END IF;
END $$;

-- Função para criar transação financeira automaticamente quando venda é criada
CREATE OR REPLACE FUNCTION criar_transacao_financeira_venda()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Criar receita para a venda
  INSERT INTO transacoes_financeiras (
    descricao,
    tipo,
    valor,
    data,
    status,
    categoria,
    venda_id,
    orcamento_id,
    created_by
  ) VALUES (
    'Venda ' || NEW.numero,
    'receita',
    NEW.valor_total,
    CURRENT_DATE,
    'pendente',
    'Vendas',
    NEW.id,
    NEW.orcamento_id,
    NEW.created_by
  );
  
  RETURN NEW;
END;
$$;

-- Função para criar transação financeira automaticamente quando orçamento é aprovado
CREATE OR REPLACE FUNCTION criar_transacao_financeira_orcamento()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Se o orçamento foi aprovado e ainda não tem transação financeira
  IF NEW.status = 'aprovado' AND OLD.status != 'aprovado' THEN
    -- Verificar se já não existe uma transação para este orçamento
    IF NOT EXISTS (
      SELECT 1 FROM transacoes_financeiras WHERE orcamento_id = NEW.id
    ) THEN
      INSERT INTO transacoes_financeiras (
        descricao,
        tipo,
        valor,
        data,
        status,
        categoria,
        orcamento_id,
        created_by
      ) VALUES (
        'Orçamento ' || NEW.numero || ' aprovado',
        'receita',
        NEW.valor_total,
        CURRENT_DATE,
        'pendente',
        'Orçamentos',
        NEW.id,
        NEW.created_by
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Criar trigger para vendas
DROP TRIGGER IF EXISTS trigger_criar_transacao_venda ON vendas;
CREATE TRIGGER trigger_criar_transacao_venda
  AFTER INSERT ON vendas
  FOR EACH ROW
  EXECUTE FUNCTION criar_transacao_financeira_venda();

-- Criar trigger para orçamentos
DROP TRIGGER IF EXISTS trigger_criar_transacao_orcamento ON orcamentos;
CREATE TRIGGER trigger_criar_transacao_orcamento
  AFTER UPDATE ON orcamentos
  FOR EACH ROW
  WHEN (NEW.status = 'aprovado')
  EXECUTE FUNCTION criar_transacao_financeira_orcamento();

-- Comentários para documentação
COMMENT ON COLUMN transacoes_financeiras.orcamento_id IS 'Referência ao orçamento que gerou esta transação';
COMMENT ON COLUMN transacoes_financeiras.forma_pagamento IS 'Forma de pagamento utilizada';
COMMENT ON COLUMN transacoes_financeiras.data_vencimento IS 'Data de vencimento para recebíveis';
COMMENT ON COLUMN transacoes_financeiras.data_pagamento IS 'Data efetiva do pagamento/recebimento';
COMMENT ON COLUMN transacoes_financeiras.numero_parcela IS 'Número da parcela (ex: 1/3, 2/3)';
COMMENT ON COLUMN transacoes_financeiras.observacoes IS 'Observações adicionais sobre a transação';
