/*
  # Correção de Kits, Colunas e Estrutura

  1. Corrigir tabela pedidos
    - Renomear coluna `total` para `valor_total`

  2. Criar kits separados para 8mm e 10mm
    - Kit Perfis 8mm
    - Kit Perfis 10mm
    - Kit Caixa 8mm
    - Kit Caixa 10mm

  3. Criar produtos de fechadura 8mm e 10mm
*/

-- 1. CORRIGIR TABELA PEDIDOS
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pedidos' AND column_name = 'total'
  ) THEN
    ALTER TABLE pedidos RENAME COLUMN total TO valor_total;
  END IF;
END $$;

-- Garantir que valor_total existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pedidos' AND column_name = 'valor_total'
  ) THEN
    ALTER TABLE pedidos ADD COLUMN valor_total NUMERIC DEFAULT 0;
  END IF;
END $$;

-- 2. CRIAR PRODUTOS ESPECÍFICOS DE 8MM E 10MM

-- Fechaduras 8mm e 10mm
INSERT INTO produtos (codigo, nome, descricao, categoria, preco, custo, estoque, estoque_minimo, unidade, ativo)
VALUES 
  ('FECHADURA-8', 'Fechadura 8mm', 'Fechadura para caixa perfil 8mm', 'Acessório Caixa', 25.00, 12.00, 50, 10, 'UN', true),
  ('FECHADURA-10', 'Fechadura 10mm', 'Fechadura para caixa perfil 10mm', 'Acessório Caixa', 28.00, 14.00, 50, 10, 'UN', true)
ON CONFLICT (codigo) DO UPDATE SET
  nome = EXCLUDED.nome,
  descricao = EXCLUDED.descricao,
  categoria = EXCLUDED.categoria,
  preco = EXCLUDED.preco,
  custo = EXCLUDED.custo;

-- 3. REMOVER KITS ANTIGOS
DELETE FROM kit_itens WHERE kit_id IN (SELECT id FROM kits WHERE codigo IN ('KIT-PERFIS', 'KIT-CAIXA'));
DELETE FROM kits WHERE codigo IN ('KIT-PERFIS', 'KIT-CAIXA');

-- 4. CRIAR KITS SEPARADOS PARA 8MM

-- Kit de Perfis 8mm
DO $$
DECLARE
  kit_id UUID;
  produto_id UUID;
BEGIN
  INSERT INTO kits (codigo, nome, descricao, preco_total, ativo)
  VALUES (
    'KIT-PERFIS-8MM',
    'Kit Completo de Perfis 8mm',
    'Kit com todos os perfis necessários para montagem - Leito 8mm',
    500.00,
    true
  )
  RETURNING id INTO kit_id;

  -- 2 barras U
  SELECT id INTO produto_id FROM produtos WHERE codigo = 'PERFIL-U' LIMIT 1;
  INSERT INTO kit_itens (kit_id, produto_id, quantidade) VALUES (kit_id, produto_id, 2);

  -- 2 barras capa U
  SELECT id INTO produto_id FROM produtos WHERE codigo = 'CAPA-U' LIMIT 1;
  INSERT INTO kit_itens (kit_id, produto_id, quantidade) VALUES (kit_id, produto_id, 2);

  -- 2 barras trilho
  SELECT id INTO produto_id FROM produtos WHERE codigo = 'TRILHO' LIMIT 1;
  INSERT INTO kit_itens (kit_id, produto_id, quantidade) VALUES (kit_id, produto_id, 2);

  -- 2 barras de leito 8mm
  SELECT id INTO produto_id FROM produtos WHERE codigo = 'LEITO-8' LIMIT 1;
  INSERT INTO kit_itens (kit_id, produto_id, quantidade) VALUES (kit_id, produto_id, 2);

  -- 1 barra cantoneira
  SELECT id INTO produto_id FROM produtos WHERE codigo = 'CANTONEIRA' LIMIT 1;
  INSERT INTO kit_itens (kit_id, produto_id, quantidade) VALUES (kit_id, produto_id, 1);
