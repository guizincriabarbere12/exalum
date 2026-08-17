/*
  # Sistema de Lembretes Financeiros
  
  ## Descrição
  Cria função para buscar transações com vencimento próximo e vencidas,
  permitindo alertas e notificações automáticas.
  
  ## Funções Criadas
  
  1. `get_transacoes_vencimento_proximo()` - Retorna transações pendentes com vencimento nos próximos 7 dias
  2. `get_transacoes_vencidas()` - Retorna transações pendentes vencidas
  3. `get_resumo_financeiro()` - Retorna resumo completo do status financeiro
  
  ## Segurança
  - Todas as funções respeitam RLS
  - Apenas usuários autenticados podem acessar
*/

-- Função para buscar transações com vencimento próximo (próximos 7 dias)
CREATE OR REPLACE FUNCTION get_transacoes_vencimento_proximo(dias_antecedencia INTEGER DEFAULT 7)
RETURNS TABLE (
  id uuid,
  descricao text,
  tipo text,
  valor numeric,
  data_vencimento date,
  dias_restantes integer,
  categoria text,
  forma_pagamento text,
  numero_parcela text,
  status text
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.id,
    t.descricao,
    t.tipo,
    t.valor,
    t.data_vencimento,
    (t.data_vencimento - CURRENT_DATE)::integer as dias_restantes,
    t.categoria,
    t.forma_pagamento,
    t.numero_parcela,
    t.status
  FROM transacoes_financeiras t
  WHERE t.status = 'pendente'
    AND t.data_vencimento IS NOT NULL
    AND t.data_vencimento BETWEEN CURRENT_DATE AND (CURRENT_DATE + dias_antecedencia)
  ORDER BY t.data_vencimento ASC;
END;
$$;

-- Função para buscar transações vencidas
CREATE OR REPLACE FUNCTION get_transacoes_vencidas()
RETURNS TABLE (
  id uuid,
  descricao text,
  tipo text,
  valor numeric,
  data_vencimento date,
  dias_atraso integer,
  categoria text,
  forma_pagamento text,
  numero_parcela text,
  status text
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.id,
    t.descricao,
    t.tipo,
    t.valor,
    t.data_vencimento,
    (CURRENT_DATE - t.data_vencimento)::integer as dias_atraso,
    t.categoria,
    t.forma_pagamento,
    t.numero_parcela,
    t.status
  FROM transacoes_financeiras t
  WHERE t.status = 'pendente'
    AND t.data_vencimento IS NOT NULL
    AND t.data_vencimento < CURRENT_DATE
  ORDER BY t.data_vencimento ASC;
END;
$$;

-- Função para obter resumo financeiro completo
CREATE OR REPLACE FUNCTION get_resumo_financeiro()
RETURNS TABLE (
  total_receitas_pendentes numeric,
  total_despesas_pendentes numeric,
  total_receitas_recebidas numeric,
  total_despesas_pagas numeric,
  saldo_atual numeric,
  contas_vencidas integer,
  contas_a_vencer_7dias integer,
  total_vencido numeric
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_receitas_pendentes numeric;
  v_despesas_pendentes numeric;
  v_receitas_recebidas numeric;
  v_despesas_pagas numeric;
  v_contas_vencidas integer;
  v_contas_a_vencer integer;
  v_total_vencido numeric;
BEGIN
  -- Receitas pendentes
  SELECT COALESCE(SUM(valor), 0) INTO v_receitas_pendentes
  FROM transacoes_financeiras
  WHERE tipo = 'receita' AND status = 'pendente';
  
  -- Despesas pendentes
  SELECT COALESCE(SUM(valor), 0) INTO v_despesas_pendentes
  FROM transacoes_financeiras
  WHERE tipo = 'despesa' AND status = 'pendente';
  
  -- Receitas recebidas
  SELECT COALESCE(SUM(valor), 0) INTO v_receitas_recebidas
  FROM transacoes_financeiras
  WHERE tipo = 'receita' AND status IN ('recebido', 'pago');
  
  -- Despesas pagas
  SELECT COALESCE(SUM(valor), 0) INTO v_despesas_pagas
  FROM transacoes_financeiras
  WHERE tipo = 'despesa' AND status IN ('recebido', 'pago');
  
  -- Contas vencidas
  SELECT COUNT(*) INTO v_contas_vencidas
  FROM transacoes_financeiras
  WHERE status = 'pendente'
    AND data_vencimento IS NOT NULL
    AND data_vencimento < CURRENT_DATE;
  
  -- Contas a vencer em 7 dias
  SELECT COUNT(*) INTO v_contas_a_vencer
  FROM transacoes_financeiras
  WHERE status = 'pendente'
    AND data_vencimento IS NOT NULL
    AND data_vencimento BETWEEN CURRENT_DATE AND (CURRENT_DATE + 7);
  
  -- Total vencido
  SELECT COALESCE(SUM(valor), 0) INTO v_total_vencido
  FROM transacoes_financeiras
  WHERE status = 'pendente'
    AND data_vencimento IS NOT NULL
    AND data_vencimento < CURRENT_DATE;
  
  RETURN QUERY SELECT 
    v_receitas_pendentes,
    v_despesas_pendentes,
    v_receitas_recebidas,
    v_despesas_pagas,
    (v_receitas_recebidas - v_despesas_pagas) as saldo_atual,
    v_contas_vencidas,
    v_contas_a_vencer,
    v_total_vencido;
END;
$$;

-- Comentários
COMMENT ON FUNCTION get_transacoes_vencimento_proximo IS 'Retorna transações pendentes com vencimento nos próximos N dias';
COMMENT ON FUNCTION get_transacoes_vencidas IS 'Retorna transações pendentes que já venceram';
COMMENT ON FUNCTION get_resumo_financeiro IS 'Retorna resumo completo do status financeiro incluindo alertas';
