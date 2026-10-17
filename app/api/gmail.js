// Crea un borrador o envía un correo desde Gmail para la app (solo equipo de Relevo).
// Las valoraciones salen desde valoraciones@relevobrokers.com: el servidor usa el buzón que tiene esa dirección como "Enviar como".
import dns from 'node:dns/promises';
import { SB, KEY, DOMINIO, ALIAS, GMAIL_SCOPE, SEND_SCOPE, credenciales, firmaGmail, mime, conFirma, entregar } from './_google.js';
import { revisarCorreo } from './_correo.js';

/** ¿El dominio del correo recibe correo? (registros MX). Evita rebotes por dominios inexistentes. */
async function recibeCorreo(correo) {
  const d = String(correo).split('@')[1];
  try { const mx = await dns.resolveMx(d); if (mx.length) return true; } catch (e) {
    if (e.code === 'ENOTFOUND' || e.code === 'NXDOMAIN') return false; // el dominio no existe
    if (e.code !== 'ENODATA') return true; // si el DNS falla por otra razón, no bloquea
  }
  // Sin MX: algunos servidores reciben por el registro A del dominio
  try { return (await dns.resolve4(d)).length > 0; } catch { return false; }
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Usa POST' });
  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ')) return res.status(401).json({ error: 'Sin sesión' });

  // Quién es: el correo sale de la sesión de Supabase, no de lo que mande el navegador
  const u = await fetch(SB + '/auth/v1/user', { headers: { apikey: KEY, Authorization: auth } });
  const user = u.ok ? await u.json() : null;
  const email = String(user?.email || '').toLowerCase();
  if (!email.endsWith(DOMINIO)) return res.status(403).json({ error: 'Solo cuentas de Relevo' });
  const eq = await fetch(SB + '/rest/v1/rpc/es_equipo', { method: 'POST', headers: { apikey: KEY, Authorization: auth, 'Content-Type': 'application/json' }, body: '{}' });
  if (!eq.ok || (await eq.json()) !== true) return res.status(403).json({ error: 'No autorizado' });

  let obtener;
  try { obtener = credenciales(req); } catch (e) { return res.status(500).json({ configurado: false, error: e.message }); }
  if (!obtener) return res.status(200).json({ configurado: false, error: 'Falta conectar Gmail (variables GCP_ o GOOGLE_ en Vercel).' });

  const { para, asunto, texto, html, firmaHtml, nombreDe, pdfBase64, pdfNombre, adjuntos, probar, alias, modo } = req.body || {};
  const pedido = String(alias || '').toLowerCase();
  const dueno = ALIAS[pedido] || null;
  const buzon = dueno || email; // con dirección compartida, se redacta en el buzón que la tiene
  try {
    const { firma, aliasListo } = await firmaGmail((s) => obtener(buzon, s), buzon, dueno ? pedido : null);
    if (probar) {
      await obtener(email, GMAIL_SCOPE);
      const alias0 = Object.keys(ALIAS)[0];
      const f0 = await firmaGmail((s) => obtener(ALIAS[alias0], s), ALIAS[alias0], alias0);
      let puedeEnviar = true; try { await obtener(ALIAS[alias0], SEND_SCOPE); } catch { puedeEnviar = false; }
      return res.status(200).json({ configurado: true, ok: true, cuenta: email, firmaGmail: !!f0.firma, alias: alias0, aliasListo: f0.aliasListo, puedeEnviar });
    }
    const rev = revisarCorreo(para);
    if (!rev.ok) return res.status(200).json({ configurado: true, correoMalo: true, error: rev.motivo + (rev.sugerencia ? `. ¿Será ${rev.sugerencia}?` : '') });
    if (!(await recibeCorreo(String(para).trim()))) return res.status(200).json({ configurado: true, correoMalo: true, error: `El dominio de ${String(para).trim()} no existe o no recibe correos. Corrige el correo en la ficha.` });
    if (dueno && !aliasListo) return res.status(200).json({ configurado: true, error: `${pedido} no está como "Enviar como" en el Gmail de ${dueno}.` });
    const desde = dueno ? pedido : email;
    const msg = mime({ de: desde, nombreDe: nombreDe || desde, para: String(para).trim(), asunto: asunto || 'Relevo', texto: texto || '', html: conFirma(html, firma || firmaHtml), adjunto: pdfBase64 ? { base64: pdfBase64, nombre: pdfNombre || 'documento.pdf' } : null, adjuntos: Array.isArray(adjuntos) ? adjuntos.slice(0, 5) : [] });
    const token = await obtener(buzon, modo === 'enviar' ? SEND_SCOPE : GMAIL_SCOPE);
    const j = await entregar(token, msg, modo);
    return res.status(200).json({ configurado: true, ok: true, id: j.id, enviado: modo === 'enviar', desde, url: modo === 'enviar' ? null : `https://mail.google.com/mail/u/${encodeURIComponent(buzon)}/#drafts` });
  } catch (e) {
    if (e.code === 'google_auth' && modo === 'enviar') return res.status(200).json({ configurado: 'pendiente', error: 'Falta el permiso para enviar: agrega https://www.googleapis.com/auth/gmail.send a la delegación de dominio en admin.google.com. ' + e.message });
    return res.status(e.code === 'google_auth' ? 200 : 500).json({ configurado: e.code !== 'google_auth' ? true : 'pendiente', error: String(e.message || e) });
  }
}
