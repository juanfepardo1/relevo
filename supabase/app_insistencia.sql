-- Formulario de la web llenado otra vez por alguien que ya es vendedor (17 oct 2026).
-- No entra a Bandeja: se marca como "repetido" y queda la insistencia en la ficha del vendedor.
begin;

alter table public.vendedores add column if not exists formularios integer not null default 1;
alter table public.vendedores add column if not exists ultimo_formulario_en timestamptz;

create or replace function public.lead_repetido() returns trigger
language plpgsql security definer set search_path to 'public' as $$
declare vid uuid; n int; tel text := regexp_replace(coalesce(new.phone, ''), '\D', '', 'g');
begin
  if new.kind <> 'seller' then return new; end if;
  select id into vid from vendedores
  where (correo is not null and correo = lower(trim(new.email)))
     or (length(tel) >= 7 and celular is not null and regexp_replace(celular, '\D', '', 'g') = tel)
  order by created_at limit 1;
  if vid is null then return new; end if;
  new.status := 'repetido';
  update vendedores set formularios = formularios + 1, ultimo_formulario_en = now() where id = vid returning formularios into n;
  insert into actividades (vendedor_id, tipo, resumen)
  values (vid, 'nota', 'Volvió a llenar el formulario de la web (' || n || ' veces en total)'
    || coalesce('. Horizonte: ' || new.timing, '') || coalesce('. Ventas: ' || new.sales_range, '') || '.');
  return new;
end $$;
drop trigger if exists leads_repetido on public.leads;
create trigger leads_repetido before insert on public.leads for each row execute function lead_repetido();

-- Al aprobar un lead, los otros envíos del mismo correo que seguían en Bandeja cuentan como insistencia.
create or replace function public.aprobar_lead(p_lead uuid) returns uuid
language plpgsql set search_path to 'public' as $function$
declare l leads; vid uuid; otros int;
begin
  if not es_equipo() then raise exception 'no autorizado'; end if;
  select * into l from leads where id = p_lead and kind = 'seller';
  if not found then raise exception 'lead no encontrado'; end if;
  select id into vid from vendedores where lead_id = p_lead;
  if vid is null then
    insert into vendedores (nombre, empresa, rol, ciudad, sector, ventas_rango, horizonte, celular, correo, canal, fuente, anuncio, campana_id, lead_id, fecha_ingreso, responsable)
    values (l.name, l.company, l.role, l.city, sector_slug(l.sector),
      case when l.sales_range in ('lt1000','1000_2000','2000_3000','3000_5000','2000_5000','5000_10000','10000_20000','gt20000') then l.sales_range end,
      case l.timing when 'En los próximos 6 meses' then '6m' when 'Entre 6 y 24 meses' then '6_24m' when 'Solo quiero saber cuánto vale' then 'solo_valor' end,
      l.phone, lower(trim(l.email)), case when l.contact_channel in ('whatsapp','correo','llamada') then l.contact_channel end,
      case l.utm_source when 'ig' then 'Instagram' when 'fb' then 'Facebook' when 'an' then 'Audience Network' else coalesce(l.utm_source,'Directo') end,
      l.utm_content, l.utm_campaign, l.id, (l.created_at at time zone 'America/Bogota')::date,
      null)
    returning id into vid;
  end if;
  update leads set status = 'aprobado' where id = p_lead;
  with r as (
    update leads set status = 'repetido'
    where kind = 'seller' and status = 'nuevo' and id <> p_lead and lower(trim(email)) = lower(trim(l.email))
    returning created_at
  ) select count(*) into otros from r;
  if otros > 0 then
    update vendedores set formularios = formularios + otros, ultimo_formulario_en = greatest(coalesce(ultimo_formulario_en, '-infinity'), now()) where id = vid;
    insert into actividades (vendedor_id, tipo, resumen) values (vid, 'nota', 'Había llenado el formulario ' || (otros + 1) || ' veces antes de aprobarlo.');
  end if;
  return vid;
end $function$;

commit;
select 'listo' as resultado;
