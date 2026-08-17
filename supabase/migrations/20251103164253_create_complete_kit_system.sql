/*
  # Sistema Completo de Kits com Componentes

  1. Criar produtos base (perfis e acessórios)
    - Perfis U
    - Capas U
    - Trilhos
    - Leitos
    - Cantoneiras
    - Fechaduras
    - Aparadores
    - Guarnições
    - Escovas
    - Polímeros
    - Deslizantes
    - Silicones
    - Kit porta

  2. Criar kits pré-configurados
    - Kit de Perfis
    - Kit Caixa de Acessórios

  3. Sistema de débito automático de estoque
    - Trigger para debitar componentes ao criar pedido de kit
    - Função para calcular quantidade disponível de kits

  4. Corrigir referências à coluna "total"
*/

-- 1. CRIAR PRODUTOS BASE

-- Perfis
INSERT INTO produtos (codigo, nome, descricao, categoria, preco, custo, estoque, estoque_minimo, unidade, ativo)
VALUES 
  ('PERFIL-U', 'Barra U', 'Barra perfil U para estrutura', 'Perfil', 50.00, 25.00, 100, 20, 'UN', true),
  ('CAPA-U', 'Barra Capa U', 'Barra capa U para acabamento', 'Perfil', 45.00, 22.00, 100, 20, 'UN', true),
  ('TRILHO', 'Barra Trilho', 'Barra trilho deslizante', 'Perfil', 55.00, 28.00, 100, 20, 'UN', true),
  ('LEITO-8', 'Barra Leito 8mm', 'Barra de leito 8mm', 'Perfil', 40.00, 20.00, 50, 10, 'UN', true),
  ('LEITO-10', 'Barra Leito 10mm', 'Barra de leito 10mm', 'Perfil', 45.00, 22.00, 50, 10, 'UN', true),
  ('CANTONEIRA', 'Barra Cantoneira', 'Barra cantoneira estrutural', 'Perfil', 35.00, 18.00, 80, 15, 'UN', true)
ON CONFLICT (codigo) DO UPDATE SET
  nome = EXCLUDED.nome,
  descricao = EXCLUDED.descricao,
  categoria = EXCLUDED.categoria,
  preco = EXCLUDED.preco,
  custo = EXCLUDED.custo,
  estoque_minimo = EXCLUDED.estoque_minimo;

-- Acessórios para Caixa
INSERT INTO produtos (codigo, nome, descricao, categoria, preco, custo, estoque, estoque_minimo, unidade, ativo)
VALUES 
  ('FECHADURA', 'Fechadura', 'Fechadura para caixa', 'Acessório Caixa', 25.00, 12.00, 50, 10, 'UN', true),
  ('APARADOR', 'Aparador', 'Aparador para caixa', 'Acessório Caixa', 15.00, 8.00, 60, 12, 'UN', true),
  ('GUARNICAO', 'Guarnição de Silicone', 'Guarnição de silicone por metro', 'Acessório Caixa', 8.00, 4.00, 200, 50, 'MT', true),
  ('ESCOVA', 'Escova Comum 6x8', 'Escova comum 6x8 por metro', 'Acessório Caixa', 6.00, 3.00, 200, 50, 'MT', true),
  ('POLIMERO', 'Polímero', 'Polímero por metro', 'Acessório Caixa', 10.00, 5.00, 150, 30, 'MT', true),
  ('DESLIZANTE', 'Kit Deslizante', 'Kit deslizante completo', 'Acessório Caixa', 12.00, 6.00, 100, 20, 'KIT', true),
  ('SILICONE-SPRAY', 'Silicone Spray', 'Silicone spray lubrificante', 'Acessório Caixa', 18.00, 9.00, 40, 10, 'UN', true),
  ('SILICONE-AQUARIO', 'Silicone Aquário', 'Silicone para vedação aquário', 'Acessório Caixa', 20.00, 10.00, 40, 10, 'UN', true),
  ('KIT-PORTA', 'Kit Porta Pivotante', 'Kit completo porta pivotante', 'Acessório Caixa', 150.00, 75.00, 30, 5, 'KIT', true)
ON CONFLICT (codigo) DO UPDATE SET
  nome = EXCLUDED.nome,
  descricao = EXCLUDED.descricao,
  categoria = EXCLUDED.categoria,
  preco = EXCLUDED.preco,
  custo = EXCLUDED.custo,
  estoque_minimo = EXCLUDED.estoque_minimo;

