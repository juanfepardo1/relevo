// Aviso por correo de cada lead nuevo, enviado desde el Gmail de Relevo.
// Lo llama un Database Webhook de Supabase (INSERT en public.leads) con el header x-webhook-secret.
// Además reporta el lead a Meta por la API de conversiones (solo vendedores que lo autorizaron en el formulario).
// Variables en Vercel: GMAIL_APP_PASSWORD, WEBHOOK_SECRET, META_CAPI_TOKEN.
// Opcionales: GMAIL_USER, META_PIXEL_ID, META_API_VERSION, META_TEST_EVENT_CODE.
// Los avisos siempre llegan a NOTIFY_TO (buzón de Relevo en Google Workspace).
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const PIXEL_ID = process.env.META_PIXEL_ID || '978272748640225';
const API_VERSION = process.env.META_API_VERSION || 'v25.0';

const sha = (v) => crypto.createHash('sha256').update(v).digest('hex');

function capiEvent(r) {
  if (r.kind !== 'seller' || !/Meta/.test(r.consent_text || '')) return null;
  const user_data = { country: [sha('co')] };
  const email = String(r.email || '').trim().toLowerCase();
  if (email) user_data.em = [sha(email)];
  let ph = String(r.phone || '').replace(/\D/g, '');
  if (ph.length === 10 && ph.startsWith('3')) ph = '57' + ph;
  if (ph) user_data.ph = [sha(ph)];
  if (r.user_agent) user_data.client_user_agent = r.user_agent;
  const created = r.created_at ? Math.floor(new Date(r.created_at).getTime() / 1000) : Math.floor(Date.now() / 1000);
  try {
    const fbclid = new URL(r.landing_url).searchParams.get('fbclid');
    if (fbclid) user_data.fbc = `fb.1.${created * 1000}.${fbclid}`;
  } catch (e) {}
  return {
    event_name: 'Lead',
    event_time: created,
    event_id: r.id,
    action_source: 'website',
    event_source_url: r.landing_url || 'https://relevo-murex.vercel.app/vender',
    user_data,
    custom_data: { content_name: 'vendedor', utm_content: r.utm_content || undefined },
  };
}

