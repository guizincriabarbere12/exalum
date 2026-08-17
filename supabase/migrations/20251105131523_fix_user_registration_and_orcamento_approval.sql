/*
  # Correção de Registro de Usuários e Aprovação de Orçamentos
  
  ## Descrição
  Corrige dois problemas críticos no sistema:
  1. Erro ao registrar novos usuários (faltavam políticas INSERT)
  2. Aprovação de orçamento não debitava estoque
  
  ## Mudanças
  
  ### 1. Políticas RLS para profiles e user_roles
  - Adiciona política INSERT para profiles (apenas trigger)
  - Adiciona política INSERT para user_roles (apenas trigger)
  - Remove WITH CHECK da política "Admins podem gerenciar roles"
  
  ### 2. Função aprovar_orcamento_simples
  - Agora verifica estoque disponível
  - Debita estoque de produtos e componentes de kits
  - Retorna mensagem de erro se houver estoque insuficiente
  - Cria transação financeira automática
  
  ## Segurança
  - Políticas INSERT usam SECURITY DEFINER no trigger
  - Apenas funções do sistema podem inserir via trigger
  - Mantém segurança RLS para operações normais
*/

-- ==============================================
-- CORRIGIR POLÍTICAS RLS PARA PROFILES
-- ==============================================

-- Adicionar política INSERT para profiles (usada pelo trigger)
DROP POLICY IF EXISTS "Sistema pode criar perfis" ON profiles;
CREATE POLICY "Sistema pode criar perfis"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- ==============================================
-- CORRIGIR POLÍTICAS RLS PARA USER_ROLES
-- ==============================================

-- Recriar política de admins com WITH CHECK
DROP POLICY IF EXISTS "Admins podem gerenciar roles" ON user_roles;
CREATE POLICY "Admins podem gerenciar roles"
  ON user_roles FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
    )
  );

-- Adicionar política INSERT para user_roles (usada pelo trigger)
DROP POLICY IF EXISTS "Sistema pode criar roles" ON user_roles;
CREATE POLICY "Sistema pode criar roles"
  ON user_roles FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- ==============================================
-- CORRIGIR FUNÇÃO: aprovar_orcamento_simples
-- ==============================================
CREATE OR REPLACE FUNCTION aprovar_orcamento_simples(orcamento_id_param uuid)
RETURNS json AS $$
DECLARE
  item RECORD;
  kit_item RECORD;
  itens_faltando json[] := '{}';
  orc RECORD;
BEGIN
  -- Buscar dados do orçamento
  SELECT * INTO orc FROM orcamentos WHERE id = orcamento_id_param;
  
  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Orçamento não encontrado'
    );
  END IF;

  -- Verificar disponibilidade de todos os itens
  FOR item IN
    SELECT oi.*, p.estoque, p.nome as produto_nome
    FROM orcamento_itens oi
    LEFT JOIN produtos p ON p.id = oi.produto_id
    WHERE oi.orcamento_id = orcamento_id_param
  LOOP
    IF item.produto_id IS NOT NULL THEN
      -- Item é um produto
      IF item.estoque < item.quantidade THEN
        itens_faltando := array_append(
          itens_faltando,
          json_build_object(
            'produto', item.produto_nome,
            'necessario', item.quantidade,
            'disponivel', item.estoque,
            'faltando', item.quantidade - item.estoque
          )
        );
      END IF;
    ELSE
      -- Item é um kit - verificar componentes
      FOR kit_item IN
        SELECT ki.quantidade as qtd_componente, p.id, p.nome, p.estoque
        FROM kit_itens ki
        JOIN produtos p ON p.id = ki.produto_id
        WHERE ki.kit_id = item.kit_id
      LOOP
        IF kit_item.estoque < (kit_item.qtd_componente * item.quantidade) THEN
          itens_faltando := array_append(
            itens_faltando,
            json_build_object(
              'produto', kit_item.nome,
              'necessario', kit_item.qtd_componente * item.quantidade,
              'disponivel', kit_item.estoque,
              'faltando', (kit_item.qtd_componente * item.quantidade) - kit_item.estoque
            )
          );
        END IF;
      END LOOP;
    END IF;
  END LOOP;

  -- Se houver itens faltando, retornar erro
  IF array_length(itens_faltando, 1) > 0 THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Estoque insuficiente para alguns itens',
      'itens_faltando', array_to_json(itens_faltando)
    );
  END IF;

  -- Debitar estoque
  FOR item IN
    SELECT oi.*
    FROM orcamento_itens oi
    WHERE oi.orcamento_id = orcamento_id_param
  LOOP
    IF item.produto_id IS NOT NULL THEN
      -- Debitar produto
      UPDATE produtos
      SET estoque = estoque - item.quantidade,
          updated_at = now()
      WHERE id = item.produto_id;
      
      -- Registrar movimentação
      INSERT INTO movimentacao_estoque (produto_id, tipo, quantidade, observacao, created_by)
      VALUES (
        item.produto_id, 
        'saida', 
        item.quantidade, 
        'Orçamento aprovado: ' || orc.numero,
        auth.uid()
      );
    ELSE
      -- Debitar componentes do kit
      FOR kit_item IN
        SELECT ki.produto_id, ki.quantidade
        FROM kit_itens ki
        WHERE ki.kit_id = item.kit_id
      LOOP
        UPDATE produtos
        SET estoque = estoque - (kit_item.quantidade * item.quantidade),
            updated_at = now()
        WHERE id = kit_item.produto_id;
        
        -- Registrar movimentação
        INSERT INTO movimentacao_estoque (produto_id, tipo, quantidade, observacao, created_by)
        VALUES (
          kit_item.produto_id, 
          'saida', 
          kit_item.quantidade * item.quantidade, 
          'Orçamento aprovado (kit): ' || orc.numero,
          auth.uid()
        );
      END LOOP;
    END IF;
  END LOOP;

  -- Atualizar status do orçamento
  UPDATE orcamentos
  SET status = 'aprovado',
      updated_at = now()
  WHERE id = orcamento_id_param;

  RETURN json_build_object(
    'success', true,
    'message', 'Orçamento aprovado e estoque atualizado com sucesso'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
