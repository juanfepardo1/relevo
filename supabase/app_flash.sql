begin;

-- 1. Etapa "En reserva": empresas pequeñas valoradas con flash, guardadas para cruzarlas con compradores.
--    Es terminal (no cuenta como atascada ni avanza el embudo).
insert into public.etapas (pipeline, codigo, nombre, orden, fase, sla_dias, terminal)
values ('vendedor', 'en_reserva', 'En reserva', 20, 'Final', null, true)
on conflict (pipeline, codigo) do update set nombre = excluded.nombre, fase = excluded.fase, terminal = true, sla_dias = null;

-- 2. Datos de la valoración flash en cada vendedor
alter table public.vendedores add column if not exists valoracion_min numeric;
alter table public.vendedores add column if not exists valoracion_fecha date;
alter table public.vendedores add column if not exists flash_subsector text;
alter table public.vendedores add column if not exists flash_subtipo smallint not null default 0;
alter table public.vendedores add column if not exists flash_mult numeric;
alter table public.vendedores add column if not exists flash_enviado_en date;

do $$ begin
  if exists (select 1 from information_schema.column_privileges where table_schema='public' and table_name='vendedores' and grantee='authenticated' and privilege_type='UPDATE') then
    execute 'grant select, update (valoracion_min, valoracion_fecha, flash_subsector, flash_subtipo, flash_mult, flash_enviado_en) on public.vendedores to authenticated';
  end if;
end $$;

-- 3. Supuestos de la valoración flash, iguales para todo el equipo (se editan en Admin)
insert into public.ajustes (clave, valor) values ('flash_supuestos', '{}') on conflict (clave) do nothing;

commit;

select 'listo' as resultado;
