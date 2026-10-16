// Crea un borrador en el Gmail de quien usa la app (felipe@ o alejandro@relevobrokers.com) con un PDF adjunto.
// Usa una cuenta de servicio de Google con delegación de dominio (Google Workspace), con permiso solo para
// gmail.compose. La llave vive en la variable de entorno GOOGLE_SERVICE_ACCOUNT de Vercel, nunca en el navegador.
// Solo crea borradores: nadie recibe nada hasta que la persona lo revise y lo envíe desde Gmail.
import crypto from 'node:crypto';

const SB = 'https://zxjqixxpyxdyrqaweorn.supabase.co';
const KEY = 'sb_publishable_zEwtzlpxk2cogjK0KCIMdg_xbPhTNPE';
const DOMINIO = '@relevobrokers.com';


const b64url = (b) => Buffer.from(b).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

async function tokenGoogle(sa, usuario) {
  const ahora = Math.floor(Date.now() / 1000);
  const head = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const body = b64url(JSON.stringify({ iss: sa.client_email, sub: usuario, scope: 'https://www.googleapis.com/auth/gmail.compose', aud: 'https://oauth2.googleapis.com/token', iat: ahora, exp: ahora + 3600 }));
  const firma = crypto.createSign('RSA-SHA256').update(`${head}.${body}`).sign(sa.private_key);
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${head}.${body}.${b64url(firma)}` }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    const e = new Error(j.error === 'unauthorized_client'
      ? 'Google no ha autorizado la app en tu Workspace. Falta el paso de delegación de dominio en admin.google.com.'
      : 'Google rechazó la conexión: ' + (j.error_description || j.error || r.status));
    e.code = 'google_auth'; throw e;
  }
  return j.access_token;
}

// Encabezados con tildes y ñ en el asunto o el nombre del archivo
const mimeWord = (s) => (/^[\x20-\x7e]*$/.test(s) ? s : `=?UTF-8?B?${Buffer.from(s).toString('base64')}?=`);
const wrap76 = (s) => s.replace(/.{1,76}/g, '$&\r\n');

function mime({ de, nombreDe, para, asunto, texto, html, adjunto }) {
  const b1 = 'rlv_' + crypto.randomBytes(8).toString('hex'), b2 = 'rlv_' + crypto.randomBytes(8).toString('hex');
  const partes = [
    `From: ${mimeWord(nombreDe)} <${de}>`, `To: ${para}`, `Subject: ${mimeWord(asunto)}`, 'MIME-Version: 1.0',
    `Content-Type: multipart/mixed; boundary="${b1}"`, '',
    `--${b1}`, `Content-Type: multipart/alternative; boundary="${b2}"`, '',
    `--${b2}`, 'Content-Type: text/plain; charset="UTF-8"', 'Content-Transfer-Encoding: base64', '', wrap76(Buffer.from(texto).toString('base64')),
    `--${b2}`, 'Content-Type: text/html; charset="UTF-8"', 'Content-Transfer-Encoding: base64', '', wrap76(Buffer.from(html).toString('base64')),
    `--${b2}--`,
  ];
  if (adjunto) partes.push(`--${b1}`, `Content-Type: application/pdf; name="${mimeWord(adjunto.nombre)}"`, `Content-Disposition: attachment; filename="${mimeWord(adjunto.nombre)}"`, 'Content-Transfer-Encoding: base64', '', wrap76(adjunto.base64));
  partes.push(`--${b1}--`, '');
  return partes.join('\r\n');
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

  const raw = process.env.GOOGLE_SERVICE_ACCOUNT;
  if (!raw) return res.status(200).json({ configurado: false, error: 'Falta conectar Gmail (variable GOOGLE_SERVICE_ACCOUNT en Vercel).' });
  let sa;
  try { sa = JSON.parse(raw); } catch { return res.status(500).json({ configurado: false, error: 'La variable GOOGLE_SERVICE_ACCOUNT no es el JSON de la llave.' }); }

  const { para, asunto, texto, html, nombreDe, pdfBase64, pdfNombre, probar } = req.body || {};
  try {
    const token = await tokenGoogle(sa, email);
    if (probar) return res.status(200).json({ configurado: true, ok: true, cuenta: email });
    if (!para || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(para).trim())) return res.status(400).json({ error: 'Correo de destino inválido' });
    const msg = mime({ de: email, nombreDe: nombreDe || email, para: String(para).trim(), asunto: asunto || 'Relevo', texto: texto || '', html: html || '', adjunto: pdfBase64 ? { base64: pdfBase64, nombre: pdfNombre || 'documento.pdf' } : null });
    const r = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/drafts', {
      method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: { raw: b64url(msg) } }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return res.status(502).json({ configurado: true, error: 'Gmail no creó el borrador: ' + (j.error?.message || r.status) });
    return res.status(200).json({ configurado: true, ok: true, id: j.id, url: `https://mail.google.com/mail/u/${encodeURIComponent(email)}/#drafts` });
  } catch (e) {
    return res.status(e.code === 'google_auth' ? 200 : 500).json({ configurado: e.code !== 'google_auth' ? true : 'pendiente', error: String(e.message || e) });
  }
}
