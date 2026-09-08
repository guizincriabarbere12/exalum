-- CRM WhatsApp: cada vendedor conecta o proprio numero (via Evolution API,
-- mesmo servidor usado pelo PedeZap - instanceName = vendedores.id), e todas
-- as conversas ficam visiveis num inbox unificado pra quem administra.
create table crm_mensagens (
  id uuid primary key default gen_random_uuid(),
  vendedor_id uuid not null references vendedores(id) on delete cascade,
  numero_cliente text not null,
  nome_contato text,
  papel text not null check (papel in ('cliente','vendedor')),
  mensagem text not null,
  created_at timestamptz not null default now()
);

create index idx_crm_mensagens_vendedor_numero on crm_mensagens(vendedor_id, numero_cliente, created_at);

alter table crm_mensagens enable row level security;

create policy "usuarios autenticados usam crm_mensagens" on crm_mensagens for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

alter publication supabase_realtime add table crm_mensagens;
