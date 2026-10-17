// Plantilla de correo de Relevo. La usan la app (vista previa y envío) y los recordatorios automáticos.
// HTML de correo: tablas y estilos en línea para que se vea bien en Gmail, Outlook y el celular.
// <!--FIRMA--> lo reemplaza el servidor con la firma de Gmail (o una de respaldo).

const C = { fondo: '#EAF1FA', tarjeta: '#ffffff', borde: '#dbe5f1', tinta: '#14243D', texto: '#3c4a5e', suave: '#6b7a92', azul: '#2C5186', naranja: '#F47B3D', tinte: '#f4f7fb' };
const FUENTE = "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";
const LOGO = 'https://relevobrokers.com/email/relevo-logo-firma.png';
const TRAZO = 'https://relevobrokers.com/email/relevo-trazo-firma.png';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const p = (t) => `<p style="margin:0 0 16px;font:400 15.5px/1.62 ${FUENTE};color:${C.texto}">${esc(t).replace(/\n/g, '<br>')}</p>`;

/**
 * @param {{ preheader?: string, saludo?: string, parrafos?: string[], despues?: string[], destacado?: { titulo: string, valor: string, nota?: string },
 *           boton?: { texto: string, url: string, nota?: string }, cierre?: string[] }} c
 */
export function correoHtml(c) {
  const destacado = c.destacado ? `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 22px;background:${C.tinte};border-radius:10px">
      <tr><td style="padding:16px 18px;border-left:3px solid ${C.naranja};border-radius:10px">
        <div style="font:600 11px/1.4 ${FUENTE};letter-spacing:.08em;text-transform:uppercase;color:${C.suave}">${esc(c.destacado.titulo)}</div>
        <div style="font:700 22px/1.3 ${FUENTE};color:${C.azul};margin-top:4px">${esc(c.destacado.valor)}</div>
        ${c.destacado.nota ? `<div style="font:400 13px/1.5 ${FUENTE};color:${C.suave};margin-top:4px">${esc(c.destacado.nota)}</div>` : ''}
      </td></tr>
    </table>` : '';
  const boton = c.boton ? `
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:6px 0 ${c.boton.nota ? 8 : 22}px">
      <tr><td style="border-radius:8px;background:${C.naranja}">
        <a href="${esc(c.boton.url)}" style="display:inline-block;padding:14px 26px;font:700 15.5px/1 ${FUENTE};color:${C.tinta};text-decoration:none;border-radius:8px">${esc(c.boton.texto)} &rarr;</a>
      </td></tr>
    </table>
    ${c.boton.nota ? `<p style="margin:0 0 22px;font:400 13px/1.5 ${FUENTE};color:${C.suave}">${esc(c.boton.nota)}</p>` : ''}` : '';
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>Relevo</title></head>
<body style="margin:0;padding:0;background:${C.fondo}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(c.preheader || '')}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.fondo}">
  <tr><td align="center" style="padding:28px 12px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:${C.tarjeta};border:1px solid ${C.borde};border-radius:14px">
      <tr><td style="padding:26px 32px 18px;border-bottom:1px solid ${C.borde}">
        <img src="${LOGO}" width="118" height="22" alt="Relevo" style="display:block;border:0;width:118px;height:auto">
      </td></tr>
      <tr><td style="padding:28px 32px 8px">
        ${c.saludo ? `<h1 style="margin:0 0 6px;font:700 22px/1.3 ${FUENTE};color:${C.tinta}">${esc(c.saludo)}</h1>
        <img src="${TRAZO}" width="76" height="10" alt="" style="display:block;border:0;width:76px;height:auto;margin:0 0 18px">` : ''}
        ${(c.parrafos || []).map(p).join('')}
        ${destacado}
        ${(c.despues || []).map(p).join('')}
        ${boton}
        ${(c.cierre || []).map(p).join('')}
        <div style="margin:22px 0 26px;font:400 14px/1.5 ${FUENTE};color:${C.texto}"><!--FIRMA--></div>
      </td></tr>
    </table>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px">
      <tr><td style="padding:18px 32px;font:400 12px/1.6 ${FUENTE};color:${C.suave};text-align:center">
        Relevo Brokers S.A.S. &middot; NIT 902.117.149-4 &middot; Bogotá, Colombia<br>
        <a href="https://relevobrokers.com" style="color:${C.suave}">relevobrokers.com</a> &middot; Recibes este correo porque pediste una valoración en Relevo.
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

/** Firma de respaldo si Gmail no deja leer la configurada. */
export function firmaRespaldo(nombre) {
  return `<div style="font:700 14px/1.4 ${FUENTE};color:${C.tinta}">${esc(nombre)}</div><div style="font:400 13.5px/1.5 ${FUENTE};color:${C.suave}">Equipo Relevo &middot; <a href="https://relevobrokers.com" style="color:${C.azul}">relevobrokers.com</a></div>`;
}

/** Convierte el texto editable de la app (párrafos separados por línea en blanco) en el correo con diseño.
 *  La primera URL se vuelve botón; el saludo ("Hola X,") se separa como título. */
export function correoDesdeTexto(texto, extra = {}) {
  const bloques = String(texto || '').split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
  let saludo = '';
  const m = bloques[0]?.match(/^(Hola[^,.\n]*)[,.]\s*([\s\S]*)$/);
  if (m) { saludo = m[1] + ','; bloques[0] = m[2].charAt(0).toUpperCase() + m[2].slice(1); if (!bloques[0]) bloques.shift(); }
  const parrafos = [], cierre = [];
  let boton = null;
  for (const b of bloques) {
    const u = b.match(/https?:\/\/\S+/);
    if (u && !boton) {
      const antes = b.slice(0, u.index).trim(), despues = b.slice(u.index + u[0].length).trim();
      if (antes) parrafos.push(antes);
      boton = { texto: extra.boton || 'Contar mi caso', url: u[0], nota: extra.notaBoton };
      if (despues) cierre.push(despues);
    } else (boton ? cierre : parrafos).push(b);
  }
  // El rango destacado va justo después del primer párrafo (el que lo presenta)
  return correoHtml({ preheader: extra.preheader, saludo, parrafos: parrafos.slice(0, 1), destacado: extra.destacado, despues: parrafos.slice(1), boton, cierre });
}

/* Nombres como los escribió el lead: a veces vienen mal o vacíos. Si no se ven bien, mejor no usarlos. */
const TITULOS = new Set(['sr', 'sra', 'srta', 'don', 'dona', 'doña', 'dr', 'dra', 'ing', 'lic', 'arq']);
const NO_NOMBRE = new Set(['gerencia', 'gerente', 'admin', 'administracion', 'administración', 'info', 'contacto', 'ventas', 'empresa', 'prueba', 'test', 'na', 'ninguno', 'usuario', 'cliente', 'propietario', 'dueno', 'dueño']);
const NO_EMPRESA = /^((una|mi|la|nuestra) empresa.*|(una|mi) (compañía|compania|firma|sociedad|negocio).*|n\/?a|no|ninguna|ninguno|empresa|privad[ao]|confidencial|prueba|test|x+|\.+|-+|sin nombre|no aplica|reservad[ao]|educaci[oó]n|salud|comercio|transporte|construcci[oó]n|servicios|restaurante|alimentos|tecnolog[ií]a|agro|manufactura|log[ií]stica|turismo|retail)$/i;
const titulo = (w) => (w.length <= 3 && w === w.toUpperCase() && /[A-ZÁÉÍÓÚÑ]/.test(w) ? w : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());

/** Primer nombre presentable, o '' si no se ve confiable. */
export function nombrePila(n) {
  const ws = String(n ?? '').replace(/^[^\p{L}]+/u, '').replace(/^PRUEBA\s+/i, '').trim().split(/\s+/).filter(Boolean);
  while (ws.length && TITULOS.has(ws[0].replace(/\./g, '').toLowerCase())) ws.shift();
  const w = ws[0] || '';
  if (!/^[\p{L}'’]{2,20}$/u.test(w) || NO_NOMBRE.has(w.toLowerCase())) return '';
  return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
}

/** Nombre de empresa presentable (sin S.A.S, sin mayúsculas sostenidas), o '' si no se ve confiable. */
export function empresaLimpia(e){
  let t = String(e ?? '').replace(/^[^\p{L}\p{N}]+/u, '').replace(/^PRUEBA\s+/i, '').replace(/\(.*?\)/g, '').replace(/[*]+/g, '').split(/[,;|]/)[0].trim();
  t = t.replace(/\s+(s\.?\s?a\.?\s?s\.?|s\.?\s?a\.?|ltda\.?|e\.?\s?u\.?|s\.?\s?en\s?c\.?|bic)\.?$/i, '').replace(/\s+(s\.?\s?a\.?\s?s\.?)$/i, '').trim();
  if (t.length < 3 || t.length > 60 || NO_EMPRESA.test(t) || /@|https?:|www\./i.test(t) || !/\p{L}/u.test(t)) return '';
  if (t === t.toUpperCase()) t = t.split(/\s+/).map(titulo).join(' ');
  return t;
}
