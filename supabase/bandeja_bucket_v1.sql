-- Bandeja de leads, bucket y presentaciones (app interna)

-- 1. Los leads ya no se vuelven vendedores solos: quedan en la bandeja
drop trigger if exists leads_a_vendedor on public.leads;
drop function if exists public.lead_a_vendedor();

create or replace function public.aprobar_lead(p_lead uuid)
returns uuid language plpgsql security invoker set search_path = public as $$
declare l leads; vid uuid;
begin
  if not es_equipo() then raise exception 'no autorizado'; end if;
  select * into l from leads where id = p_lead and kind = 'seller';
  if not found then raise exception 'lead no encontrado'; end if;
  select id into vid from vendedores where lead_id = p_lead;
  if vid is null then
    insert into vendedores (nombre, empresa, rol, ciudad, sector, ventas_rango, horizonte, celular, correo, canal, fuente, anuncio, campana_id, lead_id, fecha_ingreso, responsable)
    values (l.name, l.company, l.role, l.city, sector_slug(l.sector),
      case when l.sales_range in ('lt1000','1000_2000','2000_5000','5000_10000','10000_20000','gt20000') then l.sales_range end,
      case l.timing when 'En los próximos 6 meses' then '6m' when 'Entre 6 y 24 meses' then '6_24m' when 'Solo quiero saber cuánto vale' then 'solo_valor' end,
      l.phone, lower(trim(l.email)), case when l.contact_channel in ('whatsapp','correo','llamada') then l.contact_channel end,
      case l.utm_source when 'ig' then 'Instagram' when 'fb' then 'Facebook' when 'an' then 'Audience Network' else coalesce(l.utm_source,'Directo') end,
      l.utm_content, l.utm_campaign, l.id, (l.created_at at time zone 'America/Bogota')::date,
      (select email from equipo where email = auth.jwt()->>'email'))
    returning id into vid;
  end if;
  update leads set status = 'aprobado' where id = p_lead;
  return vid;
end $$;
revoke execute on function public.aprobar_lead(uuid) from anon, public;
grant execute on function public.aprobar_lead(uuid) to authenticated;

create or replace view public.v_bandeja with (security_invoker = true) as
select l.*,
  exists (select 1 from vendedores v where (v.correo is not null and v.correo = lower(trim(l.email)))
          or (v.celular is not null and regexp_replace(v.celular,'\D','','g') = regexp_replace(coalesce(l.phone,''),'\D','','g'))) as posible_duplicado,
  (select count(*) from leads l2 where l2.kind = 'seller' and l2.id <> l.id and lower(trim(l2.email)) = lower(trim(l.email))) as otros_envios
from leads l
where l.kind = 'seller' and l.status = 'nuevo'
  and not exists (select 1 from vendedores v where v.lead_id = l.id);

-- 2. Bucket por ventas
alter table public.vendedores add column if not exists bucket text generated always as (
  case when ventas_rango in ('5000_10000','10000_20000') then 'A'
       when ventas_rango in ('1000_2000','2000_5000') then 'B'
       when ventas_rango = 'lt1000' then 'C'
       when ventas_rango = 'gt20000' then 'D' end) stored;

do $$ declare d text; begin
  d := pg_get_viewdef('public.v_vendedores'::regclass);
  if position('bucket' in d) = 0 then
    d := replace(d, ' FROM ((vendedores v', ', v.bucket FROM ((vendedores v');
    execute 'create or replace view public.v_vendedores as ' || d;
  end if;
end $$;
alter view public.v_vendedores set (security_invoker = true);

-- 3. Compradores presentados a cada vendedor
create table if not exists public.presentaciones (
  id uuid primary key default gen_random_uuid(),
  vendedor_id uuid not null references vendedores(id) on delete cascade,
  comprador_id uuid not null references compradores(id) on delete cascade,
  orden_id uuid references ordenes(id) on delete set null,
  fecha date not null default current_date,
  estado text not null default 'presentado' check (estado in ('presentado','interesado','nda_firmado','oferta','descartado')),
  notas text,
  autor text default (auth.jwt()->>'email'),
  created_at timestamptz not null default now(),
  unique (vendedor_id, comprador_id)
);
alter table public.presentaciones enable row level security;
drop policy if exists "equipo todo presentaciones" on public.presentaciones;
create policy "equipo todo presentaciones" on public.presentaciones for all to authenticated using (es_equipo()) with check (es_equipo());

-- 4. Limpieza de seguridad pendiente
delete from public.equipo where email = 'juanfepardo1@gmail.com';
alter function public.sector_slug(text) set search_path = public;
revoke execute on function public.registrar_etapa() from anon, authenticated, public;
