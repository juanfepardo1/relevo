// PDF de 3 páginas de la valoración flash. Mismo diseño y texto del artefacto de Alejandro.
// Se dibuja en un iframe aislado (para que los estilos de la app no lo toquen) y se pasa a PDF con html2canvas + jsPDF.
import { type Lead, type Resultado, type Supuestos, money, dec, cleanName, shortName, TRAMO_TEXTO } from './motor';

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

const SECTOR_CARD: Record<string, [string, string]> = {
  'Alimentos y Bebidas': ['Tus clientes fijos no aparecen', 'Si vendes a cadenas, distribuidores o clientes que repiten cada mes, ese ingreso recurrente vale más que una venta suelta. Un comprador lo paga.'],
  'Manufactura': ['Tu capacidad instalada no se ve', 'La maquinaria, la planta y los contratos de suministro firmados son difíciles de replicar. Un comprador los valora aunque no estén en este cálculo.'],
  'Distribución y Comercio': ['Tus contratos de distribución pesan', 'Las exclusividades con marcas y la red de clientes que ya atiendes son lo primero que mira un comprador del sector.'],
  'Salud y Farmacias': ['Tus habilitaciones tienen valor', 'Licencias, registros y habilitaciones toman años en conseguirse. Para un comprador son una razón para pagar más.'],
  'Educación': ['Tus estudiantes se renuevan', 'La matrícula que se repite cada año es un ingreso recurrente, y los ingresos recurrentes se pagan mejor.'],
  'Logística y Transporte': ['Tu flota y tus rutas no aparecen', 'Los contratos de largo plazo con clientes y la flota propia o habilitada cambian mucho el valor para un comprador.'],
  'Construcción': ['Tus contratos en curso no aparecen', 'Los proyectos ya firmados son ingresos de los próximos años. Este cálculo no los ve, y un comprador sí los tiene en cuenta.'],
  'Servicios a Empresas': ['Tus contratos recurrentes no aparecen', 'Si tus clientes pagan cada mes o tienen contratos de varios años, ese flujo vale más que el margen promedio del sector.'],
  'Otro': ['Lo que hace única a tu empresa', 'Este cálculo usa un promedio general. Lo que diferencia a tu negocio de otros parecidos solo aparece cuando vemos tus números.'],
};
const GUILLOCHE = `<svg class="cta__g" viewBox="0 0 520 520" aria-hidden="true">${Array.from({ length: 18 }, (_, i) => `<ellipse cx="260" cy="260" rx="250" ry="${70 + i * 10}" transform="rotate(${i * 10} 260 260)"/>`).join('')}</svg>`;
const CHECK = `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9.5"/><path class="acc" d="M7.5 12.5l3 3 6-6.5"/></svg>`;

// Archivo viene ya fijado al 92 % de ancho (el canvas no sabe aplicar font-stretch); así el PDF sale igual a la vista previa.
const FONTS = `@font-face{font-family:"RlvArchivo";font-style:normal;font-weight:100 900;src:url(/flash/archivo92.woff2) format("woff2")}
@font-face{font-family:"RlvHanken";font-style:normal;font-weight:100 900;src:url(/flash/hanken.woff2) format("woff2")}
@font-face{font-family:"RlvHanken";font-style:italic;font-weight:100 900;src:url(/flash/hanken-italic.woff2) format("woff2")}`;

/** html2canvas dibuja en el documento principal: las fuentes tienen que existir también ahí. */
async function fuentesEnDocumento() {
  if (!document.getElementById('rlv-flash-fonts')) { const st = document.createElement('style'); st.id = 'rlv-flash-fonts'; st.textContent = FONTS; document.head.appendChild(st); }
  await Promise.all(['400 16px RlvHanken', '500 16px RlvHanken', '600 16px RlvHanken', 'italic 400 16px RlvHanken', '700 16px RlvArchivo'].map((f) => document.fonts.load(f)));
}

