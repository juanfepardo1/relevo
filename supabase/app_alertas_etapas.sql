-- Alertas por etapa en Inicio (17 oct 2026). Corre todo de una vez en el SQL Editor.
begin;

-- 1. Etapas de valoración: "Val. profunda en curso" pasa a "Valoración en curso" (empieza al tocar Valorar)
--    y se agrega "Valoración completa" antes de "Val. presentada".
update etapas set orden = orden + 1 where pipeline = 'vendedor' and orden >= 9;
update etapas set nombre = 'Valoración en curso', sla_dias = 14 where pipeline = 'vendedor' and codigo = 'val_profunda';
insert into etapas (pipeline, codigo, nombre, orden, fase, sla_dias, terminal)
values ('vendedor', 'val_completa', 'Valoración completa', 9, 'Valoración', 7, false)
on conflict (pipeline, codigo) do nothing;
update etapas set sla_dias = null where pipeline = 'vendedor' and codigo = 'docs_recibidos';

-- 2. Hora de la reunión agendada (la llena Calendly o se indica a mano al reagendar).
alter table vendedores add column if not exists reunion_en timestamptz;

-- 3. Marca de actividades generadas por las alertas (ej. recordatorio de documentos).
alter table actividades add column if not exists clave text;
create index if not exists actividades_clave on actividades (vendedor_id, clave) where clave is not null;

-- 4. Los No contactados entran sin responsable (menos los B, que son de Valoraciones).
create or replace function public.aprobar_lead(p_lead uuid) returns uuid
language plpgsql set search_path to 'public' as $function$
declare l leads; vid uuid;
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
  return vid;
end $function$;

update vendedores set responsable = null
where etapa = 'no_contactado' and bucket is distinct from 'B' and responsable is not null;

-- 5. Quien saca a un vendedor de No contactado queda como responsable si no tenía.
create or replace function public.asignar_al_avanzar() returns trigger
language plpgsql security definer set search_path to 'public' as $$
begin
  if new.responsable is null and new.etapa <> 'no_contactado' and old.etapa = 'no_contactado' then
    new.responsable := (select email from equipo where email = auth.jwt()->>'email' and activo);
  end if;
  return new;
end $$;
drop trigger if exists vendedores_asignar on vendedores;
create trigger vendedores_asignar before update of etapa on vendedores
for each row execute function asignar_al_avanzar();

-- 6. Subir un documento recibido mueve de "NDA + docs solicitados" a "Docs recibidos".
create or replace function public.docs_recibidos_auto() returns trigger
language plpgsql security definer set search_path to 'public' as $$
begin
  if new.vendedor_id is not null and new.direccion = 'recibir' and new.estado = 'recibido'
     and (new.archivo_path is not null or new.url is not null) then
    update vendedores set etapa = 'docs_recibidos' where id = new.vendedor_id and etapa = 'nda_docs';
  end if;
  return new;
end $$;
drop trigger if exists documentos_recibidos_auto on documentos;
create trigger documentos_recibidos_auto after insert or update of estado, archivo_path, url on documentos
for each row execute function docs_recibidos_auto();

-- 7. Calendly: además de pasar a Reunión agendada, guarda la hora de la reunión.
create or replace function public.sync_reuniones(p jsonb) returns integer
language plpgsql security invoker set search_path = public as $$
declare r jsonb; v_id uuid; c_id uuid; nuevo boolean; antes text; ini timestamptz; n int := 0;
  orden_agendada int := (select orden from etapas where pipeline = 'vendedor' and codigo = 'reunion_agendada');
begin
  if not es_equipo() then raise exception 'no autorizado'; end if;
  for r in select * from jsonb_array_elements(p) loop
    ini := (r->>'inicio')::timestamptz;
    v_id := (select id from vendedores where correo is not null and lower(correo) = lower(r->>'invitado_email') order by created_at limit 1);
    v_id := coalesce((select vendedor_id from reuniones where calendly_uri = r->>'uri'), v_id);
    c_id := case when v_id is null then (select comprador_id from personas where email is not null and lower(email) = lower(r->>'invitado_email') and comprador_id is not null limit 1) end;
    antes := (select estado from reuniones where calendly_uri = r->>'uri');
    insert into reuniones (calendly_uri, organizador, evento, inicio, fin, estado, invitado_nombre, invitado_email, link, vendedor_id, comprador_id)
    values (r->>'uri', r->>'organizador', r->>'evento', ini, (r->>'fin')::timestamptz, r->>'estado', r->>'invitado_nombre', lower(r->>'invitado_email'), r->>'link', v_id, c_id)
    on conflict (calendly_uri) do update set evento = excluded.evento, inicio = excluded.inicio, fin = excluded.fin, estado = excluded.estado,
      invitado_nombre = excluded.invitado_nombre, invitado_email = excluded.invitado_email, link = excluded.link,
      vendedor_id = coalesce(reuniones.vendedor_id, excluded.vendedor_id), comprador_id = coalesce(reuniones.comprador_id, excluded.comprador_id), updated_at = now();
    nuevo := antes is null;
    n := n + 1;

    if v_id is not null then
      if r->>'estado' = 'activa' then
        if nuevo then
          insert into actividades (vendedor_id, tipo, fecha, resumen, autor)
          values (v_id, 'reunion', now(), 'Agendó por Calendly: ' || coalesce(r->>'evento', 'reunión') || ' el ' || to_char(ini at time zone 'America/Bogota', 'DD/MM/YYYY HH24:MI'), r->>'organizador');
          update vendedores v set etapa = 'reunion_agendada'
          where v.id = v_id and (select orden from etapas e where e.pipeline = 'vendedor' and e.codigo = v.etapa) < orden_agendada;
        end if;
        update vendedores set reunion_en = ini where id = v_id and etapa = 'reunion_agendada' and (reunion_en is null or ini >= reunion_en);
      elsif antes = 'activa' and r->>'estado' = 'cancelada' then
        insert into actividades (vendedor_id, tipo, fecha, resumen, autor)
        values (v_id, 'nota', now(), 'Canceló en Calendly la reunión del ' || to_char(ini at time zone 'America/Bogota', 'DD/MM/YYYY HH24:MI'), r->>'organizador');
        update vendedores set reunion_en = null where id = v_id and reunion_en = ini;
      end if;
    end if;
  end loop;
  return n;
end $$;
revoke execute on function public.sync_reuniones(jsonb) from anon, public;
grant execute on function public.sync_reuniones(jsonb) to authenticated;

-- Reuniones de Calendly ya guardadas: llenar la hora en vendedores que están en Reunión agendada.
update vendedores v set reunion_en = r.inicio
from (select distinct on (vendedor_id) vendedor_id, inicio from reuniones where estado = 'activa' and vendedor_id is not null order by vendedor_id, inicio desc) r
where r.vendedor_id = v.id and v.etapa = 'reunion_agendada' and v.reunion_en is null;

commit;
select 'listo' as resultado;