async function sendCapi(r) {
  const ev = capiEvent(r);
  if (!ev || !process.env.META_CAPI_TOKEN) return 'skipped';
  const body = { data: [ev] };
  if (process.env.META_TEST_EVENT_CODE) body.test_event_code = process.env.META_TEST_EVENT_CODE;
  const resp = await fetch(`https://graph.facebook.com/${API_VERSION}/${PIXEL_ID}/events?access_token=${encodeURIComponent(process.env.META_CAPI_TOKEN)}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  if (!resp.ok) throw new Error(`capi ${resp.status} ${(await resp.text()).slice(0, 300)}`);
  return 'sent';
}
const GMAIL_USER = process.env.GMAIL_USER || 'relevobrokers@gmail.com';
const NOTIFY_TO = 'felipe@relevobrokers.com';

const HOT = ['En los próximos 6 meses', 'Entre 6 y 24 meses'];

// Identificadores de anuncio que Meta pone en utm_content, y los nombres que usamos al crear los enlaces.
const ADS = {
  '52522834119232': 'A (Valoración)', a_valoracion: 'A (Valoración)',
  '52522996494632': 'B (Reserva)', b_reserva: 'B (Reserva)',
  '52522996494832': 'C (Relevo)', c_relevo: 'C (Relevo)',
  '52522996495032': 'D (Oferta)', d_oferta: 'D (Oferta)',
};
const SOURCES = { ig: 'Instagram', fb: 'Facebook', meta: 'Meta' };
const adName = (v) => (v ? ADS[v] || `Otro (${v})` : 'Sin anuncio (llegó directo)');

const esc = (v) =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function waLink(phone) {
  let d = String(phone || '').replace(/\D/g, '');
  if (d.length === 10 && d.startsWith('3')) d = '57' + d;
  return d.length >= 11 ? `https://wa.me/${d}` : null;
}

function build(r) {
  const seller = r.kind === 'seller';
  const qualified = seller && r.sales_range && !['<1000', 'lt1000'].includes(r.sales_range);
  const hot = qualified && HOT.includes(r.timing);
  const tag = hot ? 'CALIENTE' : qualified ? 'CALIFICADO' : seller ? 'No califica' : 'Comprador';

  const subject = seller
    ? `[${tag}] Vendedor: ${r.sector || 'sin sector'}, ventas ${r.sales_range || '?'}, ${r.city || 'sin ciudad'}`
    : `[Comprador] ${r.buyer_type || 'sin tipo'}, presupuesto ${r.budget || '?'}`;

  const rows = (seller
    ? [
        ['Nombre', r.name], ['Rol', r.role], ['Empresa', r.company], ['Ciudad', r.city], ['Sector', r.sector],
        ['Ventas último año (COP millones)', r.sales_range], ['Cuándo quiere vender', r.timing],
      ]
    : [['Nombre', r.name], ['Rol', r.role], ['Tipo de comprador', r.buyer_type], ['Presupuesto', r.budget]]
  ).concat([
    ['WhatsApp', r.phone], ['Correo', r.email], ['Prefiere contacto por', r.contact_channel],
    ['Anuncio', adName(r.utm_content)], ['Red', SOURCES[r.utm_source] || r.utm_source],
  ]);

  const wa = waLink(r.phone);
  const html =
    `<div style="font:15px/1.5 Arial,sans-serif;color:#131f33;max-width:560px">` +
    `<p style="font-size:18px;margin:0 0 12px"><b>${esc(tag)}</b> · ${seller ? 'nuevo vendedor' : 'nuevo comprador'}</p>` +
    `<table style="border-collapse:collapse;width:100%">` +
    rows
      .filter(([, v]) => v)
      .map(([k, v]) => `<tr><td style="padding:6px 12px 6px 0;color:#4b5567;vertical-align:top">${esc(k)}</td><td style="padding:6px 0">${esc(v)}</td></tr>`)
      .join('') +
    `</table>` +
    (wa ? `<p style="margin:16px 0 0"><a href="${wa}" style="background:#f08a4b;color:#131f33;padding:10px 16px;border-radius:4px;text-decoration:none;font-weight:bold">Escribir por WhatsApp</a></p>` : '') +
    `<p style="color:#4b5567;font-size:13px;margin:20px 0 0">Prometimos responder en menos de 48 horas.</p></div>`;

  const text = rows.filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join('\n') + (wa ? `\n\nWhatsApp: ${wa}` : '');
  return { subject, html, text };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const secret = process.env.WEBHOOK_SECRET;
  if (!secret || req.headers['x-webhook-secret'] !== secret) return res.status(401).end();

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
  const r = body.record;
  if (body.type !== 'INSERT' || body.table !== 'leads' || !r) return res.status(200).json({ skipped: true });

  const { subject, html, text } = build(r);
  const sendMail = async () => {
    const transport = nodemailer.createTransport({
      host: 'smtp.gmail.com', port: 465, secure: true,
      auth: { user: GMAIL_USER, pass: (process.env.GMAIL_APP_PASSWORD || '').replace(/\s/g, '') },
    });
    await transport.sendMail({
      from: `Relevo Leads <${GMAIL_USER}>`,
      to: NOTIFY_TO,
      subject, html, text,
    });
  };
  const [mail, capi] = await Promise.allSettled([sendMail(), sendCapi(r)]);
  if (capi.status === 'rejected') console.error('capi', capi.reason && capi.reason.message);
  if (mail.status === 'rejected') {
    console.error('gmail', mail.reason && mail.reason.message);
    return res.status(502).json({ ok: false, capi: capi.status === 'fulfilled' ? capi.value : 'error' });
  }
  return res.status(200).json({ ok: true, capi: capi.status === 'fulfilled' ? capi.value : 'error' });
};

module.exports.build = build;
module.exports.capiEvent = capiEvent;
