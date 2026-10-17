begin;

-- Transferencias entre socios para cruzar cuentas (no afectan los estados financieros de Relevo)
create table if not exists public.transferencias_socios (
  id uuid primary key default gen_random_uuid(),
  fecha date not null default current_date,
  de text not null check (de in ('felipe','alejandro')),
  a text not null check (a in ('felipe','alejandro')),
  monto numeric(14,0) not null check (monto > 0),
  nota text,
  soporte_path text,
  autor text default (auth.jwt()->>'email'),
  created_at timestamptz not null default now(),
  check (de <> a)
);
alter table public.transferencias_socios enable row level security;
drop policy if exists "equipo lee transferencias" on public.transferencias_socios;
drop policy if exists "socio registra transferencias" on public.transferencias_socios;
drop policy if exists "socio edita transferencias" on public.transferencias_socios;
drop policy if exists "socio borra transferencias" on public.transferencias_socios;
create policy "equipo lee transferencias" on public.transferencias_socios for select to authenticated using (es_equipo());
create policy "socio registra transferencias" on public.transferencias_socios for insert to authenticated with check (es_equipo() and socio_actual() in (de, a));
create policy "socio edita transferencias" on public.transferencias_socios for update to authenticated using (socio_actual() in (de, a)) with check (socio_actual() in (de, a));
create policy "socio borra transferencias" on public.transferencias_socios for delete to authenticated using (socio_actual() in (de, a));
grant select, insert, update, delete on public.transferencias_socios to authenticated;
revoke all on public.transferencias_socios from anon;

commit;

select 'listo' as resultado;
