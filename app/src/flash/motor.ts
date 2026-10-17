// Motor de la valoración flash. Portado tal cual del artefacto de Alejandro (Valoración flash, oct 2026).
// Valor de la operación = EBITDA estimado (ventas × margen típico) × múltiplo (escalera por tamaño de EBITDA + ajuste por sector).
import SUBS_RAW from './subsectores.json';
import type { Row } from '../lib/supabase';

export type Sub = { id: string; nombre: string; padre: string; ciiu: string; margen: number | null; ajuste: number | null; confianza: string; evidencia: string; razon: string };
export const SUBS = SUBS_RAW as Sub[];

export const SECTORS = ['Alimentos y Bebidas', 'Manufactura', 'Distribución y Comercio', 'Salud y Farmacias', 'Educación', 'Logística y Transporte', 'Construcción', 'Servicios a Empresas', 'Otro'] as const;
type Alt = { base: string; label: string; ajuste: number } | null;
export type Supuestos = {
  piso: number; umbral: number; spread: number; suave: boolean;
  ladder: { hasta: number | null; mult: number }[];
  sectors: Record<string, { margen: number; ajuste: number; alt: Alt }>;
  /** Ventas representativas por tramo de la app (cuartiles interiores con reparto log-uniforme). */
  tramos: Record<string, [number, number]>;
  subs: Record<string, { margen?: number; ajuste?: number }>;
};

/** Cuartiles interiores de un tramo [a, b] suponiendo ventas log-uniformes: a·(b/a)^¼ y a·(b/a)^¾. */
const cuartiles = (a: number, b: number): [number, number] => [Math.round(a * (b / a) ** 0.25 / 10) * 10, Math.round(a * (b / a) ** 0.75 / 10) * 10];

export const DEFAULTS: Supuestos = {
  piso: 1000, umbral: 5000, spread: 2, suave: true,
  ladder: [{ hasta: 500, mult: 3.0 }, { hasta: 1500, mult: 3.5 }, { hasta: 4000, mult: 4.0 }, { hasta: null, mult: 4.5 }],
  sectors: {
    'Alimentos y Bebidas': { margen: 9, ajuste: 0, alt: null },
    'Manufactura': { margen: 10, ajuste: 0, alt: null },
    'Distribución y Comercio': { margen: 6, ajuste: 0, alt: { base: 'Distribuidor', label: 'Comercio al detal', ajuste: -0.5 } },
    'Salud y Farmacias': { margen: 12, ajuste: 0, alt: { base: 'Droguería o depende de EPS', label: 'IPS o salud de pago privado', ajuste: 0.5 } },
    'Educación': { margen: 14, ajuste: 0, alt: null },
    'Logística y Transporte': { margen: 9, ajuste: 0, alt: null },
    'Construcción': { margen: 8, ajuste: -0.5, alt: null },
    'Servicios a Empresas': { margen: 12, ajuste: 0, alt: { base: 'Sin contratos recurrentes', label: 'Mayoría del ingreso por contratos recurrentes', ajuste: 0.5 } },
    'Otro': { margen: 8, ajuste: 0, alt: { base: 'General', label: 'Software o servicios de IT', ajuste: 0.5 } },
  },
  // 1.000 a 2.000 y 2.000 a 5.000 son los valores del artefacto (1.190/1.680 y 2.510/3.980); los demás salen de la misma fórmula.
  tramos: { lt1000: [600, 850], '1000_2000': [1190, 1680], '2000_5000': [2510, 3980], '2000_3000': cuartiles(2000, 3000), '3000_5000': cuartiles(3000, 5000), '5000_10000': [5950, 8410], '10000_20000': [11890, 16820], gt20000: [22000, 30000] },
  subs: {},
};
export const TRAMO_TOPE: Record<string, [number, number]> = { lt1000: [0, 1000], '1000_2000': [1000, 2000], '2000_3000': [2000, 3000], '3000_5000': [3000, 5000], '2000_5000': [2000, 5000], '5000_10000': [5000, 10000], '10000_20000': [10000, 20000], gt20000: [20000, Infinity] };
export const TRAMO_TEXTO: Record<string, string> = { lt1000: 'Menos de $1.000 millones', '1000_2000': '$1.000 a $2.000 millones', '2000_3000': '$2.000 a $3.000 millones', '3000_5000': '$3.000 a $5.000 millones', '2000_5000': '$2.000 a $5.000 millones', '5000_10000': '$5.000 a $10.000 millones', '10000_20000': '$10.000 a $20.000 millones', gt20000: 'Más de $20.000 millones' };