const CSS = `
${FONTS}
:root{--font-display:"RlvArchivo","Arial Narrow",system-ui,sans-serif;--font-sans:"RlvHanken",system-ui,sans-serif;
--pdf-paper:#fafaf8;--pdf-surface:#ffffff;--pdf-ink:#131f33;--pdf-ink-2:#4b5567;--pdf-line:#e7e4de;
--pdf-blue:#26497c;--pdf-on-blue:#f6f3ec;--pdf-on-blue-2:#c6d2e4;--pdf-line-on-blue:#41659b;
--pdf-orange:#f08a4b;--pdf-orange-deep:#df6f30;--pdf-blue-tint:#e8eef7;--pdf-paper-2:#f2f2ef}
html,body{margin:0;padding:0;background:#fafaf8}
.page{box-sizing:border-box;width:816px;height:1056px;overflow:hidden;background:var(--pdf-paper);color:var(--pdf-ink);font-family:var(--font-sans);font-variant-numeric:tabular-nums;position:relative;-webkit-font-smoothing:antialiased}
.page *{box-sizing:border-box}
.pd{font-family:var(--font-display);font-weight:700;letter-spacing:-0.028em;margin:0;color:var(--pdf-ink)}
.cover{background:var(--pdf-blue);color:var(--pdf-on-blue)}
.cover__logo{position:absolute;top:58px;left:0;right:0;display:flex;justify-content:center}
.cover__logo img{height:34px;width:auto}
.cover__body{position:absolute;top:268px;left:80px;right:80px;display:grid;justify-items:center;text-align:center;gap:0}
.cover h1{color:var(--pdf-on-blue);font-size:64px;line-height:1.02;letter-spacing:-0.032em}
.cover__rule{width:218px;height:10px;margin:26px 0 30px}
.cover p{margin:0;max-width:600px;font-size:17px;line-height:1.6;color:var(--pdf-on-blue-2)}
.cover__date{margin-top:28px;display:inline-flex;align-items:center;height:40px;padding:0 20px;background:var(--pdf-orange);color:#131f33;border-radius:4px;font:600 15px var(--font-sans);box-shadow:0 0 0 1px var(--pdf-orange),0 0 0 3px var(--pdf-blue),0 0 0 4px var(--pdf-on-blue-2)}
.cover__art{position:absolute;left:0;right:0;bottom:22px;height:232px}
.cover__art img{display:block;width:816px;height:232px}
.p2{padding:44px 72px 60px;display:flex;flex-direction:column}
.p2>*{flex-shrink:0}
.p2 h2.pd{font-size:34px;line-height:1.06;max-width:660px}
.lead{margin:12px 0 0;font-size:15px;line-height:1.6;color:var(--pdf-ink-2);max-width:640px}
.p2__top{margin-top:24px;display:grid;grid-template-columns:330px 1fr;gap:32px;align-items:stretch}
.vbox{border:1px solid var(--pdf-line);background:var(--pdf-surface);border-radius:6px;padding:22px 22px 20px;display:grid;gap:6px;align-content:start}
.vbox__label{font-size:13.5px;color:var(--pdf-ink-2)}
.vbox__num{font-family:var(--font-display);font-weight:700;letter-spacing:-0.025em;color:var(--pdf-ink);line-height:1.02}
.vbox__num small{display:block;font-size:16px;font-family:var(--font-sans);font-weight:500;color:var(--pdf-ink-2);letter-spacing:0}
.vbox__num strong{display:block;font-size:32px;font-weight:700;white-space:nowrap}
.vbox__scale{position:relative;height:8px;margin:12px 0 4px;background:var(--pdf-paper-2);border:1px solid var(--pdf-line);border-radius:4px}
.vbox__scale i{position:absolute;top:-1px;bottom:-1px;background:var(--pdf-blue);border-radius:4px}
.vbox__ends{display:flex;justify-content:space-between;font-size:11.5px;color:var(--pdf-ink-2)}
.vbox__note{margin:8px 0 0;font-size:12.5px;line-height:1.5;color:var(--pdf-ink-2)}
.stats{display:grid;gap:0;align-content:space-between}
.stat{display:grid;gap:2px;padding:9px 0;border-bottom:1px solid var(--pdf-line)}
.stat:first-child{padding-top:4px}
.stat:last-child{border-bottom:0}
.stat b{font-family:var(--font-display);font-weight:700;font-size:23px;letter-spacing:-0.02em;line-height:1.05;color:var(--pdf-ink)}
.stat span{font-size:13.5px;color:var(--pdf-ink-2);line-height:1.4}
.p2 h3.pd{margin-top:20px;font-size:24px;letter-spacing:-0.02em}
.cards{margin-top:14px;display:grid;grid-template-columns:repeat(3,1fr);gap:14px}
.card{border:1px solid var(--pdf-line);background:var(--pdf-surface);border-radius:6px;padding:16px;display:grid;gap:8px;align-content:start;position:relative}
.card::before{content:"";position:absolute;left:18px;top:0;width:28px;height:3px;background:var(--pdf-orange-deep)}
.card h4{margin:6px 0 0;font:600 15.5px/1.3 var(--font-sans);color:var(--pdf-ink)}
.card p{margin:0;font-size:12.4px;line-height:1.5;color:var(--pdf-ink-2)}
.closing{margin:12px 0 14px;font-size:13.5px;line-height:1.55;font-style:italic;color:var(--pdf-ink);max-width:660px}
.fine{margin-top:auto;display:grid;gap:8px;padding-top:14px;border-top:1px solid var(--pdf-line)}
.fine p{margin:0;font-size:10.6px;line-height:1.5;color:var(--pdf-ink-2)}
.fine b{color:var(--pdf-ink);font-weight:600}
.foot{position:absolute;left:72px;right:72px;bottom:28px;display:flex;justify-content:space-between;align-items:center;font-size:11.5px;color:var(--pdf-ink-2)}
.foot img{height:15px;width:auto}
.p3{padding:64px 72px 0}
.p3 h2.pd{font-size:44px;line-height:1.04;max-width:620px}
.checks{margin:28px 0 0;padding:0;list-style:none;display:grid;grid-template-columns:1fr 1fr;gap:14px 28px}
.checks li{display:grid;grid-template-columns:22px 1fr;gap:12px;font-size:15px;line-height:1.45;color:var(--pdf-ink)}
.checks svg{width:22px;height:22px;stroke:var(--pdf-blue);fill:none;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round}
.checks svg .acc{stroke:var(--pdf-orange-deep)}
.p3 h3.pd{margin-top:44px;font-size:26px;letter-spacing:-0.02em}
.steps{margin-top:16px;display:grid;grid-template-columns:repeat(3,1fr);gap:14px}
.step{border:1px solid var(--pdf-line);background:var(--pdf-surface);border-radius:6px;padding:20px;display:grid;gap:8px;align-content:start}
.step__n{width:30px;height:30px;display:grid;place-items:center;border-radius:50%;background:var(--pdf-blue-tint);color:var(--pdf-blue);font:700 15px var(--font-display)}
.step h4{margin:4px 0 0;font:600 16px/1.3 var(--font-sans);color:var(--pdf-ink)}
.step p{margin:0;font-size:13px;line-height:1.5;color:var(--pdf-ink-2)}
.cta{position:absolute;left:0;right:0;bottom:84px;background:var(--pdf-blue);color:var(--pdf-on-blue);padding:40px 72px;overflow:hidden}
.cta__g{position:absolute;right:-160px;top:50%;width:520px;height:520px;margin-top:-260px;opacity:.18}
.cta__g ellipse{fill:none;stroke:var(--pdf-on-blue);stroke-width:.7}
.cta__in{position:relative;display:grid;gap:10px;max-width:520px}
.cta h3{color:var(--pdf-on-blue);font-size:30px;line-height:1.05;letter-spacing:-0.025em}
.cta p{margin:0;font-size:14.5px;line-height:1.55;color:var(--pdf-on-blue-2)}
.cta__btn{justify-self:start;margin-top:10px;display:inline-flex;align-items:center;height:44px;padding:0 20px;background:var(--pdf-orange);color:#131f33;border-radius:4px;font:600 15px var(--font-sans)}
`;

