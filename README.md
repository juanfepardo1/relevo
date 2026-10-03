# Relevo

Landing de validación de Relevo. Sitio estático (index.html, términos, privacidad) desplegado en Vercel.
Los formularios guardan en Supabase (tabla leads, solo inserción pública).

Medición: píxel de Meta (978272748640225) solo tras aceptar cookies; eventos FormStart, FormStep2, Lead (vendedor), ReserveReport y BuyerSignup. El Lead también se envía por la API de conversiones desde api/notify-lead.js cuando el vendedor lo autoriza en el formulario (event_id = id del lead, deduplica con el píxel). El embudo sin cookies se guarda en la tabla funnel (crearla con supabase/funnel.sql).
