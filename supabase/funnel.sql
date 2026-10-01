-- Embudo del formulario de vendedores: un registro por paso y por visita, sin cookies ni datos personales.
create table if not exists public.funnel (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  session_id uuid not null,
  step text not null check (step in ('form_start','step1_done')),
  utm_campaign text,
  utm_content text
);
alter table public.funnel enable row level security;
drop policy if exists "funnel insert publico" on public.funnel;
create policy "funnel insert publico" on public.funnel for insert to anon with check (true);
grant insert on public.funnel to anon;
