# Relevo

Landing de validación de Relevo. Sitio estático (index.html, términos, privacidad) desplegado en Vercel.
Los formularios de vendedores guardan en Supabase (tabla leads, solo inserción pública). Los compradores tienen su propia landing en /compradores (compradores.html), que registra su búsqueda con la función registrar_comprador; /comprar redirige allí.

Medición: píxel de Meta (978272748640225) solo tras aceptar cookies; eventos FormStart, FormStep2, Lead (vendedor)y ReserveReport. El Lead también se envía por la API de conversiones desde api/notify-lead.js cuando el vendedor lo autoriza en el formulario (event_id = id del lead, deduplica con el píxel). El embudo sin cookies se guarda en la tabla funnel (crearla con supabase/funnel.sql).