END $$;

-- Kit de Perfis 10mm
DO $$
DECLARE
  kit_id UUID;
  produto_id UUID;
BEGIN
  INSERT INTO kits (codigo, nome, descricao, preco_total, ativo)
  VALUES (
    'KIT-PERFIS-10MM',
    'Kit Completo de Perfis 10mm',
    'Kit com todos os perfis necessários para montagem - Leito 10mm',
    520.00,
    true
  )
  RETURNING id INTO kit_id;

  -- 2 barras U
  SELECT id INTO produto_id FROM produtos WHERE codigo = 'PERFIL-U' LIMIT 1;
  INSERT INTO kit_itens (kit_id, produto_id, quantidade) VALUES (kit_id, produto_id, 2);

  -- 2 barras capa U
  SELECT id INTO produto_id FROM produtos WHERE codigo = 'CAPA-U' LIMIT 1;
  INSERT INTO kit_itens (kit_id, produto_id, quantidade) VALUES (kit_id, produto_id, 2);

  -- 2 barras trilho
  SELECT id INTO produto_id FROM produtos WHERE codigo = 'TRILHO' LIMIT 1;
  INSERT INTO kit_itens (kit_id, produto_id, quantidade) VALUES (kit_id, produto_id, 2);

  -- 2 barras de leito 10mm
  SELECT id INTO produto_id FROM produtos WHERE codigo = 'LEITO-10' LIMIT 1;
  INSERT INTO kit_itens (kit_id, produto_id, quantidade) VALUES (kit_id, produto_id, 2);

  -- 1 barra cantoneira
  SELECT id INTO produto_id FROM produtos WHERE codigo = 'CANTONEIRA' LIMIT 1;
  INSERT INTO kit_itens (kit_id, produto_id, quantidade) VALUES (kit_id, produto_id, 1);
END $$;

-- Kit Caixa de Acessórios 8mm
DO $$
DECLARE
  kit_id UUID;
  produto_id UUID;
BEGIN
  INSERT INTO kits (codigo, nome, descricao, preco_total, ativo)
  VALUES (
    'KIT-CAIXA-8MM',
    'Kit Caixa de Acessórios 8mm',
    'Kit completo para fechamento de caixa de acessórios - Fechadura 8mm',
    800.00,
    true
  )
  RETURNING id INTO kit_id;

  -- 1 fechadura 8mm
  SELECT id INTO produto_id FROM produtos WHERE codigo = 'FECHADURA-8' LIMIT 1;
  INSERT INTO kit_itens (kit_id, produto_id, quantidade) VALUES (kit_id, produto_id, 1);

  -- 1 aparador
  SELECT id INTO produto_id FROM produtos WHERE codigo = 'APARADOR' LIMIT 1;
  INSERT INTO kit_itens (kit_id, produto_id, quantidade) VALUES (kit_id, produto_id, 1);

  -- 24 MT guarnição
  SELECT id INTO produto_id FROM produtos WHERE codigo = 'GUARNICAO' LIMIT 1;
  INSERT INTO kit_itens (kit_id, produto_id, quantidade) VALUES (kit_id, produto_id, 24);

  -- 24 MT escova
  SELECT id INTO produto_id FROM produtos WHERE codigo = 'ESCOVA' LIMIT 1;
  INSERT INTO kit_itens (kit_id, produto_id, quantidade) VALUES (kit_id, produto_id, 24);

  -- 12 MT polímero
  SELECT id INTO produto_id FROM produtos WHERE codigo = 'POLIMERO' LIMIT 1;
  INSERT INTO kit_itens (kit_id, produto_id, quantidade) VALUES (kit_id, produto_id, 12);

  -- 12 kits deslizantes
  SELECT id INTO produto_id FROM produtos WHERE codigo = 'DESLIZANTE' LIMIT 1;
  INSERT INTO kit_itens (kit_id, produto_id, quantidade) VALUES (kit_id, produto_id, 12);

  -- 1 silicone spray
  SELECT id INTO produto_id FROM produtos WHERE codigo = 'SILICONE-SPRAY' LIMIT 1;
  INSERT INTO kit_itens (kit_id, produto_id, quantidade) VALUES (kit_id, produto_id, 1);

  -- 1 silicone aquário
  SELECT id INTO produto_id FROM produtos WHERE codigo = 'SILICONE-AQUARIO' LIMIT 1;
  INSERT INTO kit_itens (kit_id, produto_id, quantidade) VALUES (kit_id, produto_id, 1);

  -- 1 kit porta
  SELECT id INTO produto_id FROM produtos WHERE codigo = 'KIT-PORTA' LIMIT 1;
  INSERT INTO kit_itens (kit_id, produto_id, quantidade) VALUES (kit_id, produto_id, 1);
