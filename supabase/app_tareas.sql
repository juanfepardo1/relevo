-- Tareas y recordatorios del equipo (Inicio personalizado). Una tarea con fecha es un recordatorio.
create table if not exists public.tareas (
  id uuid primary key default gen_random_uuid(),
  titulo text not null check (length(trim(titulo)) > 0),
  notas text,
  fecha date,
  asignado text not null default (auth.jwt()->>'email') references public.equipo(email),
  creador text not null default (auth.jwt()->>'email'),
  vendedor_id uuid references public.vendedores(id) on delete set null,
  comprador_id uuid references public.compradores(id) on delete set null,
  hecha_en timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists tareas_asignado_pend on public.tareas (asignado) where hecha_en is null;
create index if not exists tareas_vendedor on public.tareas (vendedor_id);

alter table public.tareas enable row level security;
drop policy if exists "equipo tareas" on public.tareas;
create policy "equipo tareas" on public.tareas for all using (es_equipo()) with check (es_equipo());
