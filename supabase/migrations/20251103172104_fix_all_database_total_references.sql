/*
  # Correção de Todas as Referências a 'total' no Banco

  1. Corrigir função get_dashboard_stats
  2. Verificar e corrigir outras funções
  3. Garantir consistência total em todo banco
*/

-- 1. CORRIGIR FUNÇÃO GET_DASHBOARD_STATS
CREATE OR REPLACE FUNCTION get_dashboard_stats()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result json;
BEGIN
  SELECT json_build_object(
    'total_produtos', (SELECT COUNT(*) FROM produtos WHERE ativo = true),
    'total_kg_aluminio', COALESCE((SELECT SUM(peso * estoque) FROM produtos WHERE ativo = true), 0),
    'valor_total_estoque', COALESCE((SELECT SUM(preco * estoque) FROM produtos WHERE ativo = true), 0),
    'receitas_mes', COALESCE((
      SELECT SUM(valor) 
      FROM transacoes_financeiras 
      WHERE tipo = 'receita' 
      AND EXTRACT(MONTH FROM data) = EXTRACT(MONTH FROM CURRENT_DATE)
      AND EXTRACT(YEAR FROM data) = EXTRACT(YEAR FROM CURRENT_DATE)
    ), 0),
    'despesas_mes', COALESCE((
      SELECT SUM(valor) 
      FROM transacoes_financeiras 
      WHERE tipo = 'despesa' 
      AND EXTRACT(MONTH FROM data) = EXTRACT(MONTH FROM CURRENT_DATE)
      AND EXTRACT(YEAR FROM data) = EXTRACT(YEAR FROM CURRENT_DATE)
    ), 0),
    'vendas_mes', COALESCE((
      SELECT SUM(valor_total) 
      FROM vendas 
      WHERE EXTRACT(MONTH FROM data) = EXTRACT(MONTH FROM CURRENT_DATE)
      AND EXTRACT(YEAR FROM data) = EXTRACT(YEAR FROM CURRENT_DATE)
    ), 0),
    'pedidos_pendentes', COALESCE((
      SELECT COUNT(*) 
      FROM pedidos 
      WHERE status IN ('aguardando_producao', 'em_producao')
    ), 0),
    'orcamentos_pendentes', COALESCE((
      SELECT COUNT(*) 
      FROM orcamentos 
      WHERE status = 'pendente'
    ), 0)
  ) INTO result;
  
  RETURN result;
END;
$$;

-- 2. CRIAR FUNÇÃO PARA OBTER DETALHES DE VENDA (CASO PRECISE)
CREATE OR REPLACE FUNCTION get_venda_detalhes(venda_id_param UUID)
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'id', v.id,
    'numero', v.numero,
    'data', v.data,
    'status', v.status,
    'valor_total', v.valor_total,
    'observacoes', v.observacoes,
    'cliente', json_build_object(
      'id', c.id,
      'nome', c.nome,
      'cpf_cnpj', c.cpf_cnpj,
      'telefone', c.telefone,
      'email', c.email
    ),
    'itens', (
      SELECT json_agg(
        json_build_object(
          'produto_id', vi.produto_id,
          'produto_nome', p.nome,
          'quantidade', vi.quantidade,
          'preco_unitario', vi.preco_unitario,
          'subtotal', vi.subtotal
        )
      )
      FROM venda_itens vi
      JOIN produtos p ON p.id = vi.produto_id
      WHERE vi.venda_id = v.id
    )
  ) INTO result
  FROM vendas v
  JOIN clientes c ON c.id = v.cliente_id
  WHERE v.id = venda_id_param;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- 3. CRIAR FUNÇÃO PARA OBTER DETALHES DE PEDIDO
