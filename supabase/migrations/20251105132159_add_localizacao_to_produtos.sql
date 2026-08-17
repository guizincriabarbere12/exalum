/*
  # Adicionar Campo de Localização aos Produtos
  
  ## Descrição
  Adiciona campo 'localizacao' na tabela produtos para identificar em qual box/local
  o produto está armazenado no estoque.
  
  ## Mudanças
  
  ### 1. Tabela produtos
  - Adiciona coluna 'localizacao' (text, opcional)
  - Campo permite identificar box, prateleira ou local de armazenamento
  
  ## Notas
  - Campo é opcional para não quebrar registros existentes
  - Útil para organização e localização rápida no estoque físico
*/

-- Adicionar coluna localizacao se não existir
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'produtos' AND column_name = 'localizacao'
  ) THEN
    ALTER TABLE produtos ADD COLUMN localizacao text;
  END IF;
END $$;
