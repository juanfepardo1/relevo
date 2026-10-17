begin;

create table if not exists public.movimientos (
  id uuid primary key default gen_random_uuid(),
  fecha date not null default current_date,
  tipo text not null check (tipo in ('ingreso','gasto','aporte','reembolso')),
  categoria text not null,
  descripcion text,
  monto numeric(14,0) not null check (monto > 0),
  pagado_por text not null check (pagado_por in ('felipe','alejandro','relevo')),
  vendedor_id uuid references public.vendedores(id) on delete set null,
  soporte_path text,
  autor text default (auth.jwt()->>'email'),
  created_at timestamptz not null default now()
);
create index if not exists movimientos_fecha on public.movimientos (fecha);
alter table public.movimientos enable row level security;
drop policy if exists "equipo todo movimientos" on public.movimientos;
create policy "equipo todo movimientos" on public.movimientos for all to authenticated using (es_equipo()) with check (es_equipo());
grant select, insert, update, delete on public.movimientos to authenticated;
revoke all on public.movimientos from anon;

create table if not exists public.ajustes (clave text primary key, valor text not null, updated_at timestamptz not null default now());
alter table public.ajustes enable row level security;
drop policy if exists "equipo todo ajustes" on public.ajustes;
create policy "equipo todo ajustes" on public.ajustes for all to authenticated using (es_equipo()) with check (es_equipo());
grant select, insert, update on public.ajustes to authenticated;
revoke all on public.ajustes from anon;
insert into public.ajustes (clave, valor) values ('gastos_socios', 'deuda') on conflict do nothing;

-- Movimientos del Google Sheet (solo si la tabla está vacía)
insert into public.movimientos (fecha, tipo, categoria, descripcion, monto, pagado_por)
select fecha::date, tipo, categoria, descripcion, monto, pagado_por from (values

  ('2026-10-02','gasto','marketing','Meta Ads',7985,'felipe'),
  ('2026-10-02','gasto','marketing','Meta Ads',7985,'felipe'),
  ('2026-10-02','gasto','marketing','Meta Ads',13366,'felipe'),
  ('2026-10-02','gasto','hosting','Dominios GoDaddy',120538,'felipe'),
  ('2026-10-02','gasto','software','Suscripción Lemlist',98322,'felipe'),
  ('2026-10-02','gasto','software','Créditos extra Claude',308228,'felipe'),
  ('2026-10-02','gasto','marketing','Meta Ads',13366,'felipe'),
  ('2026-10-03','gasto','marketing','Meta Ads',27512,'felipe'),
  ('2026-10-03','gasto','software','Suscripción Claude Max',330024,'felipe'),
  ('2026-10-04','gasto','marketing','Meta Ads',27512,'felipe'),
  ('2026-10-04','gasto','marketing','Meta Ads',27512,'felipe'),
  ('2026-10-05','gasto','marketing','Meta Ads',27512,'felipe'),
  ('2026-10-05','gasto','marketing','Meta Ads',27512,'felipe'),
  ('2026-10-05','gasto','marketing','Meta Ads',27512,'felipe'),
  ('2026-10-06','gasto','marketing','Meta Ads',68764,'felipe'),
  ('2026-10-06','gasto','marketing','Meta Ads',68764,'felipe'),
  ('2026-10-07','gasto','software','Suscripción Claude Alejo',64200,'alejandro'),
  ('2026-10-07','gasto','marketing','Meta Ads',68764,'felipe'),
  ('2026-10-07','gasto','software','Suscripción Notion',79113,'felipe'),
  ('2026-10-09','gasto','marketing','Meta Ads',105845,'felipe'),
  ('2026-10-11','gasto','marketing','Meta Ads',105845,'felipe'),
  ('2026-10-12','gasto','marketing','Meta Ads',105845,'felipe'),
  ('2026-10-11','gasto','marketing','Meta Ads',105845,'felipe')
) as x(fecha, tipo, categoria, descripcion, monto, pagado_por)
where not exists (select 1 from public.movimientos);

-- Suscripciones
create table if not exists public.suscripciones (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  categoria text not null default 'software',
  monto numeric(14,0) not null check (monto >= 0),
  periodicidad text not null default 'mensual' check (periodicidad in ('mensual','trimestral','anual')),
  proxima_renovacion date not null,
  pagado_por text not null check (pagado_por in ('felipe','alejandro','relevo')),
  estado text not null default 'activa' check (estado in ('activa','cancelada')),
  url_gestion text,
  notas text,
  created_at timestamptz not null default now()
);
alter table public.suscripciones enable row level security;
drop policy if exists "equipo todo suscripciones" on public.suscripciones;
create policy "equipo todo suscripciones" on public.suscripciones for all to authenticated using (es_equipo()) with check (es_equipo());
grant select, insert, update, delete on public.suscripciones to authenticated;
revoke all on public.suscripciones from anon;

insert into public.suscripciones (nombre, categoria, monto, periodicidad, proxima_renovacion, pagado_por, url_gestion, notas)
select * from (values
  ('Claude Max', 'software', 330024, 'mensual', date '2026-11-03', 'felipe', 'https://claude.ai/settings/billing', 'Fecha estimada desde el último cobro'),
  ('Claude (Alejo)', 'software', 64200, 'mensual', date '2026-11-07', 'alejandro', 'https://claude.ai/settings/billing', 'Fecha estimada desde el último cobro'),
  ('Lemlist', 'software', 98322, 'mensual', date '2026-11-02', 'felipe', 'https://app.lemlist.com', 'Fecha estimada desde el último cobro'),
  ('Notion', 'software', 79113, 'mensual', date '2026-11-07', 'felipe', 'https://www.notion.so', 'Fecha estimada desde el último cobro'),
  ('Dominios GoDaddy', 'hosting', 120538, 'anual', date '2027-10-02', 'felipe', 'https://account.godaddy.com/products', 'Fecha estimada desde el último cobro')
) as x(nombre, categoria, monto, periodicidad, proxima_renovacion, pagado_por, url_gestion, notas)
where not exists (select 1 from public.suscripciones);

commit;

select pagado_por, count(*), sum(monto) from public.movimientos group by 1;
select nombre, periodicidad, proxima_renovacion from public.suscripciones order by proxima_renovacion;
