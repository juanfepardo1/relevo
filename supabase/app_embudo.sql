begin;

-- Metas editables desde Admin (solo el admin)
grant update (sla_dias) on public.etapas to authenticated;
drop policy if exists "admin edita metas" on public.etapas;
create policy "admin edita metas" on public.etapas for update to authenticated using (es_admin()) with check (es_admin());

-- Días sin actividad para considerar quieto a un vendedor
insert into public.ajustes (clave, valor) values ('dias_sin_actividad', '7') on conflict do nothing;

commit;

select codigo, nombre, sla_dias from public.etapas where pipeline = 'vendedor' order by orden;
