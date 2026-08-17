-- Reconstructed from the live Kits do Brasil database (no local .sql file existed for this
-- migration in the kitsdobrasil repo when this branch was created).
DROP POLICY IF EXISTS "admin_delete_permissions" ON public.user_permissions;
CREATE POLICY "admin_delete_permissions" ON public.user_permissions FOR DELETE
  TO authenticated USING (is_admin());

DROP POLICY IF EXISTS "admin_insert_permissions" ON public.user_permissions;
CREATE POLICY "admin_insert_permissions" ON public.user_permissions FOR INSERT
  TO authenticated WITH CHECK (is_admin());

DROP POLICY IF EXISTS "admin_read_all_permissions" ON public.user_permissions;
CREATE POLICY "admin_read_all_permissions" ON public.user_permissions FOR SELECT
  TO authenticated USING (is_admin());

DROP POLICY IF EXISTS "admin_update_permissions" ON public.user_permissions;
CREATE POLICY "admin_update_permissions" ON public.user_permissions FOR UPDATE
  TO authenticated USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS "user_read_own_permissions" ON public.user_permissions;
CREATE POLICY "user_read_own_permissions" ON public.user_permissions FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