export function mezclar(guardado: Partial<Supuestos> | null | undefined): Supuestos {
  const g = guardado || {};
  return {
    ...DEFAULTS, ...g,
    ladder: g.ladder?.length ? g.ladder : DEFAULTS.ladder,
    sectors: Object.fromEntries(SECTORS.map((s) => [s, { ...DEFAULTS.sectors[s], ...(g.sectors?.[s] || {}), alt: DEFAULTS.sectors[s].alt ? { ...DEFAULTS.sectors[s].alt!, ...(g.sectors?.[s]?.alt || {}) } : null }])),
    tramos: { ...DEFAULTS.tramos, ...(g.tramos || {}) },
    subs: g.subs || {},
  };
}

/** Sector de la app → [sector del motor, subsector por defecto, tipo de negocio]. */
const SECTOR_APP: Record<string, [string, string?, number?]> = {
  alimentos_bebidas: ['Alimentos y Bebidas'], agro: ['Alimentos y Bebidas', 'alim-agro'], quimicos_farma: ['Manufactura', 'man-quim'],
  manufactura: ['Manufactura'], construccion: ['Construcción'], comercio_mayorista: ['Distribución y Comercio'],
  comercio_minorista: ['Distribución y Comercio', 'dis-det'], transporte_logistica: ['Logística y Transporte'],
  turismo_restaurantes: ['Otro'], tecnologia: ['Otro', undefined, 1], medios_telecom: ['Otro'], salud: ['Salud y Farmacias'],
  educacion: ['Educación'], servicios_empresariales: ['Servicios a Empresas'], energia_mineria: ['Otro'], otros_servicios: ['Otro'],
};

export type Lead = {
  id: string; nombre: string; rol: string; empresa: string; ciudad: string; sector: string; sectorApp: string;
  subsector: string; subtipo: number; multManual: string; ventas: string; correo: string; celular: string; canal: string;
  horizonte: string; ingreso: string; etapa: string; valoracion: string; min: number | null; max: number | null; fechaVal: string | null; enviado: string | null;
  responsable: string | null; codigo: string | null; dup?: string;
};

export function leadDe(v: Row): Lead {
  const [sector, subDef, tipoDef] = SECTOR_APP[v.sector] || ['Otro'];
  return {
    id: v.id, nombre: v.nombre || '', rol: v.rol || '', empresa: v.empresa || '', ciudad: v.ciudad || '', sectorApp: v.sector || '',
    sector: v.flash_subsector ? (SUBS.find((s) => s.id === v.flash_subsector)?.padre || sector) : sector,
    subsector: v.flash_subsector ?? subDef ?? '', subtipo: v.flash_subsector ? 0 : (v.flash_subtipo || tipoDef || 0),
    multManual: v.flash_mult != null ? String(v.flash_mult) : '', ventas: v.ventas_rango || '', correo: (v.correo || '').trim(), celular: v.celular || v.telefono || '',
    canal: v.canal === 'correo' ? 'Correo' : 'WhatsApp', horizonte: v.horizonte || '', ingreso: v.fecha_ingreso || '', etapa: v.etapa, valoracion: v.valoracion_tipo || '',
    min: v.valoracion_min != null ? Number(v.valoracion_min) : null, max: v.valoracion_max != null ? Number(v.valoracion_max) : null,
    fechaVal: v.valoracion_fecha, enviado: v.flash_enviado_en, responsable: v.responsable, codigo: v.form_codigo ?? null,
  };
}

export function subOf(A: Supuestos, id: string | null | undefined): Sub | null {
  const s = id ? SUBS.find((x) => x.id === id) : null;
  return s ? { ...s, ...(A.subs[s.id] || {}) } : null;
}

const parseMult = (s: string) => { const t = String(s ?? '').trim(); return t === '' ? NaN : Number(t.replace(',', '.').replace(/x$/i, '')); };

