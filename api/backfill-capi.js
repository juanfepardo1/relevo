// Uso único: reporta a Meta los leads de vendedor anteriores a la API de conversiones,
// solo con el identificador del clic (fbclid) y el navegador. Sin correo, teléfono ni respuestas.
// Se llama desde Supabase con net.http_post y el header x-webhook-secret. Borrar después de usarlo.

const PIXEL_ID = process.env.META_PIXEL_ID || '978272748640225';
const API_VERSION = process.env.META_API_VERSION || 'v25.0';

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  if (!process.env.WEBHOOK_SECRET || req.headers['x-webhook-secret'] !== process.env.WEBHOOK_SECRET) return res.status(401).end();
  if (!process.env.META_CAPI_TOKEN) return res.status(500).json({ error: 'falta META_CAPI_TOKEN' });

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
  const rows = Array.isArray(body.rows) ? body.rows : [];
  const now = Math.floor(Date.now() / 1000);
  const data = [];
  const skipped = [];

  for (const r of rows) {
    let fbclid = null;
    try { fbclid = new URL(r.landing_url).searchParams.get('fbclid'); } catch (e) {}
    const t = Math.floor(new Date(r.created_at).getTime() / 1000);
    if (!fbclid || !t || now - t > 7 * 86400) { skipped.push({ id: r.id, reason: !fbclid ? 'sin fbclid' : 'fecha' }); continue; }
    data.push({
      event_name: 'Lead',
      event_time: t,
      event_id: r.id,
      action_source: 'website',
      event_source_url: r.landing_url,
      user_data: { fbc: `fb.1.${t * 1000}.${fbclid}`, client_user_agent: r.user_agent || undefined },
      custom_data: { content_name: 'vendedor' },
    });
  }

  if (!data.length) return res.status(200).json({ sent: 0, skipped });
  const resp = await fetch(
    `https://graph.facebook.com/${API_VERSION}/${PIXEL_ID}/events?access_token=${encodeURIComponent(process.env.META_CAPI_TOKEN)}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data }) }
  );
  const meta = await resp.text();
  return res.status(resp.ok ? 200 : 502).json({ sent: resp.ok ? data.length : 0, skipped, meta: meta.slice(0, 500) });
};
