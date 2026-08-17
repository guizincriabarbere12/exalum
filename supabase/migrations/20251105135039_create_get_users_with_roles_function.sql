/*
  # Criar Função para Listar Usuários com Roles
  
  ## Descrição
  Cria uma função que retorna a lista de usuários com suas roles,
  incluindo email da tabela auth.users.
  
  ## Funcionalidade
  1. Busca usuários da tabela user_roles
  2. Faz JOIN com auth.users para pegar o email
  3. Retorna JSON com id, email, created_at e role
  
  ## Segurança
  - Função com SECURITY DEFINER para acessar auth.users
  - Apenas admins podem executar (via RLS na aplicação)
*/

CREATE OR REPLACE FUNCTION public.get_users_with_roles()
RETURNS TABLE (
  id uuid,
  email text,
  created_at timestamptz,
  role text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ur.user_id as id,
    au.email::text,
    ur.created_at,
    ur.role::text
  FROM user_roles ur
  JOIN auth.users au ON au.id = ur.user_id
  ORDER BY ur.role, au.email;
END;
$$;