function ladderStep(A: Supuestos, e: number) { for (const r of A.ladder) if (r.hasta === null || e < r.hasta) return r.mult; return A.ladder[A.ladder.length - 1].mult; }
/** Interpolación lineal entre el punto medio de cada escalón. */
function ladderMult(A: Supuestos, e: number) {
  if (!A.suave) return ladderStep(A, e);
  const pts = A.ladder.map((r, i) => { const lo = i === 0 ? 0 : A.ladder[i - 1].hasta!; return [r.hasta === null ? lo * 1.3 : (lo + r.hasta) / 2, r.mult]; });
  if (e <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) if (e <= pts[i][0]) { const [x0, y0] = pts[i - 1], [x1, y1] = pts[i]; return y0 + (y1 - y0) * (e - x0) / (x1 - x0); }
  return pts[pts.length - 1][1];
}
const roundLo = (n: number) => { const s = n < 2000 ? 50 : 100; return Math.max(s, Math.floor(n / s) * s); };
const roundHi = (n: number) => { const s = n < 2000 ? 50 : 100; return Math.ceil(n / s) * s; };
const BAD_NAMES = /^(n\/?a|na|ninguna|no|xxx+|x+|mi empresa|empresa|privad[oa]|confidencial|-+|\.+|\*+|una empresa.*|no aplica|prefiero no decir)$/i;
const DESCRIPTIVE = /^(una?\s+)?(empresa|negocio|compa[nñ][ií]a|f[aá]brica|tienda|almac[eé]n|local|emprendimiento|microempresa|pyme|sociedad|firma|taller|distribuidora|comercializadora)\s+(de|del|que|en|dedicada)\b/i;
export const money = (n: number) => '$' + String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
export const dec = (n: number, d = 1) => Number(n).toFixed(d).replace('.', ',');
export const fmtAdj = (a: number) => (a === 0 ? 'sin ajuste' : (a > 0 ? '+' : '−') + dec(Math.abs(a), 1) + 'x');
export function cleanName(n: string) { return String(n || '').replace(/^[^\p{L}\p{N}]+/u, '').replace(/^PRUEBA\s+/i, '').replace(/[*]+$/, '').trim(); }
export function shortName(n: string) { const t = (n || '').replace(/\s+(s\.?\s?a\.?\s?s\.?|s\.?a\.?|ltda\.?|sas|e\.?u\.?)$/i, '').replace(/[*]+$/, '').trim(); return t || 'tu empresa'; }

export type Ruta = 'flash' | 'fuera' | 'fuera_rango';
export type Resultado = ReturnType<typeof calcular>;

export function calcular(A: Supuestos, L: Lead) {
  const sec = A.sectors[L.sector] || A.sectors['Otro'];
  const sub = subOf(A, L.subsector);
  const excluido = !!(sub && sub.confianza === 'Excluido');
  const margen = sub && sub.margen != null ? sub.margen : sec.margen;
  const [vLo, vHi] = A.tramos[L.ventas] || [0, 0];
  const mLo = margen, mHi = margen;
  const eLo = vLo * mLo / 100, eHi = vHi * mHi / 100;
  const adj = sub && sub.ajuste != null ? sub.ajuste : (sec.alt && L.subtipo ? sec.alt.ajuste : sec.ajuste);
  const manual = parseMult(L.multManual), hasManual = isFinite(manual) && manual > 0;
  const xLo = hasManual ? manual : Math.max(1, ladderMult(A, eLo) + adj), xHi = hasManual ? manual : Math.max(1, ladderMult(A, eHi) + adj);
  const lo = roundLo(eLo * xLo), hi = Math.max(roundHi(eHi * xHi), roundLo(eLo * xLo) + (eHi * xHi < 2000 ? 50 : 100));

  const nombre = (L.empresa || '').trim();
  const sinNombre = nombre === '' || BAD_NAMES.test(nombre) || DESCRIPTIVE.test(nombre);
  const [bot, top] = TRAMO_TOPE[L.ventas] || [0, 0];
  const route: Ruta = top <= A.piso ? 'fuera' : bot >= A.umbral ? 'fuera_rango' : 'flash';
  const why = route === 'fuera' ? `Ventas menores a ${money(A.piso)} millones. Recibe solo el mensaje, sin valoración.`
    : route === 'flash' ? `Ventas entre ${money(A.piso)} y ${money(A.umbral)} millones. Recibe la valoración flash y queda en la lista confidencial.`
    : `Ventas sobre ${money(A.umbral)} millones. No va por valoración flash.`;

  const flags: string[] = [];
  if (route === 'flash' && sinNombre) flags.push(`El PDF va dirigido a "tu empresa" porque ${nombre === '' ? 'no dejó el nombre de la empresa' : 'el nombre no permite identificarla'}.`);
  if (sec.alt && !L.subtipo && !L.subsector && L.sector !== 'Otro' && route === 'flash') flags.push(`El ajuste por sector supone "${sec.alt.base.toLowerCase()}". Si es ${sec.alt.label.toLowerCase()}, cámbialo en Tipo de negocio.`);
  const sectorGeneral = L.sector === 'Otro' && !L.subsector && !hasManual;
  const conservador: '' | 'sector' | 'ventas' = route === 'flash' && (sectorGeneral || lo < 300) ? (sectorGeneral ? 'sector' : 'ventas') : '';
  if (conservador) flags.push(conservador === 'sector' ? 'El PDF y el mensaje llevan la nota de rango conservador: se usó el margen promedio porque no se conoce la actividad exacta.' : `El extremo bajo es de ${money(lo)} millones. El PDF y el mensaje llevan la nota de rango conservador.`);
  if (route === 'flash' && sub && !excluido) flags.unshift(`Subsector: ${sub.nombre}. Margen ${dec(margen, 1)}% y ${adj === 0 ? 'sin ajuste al múltiplo' : 'ajuste de ' + fmtAdj(adj)} (${sub.confianza === 'Hereda' ? 'hereda el ajuste de su sector' : sub.confianza.toLowerCase()}).`);
  if (route === 'flash' && hasManual) flags.unshift(`Múltiplo manual de ${dec(manual, 1)}x: reemplaza la escalera y el ajuste por sector.`);
  if (excluido) flags.unshift(`${sub!.nombre}: este tipo de empresa no se valora por EBITDA. No envíes la valoración flash.`);
  return { conservador, sec, sub, excluido, margen, hasManual, adj, vLo, vHi, mLo, mHi, eLo, eHi, xLo, xHi, lo, hi, route, why, flags, sinNombre };
}

