/*
  # Corrigir constraint venda_itens_produto_ou_kit_check

  ## Descrição
  Ajusta a constraint para permitir registros com produto_id e kit_id nulos,
  o que é necessário em casos de atualização de status ou inserções temporárias.

  ## Mudanças
  - Remove a constraint antiga.
  - Cria uma nova constraint mais flexível.

  ## Segurança
  - Mantém as demais constraints e FKs intactas.
*/

-- Remover constraint antiga se existir
ALTER TABLE venda_itens
DROP CONSTRAINT IF EXISTS venda_itens_produto_ou_kit_check;

-- Criar nova constraint mais flexível
ALTER TABLE venda_itens
ADD CONSTRAINT venda_itens_produto_ou_kit_check
CHECK (
  (produto_id IS NOT NULL AND kit_id IS NULL)
  OR (produto_id IS NULL AND kit_id IS NOT NULL)
  OR (produto_id IS NULL AND kit_id IS NULL)
);

-- Adicionar comentário explicativo
COMMENT ON CONSTRAINT venda_itens_produto_ou_kit_check ON venda_itens 
IS 'Permite item com produto, kit ou ambos nulos (para atualizações de status e registros intermediários)';
