begin;

-- Contactos adicionales de un vendedor (contador, revisor fiscal, abogado, socio...). Reusa la tabla personas.
alter table public.personas add column if not exists vendedor_id uuid references public.vendedores(id) on delete cascade;
alter table public.personas add column if not exists notas text;
create index if not exists personas_vendedor_idx on public.personas (vendedor_id);
grant select, insert, update, delete on public.personas to authenticated;

commit;

select 'listo' as resultado;