export function paginas(A: Supuestos, L: Lead, r: Resultado, hoy = new Date()): string[] {
  const fecha = MESES[hoy.getMonth()].replace(/^./, (c) => c.toUpperCase()) + ' de ' + hoy.getFullYear();
  const empresa = cleanName(L.empresa);
  const usable = empresa && !r.sinNombre;
  const corto = usable ? shortName(empresa) : 'tu empresa';
  const titulo = corto === 'tu empresa' ? 'Una primera mirada al valor de tu empresa' : `Una primera mirada al valor de ${corto}`;
  const quien = usable ? esc(empresa) : 'tu empresa';
  const maxScale = Math.max(1000, Math.ceil(r.hi * 1.25 / 500) * 500);
  const left = (r.lo / maxScale * 100).toFixed(1), right = (100 - r.hi / maxScale * 100).toFixed(1);
  const ventasStat = TRAMO_TEXTO[L.ventas] || '';
  const margenStat = `${dec(r.mLo, 0)}%`;
  const multStat = Math.abs(r.xLo - r.xHi) < 0.05 ? `${dec(r.xLo, 1)} veces` : `${dec(r.xLo, 1)} a ${dec(r.xHi, 1)} veces`;
  const card1 = SECTOR_CARD[L.sector] || SECTOR_CARD['Otro'];
  const logoAzul = `<img src="/flash/logo-azul.svg" alt="Relevo">`;
  const logoFoot = `<img src="/flash/logo-claro.svg" alt="Relevo">`;
  const queSector = r.sub && !r.excluido ? r.sub.nombre.replace(/\s*\(.*\)$/, '').replace(/^./, (c) => c.toLowerCase()) : (L.sector === 'Otro' ? 'una pyme colombiana' : L.sector.toLowerCase());

  const p1 = `<div class="page cover">
    <div class="cover__logo">${logoAzul}</div>
    <div class="cover__body">
      <h1 class="pd">${esc(titulo)}</h1>
      <svg class="cover__rule" viewBox="0 0 218 10" aria-hidden="true"><path d="M2 6c40-3 120-4 214-3" stroke="#f08a4b" stroke-width="2.4" fill="none" stroke-linecap="round"/><path d="M8 9c50-2 110-3 200-2" stroke="#f08a4b" stroke-width="1" fill="none" stroke-linecap="round" opacity=".7"/></svg>
      <p>Valoración express de ${quien}, hecha con el sector y el rango de ventas que nos compartiste en el formulario.</p>
      <span class="cover__date">${fecha}</span>
    </div>
    <div class="cover__art"><img src="/flash/portada.png" alt="" width="816" height="232"></div>
  </div>`;

  const p2 = `<div class="page p2">
    <h2 class="pd"${corto.length > 22 ? ' style="font-size:29px"' : ''}>La operación de ${corto === 'tu empresa' ? 'tu empresa' : esc(corto)} puede valer entre ${money(r.lo)} y ${money(r.hi)} millones</h2>
    <p class="lead">Es una referencia general, hecha con el sector y las ventas que compartiste y con lo que se paga hoy por empresas de tamaño parecido. No incluye las deudas ni la caja de la empresa.</p>
    <div class="p2__top">
      <div class="vbox">
        <span class="vbox__label">Valor de la operación, antes de deudas</span>
        <div class="vbox__num"><small>Entre</small><strong>${money(r.lo)} y ${money(r.hi)}</strong><small>millones</small></div>
        <div class="vbox__scale"><i style="left:${left}%;right:${right}%"></i></div>
        <div class="vbox__ends"><span>$0</span><span>${money(maxScale)} millones</span></div>
        <p class="vbox__note">Es lo que vale el negocio en marcha. Lo que recibe el dueño en una venta depende además de las deudas y la caja que tenga la empresa ese día.</p>
      </div>
      <div class="stats">
        <div class="stat"><b>${esc(ventasStat)}</b><span>Ventas del último año, según el formulario</span></div>
        <div class="stat"><b>${margenStat}</b><span>Margen de operación típico de ${esc(queSector)}</span></div>
        <div class="stat"><b>${multStat}</b><span>Lo que suele pagarse por la utilidad de una empresa de este tamaño</span></div>
      </div>
    </div>
    <h3 class="pd">Por qué tu empresa podría valer más</h3>
    <div class="cards">
      <div class="card"><h4>${esc(card1[0])}</h4><p>${esc(card1[1])}</p></div>
      <div class="card"><h4>Usamos un margen típico, no el tuyo</h4><p>Si tu empresa gana más que el promedio de su sector, su valor está por encima de este rango. Ese dato solo aparece en tus estados financieros.</p></div>
      <div class="card"><h4>No vemos los gastos del dueño</h4><p>En muchas pymes, el salario del dueño y algunos gastos personales pasan por la empresa. Al ajustarlos, la utilidad real suele ser mayor.</p></div>
    </div>
    ${r.conservador ? `<p class="closing"><b>Este rango es conservador.</b> ${r.conservador === 'sector'
      ? 'Lo calculamos solo con el rango de ventas del formulario y el margen promedio de una pyme colombiana, porque todavía no conocemos el detalle de tu actividad. Si tu empresa gana más que ese promedio, su valor está por encima.'
      : 'Lo calculamos solo con el rango de ventas del formulario y el margen típico de tu sector, y en empresas de este tamaño los compradores pagan múltiplos más bajos. Con tus cifras reales el valor puede ser mayor.'}</p>` : `<p class="closing">El valor final de una empresa depende de sus cifras reales, de sus deudas y de lo que un comprador esté dispuesto a pagar por ella. Este rango te da una primera idea de dónde está ${quien} hoy.</p>`}
    <div class="fine">
      <p><b>Método.</b> Utilidad de operación estimada (ventas del formulario por el margen típico del sector) multiplicada por lo que se paga por empresas de tamaño similar: ${dec(A.ladder[0].mult, 1)} a ${dec(A.ladder[A.ladder.length - 1].mult, 1)} veces según el tamaño, con ajuste por sector. Es el valor de la operación: no resta la deuda financiera ni suma la caja. Cifras en pesos colombianos.</p>
      <p><b>Aviso.</b> Este documento es una valoración express y tentativa, hecha solo con la información que compartiste en el formulario. No reemplaza una valoración completa ni constituye una oferta de compra.</p>
    </div>
    <div class="foot"><span>${logoFoot}</span><span>Valoración express</span></div>
  </div>`;

  // Primer punto corregido: guardamos el nombre y el contacto en nuestra base, así que no prometemos lo contrario.
  const checks = ['Tu empresa no se muestra a ningún comprador sin tu permiso.', 'Los compradores solo ven el sector, el tamaño y la ciudad, nunca el nombre.', 'No tiene costo ni te compromete a nada.', 'Si un comprador busca una empresa como la tuya, te escribimos.'];
  const p3 = `<div class="page p3">
    <h2 class="pd">Tu empresa queda en nuestra lista confidencial</h2>
    <p class="lead">Tu empresa ya hace parte de nuestra base confidencial. Desde ahora la tenemos en cuenta cada vez que un comprador nos cuenta qué tipo de empresa busca.</p>
    <ul class="checks">${checks.map((c) => `<li>${CHECK}<span>${c}</span></li>`).join('')}</ul>
    <h3 class="pd">Cómo funciona la lista</h3>
    <div class="steps">${[['Quedas en la lista', 'Guardamos los datos de tu empresa en una base privada. A los compradores solo les contamos el sector, el tamaño y la ciudad.'], ['Llega un comprador', 'Cada comprador nos dice qué tipo de empresa busca, y revisamos la lista con cada uno.'], ['Te escribimos', 'Si tu empresa encaja, te contactamos y tú decides si empezamos la valoración y la venta.']].map((s, i) => `<div class="step"><span class="step__n">${i + 1}</span><h4>${esc(s[0])}</h4><p>${esc(s[1])}</p></div>`).join('')}</div>
    <div class="cta">${GUILLOCHE}<div class="cta__in"><h3 class="pd">No tienes que hacer nada más</h3><p>Si un comprador busca una empresa con las características de la tuya, te escribimos para iniciar el proceso de valoración y venta.</p><span class="cta__btn">Ya estás en la lista</span></div></div>
    <div class="foot"><span>${logoFoot}</span><span>Equipo Relevo · relevobrokers.com</span></div>
  </div>`;
  return [p1, p2, p3];
}