CREATE OR REPLACE FUNCTION get_pedido_detalhes(pedido_id_param UUID)
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'id', p.id,
    'numero', p.numero,
    'data', p.data,
    'status', p.status,
    'valor_total', p.valor_total,
    'observacoes', p.observacoes,
    'cliente', json_build_object(
      'id', c.id,
      'nome', c.nome,
      'cpf_cnpj', c.cpf_cnpj,
      'telefone', c.telefone,
      'email', c.email
    ),
    'itens', (
      SELECT json_agg(
        json_build_object(
          'produto_id', pi.produto_id,
          'kit_id', pi.kit_id,
          'produto_nome', COALESCE(prod.nome, k.nome),
          'quantidade', pi.quantidade,
          'preco_unitario', pi.preco_unitario,
          'subtotal', pi.subtotal
        )
      )
      FROM pedido_itens pi
      LEFT JOIN produtos prod ON prod.id = pi.produto_id
      LEFT JOIN kits k ON k.id = pi.kit_id
      WHERE pi.pedido_id = p.id
    )
  ) INTO result
  FROM pedidos p
  JOIN clientes c ON c.id = p.cliente_id
  WHERE p.id = pedido_id_param;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- 4. CRIAR FUNÇÃO PARA OBTER DETALHES DE ORÇAMENTO
CREATE OR REPLACE FUNCTION get_orcamento_detalhes(orcamento_id_param UUID)
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'id', o.id,
    'numero', o.numero,
    'data', o.data,
    'status', o.status,
    'valor_total', o.valor_total,
    'observacoes', o.observacoes,
    'cliente', json_build_object(
      'id', c.id,
      'nome', c.nome,
      'cpf_cnpj', c.cpf_cnpj,
      'telefone', c.telefone,
      'email', c.email
    ),
    'itens', (
      SELECT json_agg(
        json_build_object(
          'produto_id', oi.produto_id,
          'kit_id', oi.kit_id,
          'produto_nome', COALESCE(p.nome, k.nome),
          'quantidade', oi.quantidade,
          'preco_unitario', oi.preco_unitario,
          'desconto', oi.desconto,
          'subtotal', oi.subtotal
        )
      )
      FROM orcamento_itens oi
      LEFT JOIN produtos p ON p.id = oi.produto_id
      LEFT JOIN kits k ON k.id = oi.kit_id
      WHERE oi.orcamento_id = o.id
    )
  ) INTO result
  FROM orcamentos o
  JOIN clientes c ON c.id = o.cliente_id
  WHERE o.id = orcamento_id_param;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- 5. CRIAR VIEW PARA RELATÓRIOS DE VENDAS
CREATE OR REPLACE VIEW relatorio_vendas_mes AS
SELECT 
  TO_CHAR(v.data, 'YYYY-MM') as mes,
  COUNT(*) as total_vendas,
  SUM(v.valor_total) as valor_total,
  AVG(v.valor_total) as ticket_medio,
  COUNT(DISTINCT v.cliente_id) as total_clientes
FROM vendas v
WHERE v.data >= CURRENT_DATE - INTERVAL '12 months'
GROUP BY TO_CHAR(v.data, 'YYYY-MM')
ORDER BY mes DESC;

-- 6. CRIAR VIEW PARA PRODUTOS COM BAIXO ESTOQUE
CREATE OR REPLACE VIEW produtos_estoque_baixo AS
SELECT 
  p.id,
  p.codigo,
  p.nome,
  p.categoria,
  p.estoque,
  p.estoque_minimo,
  p.preco,
  (p.estoque_minimo - p.estoque) as deficit
FROM produtos p
WHERE p.ativo = true
  AND p.estoque < p.estoque_minimo
ORDER BY (p.estoque_minimo - p.estoque) DESC;

-- 7. CRIAR VIEW PARA KITS COM BAIXO ESTOQUE
CREATE OR REPLACE VIEW kits_estoque_baixo AS
SELECT 
  k.id,
  k.codigo,
  k.nome,
  calcular_kits_disponiveis(k.id) as estoque_disponivel,
  k.preco_total
FROM kits k
WHERE k.ativo = true
  AND calcular_kits_disponiveis(k.id) < 5
ORDER BY calcular_kits_disponiveis(k.id) ASC;
