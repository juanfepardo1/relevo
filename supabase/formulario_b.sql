-- Formulario "Afina tu valoración" para vendedores B (relevobrokers.com/afinar?c=CODIGO).
-- Cada vendedor tiene un código imposible de adivinar. Sin sesión: la página solo puede leer
-- nombre, empresa, sector y rango de ventas de ese código, y guardar respuestas.

alter table vendedores add column if not exists form_codigo text unique default substr(replace(gen_random_uuid()::text, '-', ''), 1, 20);
update vendedores set form_codigo = substr(replace(gen_random_uuid()::text, '-', ''), 1, 20) where form_codigo is null;
alter table vendedores add column if not exists form_enviado_en date;
alter table vendedores add column if not exists form_respondido_en timestamptz;

create table if not exists formulario_respuestas (
  id uuid primary key default gen_random_uuid(),
  vendedor_id uuid not null references vendedores(id) on delete cascade,
  respuestas jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists formulario_respuestas_vend on formulario_respuestas(vendedor_id, created_at desc);
alter table formulario_respuestas enable row level security;
drop policy if exists "equipo lee respuestas" on formulario_respuestas;
create policy "equipo lee respuestas" on formulario_respuestas for select using (es_equipo());
drop policy if exists "equipo borra respuestas" on formulario_respuestas;
create policy "equipo borra respuestas" on formulario_respuestas for delete using (es_equipo());

create or replace function formulario_datos(c text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'nombre', split_part(regexp_replace(coalesce(v.nombre, ''), '^[^[:alpha:]]+', ''), ' ', 1),
    'empresa', v.empresa, 'sector', v.sector, 'ventas', v.ventas_rango,
    'respondido', v.form_respondido_en is not null)
  from vendedores v where length(c) >= 16 and v.form_codigo = c;
$$;

create or replace function formulario_responder(c text, r jsonb)
returns boolean language plpgsql security definer set search_path = public as $$
declare vid uuid;
begin
  if r is null or jsonb_typeof(r) <> 'object' or length(r::text) > 8000 then return false; end if;
  select id into vid from vendedores where length(c) >= 16 and form_codigo = c;
  if vid is null then return false; end if;
  if (select count(*) from formulario_respuestas where vendedor_id = vid) >= 5 then return false; end if;
  insert into formulario_respuestas(vendedor_id, respuestas) values (vid, r);
  update vendedores set form_respondido_en = now() where id = vid;
  insert into actividades(vendedor_id, tipo, resumen) values (vid, 'nota', 'Respondió el formulario "Afina tu valoración".');
  return true;
end $$;

revoke all on function formulario_datos(text) from public;
revoke all on function formulario_responder(text, jsonb) from public;
grant execute on function formulario_datos(text) to anon, authenticated;
grant execute on function formulario_responder(text, jsonb) to anon, authenticated;

-- La vista del CRM muestra el estado del formulario (columnas nuevas al final).
create or replace view v_vendedores with (security_invoker = true) as
 SELECT v.id, v.nombre, v.empresa, v.empresa_nit, v.rol, v.ciudad, v.departamento, v.sector, v.ventas_rango, v.horizonte, v.motivo_venta,
    v.celular, v.telefono, v.correo, v.canal, v.fuente, v.referido_por, v.anuncio, v.campana_id, v.valoracion_tipo, v.valoracion_max,
    v.precio_esperado, v.emis, v.etapa, v.pipeline, v.motivo_perdida, v.responsable, v.proxima_accion, v.fecha_proxima_accion,
    v.ultimo_contacto, v.fecha_ingreso, v.lead_id, v.notion_url, v.notas, v.created_at, v.updated_at,
    e.nombre AS etapa_nombre, e.orden AS etapa_orden, e.fase, e.sla_dias,
    floor(EXTRACT(epoch FROM now() - h.desde) / 86400::numeric)::integer AS dias_en_etapa,
    ( SELECT count(*) FROM documentos d WHERE d.vendedor_id = v.id AND d.estado = 'solicitado') AS docs_pendientes,
    v.bucket, v.propietario_cedula, v.propietario_cedula_expedida, v.razon_social, v.nombre_corto, v.nit,
    v.form_enviado_en, v.form_respondido_en
   FROM vendedores v
     JOIN etapas e ON e.pipeline = 'vendedor' AND e.codigo = v.etapa
     LEFT JOIN etapa_historial h ON h.entidad = 'vendedor' AND h.entidad_id = v.id AND h.hasta IS NULL;

-- Los B valorados cuya flash todavía no se envió vuelven a "No contactado": "En reserva" ya no es el paso por defecto.
update vendedores set etapa = 'no_contactado'
 where etapa = 'en_reserva' and valoracion_tipo = 'flash' and flash_enviado_en is null;
