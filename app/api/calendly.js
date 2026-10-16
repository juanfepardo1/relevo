// Sincroniza las reuniones de Calendly de cada socio con la app.
// Los tokens viven en variables de entorno de Vercel (CALENDLY_TOKEN_FELIPE, CALENDLY_TOKEN_ALEJANDRO), nunca en el navegador.
// Solo responde a usuarios del equipo: valida el token de sesión de Supabase y escribe con los permisos de ese usuario (RLS).

const SB = 'https://zxjqixxpyxdyrqaweorn.supabase.co';
const KEY = 'sb_publishable_zEwtzlpxk2cogjK0KCIMdg_xbPhTNPE';
const CAL = 'https://api.calendly.com';
const DIAS_ATRAS = 30;
const DIAS_ADELANTE = 120;

const cuentas = () => [
  ['felipe@relevobrokers.com', process.env.CALENDLY_TOKEN_FELIPE],
  ['alejandro@relevobrokers.com', process.env.CALENDLY_TOKEN_ALEJANDRO],
].filter(([, t]) => t);

async function cal(token, url) {
  const r = await fetch(url.startsWith('http') ? url : CAL + url, { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } });
  if (!r.ok) throw new Error(`Calendly ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return r.json();
}

async function reunionesDe(email, token) {
  const me = await cal(token, '/users/me');
  const userUri = me.resource.uri;
  const min = new Date(Date.now() - DIAS_ATRAS * 864e5).toISOString();
  const max = new Date(Date.now() + DIAS_ADELANTE * 864e5).toISOString();
  let url = `/scheduled_events?user=${encodeURIComponent(userUri)}&min_start_time=${min}&max_start_time=${max}&count=100&sort=start_time:asc`;
  const eventos = [];
  for (let i = 0; url && i < 5; i++) {
    const page = await cal(token, url);
    eventos.push(...page.collection);
    url = page.pagination?.next_page || null;
  }
  const filas = [];
  for (let i = 0; i < eventos.length; i += 8) {
    const lote = eventos.slice(i, i + 8);
    const res = await Promise.all(lote.map(async (e) => {
      const inv = await cal(token, `${e.uri}/invitees?count=10`);
      const persona = inv.collection.find((x) => x.status === 'active') || inv.collection[0] || {};
      const loc = e.location || {};
      return {
        uri: e.uri, organizador: email, evento: e.name, inicio: e.start_time, fin: e.end_time,
        estado: e.status === 'canceled' ? 'cancelada' : 'activa',
        invitado_nombre: persona.name || null, invitado_email: persona.email || null,
        link: loc.join_url || (typeof loc.location === 'string' && /^https?:/.test(loc.location) ? loc.location : null),
      };
    }));
    filas.push(...res);
  }
  return filas;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Usa POST' });
  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ')) return res.status(401).json({ error: 'Sin sesión' });

  const sb = (path, body) => fetch(SB + path, { method: 'POST', headers: { apikey: KEY, Authorization: auth, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const ok = await sb('/rest/v1/rpc/es_equipo', {});
  if (!ok.ok || (await ok.json()) !== true) return res.status(403).json({ error: 'No autorizado' });

  const lista = cuentas();
  if (!lista.length) return res.status(200).json({ configurado: false, sincronizadas: 0, cuentas: [] });

  const resumen = [];
  const todas = [];
  for (const [email, token] of lista) {
    try { const f = await reunionesDe(email, token); todas.push(...f); resumen.push({ email, reuniones: f.length }); }
    catch (e) { resumen.push({ email, error: String(e.message || e) }); }
  }
  let sincronizadas = 0;
  if (todas.length) {
    const r = await sb('/rest/v1/rpc/sync_reuniones', { p: todas });
    if (!r.ok) return res.status(500).json({ error: 'No se guardaron las reuniones: ' + (await r.text()).slice(0, 300), cuentas: resumen });
    sincronizadas = await r.json();
  }
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({ configurado: true, sincronizadas, cuentas: resumen });
}
