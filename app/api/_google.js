// Conexión con Gmail (compartida por /api/gmail y /api/seguimientos). Crea borradores o envía en el Gmail de quien usa la app (felipe@ o alejandro@relevobrokers.com) con un PDF adjunto.
// Usa una cuenta de servicio de Google con delegación de dominio (Google Workspace), con permiso solo para gmail.compose.
// Sin llaves: Vercel se identifica ante Google por OIDC y Google firma por nosotros. (También acepta una llave JSON en
// GOOGLE_SERVICE_ACCOUNT, por si algún día se usa.) Nada de esto llega al navegador.
// Solo crea borradores: nadie recibe nada hasta que la persona lo revise y lo envíe desde Gmail.
import crypto from 'node:crypto';

export const SB = 'https://zxjqixxpyxdyrqaweorn.supabase.co';
export const KEY = 'sb_publishable_zEwtzlpxk2cogjK0KCIMdg_xbPhTNPE';
export const DOMINIO = '@relevobrokers.com';
// Direcciones compartidas desde las que se puede redactar (deben estar como "Enviar como" en el Gmail de quien usa la app).
// Dirección compartida -> buzón que la tiene como "Enviar como" (el servidor redacta en ese buzón).
export const ALIAS = { 'valoraciones@relevobrokers.com': process.env.ALIAS_DUENO || 'felipe@relevobrokers.com' };


export const b64url = (b) => Buffer.from(b).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

export const GMAIL_SCOPE = 'https://www.googleapis.com/auth/gmail.compose';
export const SEND_SCOPE = 'https://www.googleapis.com/auth/gmail.send';
export const FIRMA_SCOPE = 'https://www.googleapis.com/auth/gmail.settings.basic';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
export const errAuth = (msg) => { const e = new Error(msg); e.code = 'google_auth'; return e; };

/** Cambia la afirmación firmada (JWT con sub = usuario) por un token de Gmail de ese usuario. */
async function canjear(assertion) {
  const r = await fetch(TOKEN_URL, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw errAuth(j.error === 'unauthorized_client'
    ? 'Google no ha autorizado la app en tu Workspace. Falta el paso de delegación de dominio en admin.google.com (ID de cliente y permiso gmail.compose).'
    : 'Google rechazó la conexión: ' + (j.error_description || j.error || r.status));
  return j.access_token;
}
const claims = (iss, sub, scope = GMAIL_SCOPE) => { const ahora = Math.floor(Date.now() / 1000); return { iss, sub, scope, aud: TOKEN_URL, iat: ahora, exp: ahora + 3600 }; };

/** Opción 1: llave JSON de la cuenta de servicio (GOOGLE_SERVICE_ACCOUNT). */
export async function conLlave(sa, usuario, scope) {
  const head = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const body = b64url(JSON.stringify(claims(sa.client_email, usuario, scope)));
  const firma = crypto.createSign('RSA-SHA256').update(`${head}.${body}`).sign(sa.private_key);
  return canjear(`${head}.${body}.${b64url(firma)}`);
}

/** Opción 2, sin llave: Vercel se identifica ante Google (OIDC + Workload Identity Federation) y Google firma el JWT. */
export async function sinLlave(req, usuario, scope) {
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
    body: JSON.stringify({ payload: JSON.stringify(claims(sa, usuario, scope)) }),
  });
  const gj = await sg.json().catch(() => ({}));
  if (!sg.ok) throw errAuth('Google no dejó firmar con la cuenta de servicio: ' + (gj.error?.message || sg.status) + '. Revisa el rol "Creador de tokens de cuenta de servicio" y que la API IAM Service Account Credentials esté habilitada.');
  return canjear(gj.signedJwt);
}

