alter table crm_mensagens add column if not exists tipo text not null default 'texto'
  check (tipo in ('texto','audio','imagem','video','documento'));
alter table crm_mensagens add column if not exists midia_base64 text;
