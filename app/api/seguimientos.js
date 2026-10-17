// Recordatorios automáticos del formulario "Cuéntanos tu caso" (los corre Vercel Cron de lunes a viernes, 9 a. m. Bogotá).
// A quien recibió su valoración flash por correo y no ha respondido: un recordatorio a los 2 días y otro (el último) a los 5.
// Salen desde valoraciones@relevobrokers.com, firmados por Equipo Relevo. Los B se manejan solo por correo.
// Necesita en Vercel: CRON_SECRET y SUPABASE_SERVICE_ROLE_KEY (nunca en el código ni en el navegador).
import { SB, KEY, ALIAS, SEND_SCOPE, credenciales, firmaGmail, mime, conFirma, entregar } from './_google.js';
import { correoFormulario, firmaRespaldo } from './_correo.js';

const REMITENTE = 'valoraciones@relevobrokers.com';
const MAX_POR_CORRIDA = 30;
const MARCA = 'Recordatorio automático';

const hoyBogota = () => new Date(Date.now() - 5 * 3600e3).toISOString().slice(0, 10);
const diasDesde = (d) => Math.round((new Date(hoyBogota() + 'T00:00:00Z') - new Date(d + 'T00:00:00Z')) / 864e5);

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const secreto = process.env.CRON_SECRET;
  const auth = req.headers.authorization || '';
  let prueba = String(req.query?.prueba || '') === '1'; // solo lista, no envía
  if (!secreto || auth !== `Bearer ${secreto}`) {
    // Desde la app, alguien del equipo puede ver qué recordatorios saldrían (nunca enviar)
    const eq = auth.startsWith('Bearer ') ? await fetch(SB + '/rest/v1/rpc/es_equipo', { method: 'POST', headers: { apikey: KEY, Authorization: auth, 'Content-Type': 'application/json' }, body: '{}' }) : null;
    if (!eq?.ok || (await eq.json()) !== true) return res.status(401).json({ error: 'No autorizado' });
    prueba = true;
  }
  const srk = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!srk) return res.status(500).json({ error: 'Falta SUPABASE_SERVICE_ROLE_KEY en Vercel' });
  const cronListo = !!secreto;
  const db = (path, init = {}) => fetch(`${SB}/rest/v1/${path}`, { ...init, headers: { apikey: srk, Authorization: `Bearer ${srk}`, 'Content-Type': 'application/json', ...(init.headers || {}) } });

  const vr = await db('vendedores?select=id,nombre,empresa,correo,form_codigo,form_enviado_en&etapa=eq.val_preliminar&form_enviado_en=not.is.null&form_respondido_en=is.null&correo=not.is.null');
  if (!vr.ok) return res.status(500).json({ error: 'No se pudo leer vendedores: ' + vr.status });
  const vendedores = (await vr.json()).filter((v) => v.form_codigo && /@/.test(v.correo || ''));
  if (!vendedores.length) return res.status(200).json({ ok: true, prueba, cronListo, enviados: 0, revisados: 0, pendientes: [] });

  const ar = await db(`actividades?select=vendedor_id,resumen&resumen=like.${encodeURIComponent(MARCA + '*')}&vendedor_id=in.(${vendedores.map((v) => v.id).join(',')})`);
  const previos = {};
  if (ar.ok) for (const a of await ar.json()) previos[a.vendedor_id] = (previos[a.vendedor_id] || 0) + 1;

  const cola = [];
  for (const v of vendedores) {
    const n = previos[v.id] || 0, d = diasDesde(v.form_enviado_en);
    if (n === 0 && d >= 2) cola.push([v, 1]);
    else if (n === 1 && d >= 5) cola.push([v, 2]);
  }
  if (prueba) return res.status(200).json({ ok: true, prueba: true, cronListo, revisados: vendedores.length, pendientes: cola.map(([v, n]) => ({ id: v.id, nombre: v.nombre, empresa: v.empresa, recordatorio: n })) });

  let obtener;
  try { obtener = credenciales(req); } catch (e) { return res.status(500).json({ error: e.message }); }
  if (!obtener) return res.status(500).json({ error: 'Gmail no está conectado' });
  const buzon = ALIAS[REMITENTE];
  const resultado = { ok: true, revisados: vendedores.length, enviados: 0, errores: [] };
  try {
    const { firma, aliasListo } = await firmaGmail((s) => obtener(buzon, s), buzon, REMITENTE);
    if (!aliasListo) return res.status(500).json({ error: `${REMITENTE} no está como "Enviar como" en ${buzon}` });
    const token = await obtener(buzon, SEND_SCOPE);
    for (const [v, n] of cola.slice(0, MAX_POR_CORRIDA)) {
      try {
        const c = correoFormulario(v, n === 1 ? 'r1' : 'r2');
        await entregar(token, mime({ de: REMITENTE, nombreDe: 'Equipo Relevo', para: v.correo.trim(), asunto: c.asunto, texto: c.texto, html: conFirma(c.html, firma || firmaRespaldo()) }), 'enviar');
        await db('actividades', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ vendedor_id: v.id, tipo: 'correo', resumen: `${MARCA} ${n} de 2 del formulario "Cuéntanos tu caso".` }) });
        resultado.enviados++;
      } catch (e) { resultado.errores.push({ id: v.id, error: String(e.message || e) }); }
    }
  } catch (e) { return res.status(500).json({ error: String(e.message || e) }); }
  console.log('seguimientos', JSON.stringify(resultado));
  return res.status(200).json(resultado);
}
