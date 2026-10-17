-- Al eliminar un vendedor o comprador, se borra también su historial de etapas
create or replace function public.borrar_historial() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  delete from etapa_historial
  where entidad = case tg_table_name when 'vendedores' then 'vendedor' else 'comprador' end
    and entidad_id = old.id;
  return old;
end $$;
revoke execute on function public.borrar_historial() from anon, authenticated, public;

drop trigger if exists vendedores_borra_historial on public.vendedores;
create trigger vendedores_borra_historial after delete on public.vendedores for each row execute function public.borrar_historial();
drop trigger if exists compradores_borra_historial on public.compradores;
create trigger compradores_borra_historial after delete on public.compradores for each row execute function public.borrar_historial();

-- Limpia historial huérfano que haya quedado de antes
delete from public.etapa_historial h
where (h.entidad = 'vendedor' and not exists (select 1 from public.vendedores v where v.id = h.entidad_id))
   or (h.entidad = 'comprador' and not exists (select 1 from public.compradores c where c.id = h.entidad_id));

select 'listo' as resultado;
