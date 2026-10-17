begin;

-- Documentos corporativos de Relevo (RUT, Cámara de Comercio, etc.). Uno por tipo; "otro" admite varios.
create table if not exists public.documentos_empresa (
  id uuid primary key default gen_random_uuid(),
  tipo text not null,
  nombre text,
  fecha_expedicion date,
  path text not null,
  archivo text,
  subido_por text default (auth.jwt()->>'email'),
  updated_at timestamptz not null default now()
);
create unique index if not exists documentos_empresa_tipo_unico on public.documentos_empresa (tipo) where tipo <> 'otro';

alter table public.documentos_empresa enable row level security;
drop policy if exists "equipo gestiona documentos empresa" on public.documentos_empresa;
create policy "equipo gestiona documentos empresa" on public.documentos_empresa for all to authenticated using (es_equipo()) with check (es_equipo());
grant select, insert, update, delete on public.documentos_empresa to authenticated;
revoke all on public.documentos_empresa from anon;

commit;

select 'listo' as resultado;