/** Documento HTML completo (para la vista previa en iframe y para dibujar el PDF). */
export function documento(pags: string[], escala = 1) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>${CSS}
  body{overflow:hidden}.wrap{zoom:${escala};width:816px}.wrap .page+.page{margin-top:${Math.round(24 / escala)}px}</style></head><body><div class="wrap">${pags.join('')}</div></body></html>`;
}

type Libs = { html2canvas: typeof import('html2canvas').default; jsPDF: typeof import('jspdf').jsPDF };
let libs: Promise<Libs> | null = null;
const cargar = () => (libs ??= Promise.all([import('html2canvas'), import('jspdf')]).then(([h, j]) => ({ html2canvas: h.default, jsPDF: j.jsPDF })));

/** Dibuja las páginas en un iframe aislado y devuelve el PDF (carta, 3 páginas). */
export async function generarPdf(pags: string[], calidad = 0.9): Promise<Blob> {
  const { html2canvas, jsPDF } = await cargar();
  await fuentesEnDocumento();
  const fr = document.createElement('iframe');
  fr.setAttribute('aria-hidden', 'true');
  fr.style.cssText = 'position:fixed;left:-12000px;top:0;width:816px;height:1056px;border:0;visibility:hidden';
  document.body.appendChild(fr);
  try {
    const doc = fr.contentDocument!;
    doc.open(); doc.write(documento(pags)); doc.close();
    await new Promise((r) => (doc.readyState === 'complete' ? r(null) : fr.addEventListener('load', () => r(null), { once: true })));
    await doc.fonts.ready;
    await Promise.all([...doc.images].map((img) => (img.complete ? null : new Promise((res) => { img.onload = img.onerror = res; }))));
    const pdf = new jsPDF({ unit: 'pt', format: 'letter', compress: true });
    const pages = doc.querySelectorAll<HTMLElement>('.page');
    for (let i = 0; i < pages.length; i++) {
      const canvas = await html2canvas(pages[i], { scale: 2, backgroundColor: null, useCORS: true, logging: false, width: 816, height: 1056, windowWidth: 816 });
      if (i > 0) pdf.addPage('letter', 'portrait');
      pdf.addImage(canvas.toDataURL('image/jpeg', calidad), 'JPEG', 0, 0, 612, 792, undefined, 'FAST');
    }
    return pdf.output('blob');
  } finally { fr.remove(); }
}

export const nombreArchivo = (L: Lead) => `Valoracion_flash_${(cleanName(L.empresa) || cleanName(L.nombre) || 'Lead').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 60) || 'Lead'}.pdf`;
