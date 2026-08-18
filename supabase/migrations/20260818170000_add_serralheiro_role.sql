-- Novo papel de usuário: serralheiro (colaborador interno que solicita material
-- para a administração, sem acesso ao ERP completo).
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'serralheiro';
