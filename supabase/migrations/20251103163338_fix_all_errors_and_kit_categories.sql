/*
  # Correção de Todos os Erros e Implementação de Categorias de Kits

  1. Correção da tabela vendas
    - Renomear coluna `total` para `valor_total`

  2. Criação da função processar_orcamento_aprovado
    - Função para processar orçamentos quando aprovados

  3. Criar categorias para Kits
    - Garantir que existem as categorias "Acessório Kit" e "Acessório Caixa"
    - Seed com produtos exemplo
    
  4. Remover todas as referências a perfis
*/

-- 1. Corrigir tabela vendas - renomear total para valor_total
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vendas' AND column_name = 'total'
  ) THEN
    ALTER TABLE vendas RENAME COLUMN total TO valor_total;
  END IF;
END $$;

-- Garantir que valor_total existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vendas' AND column_name = 'valor_total'
  ) THEN
    ALTER TABLE vendas ADD COLUMN valor_total NUMERIC DEFAULT 0;
  END IF;
END $$;

-- 2. Criar função processar_orcamento_aprovado
CREATE OR REPLACE FUNCTION public.processar_orcamento_aprovado(orcamento_id_param UUID)
RETURNS void AS $$
DECLARE
  orcamento_row RECORD;
  item_row RECORD;
BEGIN
  -- Buscar dados do orçamento
  SELECT * INTO orcamento_row
  FROM orcamentos
  WHERE id = orcamento_id_param;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Orçamento não encontrado';
  END IF;

  -- Criar pedido baseado no orçamento
  INSERT INTO pedidos (
    numero,
    cliente_id,
    status,
    valor_total,
    observacoes,
    created_by
  ) VALUES (
    'PED-' || orcamento_row.numero,
    orcamento_row.cliente_id,
    'aguardando_producao',
    orcamento_row.valor_total,
    orcamento_row.observacoes,
    orcamento_row.created_by
  );

  -- Atualizar status do orçamento
  UPDATE orcamentos
  SET status = 'aprovado'
  WHERE id = orcamento_id_param;

END;
$$ LANGUAGE plpgsql;

-- 3. Inserir categorias padrão se não existirem
-- Primeiro, vamos garantir que temos alguns produtos de exemplo

-- Inserir produtos de Acessório Kit (se não existirem)
INSERT INTO produtos (codigo, nome, descricao, categoria, preco, custo, estoque, estoque_minimo, unidade, ativo)
SELECT 'AK-001', 'Parafuso M6 Kit', 'Parafuso M6 para montagem de kits', 'Acessório Kit', 2.50, 1.00, 100, 20, 'UN', true
WHERE NOT EXISTS (SELECT 1 FROM produtos WHERE codigo = 'AK-001');

INSERT INTO produtos (codigo, nome, descricao, categoria, preco, custo, estoque, estoque_minimo, unidade, ativo)
SELECT 'AK-002', 'Porca M6 Kit', 'Porca M6 para montagem de kits', 'Acessório Kit', 1.50, 0.50, 150, 30, 'UN', true
WHERE NOT EXISTS (SELECT 1 FROM produtos WHERE codigo = 'AK-002');

INSERT INTO produtos (codigo, nome, descricao, categoria, preco, custo, estoque, estoque_minimo, unidade, ativo)
SELECT 'AK-003', 'Arruela Kit', 'Arruela para fixação de componentes', 'Acessório Kit', 0.80, 0.30, 200, 50, 'UN', true
WHERE NOT EXISTS (SELECT 1 FROM produtos WHERE codigo = 'AK-003');

-- Inserir produtos de Acessório Caixa (se não existirem)
INSERT INTO produtos (codigo, nome, descricao, categoria, preco, custo, estoque, estoque_minimo, unidade, ativo)
SELECT 'AC-001', 'Dobradiça Caixa', 'Dobradiça para fechamento de caixa', 'Acessório Caixa', 15.00, 8.00, 50, 10, 'UN', true
WHERE NOT EXISTS (SELECT 1 FROM produtos WHERE codigo = 'AC-001');

INSERT INTO produtos (codigo, nome, descricao, categoria, preco, custo, estoque, estoque_minimo, unidade, ativo)
SELECT 'AC-002', 'Fechadura Caixa', 'Fechadura com chave para caixa', 'Acessório Caixa', 25.00, 12.00, 30, 5, 'UN', true
WHERE NOT EXISTS (SELECT 1 FROM produtos WHERE codigo = 'AC-002');

INSERT INTO produtos (codigo, nome, descricao, categoria, preco, custo, estoque, estoque_minimo, unidade, ativo)
SELECT 'AC-003', 'Alça Transporte', 'Alça metálica para transporte de caixa', 'Acessório Caixa', 18.00, 9.00, 40, 8, 'UN', true
WHERE NOT EXISTS (SELECT 1 FROM produtos WHERE codigo = 'AC-003');

-- 4. Criar índice para acelerar busca por categoria
CREATE INDEX IF NOT EXISTS idx_produtos_categoria ON produtos(categoria) WHERE ativo = true;

-- 5. Criar view para facilitar consulta de acessórios
CREATE OR REPLACE VIEW acessorios_kit_view AS
SELECT 
  id,
  codigo,
  nome,
  descricao,
  categoria,
  preco,
  custo,
  estoque,
  estoque_minimo,
  unidade,
  peso,
  imagem_url
FROM produtos
WHERE categoria IN ('Acessório Kit', 'Acessório Caixa')
  AND ativo = true
ORDER BY categoria, nome;
