-- user_permissions não tinha uma constraint única em (user_id, module),
-- necessária para o upsert por onConflict da tela de permissões.
ALTER TABLE public.user_permissions
  ADD CONSTRAINT user_permissions_user_id_module_key UNIQUE (user_id, module);

-- Permite que, além de admins, um usuário explicitamente autorizado
-- (module = 'gerenciar_permissoes', can_access = true) também gerencie
-- as permissões de tela de outros usuários em user_permissions.
CREATE OR REPLACE FUNCTION public.can_manage_permissions()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT is_admin() OR EXISTS (
    SELECT 1 FROM public.user_permissions
    WHERE user_id = auth.uid() AND module = 'gerenciar_permissoes' AND can_access = true
  );
$$;

DROP POLICY IF EXISTS "admin_read_all_permissions" ON public.user_permissions;
DROP POLICY IF EXISTS "admin_insert_permissions" ON public.user_permissions;
DROP POLICY IF EXISTS "admin_update_permissions" ON public.user_permissions;
DROP POLICY IF EXISTS "admin_delete_permissions" ON public.user_permissions;

CREATE POLICY "admin_read_all_permissions"
  ON public.user_permissions FOR SELECT
  USING (can_manage_permissions());

CREATE POLICY "admin_insert_permissions"
  ON public.user_permissions FOR INSERT
  WITH CHECK (can_manage_permissions());

CREATE POLICY "admin_update_permissions"
  ON public.user_permissions FOR UPDATE
  USING (can_manage_permissions())
  WITH CHECK (can_manage_permissions());

CREATE POLICY "admin_delete_permissions"
  ON public.user_permissions FOR DELETE
  USING (can_manage_permissions());

-- Concede a je.orodrigues@outlook.com a capacidade de gerenciar as
-- permissões de tela de outros usuários.
INSERT INTO public.user_permissions (user_id, module, can_access)
SELECT id, 'gerenciar_permissoes', true
FROM auth.users
WHERE email = 'je.orodrigues@outlook.com'
ON CONFLICT (user_id, module) DO UPDATE SET can_access = true;
