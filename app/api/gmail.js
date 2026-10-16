// Crea un borrador en el Gmail de quien usa la app (felipe@ o alejandro@relevobrokers.com) con un PDF adjunto.
// Usa una cuenta de servicio de Google con delegación de dominio (Google Workspace), con permiso solo para gmail.compose.
// Sin llaves: Vercel se identifica ante Google por OIDC y Google firma por nosotros. (También acepta una llave JSON en
// GOOGLE_SERVICE_ACCOUNT, por si algún día se usa.) Nada de esto llega al navegador.
// Solo crea borradores: nadie recibe nada hasta que la persona lo revise y lo envíe desde Gmail.
import crypto from 'node:crypto';

const SB = 'https://zxjqixxpyxdyrqaweorn.supabase.co';
const KEY = 'sb_publishable_zEwtzlpxk2cogjK0KCIMdg_xbPhTNPE';
const DOMINIO = '@relevobrokers.com';


const b64url = (b) => Buffer.from(b).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const GMAIL_SCOPE = 'https://www.googleapis.com/auth/gmail.compose';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const errAuth = (msg) => { const e = new Error(msg); e.code = 'google_auth'; return e; };

/** Cambia la afirmación firmada (JWT con sub = usuario) por un token de Gmail de ese usuario. */
async function canjear(assertion) {
  const r = await fetch(TOKEN_URL, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw errAuth(j.error === 'unauthorized_client'
    ? 'Google no ha autorizado la app en tu Workspace. Falta el paso de delegación de dominio en admin.google.com (ID de cliente y permiso gmail.compose).'
    : 'Google rechazó la conexión: ' + (j.error_description || j.error || r.status));
  return j.access_token;
}
const claims = (iss, sub) => { const ahora = Math.floor(Date.now() / 1000); return { iss, sub, scope: GMAIL_SCOPE, aud: TOKEN_URL, iat: ahora, exp: ahora + 3600 }; };

/** Opción 1: llave JSON de la cuenta de servicio (GOOGLE_SERVICE_ACCOUNT). */
async function conLlave(sa, usuario) {
  const head = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const body = b64url(JSON.stringify(claims(sa.client_email, usuario)));
  const firma = crypto.createSign('RSA-SHA256').update(`${head}.${body}`).sign(sa.private_key);
  return canjear(`${head}.${body}.${b64url(firma)}`);
}

/** Opción 2, sin llave: Vercel se identifica ante Google (OIDC + Workload Identity Federation) y Google firma el JWT. */
async function sinLlave(req, usuario) {
  const num = process.env.GCP_PROJECT_NUMBER, sa = process.env.GCP_SERVICE_ACCOUNT_EMAIL;
  const pool = process.env.GCP_WORKLOAD_IDENTITY_POOL_ID || 'vercel', prov = process.env.GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID || 'vercel';
  const oidc = req.headers['x-vercel-oidc-token'] || process.env.VERCEL_OIDC_TOKEN;
  if (!oidc) throw errAuth('Vercel no entregó el token OIDC. Activa "Secure Backend Access with OIDC Federation" en Settings > Security del proyecto y redespliega.');
  const sts = await fetch('https://sts.googleapis.com/v1/token', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ grantType: 'urn:ietf:params:oauth:grant-type:token-exchange', audience: `//iam.googleapis.com/projects/${num}/locations/global/workloadIdentityPools/${pool}/providers/${prov}`, scope: 'https://www.googleapis.com/auth/cloud-platform', requestedTokenType: 'urn:ietf:params:oauth:token-type:access_token', subjectToken: oidc, subjectTokenType: 'urn:ietf:params:oauth:token-type:jwt' }),
  });
  const sj = await sts.json().catch(() => ({}));
  if (!sts.ok) throw errAuth('Google no aceptó la identidad de Vercel (grupo de identidades): ' + (sj.error_description || sj.error || sts.status));
  const sg = await fetch(`https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${encodeURIComponent(sa)}:signJwt`, {
    method: 'POST', headers: { Authorization: `Bearer ${sj.access_token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ payload: JSON.stringify(claims(sa, usuario)) }),
  });
  const gj = await sg.json().catch(() => ({}));
  if (!sg.ok) throw errAuth('Google no dejó firmar con la cuenta de servicio: ' + (gj.error?.message || sg.status) + '. Revisa el rol "Creador de tokens de cuenta de servicio" y que la API IAM Service Account Credentials esté habilitada.');
  return canjear(gj.signedJwt);
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
  const federado = !!(process.env.GCP_PROJECT_NUMBER && process.env.GCP_SERVICE_ACCOUNT_EMAIL);
  if (!raw && !federado) return res.status(200).json({ configurado: false, error: 'Falta conectar Gmail (variables GCP_PROJECT_NUMBER y GCP_SERVICE_ACCOUNT_EMAIL en Vercel).' });
  let sa = null;
  if (raw) { try { sa = JSON.parse(raw); } catch { return res.status(500).json({ configurado: false, error: 'La variable GOOGLE_SERVICE_ACCOUNT no es el JSON de la llave.' }); } }

  const { para, asunto, texto, html, nombreDe, pdfBase64, pdfNombre, probar } = req.body || {};
  try {
    const token = sa ? await conLlave(sa, email) : await sinLlave(req, email);
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
