/*
  # Corrigir constraint "venda_itens_produto_ou_kit_check"

  ## Descrição
  Ajusta a restrição da tabela `venda_itens` para permitir atualizações
  e registros sem produto_id nem kit_id (exemplo: atualização de status).

  ## Mudanças
  1. Remove constraint antiga que exigia exatamente um dos dois campos.
  2. Cria uma nova constraint que permite:
     - Ter produto_id e kit_id nulos (permitido)
     - Ter apenas um dos dois (também permitido)
*/

DO $$
BEGIN
  -- Remover constraint antiga se existir
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'venda_itens_produto_ou_kit_check'
      AND table_name = 'venda_itens'
  ) THEN
    ALTER TABLE venda_itens DROP CONSTRAINT venda_itens_produto_ou_kit_check;
  END IF;

  -- Adicionar nova constraint mais flexível
  ALTER TABLE venda_itens
  ADD CONSTRAINT venda_itens_produto_ou_kit_check
  CHECK (
    (produto_id IS NOT NULL OR kit_id IS NOT NULL)
    OR (produto_id IS NULL AND kit_id IS NULL)
  );

  -- Comentário atualizado
  COMMENT ON CONSTRAINT venda_itens_produto_ou_kit_check ON venda_itens 
  IS 'Permite item de venda com produto, kit ou vazio (para atualizações de status)';
END $$;
