/*
  # Corrigir Recursão Infinita nas Políticas RLS
  
  ## Descrição
  Remove a política recursiva que estava causando erro "infinite recursion detected"
  ao tentar criar orçamentos e produtos.
  
  ## Problema
  A política "Admins podem gerenciar roles" consultava a própria tabela user_roles
  para verificar se o usuário era admin, causando recursão infinita.
  
  ## Solução
  Remove a política problemática de ALL e mantém apenas:
  - SELECT: Usuários podem ver próprias roles
  - INSERT: Permitido durante signup
  - UPDATE/DELETE: Não permitido (roles são fixas após criação)
  
  ## Segurança
  - Usuários podem ver apenas suas próprias roles
  - Apenas o sistema pode criar roles (via trigger)
  - Roles não podem ser alteradas manualmente pelos usuários
*/

-- Remover política recursiva problemática
DROP POLICY IF EXISTS "Admins podem gerenciar roles" ON user_roles;

-- As outras políticas já existem e estão corretas:
-- 1. "Usuários podem ver próprias roles" (SELECT)
-- 2. "Allow insert during signup" (INSERT)

-- Nota: Admins podem gerenciar roles através de funções específicas
-- que usam SECURITY DEFINER, não através de políticas RLS diretas
