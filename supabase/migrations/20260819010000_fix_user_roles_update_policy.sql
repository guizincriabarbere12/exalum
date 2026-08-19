-- user_roles só tinha policy de INSERT (cadastro) e SELECT (só a própria
-- role) — não existia NENHUMA policy de UPDATE. Trocar o papel de um
-- usuário pela tela de Configurações (ou pelo seletor de permissões)
-- sempre falhava silenciosamente: o Supabase não retorna erro quando o
-- RLS filtra a linha, só não atualiza nada.
CREATE POLICY "Admins podem atualizar roles"
  ON public.user_roles FOR UPDATE
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Admins podem remover roles"
  ON public.user_roles FOR DELETE
  USING (is_admin());

-- O Postgres exige que a linha também seja visível via alguma policy de
-- SELECT para o UPDATE ter efeito — só existia "ver a própria role", então
-- mesmo com a policy de UPDATE acima, admin não conseguia atualizar a role
-- de outro usuário (0 linhas afetadas, sem erro nenhum).
CREATE POLICY "Admins podem ver todas as roles"
  ON public.user_roles FOR SELECT
  USING (is_admin());