/** Firma que el usuario tiene configurada en Gmail. Necesita el permiso gmail.settings.basic en la delegación; si no está, null. */
export async function firmaGmail(obtener, email, preferida) {
  try {
    const token = await obtener(FIRMA_SCOPE);
    const r = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/settings/sendAs', { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) return { firma: null, aliasListo: false };
    const j = await r.json();
    const lista = j.sendAs || [];
    const de = (x) => lista.find((s) => s.sendAsEmail?.toLowerCase() === x);
    // Con dirección compartida solo vale su propia firma: nunca la personal del dueño del buzón.
    const sa = preferida ? de(preferida) : de(email) || lista.find((x) => x.isDefault);
    return { firma: sa?.signature?.trim() || null, aliasListo: !!(preferida && de(preferida)) };
  } catch { return { firma: null, aliasListo: false }; }
}

// Encabezados con tildes y ñ en el asunto o el nombre del archivo
const mimeWord = (s) => (/^[\x20-\x7e]*$/.test(s) ? s : `=?UTF-8?B?${Buffer.from(s).toString('base64')}?=`);
const wrap76 = (s) => s.replace(/.{1,76}/g, '$&\r\n');

export function mime({ de, nombreDe, para, asunto, texto, html, adjunto, adjuntos }) {
  const b1 = 'rlv_' + crypto.randomBytes(8).toString('hex'), b2 = 'rlv_' + crypto.randomBytes(8).toString('hex');
  const partes = [
    `From: ${mimeWord(nombreDe)} <${de}>`, `To: ${para}`, `Reply-To: ${de}`, `Subject: ${mimeWord(asunto)}`, 'MIME-Version: 1.0',
    `Content-Type: multipart/mixed; boundary="${b1}"`, '',
    `--${b1}`, `Content-Type: multipart/alternative; boundary="${b2}"`, '',
    `--${b2}`, 'Content-Type: text/plain; charset="UTF-8"', 'Content-Transfer-Encoding: base64', '', wrap76(Buffer.from(texto).toString('base64')),
    `--${b2}`, 'Content-Type: text/html; charset="UTF-8"', 'Content-Transfer-Encoding: base64', '', wrap76(Buffer.from(html).toString('base64')),
    `--${b2}--`,
  ];
  for (const a of [...(adjunto ? [adjunto] : []), ...(Array.isArray(adjuntos) ? adjuntos : [])]) {
    if (!a?.base64) continue;
    partes.push(`--${b1}`, `Content-Type: application/pdf; name="${mimeWord(a.nombre || 'documento.pdf')}"`, `Content-Disposition: attachment; filename="${mimeWord(a.nombre || 'documento.pdf')}"`, 'Content-Transfer-Encoding: base64', '', wrap76(a.base64));
  }
  partes.push(`--${b1}--`, '');
  return partes.join('\r\n');
}


/** Credenciales: llave JSON o federación sin llave. Devuelve una función que pide un token de un buzón para un permiso. */
export function credenciales(req) {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT;
  const federado = !!(process.env.GCP_PROJECT_NUMBER && process.env.GCP_SERVICE_ACCOUNT_EMAIL);
  if (!raw && !federado) return null;
  let sa = null;
  if (raw) { try { sa = JSON.parse(raw); } catch { throw errAuth('La variable GOOGLE_SERVICE_ACCOUNT no es el JSON de la llave.'); } }
  return (buzon, scope) => (sa ? conLlave(sa, buzon, scope) : sinLlave(req, buzon, scope));
}

/** Pone la firma donde va (<!--FIRMA-->) o al final. */
export const conFirma = (html, firma) => (String(html || '').includes('<!--FIRMA-->') ? String(html).replace('<!--FIRMA-->', firma || '') : String(html || '') + (firma ? `<br><div class="gmail_signature">${firma}</div>` : ''));

/** Envía (o deja en borrador) un mensaje ya armado desde un buzón. */
export async function entregar(token, raw, modo) {
  const url = modo === 'enviar' ? 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send' : 'https://gmail.googleapis.com/gmail/v1/users/me/drafts';
  const r = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(modo === 'enviar' ? { raw: b64url(raw) } : { message: { raw: b64url(raw) } }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((modo === 'enviar' ? 'Gmail no envió el correo: ' : 'Gmail no creó el borrador: ') + (j.error?.message || r.status));
  return j;
}
