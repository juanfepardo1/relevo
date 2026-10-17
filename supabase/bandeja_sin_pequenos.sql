-- Bandeja: los vendedores con ventas < $1.000M no entran (les llega el correo automático desde hablaconrelevo.com).
create or replace view v_bandeja with (security_invoker = on) as
 SELECT id, created_at, kind, sector, sales_range, timing, buyer_type, budget, name, company, city, phone, email, contact_channel, consent, consent_text, utm_source, utm_medium, utm_campaign, utm_content, utm_term, referrer, landing_url, user_agent, status, notes, role,
    (EXISTS ( SELECT 1 FROM vendedores v
          WHERE v.correo IS NOT NULL AND v.correo = lower(TRIM(BOTH FROM l.email)) OR v.celular IS NOT NULL AND regexp_replace(v.celular, '\D', '', 'g') = regexp_replace(COALESCE(l.phone, ''), '\D', '', 'g'))) AS posible_duplicado,
    ( SELECT count(*) FROM leads l2
          WHERE l2.kind = 'seller' AND l2.id <> l.id AND lower(TRIM(BOTH FROM l2.email)) = lower(TRIM(BOTH FROM l.email))) AS otros_envios
   FROM leads l
  WHERE kind = 'seller' AND status = 'nuevo'
    AND coalesce(sales_range, '') NOT IN ('<1000', 'lt1000')
    AND NOT (EXISTS ( SELECT 1 FROM vendedores v WHERE v.lead_id = l.id));
