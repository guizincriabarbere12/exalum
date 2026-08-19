-- audit_logs no exalum tinha um schema diferente do que o código (trazido
-- do kitsdobrasil) espera: colunas tabela/registro_id/detalhes em vez de
-- entidade_id/descricao/metadados. Toda gravação de log falhava
-- silenciosamente (logActivity engole o erro de propósito) e a tela de
-- Auditoria falhava ao carregar (SELECT em colunas inexistentes).
--
-- Além disso, RLS estava habilitado sem NENHUMA policy — mesmo com as
-- colunas certas, ninguém conseguiria ler nem gravar nada.
ALTER TABLE public.audit_logs
  ADD COLUMN IF NOT EXISTS entidade_id text,
  ADD COLUMN IF NOT EXISTS descricao text,
  ADD COLUMN IF NOT EXISTS metadados jsonb;

CREATE POLICY "admin_select_audit_logs"
  ON public.audit_logs FOR SELECT
  USING (is_admin());

CREATE POLICY "insert_audit_logs"
  ON public.audit_logs FOR INSERT
  WITH CHECK (true);
