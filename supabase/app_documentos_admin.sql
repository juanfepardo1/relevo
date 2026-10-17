begin;

-- Datos legales de quien firma (cada uno edita solo los suyos desde Mi perfil)
alter table public.equipo add column if not exists nombre_legal text;
alter table public.equipo add column if not exists cedula text;
alter table public.equipo add column if not exists cedula_expedida text;
alter table public.equipo add column if not exists domicilio text;
alter table public.equipo add column if not exists firma_path text;
revoke insert, update, delete, truncate on public.equipo from authenticated;
grant update (apodo, nombre_legal, cedula, cedula_expedida, domicilio, firma_path) on public.equipo to authenticated;
drop policy if exists "cada uno edita su perfil" on public.equipo;
create policy "cada uno edita su perfil" on public.equipo for update to authenticated
  using (email = auth.jwt()->>'email') with check (email = auth.jwt()->>'email');

where email = 'felipe@relevobrokers.com' and nombre_legal is null;

-- Datos del propietario y de la empresa para los documentos
alter table public.vendedores add column if not exists propietario_cedula text;
alter table public.vendedores add column if not exists propietario_cedula_expedida text;
alter table public.vendedores add column if not exists razon_social text;
alter table public.vendedores add column if not exists nombre_corto text;
alter table public.vendedores add column if not exists nit text;

-- La vista de vendedores expone las columnas nuevas
do $$ declare d text; begin
  d := pg_get_viewdef('public.v_vendedores'::regclass);
  if position('razon_social' in d) = 0 then
    d := replace(d, ' FROM ((vendedores v', ', v.propietario_cedula, v.propietario_cedula_expedida, v.razon_social, v.nombre_corto, v.nit FROM ((vendedores v');
    if position('razon_social' in d) = 0 then raise exception 'No pude actualizar v_vendedores'; end if;
    execute 'create or replace view public.v_vendedores with (security_invoker = true) as ' || d;
  end if;
end $$;

-- UNICARIBE, con los datos del NDA ya enviado
update public.vendedores set propietario_cedula = '15985541', propietario_cedula_expedida = 'Manzanares',
  razon_social = 'Distribuidores Unidos del Caribe S.A.', nombre_corto = 'Unicaribe S.A.', nit = '802022698'
where nombre like 'José Herminzo%' and razon_social is null;

-- Admin y notas de mejora de la app
alter table public.equipo add column if not exists es_admin boolean not null default false;
update public.equipo set es_admin = true where email = 'felipe@relevobrokers.com';
grant update (activo) on public.equipo to authenticated;

create or replace function public.es_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select es_admin from equipo where email = auth.jwt()->>'email' and activo), false)
$$;
revoke execute on function public.es_admin() from anon, public;
grant execute on function public.es_admin() to authenticated;

drop policy if exists "admin edita equipo" on public.equipo;
create policy "admin edita equipo" on public.equipo for update to authenticated using (es_admin()) with check (es_admin());

create table if not exists public.notas_app (
  id uuid primary key default gen_random_uuid(),
  autor text not null default (auth.jwt()->>'email'),
  tipo text not null default 'falla' check (tipo in ('falla','falta','sobra','idea')),
  texto text not null check (char_length(texto) between 1 and 4000),
  pagina text,
  estado text not null default 'nueva' check (estado in ('nueva','en_curso','resuelta','descartada')),
  respuesta text,
  created_at timestamptz not null default now(),
  resuelta_en timestamptz
);
alter table public.notas_app enable row level security;
drop policy if exists "equipo deja notas" on public.notas_app;
drop policy if exists "autor y admin leen notas" on public.notas_app;
drop policy if exists "admin gestiona notas" on public.notas_app;
create policy "equipo deja notas" on public.notas_app for insert to authenticated with check (es_equipo() and autor = auth.jwt()->>'email');
create policy "autor y admin leen notas" on public.notas_app for select to authenticated using (es_admin() or autor = auth.jwt()->>'email');
create policy "admin gestiona notas" on public.notas_app for update to authenticated using (es_admin()) with check (es_admin());
grant select, insert, update on public.notas_app to authenticated;
revoke all on public.notas_app from anon;

commit;

select email, nombre_legal, es_admin from public.equipo;
