// Aviso por correo de cada lead nuevo, enviado desde el Gmail de Relevo.
// Lo llama un Database Webhook de Supabase (INSERT en public.leads) con el header x-webhook-secret.
// Variables en Vercel: GMAIL_APP_PASSWORD, WEBHOOK_SECRET. Opcional: GMAIL_USER.
// Los avisos siempre llegan a NOTIFY_TO (buzón de Relevo en Google Workspace).
const nodemailer = require('nodemailer');
const GMAIL_USER = process.env.GMAIL_USER || 'relevobrokers@gmail.com';
const NOTIFY_TO = 'felipe@relevobrokers.com';

const HOT = ['En los próximos 6 meses', 'Entre 6 y 24 meses'];

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
        ['Nombre', r.name], ['Empresa', r.company], ['Ciudad', r.city], ['Sector', r.sector],
        ['Ventas último año (COP millones)', r.sales_range], ['Cuándo quiere vender', r.timing],
      ]
    : [['Nombre', r.name], ['Tipo de comprador', r.buyer_type], ['Presupuesto', r.budget]]
  ).concat([
    ['WhatsApp', r.phone], ['Correo', r.email], ['Prefiere contacto por', r.contact_channel],
    ['Anuncio (utm_content)', r.utm_content], ['Campaña', r.utm_campaign], ['Fuente', r.utm_source],
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
  try {
    const transport = nodemailer.createTransport({
      host: 'smtp.gmail.com', port: 465, secure: true,
      auth: { user: GMAIL_USER, pass: (process.env.GMAIL_APP_PASSWORD || '').replace(/\s/g, '') },
    });
    await transport.sendMail({
      from: `Relevo Leads <${GMAIL_USER}>`,
      to: NOTIFY_TO,
      subject, html, text,
    });
  } catch (e) {
    console.error('gmail', e && e.message);
    return res.status(502).json({ ok: false });
  }
  return res.status(200).json({ ok: true });
};

module.exports.build = build;
