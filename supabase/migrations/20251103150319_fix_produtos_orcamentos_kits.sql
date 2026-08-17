/*
  # Correções de Produtos, Orçamentos e Kits

  1. Alterações em Produtos
    - Adicionar coluna `preco_por_kg` (preço por kg/m)
    - Manter coluna `peso` (peso em kg/m por unidade)
    - Coluna `preco` será calculada automaticamente: peso * preco_por_kg * 6

  2. Alterações em Orçamentos
    - Renomear coluna `total` para `valor_total` para consistência
    - Manter coluna `desconto` para desconto global

  3. Alterações em Orcamento_Itens
    - Garantir que coluna `desconto` existe (desconto por item em %)

  4. Alterações em Kits
    - Garantir que kit_itens tem quantidade de componentes
    - Adicionar trigger para calcular estoque disponível de kits
*/

-- 1. Adicionar preco_por_kg aos produtos
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'produtos' AND column_name = 'preco_por_kg'
  ) THEN
    ALTER TABLE produtos ADD COLUMN preco_por_kg NUMERIC DEFAULT 0;
  END IF;
END $$;

-- 2. Renomear total para valor_total em orcamentos
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orcamentos' AND column_name = 'total'
  ) THEN
    ALTER TABLE orcamentos RENAME COLUMN total TO valor_total;
  END IF;
END $$;

-- Garantir que valor_total existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orcamentos' AND column_name = 'valor_total'
  ) THEN
    ALTER TABLE orcamentos ADD COLUMN valor_total NUMERIC DEFAULT 0;
  END IF;
END $$;

-- 3. Garantir que desconto existe em orcamento_itens
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orcamento_itens' AND column_name = 'desconto'
  ) THEN
    ALTER TABLE orcamento_itens ADD COLUMN desconto NUMERIC DEFAULT 0;
  END IF;
END $$;

-- 4. Criar função para calcular preço de venda do produto
CREATE OR REPLACE FUNCTION calcular_preco_venda()
RETURNS TRIGGER AS $$
BEGIN
  -- Se preco_por_kg e peso estão definidos, calcular preco automaticamente
  IF NEW.preco_por_kg > 0 AND NEW.peso > 0 THEN
    NEW.preco := NEW.peso * NEW.preco_por_kg * 6;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar trigger para calcular preço automaticamente
DROP TRIGGER IF EXISTS trigger_calcular_preco_venda ON produtos;
CREATE TRIGGER trigger_calcular_preco_venda
  BEFORE INSERT OR UPDATE ON produtos
  FOR EACH ROW
  EXECUTE FUNCTION calcular_preco_venda();

-- 5. Criar view para estoque disponível de kits
CREATE OR REPLACE VIEW kits_estoque_disponivel AS
SELECT 
  k.id as kit_id,
  k.codigo,
  k.nome,
  k.ativo,
  COALESCE(
    MIN(FLOOR(p.estoque / ki.quantidade)),
    0
  ) as estoque_disponivel
FROM kits k
LEFT JOIN kit_itens ki ON k.id = ki.kit_id
LEFT JOIN produtos p ON ki.produto_id = p.id
WHERE k.ativo = true
GROUP BY k.id, k.codigo, k.nome, k.ativo;

-- 6. Atualizar produtos existentes com preco_por_kg baseado no preço atual
UPDATE produtos 
SET preco_por_kg = CASE 
  WHEN peso > 0 THEN preco / (peso * 6)
  ELSE 0 
END
WHERE preco_por_kg = 0 AND preco > 0;
