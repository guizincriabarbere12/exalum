-- Reconstructed from the live Kits do Brasil database (no local .sql file existed for this
-- migration in the kitsdobrasil repo when this branch was created).
CREATE OR REPLACE FUNCTION public.is_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
SELECT EXISTS (
SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'
);
$function$;
