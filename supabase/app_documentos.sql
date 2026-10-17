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

commit;

select email, nombre_legal, cedula_expedida, domicilio from public.equipo;