/** Lo que saca a un lead del lote y lo deja para revisión manual (solo lo que sería un error enviar). */
export function motivosRevision(A: Supuestos, L: Lead): string[] {
  const out: string[] = [];
  const sb = subOf(A, L.subsector);
  if (sb && sb.confianza === 'Excluido') out.push(`${sb.nombre}: no se valora por EBITDA`);
  if (L.dup) out.push(L.dup);
  if (!L.correo && !L.celular) out.push('Sin celular ni correo');
  return out;
}

/** Marca solicitudes repetidas (mismo correo, celular o nombre completo). */
export function marcarRepetidos(pend: Lead[], todos: Row[]) {
  const normName = (s: string) => cleanName(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ');
  const normMail = (s: string) => String(s || '').trim().toLowerCase();
  const normCel = (s: string) => String(s || '').replace(/\D/g, '').slice(-10);
  const count: Record<string, number> = {};
  todos.forEach((r) => [normMail(r.correo), normCel(r.celular || r.telefono)].forEach((k) => { if (k) count[k] = (count[k] || 0) + 1; }));
  const useful = (k: string) => !!k && count[k] <= 3;
  const ids = new Set(pend.map((l) => l.id));
  for (const l of pend) {
    l.dup = '';
    const n = normName(l.nombre), m = normMail(l.correo), c = normCel(l.celular);
    const twins = todos.filter((r) => r.id !== l.id && ((n && normName(r.nombre) === n && (n.split(' ').length > 1 || normMail(r.correo) === m)) || (useful(m) && normMail(r.correo) === m) || (useful(c) && normCel(r.celular || r.telefono) === c)));
    if (!twins.length) continue;
    const atendida = twins.find((r) => !ids.has(r.id) && (r.valoracion_tipo === 'flash' || r.etapa !== 'no_contactado'));
    if (atendida) { l.dup = `Solicitud repetida: ya se atendió otra de esta persona (${atendida.empresa || atendida.etapa}). No le escribas de nuevo`; continue; }
    const grupo = [l, ...pend.filter((o) => twins.some((r) => r.id === o.id))].sort((a, b) => String(b.ingreso).localeCompare(String(a.ingreso)) || (a.id < b.id ? -1 : 1));
    if (grupo[0].id !== l.id) l.dup = 'Solicitud repetida: se valora solo la más reciente';
  }
}

/** Mensaje para el lead (correo o WhatsApp), igual al del artefacto. */
export function mensaje(A: Supuestos, L: Lead, r: Resultado, canal = L.canal): { asunto: string; cuerpo: string } {
  const nombre = (L.nombre || '').replace(/^[^\p{L}]+/u, '').replace(/^PRUEBA\s+/i, '').trim().split(/\s+/)[0] || '';
  const saludo = nombre ? `Hola ${nombre}` : 'Hola';
  const emp = cleanName(L.empresa);
  const de = emp && !r.sinNombre ? ` de ${emp}` : ' de tu empresa';
  void canal;
  if (r.route === 'fuera') return { asunto: `Gracias por contarnos${de}`, cuerpo: `${saludo}, gracias por contarnos${de}.\n\nHoy nuestro proceso está pensado para empresas de mayor tamaño, así que en este momento no podemos hacer una valoración de una empresa como la tuya. Te deseamos lo mejor con su crecimiento: cuando sus ventas pasen de ${money(A.piso)} millones al año, con gusto la miramos.` };
  const link = L.codigo ? `https://relevobrokers.com/afinar?c=${L.codigo}` : '';
  return {
    asunto: `Una primera mirada al valor${de}`,
    cuerpo: `${saludo}, gracias por contarnos${de}. Te comparto una primera mirada a su valor, hecha con lo que nos contaste en el formulario.${r.conservador ? ' Es un rango conservador: con tus cifras reales el valor puede ser mayor.' : ''}\n\n`
      + (link
        ? `Es un primer rango. Si respondes unas preguntas (4 minutos, sin documentos), lo afinamos y te decimos qué miraría un comprador en tu empresa:\n${link}\n\nTodo lo que nos cuentes es confidencial.`
        : `Si quieres afinar este rango, responde este correo y te contamos cómo seguir. Todo lo que nos cuentes es confidencial.`),
  };
}
