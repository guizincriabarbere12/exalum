/*
# Create audit_logs table for full system traceability

## What this migration does
Adds an append-only `audit_logs` table that records who did what and when
across the system (logins/logouts, criação/edição/exclusão de registros,
aprovações de orçamento, ajustes de estoque, etc.).

## Changes
1. New table `audit_logs`:
   - `user_id` (uuid, nullable, references auth.users, SET NULL on user deletion
     so historical logs are preserved even if the user is later removed)
   - `user_email` (text) — snapshot of the email at the time of the action,
     so the log stays readable even if the user is later deleted
   - `acao` (text) — e.g. 'login', 'logout', 'criar', 'atualizar', 'excluir',
     'aprovar', 'rejeitar', 'ajuste_estoque'
   - `entidade` (text) — e.g. 'orcamento', 'produto', 'cliente', 'usuario',
     'configuracoes', 'estoque', 'auth'
   - `entidade_id` (text, nullable) — id of the affected row, if any
   - `descricao` (text, nullable) — human-readable summary
   - `metadados` (jsonb, nullable) — extra structured data
   - `created_at` (timestamptz, default now())
2. Indexes on `created_at`, `entidade`, `user_id` for fast filtering.
3. Security:
   - RLS enabled.
   - Any authenticated user can INSERT (every user's own actions must be
     logged, not just admins').
   - Only admins can SELECT (view the audit trail).
   - No UPDATE/DELETE policy is created, so logs are effectively immutable
     through the app — nobody can edit or erase history via the API.
*/

CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email text,
  acao text NOT NULL,
  entidade text NOT NULL,
  entidade_id text,
  descricao text,
  metadados jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entidade ON audit_logs (entidade);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs (user_id);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "insert_audit_logs" ON audit_logs;
CREATE POLICY "insert_audit_logs" ON audit_logs
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "admin_select_audit_logs" ON audit_logs;
CREATE POLICY "admin_select_audit_logs" ON audit_logs
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'
    )
  );
