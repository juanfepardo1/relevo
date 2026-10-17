-- NDA y lista de documentos enviados desde la app (17 oct 2026). Corre todo de una vez en el SQL Editor.
begin;

-- Cada envío de NDA + lista queda como un paquete: la lista que se pidió, quién la armó y el borrador de Gmail.
create table if not exists public.paquetes (
  id uuid primary key default gen_random_uuid(),
  vendedor_id uuid not null references public.vendedores(id) on delete cascade,
  items jsonb not null default '[]'::jsonb,
  correo_para text,
  borrador_url text,
  creado_por text not null default (auth.jwt()->>'email'),
  created_at timestamptz not null default now()
);
create index if not exists paquetes_vendedor on public.paquetes (vendedor_id);
alter table public.paquetes enable row level security;
drop policy if exists "equipo paquetes" on public.paquetes;
create policy "equipo paquetes" on public.paquetes for all to authenticated using (es_equipo()) with check (es_equipo());
grant select, insert, update, delete on public.paquetes to authenticated;
revoke all on public.paquetes from anon;

-- Los documentos pedidos y los dos PDF enviados apuntan a su paquete.
alter table public.documentos add column if not exists paquete_id uuid references public.paquetes(id) on delete set null;
create index if not exists documentos_paquete on public.documentos (paquete_id);

-- Nuevo tipo: la lista de documentos que enviamos.
alter table public.documentos drop constraint if exists documentos_tipo_check;
alter table public.documentos add constraint documentos_tipo_check check (tipo = any (array['nda','lista_documentos','estados_financieros','declaracion_renta','facturacion','extractos','camara_comercio','valoracion_preliminar','valoracion_profunda','diagnostico','teaser','cim','mandato','loi','contrato','prueba_fondos','otro']));

-- Pasa a Docs recibidos con el primer documento recibido, tenga archivo o se marque a mano.
create or replace function public.docs_recibidos_auto() returns trigger
language plpgsql security definer set search_path to 'public' as $$
begin
  if new.vendedor_id is not null and new.direccion = 'recibir' and new.estado = 'recibido'
     and (tg_op = 'INSERT' or old.estado is distinct from 'recibido' or new.archivo_path is distinct from old.archivo_path) then
    update vendedores set etapa = 'docs_recibidos' where id = new.vendedor_id and etapa = 'nda_docs';
  end if;
  return new;
end $$;

commit;
select 'listo' as resultado;
