-- Romaneio de entrega: registra o que realmente saiu pra entrega em cada
-- viagem, por pedido, permitindo entregas parciais (ex: pedido de 10 un.,
-- saem 5 numa entrega e o restante fica pendente pra uma proxima).
create table romaneios (
  id uuid primary key default gen_random_uuid(),
  numero text not null unique,
  pedido_id uuid not null references pedidos(id) on delete cascade,
  status text not null default 'finalizado' check (status in ('finalizado','cancelado')),
  observacoes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table romaneio_itens (
  id uuid primary key default gen_random_uuid(),
  romaneio_id uuid not null references romaneios(id) on delete cascade,
  pedido_item_id uuid not null references pedido_itens(id) on delete cascade,
  produto_id uuid references produtos(id),
  kit_id uuid references kits(id),
  quantidade_entregue numeric not null,
  created_at timestamptz not null default now()
);

create index idx_romaneio_itens_pedido_item on romaneio_itens(pedido_item_id);
create index idx_romaneios_pedido on romaneios(pedido_id);

alter table romaneios enable row level security;
alter table romaneio_itens enable row level security;

create policy "usuarios autenticados usam romaneios" on romaneios for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "usuarios autenticados usam romaneio_itens" on romaneio_itens for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
