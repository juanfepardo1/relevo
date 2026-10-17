begin;

-- Apodos y socio de cada usuario
alter table public.equipo add column if not exists apodo text;
alter table public.equipo add column if not exists socio text check (socio in ('felipe','alejandro'));
update public.equipo set apodo = 'Pardo', socio = 'felipe' where email = 'felipe@relevobrokers.com';
update public.equipo set apodo = 'Alejo', socio = 'alejandro' where email = 'alejandro@relevobrokers.com';

create or replace function public.socio_actual() returns text
language sql stable security definer set search_path = public as $$
  select socio from equipo where email = auth.jwt()->>'email' and activo
$$;
revoke execute on function public.socio_actual() from anon, public;
grant execute on function public.socio_actual() to authenticated;

-- Movimientos: cada uno solo registra, edita o borra a su nombre o a nombre de Relevo
drop policy if exists "equipo todo movimientos" on public.movimientos;
drop policy if exists "equipo lee movimientos" on public.movimientos;
drop policy if exists "socio escribe movimientos" on public.movimientos;
drop policy if exists "socio edita movimientos" on public.movimientos;
drop policy if exists "socio borra movimientos" on public.movimientos;
create policy "equipo lee movimientos" on public.movimientos for select to authenticated using (es_equipo());
create policy "socio escribe movimientos" on public.movimientos for insert to authenticated with check (es_equipo() and pagado_por in ('relevo', socio_actual()));
create policy "socio edita movimientos" on public.movimientos for update to authenticated using (es_equipo() and pagado_por in ('relevo', socio_actual())) with check (es_equipo() and pagado_por in ('relevo', socio_actual()));
create policy "socio borra movimientos" on public.movimientos for delete to authenticated using (es_equipo() and pagado_por in ('relevo', socio_actual()));

-- Suscripciones: misma regla
drop policy if exists "equipo todo suscripciones" on public.suscripciones;
drop policy if exists "equipo lee suscripciones" on public.suscripciones;
drop policy if exists "socio escribe suscripciones" on public.suscripciones;
drop policy if exists "socio edita suscripciones" on public.suscripciones;
drop policy if exists "socio borra suscripciones" on public.suscripciones;
create policy "equipo lee suscripciones" on public.suscripciones for select to authenticated using (es_equipo());
create policy "socio escribe suscripciones" on public.suscripciones for insert to authenticated with check (es_equipo() and pagado_por in ('relevo', socio_actual()));
create policy "socio edita suscripciones" on public.suscripciones for update to authenticated using (es_equipo() and pagado_por in ('relevo', socio_actual())) with check (es_equipo() and pagado_por in ('relevo', socio_actual()));
create policy "socio borra suscripciones" on public.suscripciones for delete to authenticated using (es_equipo() and pagado_por in ('relevo', socio_actual()));

commit;

select email, nombre, apodo, socio from public.equipo;
