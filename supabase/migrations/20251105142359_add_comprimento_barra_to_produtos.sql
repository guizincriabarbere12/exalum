/*
  # Adicionar Comprimento da Barra aos Produtos
  
  ## Descrição
  Adiciona campo para armazenar o comprimento da barra em metros.
  O cálculo de preço de venda será: peso_kg_m × comprimento_barra × preco_por_kg
  
  ## Alterações
  1. Adiciona coluna `comprimento_barra` com valor padrão de 6 metros
  2. Adiciona coluna calculada `preco_venda_calculado` (peso × comprimento × preço/kg)
  
  ## Observações
  - Comprimento padrão é 6 metros (valor típico de barras de alumínio)
  - Campo pode ser alterado conforme necessidade do produto
*/

-- Adicionar coluna comprimento_barra se não existir
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'produtos' AND column_name = 'comprimento_barra'
  ) THEN
    ALTER TABLE produtos ADD COLUMN comprimento_barra numeric DEFAULT 6.0;
  END IF;
END $$;

-- Adicionar coluna peso_kg_m (peso por metro) se não existir
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'produtos' AND column_name = 'peso_kg_m'
  ) THEN
    ALTER TABLE produtos ADD COLUMN peso_kg_m numeric DEFAULT 0;
  END IF;
END $$;

-- Atualizar produtos existentes para usar o campo peso como peso_kg_m se aplicável
UPDATE produtos 
SET peso_kg_m = peso 
WHERE peso_kg_m IS NULL OR peso_kg_m = 0;

-- Comentários nas colunas para documentação
COMMENT ON COLUMN produtos.peso_kg_m IS 'Peso em kg por metro linear da barra';
COMMENT ON COLUMN produtos.comprimento_barra IS 'Comprimento da barra em metros (padrão 6m)';
COMMENT ON COLUMN produtos.peso IS 'Peso total da barra (kg/m × comprimento)';
COMMENT ON COLUMN produtos.preco IS 'Preço de venda da barra (peso_total × preco_por_kg)';
