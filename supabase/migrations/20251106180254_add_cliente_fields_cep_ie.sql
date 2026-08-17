/*
  # Adicionar Campos de CEP e Inscrição Estadual aos Clientes
  
  ## Descrição
  Adiciona campos de CEP, cidade, estado, bairro e inscrição estadual na tabela de clientes
  para melhor controle de dados cadastrais.
  
  ## Mudanças
  1. Novos Campos na Tabela `clientes`:
     - `cep` (text) - CEP do cliente
     - `cidade` (text) - Cidade do cliente
     - `estado` (text) - Estado do cliente (UF)
     - `bairro` (text) - Bairro do cliente
     - `inscricao_estadual` (text) - Inscrição estadual para clientes PJ
  
  ## Notas
  - Todos os campos são opcionais (nullable)
  - Permite busca automática de endereço via CEP
  - Facilita emissão de documentos fiscais
*/

-- Adicionar campos de endereço detalhado
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clientes' AND column_name = 'cep'
  ) THEN
    ALTER TABLE clientes ADD COLUMN cep text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clientes' AND column_name = 'cidade'
  ) THEN
    ALTER TABLE clientes ADD COLUMN cidade text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clientes' AND column_name = 'estado'
  ) THEN
    ALTER TABLE clientes ADD COLUMN estado text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clientes' AND column_name = 'bairro'
  ) THEN
    ALTER TABLE clientes ADD COLUMN bairro text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clientes' AND column_name = 'inscricao_estadual'
  ) THEN
    ALTER TABLE clientes ADD COLUMN inscricao_estadual text;
  END IF;
END $$;