-- 2. CRIAR KITS PRÉ-CONFIGURADOS

-- Kit de Perfis
DO $$
DECLARE
  kit_perfis_id UUID;
  produto_id UUID;
BEGIN
  -- Criar ou atualizar kit
  INSERT INTO kits (codigo, nome, descricao, preco_total, ativo)
  VALUES (
    'KIT-PERFIS',
    'Kit Completo de Perfis',
    'Kit com todos os perfis necessários para montagem',
    500.00,
    true
  )
  ON CONFLICT (codigo) 
  DO UPDATE SET
    nome = EXCLUDED.nome,
    descricao = EXCLUDED.descricao,
    preco_total = EXCLUDED.preco_total
  RETURNING id INTO kit_perfis_id;

  -- Remover itens antigos se existirem
  DELETE FROM kit_itens WHERE kit_id = kit_perfis_id;

  -- Adicionar componentes do kit
  -- 2 barras U
  SELECT id INTO produto_id FROM produtos WHERE codigo = 'PERFIL-U' LIMIT 1;
  INSERT INTO kit_itens (kit_id, produto_id, quantidade) VALUES (kit_perfis_id, produto_id, 2);

  -- 2 barras capa U
  SELECT id INTO produto_id FROM produtos WHERE codigo = 'CAPA-U' LIMIT 1;
  INSERT INTO kit_itens (kit_id, produto_id, quantidade) VALUES (kit_perfis_id, produto_id, 2);

  -- 2 barras trilho
  SELECT id INTO produto_id FROM produtos WHERE codigo = 'TRILHO' LIMIT 1;
  INSERT INTO kit_itens (kit_id, produto_id, quantidade) VALUES (kit_perfis_id, produto_id, 2);

  -- 2 barras de leito (usando 8mm como padrão)
  SELECT id INTO produto_id FROM produtos WHERE codigo = 'LEITO-8' LIMIT 1;
  INSERT INTO kit_itens (kit_id, produto_id, quantidade) VALUES (kit_perfis_id, produto_id, 2);

  -- 1 barra cantoneira
  SELECT id INTO produto_id FROM produtos WHERE codigo = 'CANTONEIRA' LIMIT 1;
  INSERT INTO kit_itens (kit_id, produto_id, quantidade) VALUES (kit_perfis_id, produto_id, 1);
END $$;

-- Kit Caixa de Acessórios
DO $$
DECLARE
  kit_caixa_id UUID;
  produto_id UUID;
BEGIN
  -- Criar ou atualizar kit
  INSERT INTO kits (codigo, nome, descricao, preco_total, ativo)
  VALUES (
    'KIT-CAIXA',
    'Kit Caixa de Acessórios Completo',
    'Kit completo para fechamento de caixa de acessórios',
    800.00,
    true
  )
  ON CONFLICT (codigo) 
  DO UPDATE SET
    nome = EXCLUDED.nome,
    descricao = EXCLUDED.descricao,
    preco_total = EXCLUDED.preco_total
  RETURNING id INTO kit_caixa_id;

  -- Remover itens antigos se existirem
  DELETE FROM kit_itens WHERE kit_id = kit_caixa_id;

  -- Adicionar componentes do kit
  -- 1 fechadura
  SELECT id INTO produto_id FROM produtos WHERE codigo = 'FECHADURA' LIMIT 1;
  INSERT INTO kit_itens (kit_id, produto_id, quantidade) VALUES (kit_caixa_id, produto_id, 1);

  -- 1 aparador
  SELECT id INTO produto_id FROM produtos WHERE codigo = 'APARADOR' LIMIT 1;
  INSERT INTO kit_itens (kit_id, produto_id, quantidade) VALUES (kit_caixa_id, produto_id, 1);

  -- 24 MT guarnição
  SELECT id INTO produto_id FROM produtos WHERE codigo = 'GUARNICAO' LIMIT 1;
  INSERT INTO kit_itens (kit_id, produto_id, quantidade) VALUES (kit_caixa_id, produto_id, 24);

  -- 24 MT escova
  SELECT id INTO produto_id FROM produtos WHERE codigo = 'ESCOVA' LIMIT 1;
  INSERT INTO kit_itens (kit_id, produto_id, quantidade) VALUES (kit_caixa_id, produto_id, 24);

  -- 12 MT polímero
  SELECT id INTO produto_id FROM produtos WHERE codigo = 'POLIMERO' LIMIT 1;
  INSERT INTO kit_itens (kit_id, produto_id, quantidade) VALUES (kit_caixa_id, produto_id, 12);

  -- 12 kits deslizantes
  SELECT id INTO produto_id FROM produtos WHERE codigo = 'DESLIZANTE' LIMIT 1;
  INSERT INTO kit_itens (kit_id, produto_id, quantidade) VALUES (kit_caixa_id, produto_id, 12);

  -- 1 silicone spray
  SELECT id INTO produto_id FROM produtos WHERE codigo = 'SILICONE-SPRAY' LIMIT 1;
  INSERT INTO kit_itens (kit_id, produto_id, quantidade) VALUES (kit_caixa_id, produto_id, 1);

  -- 1 silicone aquário
  SELECT id INTO produto_id FROM produtos WHERE codigo = 'SILICONE-AQUARIO' LIMIT 1;
  INSERT INTO kit_itens (kit_id, produto_id, quantidade) VALUES (kit_caixa_id, produto_id, 1);

  -- 1 kit porta
  SELECT id INTO produto_id FROM produtos WHERE codigo = 'KIT-PORTA' LIMIT 1;
  INSERT INTO kit_itens (kit_id, produto_id, quantidade) VALUES (kit_caixa_id, produto_id, 1);
