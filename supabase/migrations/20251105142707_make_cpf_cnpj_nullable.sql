/*
  # Tornar CPF/CNPJ Opcional para Clientes do Catálogo
  
  ## Descrição
  Remove a obrigatoriedade do campo cpf_cnpj para permitir que clientes
  façam pedidos pelo catálogo público apenas com nome e telefone.
  
  ## Alterações
  1. Altera coluna cpf_cnpj para aceitar valores nulos
  
  ## Observações
  - Clientes do catálogo público podem não ter CPF/CNPJ cadastrado
  - Campo continua disponível para cadastros completos
*/

-- Tornar cpf_cnpj opcional
ALTER TABLE clientes ALTER COLUMN cpf_cnpj DROP NOT NULL;
