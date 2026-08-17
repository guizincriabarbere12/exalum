/*
  # Adicionar Suporte a Kits na Tabela venda_itens
  
  ## Descrição
  Corrige a tabela venda_itens para permitir vendas com kits,
  seguindo o mesmo padrão de orcamento_itens e pedido_itens.
  
  ## Mudanças
  
  1. Alterações na Tabela `venda_itens`:
     - Adiciona coluna `kit_id` (uuid, nullable)
     - Torna `produto_id` nullable
     - Adiciona constraint para garantir que ou produto_id ou kit_id seja preenchido
     - Adiciona foreign key para kits
  
  ## Segurança
  - Mantém RLS existente
  - Adiciona validação para evitar itens sem produto nem kit
*/

-- Tornar produto_id nullable
ALTER TABLE venda_itens 
  ALTER COLUMN produto_id DROP NOT NULL;

-- Adicionar coluna kit_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'venda_itens' AND column_name = 'kit_id'
  ) THEN
    ALTER TABLE venda_itens ADD COLUMN kit_id uuid REFERENCES kits(id);
  END IF;
END $$;

-- Adicionar constraint para garantir que tenha produto_id OU kit_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'venda_itens_produto_ou_kit_check'
  ) THEN
    ALTER TABLE venda_itens 
      ADD CONSTRAINT venda_itens_produto_ou_kit_check 
      CHECK (
        (produto_id IS NOT NULL AND kit_id IS NULL) OR
        (produto_id IS NULL AND kit_id IS NOT NULL)
      );
  END IF;
END $$;

-- Comentários
COMMENT ON COLUMN venda_itens.kit_id IS 'Referência ao kit vendido (exclusivo com produto_id)';
COMMENT ON CONSTRAINT venda_itens_produto_ou_kit_check ON venda_itens IS 'Garante que cada item de venda tenha exatamente um produto OU um kit';