END $$;

-- 3. FUNÇÃO PARA CALCULAR KITS DISPONÍVEIS
CREATE OR REPLACE FUNCTION calcular_kits_disponiveis(kit_id_param UUID)
RETURNS INTEGER AS $$
DECLARE
  min_kits INTEGER;
BEGIN
  SELECT MIN(FLOOR(p.estoque / ki.quantidade))
  INTO min_kits
  FROM kit_itens ki
  JOIN produtos p ON p.id = ki.produto_id
  WHERE ki.kit_id = kit_id_param
    AND p.ativo = true;

  RETURN COALESCE(min_kits, 0);
END;
$$ LANGUAGE plpgsql;

-- 4. FUNÇÃO PARA DEBITAR ESTOQUE AO MONTAR KIT
CREATE OR REPLACE FUNCTION debitar_estoque_kit()
RETURNS TRIGGER AS $$
DECLARE
  item_kit RECORD;
BEGIN
  -- Verificar se é um item de kit (não produto avulso)
  IF NEW.kit_id IS NOT NULL THEN
    -- Debitar estoque de cada componente do kit
    FOR item_kit IN 
      SELECT ki.produto_id, ki.quantidade * NEW.quantidade as quantidade_total
      FROM kit_itens ki
      WHERE ki.kit_id = NEW.kit_id
    LOOP
      -- Atualizar estoque do produto
      UPDATE produtos
      SET estoque = estoque - item_kit.quantidade_total
      WHERE id = item_kit.produto_id;
      
      -- Verificar se há estoque suficiente (após débito)
      IF (SELECT estoque FROM produtos WHERE id = item_kit.produto_id) < 0 THEN
        RAISE EXCEPTION 'Estoque insuficiente para o produto %', item_kit.produto_id;
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. CRIAR TRIGGER PARA DEBITAR ESTOQUE
DROP TRIGGER IF EXISTS trigger_debitar_estoque_kit ON pedido_itens;
CREATE TRIGGER trigger_debitar_estoque_kit
  AFTER INSERT ON pedido_itens
  FOR EACH ROW
  EXECUTE FUNCTION debitar_estoque_kit();

-- 6. ATUALIZAR VIEW DE ESTOQUE DE KITS
DROP VIEW IF EXISTS kits_estoque_disponivel;
CREATE OR REPLACE VIEW kits_estoque_disponivel AS
SELECT 
  k.id as kit_id,
  k.codigo,
  k.nome,
  k.descricao,
  k.preco_total,
  k.ativo,
  calcular_kits_disponiveis(k.id) as estoque_disponivel,
  (
    SELECT json_agg(
      json_build_object(
        'produto_codigo', p.codigo,
        'produto_nome', p.nome,
        'quantidade_necessaria', ki.quantidade,
        'estoque_disponivel', p.estoque,
        'kits_possiveis', FLOOR(p.estoque / ki.quantidade)
      )
    )
    FROM kit_itens ki
    JOIN produtos p ON p.id = ki.produto_id
    WHERE ki.kit_id = k.id
  ) as componentes
FROM kits k
WHERE k.ativo = true;