END $$;

-- Kit Caixa de Acessórios 10mm
DO $$
DECLARE
  kit_id UUID;
  produto_id UUID;
BEGIN
  INSERT INTO kits (codigo, nome, descricao, preco_total, ativo)
  VALUES (
    'KIT-CAIXA-10MM',
    'Kit Caixa de Acessórios 10mm',
    'Kit completo para fechamento de caixa de acessórios - Fechadura 10mm',
    820.00,
    true
  )
  RETURNING id INTO kit_id;

  -- 1 fechadura 10mm
  SELECT id INTO produto_id FROM produtos WHERE codigo = 'FECHADURA-10' LIMIT 1;
  INSERT INTO kit_itens (kit_id, produto_id, quantidade) VALUES (kit_id, produto_id, 1);

  -- 1 aparador
  SELECT id INTO produto_id FROM produtos WHERE codigo = 'APARADOR' LIMIT 1;
  INSERT INTO kit_itens (kit_id, produto_id, quantidade) VALUES (kit_id, produto_id, 1);

  -- 24 MT guarnição
  SELECT id INTO produto_id FROM produtos WHERE codigo = 'GUARNICAO' LIMIT 1;
  INSERT INTO kit_itens (kit_id, produto_id, quantidade) VALUES (kit_id, produto_id, 24);

  -- 24 MT escova
  SELECT id INTO produto_id FROM produtos WHERE codigo = 'ESCOVA' LIMIT 1;
  INSERT INTO kit_itens (kit_id, produto_id, quantidade) VALUES (kit_id, produto_id, 24);

  -- 12 MT polímero
  SELECT id INTO produto_id FROM produtos WHERE codigo = 'POLIMERO' LIMIT 1;
  INSERT INTO kit_itens (kit_id, produto_id, quantidade) VALUES (kit_id, produto_id, 12);

  -- 12 kits deslizantes
  SELECT id INTO produto_id FROM produtos WHERE codigo = 'DESLIZANTE' LIMIT 1;
  INSERT INTO kit_itens (kit_id, produto_id, quantidade) VALUES (kit_id, produto_id, 12);

  -- 1 silicone spray
  SELECT id INTO produto_id FROM produtos WHERE codigo = 'SILICONE-SPRAY' LIMIT 1;
  INSERT INTO kit_itens (kit_id, produto_id, quantidade) VALUES (kit_id, produto_id, 1);

  -- 1 silicone aquário
  SELECT id INTO produto_id FROM produtos WHERE codigo = 'SILICONE-AQUARIO' LIMIT 1;
  INSERT INTO kit_itens (kit_id, produto_id, quantidade) VALUES (kit_id, produto_id, 1);

  -- 1 kit porta
  SELECT id INTO produto_id FROM produtos WHERE codigo = 'KIT-PORTA' LIMIT 1;
  INSERT INTO kit_itens (kit_id, produto_id, quantidade) VALUES (kit_id, produto_id, 1);
END $$;
