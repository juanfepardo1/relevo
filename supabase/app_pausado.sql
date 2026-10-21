-- Etapa "Pausado" (21 oct 2026): el cliente está interesado pero pidió esperar hasta una fecha.
-- Al llegar la fecha, Inicio pide retomarlo y vuelve a la etapa donde estaba.
begin;

alter table public.vendedores add column if not exists pausado_hasta date;
alter table public.vendedores add column if not exists pausado_desde text;

update etapas set orden = orden + 1 where pipeline = 'vendedor' and orden >= (select orden from etapas where pipeline = 'vendedor' and codigo = 'cerrado');
insert into etapas (pipeline, codigo, nombre, orden, fase, sla_dias, terminal)
values ('vendedor', 'pausado', 'Pausado', (select orden - 1 from etapas where pipeline = 'vendedor' and codigo = 'cerrado'), 'Final', null, false)
on conflict (pipeline, codigo) do nothing;

-- Guarda de qué etapa venía para devolverlo ahí al retomar, y limpia la fecha al salir.
create or replace function public.pausado_etapa() returns trigger
language plpgsql set search_path to 'public' as $$
begin
  if new.etapa = 'pausado' and old.etapa is distinct from 'pausado' then
    new.pausado_desde := old.etapa;
  elsif old.etapa = 'pausado' and new.etapa is distinct from 'pausado' then
    new.pausado_hasta := null;
  end if;
  return new;
end $$;
drop trigger if exists vendedores_pausado on public.vendedores;
create trigger vendedores_pausado before update of etapa on public.vendedores for each row execute function pausado_etapa();

commit;
select 'listo' as resultado;
