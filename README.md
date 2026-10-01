# Relevo

Landing de validación de Relevo. Sitio estático (index.html, términos, privacidad) desplegado en Vercel.
Los formularios guardan en Supabase (tabla leads, solo inserción pública).

Medición: píxel de Meta (978272748640225) solo tras aceptar cookies; eventos FormStart, FormStep2, Lead (vendedor), ReserveReport y BuyerSignup. El embudo sin cookies se guarda en la tabla funnel (crearla con supabase/funnel.sql).
