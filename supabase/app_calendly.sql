begin;

-- Reuniones que llegan de Calendly
create table if not exists public.reuniones (
  id uuid primary key default gen_random_uuid(),
  calendly_uri text not null unique,
  organizador text not null,
  evento text,
  inicio timestamptz not null,
  fin timestamptz,
  estado text not null default 'activa' check (estado in ('activa','cancelada')),
  invitado_nombre text,
  invitado_email text,
  link text,
  vendedor_id uuid references public.vendedores(id) on delete set null,
  comprador_id uuid references public.compradores(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists reuniones_inicio on public.reuniones (inicio);
alter table public.reuniones enable row level security;
drop policy if exists "equipo todo reuniones" on public.reuniones;
create policy "equipo todo reuniones" on public.reuniones for all to authenticated using (es_equipo()) with check (es_equipo());
grant select, insert, update, delete on public.reuniones to authenticated;
revoke all on public.reuniones from anon;

-- Recibe las reuniones de Calendly, las enlaza con vendedores o compradores por correo
-- y, la primera vez que ve una reunión activa de un vendedor, deja la actividad y lo pasa a Reunión agendada.
create or replace function public.sync_reuniones(p jsonb) returns integer
language plpgsql security invoker set search_path = public as $$
declare r jsonb; v_id uuid; c_id uuid; nuevo boolean; antes text; n int := 0;
  orden_agendada int := (select orden from etapas where pipeline = 'vendedor' and codigo = 'reunion_agendada');
begin
  if not es_equipo() then raise exception 'no autorizado'; end if;
  for r in select * from jsonb_array_elements(p) loop
    v_id := (select id from vendedores where correo is not null and lower(correo) = lower(r->>'invitado_email') order by created_at limit 1);
    c_id := case when v_id is null then (select comprador_id from personas where email is not null and lower(email) = lower(r->>'invitado_email') and comprador_id is not null limit 1) end;
    antes := (select estado from reuniones where calendly_uri = r->>'uri');
    insert into reuniones (calendly_uri, organizador, evento, inicio, fin, estado, invitado_nombre, invitado_email, link, vendedor_id, comprador_id)
    values (r->>'uri', r->>'organizador', r->>'evento', (r->>'inicio')::timestamptz, (r->>'fin')::timestamptz, r->>'estado', r->>'invitado_nombre', lower(r->>'invitado_email'), r->>'link', v_id, c_id)
    on conflict (calendly_uri) do update set evento = excluded.evento, inicio = excluded.inicio, fin = excluded.fin, estado = excluded.estado,
      invitado_nombre = excluded.invitado_nombre, invitado_email = excluded.invitado_email, link = excluded.link,
      vendedor_id = coalesce(reuniones.vendedor_id, excluded.vendedor_id), comprador_id = coalesce(reuniones.comprador_id, excluded.comprador_id), updated_at = now();
    nuevo := antes is null;
    n := n + 1;

    if v_id is not null then
      if nuevo and r->>'estado' = 'activa' then
        insert into actividades (vendedor_id, tipo, fecha, resumen, autor)
        values (v_id, 'reunion', now(), 'Agendó por Calendly: ' || coalesce(r->>'evento', 'reunión') || ' el ' || to_char(((r->>'inicio')::timestamptz) at time zone 'America/Bogota', 'DD/MM/YYYY HH24:MI'), r->>'organizador');
        update vendedores v set etapa = 'reunion_agendada'
        where v.id = v_id and (select orden from etapas e where e.pipeline = 'vendedor' and e.codigo = v.etapa) < orden_agendada;
        update vendedores set proxima_accion = coalesce(proxima_accion, 'Reunión: ' || coalesce(r->>'evento', 'Calendly')),
          fecha_proxima_accion = coalesce(fecha_proxima_accion, (((r->>'inicio')::timestamptz) at time zone 'America/Bogota')::date)
        where id = v_id;
      elsif antes = 'activa' and r->>'estado' = 'cancelada' then
        insert into actividades (vendedor_id, tipo, fecha, resumen, autor)
        values (v_id, 'nota', now(), 'Canceló en Calendly la reunión del ' || to_char(((r->>'inicio')::timestamptz) at time zone 'America/Bogota', 'DD/MM/YYYY HH24:MI'), r->>'organizador');
      end if;
    end if;
  end loop;
  return n;
end $$;
revoke execute on function public.sync_reuniones(jsonb) from anon, public;
grant execute on function public.sync_reuniones(jsonb) to authenticated;

commit;

select 'listo' as resultado;
