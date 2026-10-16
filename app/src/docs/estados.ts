/** PDF de los estados financieros con la identidad de Relevo (mismo lenguaje visual del NDA). */
import type { Content, TDocumentDefinitions, TableCell } from 'pdfmake/interfaces';
import type { Marca } from './pdf';
import { RELEVO_SAS } from './nda';
import { nombreMes, cop, type Mov, type Transfer } from '../lib/finanzas';
import { estadoResultados, estadoFlujo, estadoSituacion, fechaLarga, type Fila, type Linea, type Presentacion } from '../lib/estados';

const C = { ink: '#14243d', azul: '#2c5186', naranja: '#f47b3d', gris: '#5b6577', linea: '#d5dbe5', suave: '#f3f6fb', calido: '#fdf1ea', rojo: '#b42318', verde: '#1f7a4d' };
const M = 54; // margen lateral

export type Pieza = 'balance' | 'resultados' | 'flujo' | 'socios';
export type Datos = { movs: Mov[]; corte: string; modo: Presentacion; emitido: string; representante: string; transf?: Transfer[]; sociosRes?: any };

const nf = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 });
/** Formato contable: negativos entre paréntesis, ceros como punto medio. */
const plata = (v: number | undefined, cero = '·') => v == null ? '' : Math.round(v) === 0 ? cero : v < 0 ? `(${nf.format(Math.abs(Math.round(v)))})` : nf.format(Math.round(v));
const mesLargo = (m: string) => new Intl.DateTimeFormat('es-CO', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(m + '-15T00:00:00Z')).replace(' de ', ' ');

/* ---------- piezas comunes ---------- */
const encabezadoTitulo = (titulo: string, periodo: string): Content[] => [
  { text: titulo, font: 'Titulo', fontSize: 20, color: C.ink, lineHeight: 1, margin: [0, 0, 0, 4] },
  { image: 'brush', width: 132, margin: [0, 0, 0, 7] },
  { columns: [
    { text: [{ text: 'Relevo Brokers S.A.S.', bold: true, color: C.ink }, { text: `  ·  NIT ${RELEVO_SAS.nit}`, color: C.gris }], fontSize: 9.5 },
    { text: periodo, alignment: 'right', fontSize: 9.5, color: C.gris, italics: true },
  ], margin: [0, 0, 0, 14] },
];

const kpis = (items: [string, number][]): Content => ({
  table: {
    widths: items.map(() => '*'),
    body: [items.map(([l, v]) => ({
      stack: [
        { text: l.toUpperCase(), fontSize: 6.8, bold: true, color: C.gris, characterSpacing: 0.5 },
        { text: (v < 0 ? '-$' : '$') + nf.format(Math.abs(Math.round(v))), fontSize: 14, bold: true, color: v < 0 ? C.rojo : C.azul, margin: [0, 3, 0, 0] },
      ],
      fillColor: C.suave, margin: [10, 8, 10, 8],
    }))],
  },
  layout: { hLineWidth: () => 0, vLineWidth: (i: number, node: any) => (i === 0 || i === node.table.widths.length ? 0 : 3), vLineColor: () => '#ffffff', paddingLeft: () => 0, paddingRight: () => 0, paddingTop: () => 0, paddingBottom: () => 0 },
  margin: [0, 0, 0, 16],
});

const notas = (xs: string[]): Content => ({
  stack: [
    { text: 'Notas', font: 'Titulo', fontSize: 11, color: C.azul, margin: [0, 16, 0, 5] },
    ...xs.map((t, i) => ({ columns: [{ text: `${i + 1}.`, width: 14, bold: true, color: C.naranja, fontSize: 8.5 }, { text: t, fontSize: 8.5, color: C.gris, lineHeight: 1.3 }], margin: [0, 0, 0, 3] } as Content)),
  ],
});

const firmas = (rep: string): Content => ({
  columns: [
    { stack: [{ canvas: [{ type: 'line', x1: 0, y1: 0, x2: 190, y2: 0, lineWidth: 0.75, lineColor: C.ink }] }, { text: rep, bold: true, fontSize: 9, margin: [0, 5, 0, 0] }, { text: 'Representante legal', fontSize: 8.5, color: C.gris }] },
    { stack: [{ canvas: [{ type: 'line', x1: 0, y1: 0, x2: 190, y2: 0, lineWidth: 0.75, lineColor: C.ink }] }, { text: 'Contador público', bold: true, fontSize: 9, margin: [0, 5, 0, 0] }, { text: 'Tarjeta profesional', fontSize: 8.5, color: C.gris }] },
  ],
  columnGap: 40, margin: [0, 30, 0, 0], unbreakable: true,
});

/** Estilo de tabla contable: sin rayas verticales, encabezado azul, totales con línea arriba. */
const tablaLayout = (tipos: (string | undefined)[]) => ({
  hLineWidth: (i: number, node: any) => {
    if (i === 0) return 0;
    if (i === node.table.body.length) return 0.75;
    const k = tipos[i - 1]; // fila i (cuerpo empieza en 1)
    return k === 'tot' || k === 'resultado' ? 0.75 : 0;
  },
  hLineColor: (i: number, node: any) => (i === node.table.body.length ? C.azul : C.ink),
  vLineWidth: () => 0,
  paddingTop: (i: number) => (i === 0 ? 5 : tipos[i - 1] === 'grupo' && i > 1 && tipos[i - 2] !== 'grupo' ? 7 : 2.4),
  paddingBottom: (i: number) => (i === 0 ? 5 : 2.4),
  paddingLeft: () => 5, paddingRight: () => 5,
  fillColor: (i: number) => (i === 0 ? C.azul : tipos[i - 1] === 'resultado' ? C.calido : null),
});

const th = (t: string, right = false): TableCell => ({ text: t, bold: true, color: '#ffffff', fontSize: 7.5, alignment: right ? 'right' : 'left', characterSpacing: 0.3 });

/** Si hay muchos meses, los primeros se agrupan en una columna para que quepa. */
function columnas(meses: string[], max: number) {
  if (meses.length <= max) return { labels: meses.map(nombreMes), agrupa: (v: number[]) => v };
  const corte = meses.length - (max - 1);
  return {
    labels: [`Hasta ${nombreMes(meses[corte - 1])}`, ...meses.slice(corte).map(nombreMes)],
    agrupa: (v: number[]) => (v.length ? [v.slice(0, corte).reduce((a, b) => a + b, 0), ...v.slice(corte)] : v),
  };
}

function tablaMensual(meses: string[], filas: Fila[], ancho: number): Content {
  const max = Math.max(1, Math.floor((ancho - 42 - 74 - 190) / 64));
  const col = columnas(meses, max);
  const n = col.labels.length;
  const body: TableCell[][] = [[th('CÓDIGO'), th('CUENTA'), ...col.labels.map((l) => th(l.toUpperCase(), true)), th('TOTAL', true)]];
  for (const f of filas) {
    const cod: TableCell = { text: f.c ?? '', fontSize: 8, color: C.gris, font: 'Serif' };
    if (f.k === 'grupo') { body.push([{ ...cod, color: C.azul, bold: true }, { text: f.l.toUpperCase(), bold: true, color: C.azul, fontSize: 7.8, characterSpacing: 0.4, colSpan: n + 2 }, ...Array(n + 1).fill({})]); continue; }
    const fuerte = f.k === 'tot' || f.k === 'resultado';
    const color = (x: number) => (f.k === 'resultado' && Math.round(x) < 0 ? C.rojo : C.ink);
    body.push([
      cod,
      { text: f.l, fontSize: 8.6, bold: fuerte, color: C.ink },
      ...col.agrupa(f.v).map((x) => ({ text: plata(x), alignment: 'right', fontSize: 8.6, bold: fuerte, color: Math.round(x) === 0 ? '#9aa3b2' : color(x) } as TableCell)),
      { text: plata(f.t, '0'), alignment: 'right', fontSize: 8.6, bold: true, color: color(f.t) },
    ]);
  }
  return {
    table: { headerRows: 1, widths: [38, '*', ...Array(n).fill(60), 70], body, dontBreakRows: true },
    layout: tablaLayout(filas.map((f) => f.k)) as any,
  };
}

function tablaSaldos(secciones: { titulo: string; lineas: Linea[] }[], cierre?: Linea): Content[] {
  return secciones.map((s, si): Content => {
    const tipos = s.lineas.filter((y) => !(y.k === 'grupo' && y.c?.length === 1)).map((x) => x.k);
    const body: TableCell[][] = [[th('CÓDIGO'), th(s.titulo.toUpperCase()), th('SALDO', true)]];
    for (const x of s.lineas.filter((y) => !(y.k === 'grupo' && y.c?.length === 1))) {
      const cod: TableCell = { text: x.c ?? '', fontSize: 8, color: x.k === 'grupo' ? C.azul : C.gris, font: 'Serif', bold: x.k === 'grupo' };
      if (x.k === 'grupo') { body.push([cod, { text: x.l.toUpperCase(), bold: true, color: C.azul, fontSize: 7.8, characterSpacing: 0.4, colSpan: 2 }, {}]); continue; }
      const fuerte = x.k === 'tot' || x.k === 'resultado';
      const sub = x.k === 'subcta';
      body.push([
        cod,
        { text: x.l, fontSize: sub ? 8 : 8.8, bold: fuerte, italics: sub, color: sub ? C.gris : C.ink, margin: [sub ? 12 : 0, 0, 0, 0] },
        { text: x.v == null ? '' : plata(x.v, '0'), alignment: 'right', fontSize: sub ? 8 : 8.8, bold: fuerte, color: sub ? C.gris : x.k === 'resultado' && (x.v ?? 0) < 0 ? C.rojo : C.ink },
      ]);
    }
    const t: Content = { table: { headerRows: 1, widths: [44, '*', 110], body, dontBreakRows: true }, layout: tablaLayout(tipos) as any, margin: [0, si ? 10 : 0, 0, 0] };
    return t;
  }).concat(cierre ? [{
    table: { widths: [44, '*', 110], body: [[{ text: '' }, { text: cierre.l, bold: true, fontSize: 9.5, color: '#ffffff' }, { text: plata(cierre.v, '0'), bold: true, fontSize: 9.5, color: '#ffffff', alignment: 'right' }]] },
    layout: { hLineWidth: () => 0, vLineWidth: () => 0, fillColor: () => C.ink, paddingTop: () => 6, paddingBottom: () => 6, paddingLeft: () => 5, paddingRight: () => 5 },
    margin: [0, 10, 0, 0],
  } as Content] : []);
}

const periodoDe = (meses: string[], hasta: string) => meses.length ? `Del 1 de ${mesLargo(meses[0])} al ${fechaLarga(hasta)}` : `Al ${fechaLarga(hasta)}`;

/* ---------- cada estado ---------- */
function situacion(d: Datos): Content[] {
  const e = estadoSituacion(d.movs, d.corte, d.modo);
  return [
    ...encabezadoTitulo('Estado de situación financiera', `Al ${fechaLarga(d.corte)}`),
    ...tablaSaldos([{ titulo: 'Activo', lineas: e.activoL.filter((x) => x.l !== 'Total activo corriente') }, { titulo: 'Pasivo', lineas: e.pasivoL }, { titulo: 'Patrimonio', lineas: e.patL }], { l: 'Total pasivo y patrimonio', v: e.totalPP }),
    notas(e.notas),
    firmas(d.representante),
  ];
}
function resultados(d: Datos, ancho: number): Content[] {
  const e = estadoResultados(d.movs);
  return [...encabezadoTitulo('Estado de resultados', periodoDe(e.meses, d.corte)), ...(ancho > 600 ? [] : [kpis(e.kpis)]), tablaMensual(e.meses, e.filas, ancho), notas(e.notas), firmas(d.representante)];
}
function flujo(d: Datos, ancho: number): Content[] {
  const e = estadoFlujo(d.movs);
  return [...encabezadoTitulo('Estado de flujos de efectivo', periodoDe(e.meses, d.corte)), ...(ancho > 600 ? [] : [kpis(e.kpis)]), tablaMensual(e.meses, e.filas, ancho), notas(e.notas), firmas(d.representante)];
}
function socios(d: Datos): Content[] {
  const s = d.sociosRes, Q: Record<string, string> = { felipe: 'Pardo', alejandro: 'Alejo' };
  const SOC = ['felipe', 'alejandro'];
  const fila = (l: string, vs: (number | string)[], k?: string): TableCell[] => [{ text: l, fontSize: 8.8, bold: !!k }, ...vs.map((v) => ({ text: typeof v === 'number' ? plata(v, '0') : v, alignment: 'right', fontSize: 8.8, bold: !!k } as TableCell))];
  const tipos = [undefined, undefined, 'tot', undefined, 'resultado'];
  const dif = SOC.map((k) => s.puesto[k] - s.mitad);
  const transf = (d.transf ?? []).slice().sort((a, b) => a.fecha.localeCompare(b.fecha));
  return [
    ...encabezadoTitulo('Cuentas entre socios', `Al ${fechaLarga(d.corte)}`),
    kpis([['Pardo ha puesto', s.puesto.felipe], ['Alejo ha puesto', s.puesto.alejandro], ['Total puesto', s.total]]),
    { text: s.transferencia < 1 ? 'Los socios están a mano.' : [{ text: Q[s.de], bold: true }, ' le transfiere ', { text: cop(s.transferencia), bold: true, color: C.azul }, ' a ', { text: Q[s.a], bold: true }, `. Así cada uno queda con ${cop(s.mitad)} puestos.`], fontSize: 11, margin: [0, 0, 0, 12] },
    {
      table: { headerRows: 1, widths: ['*', 100, 100], body: [
        [th('CONCEPTO'), th('PARDO', true), th('ALEJO', true)],
        fila('Puesto en Relevo (gastos y aportes, menos reembolsos e ingresos recibidos)', SOC.map((k) => s.enRelevo[k])),
        fila('Transferencias entre socios (dio + / recibió −)', SOC.map((k) => s.cruces[k])),
        fila('Total puesto', SOC.map((k) => s.puesto[k]), 'tot'),
        fila('Le corresponde (50%)', SOC.map(() => s.mitad)),
        fila('Diferencia', dif, 'resultado'),
      ] },
      layout: tablaLayout(tipos) as any,
    },
    ...(transf.length ? [
      { text: 'Transferencias entre socios', font: 'Titulo', fontSize: 11, color: C.azul, margin: [0, 18, 0, 6] } as Content,
      {
        table: { headerRows: 1, widths: [112, 50, 50, 70, '*'], body: [
          [th('FECHA'), th('DE'), th('A'), th('MONTO', true), th('NOTA')],
          ...transf.map((t) => [{ text: fechaLarga(t.fecha), fontSize: 8.4 }, { text: Q[t.de], fontSize: 8.4 }, { text: Q[t.a], fontSize: 8.4 }, { text: plata(Number(t.monto)), alignment: 'right', fontSize: 8.4 }, { text: t.nota ?? '', fontSize: 8.4, color: C.gris }] as TableCell[]),
        ] },
        layout: { ...(tablaLayout([]) as any), hLineWidth: (i: number, node: any) => (i === 0 ? 0 : i === node.table.body.length ? 0.75 : 0.4), hLineColor: (i: number, node: any) => (i === node.table.body.length ? C.azul : C.linea) },
      } as Content,
    ] : []),
    notas(['Las transferencias entre socios no son gasto ni ingreso de Relevo: solo cruzan cuentas entre ellos.', 'Documento interno de los socios. No hace parte de los estados financieros de la sociedad.']),
  ];
}

/* ---------- documento ---------- */
const TITULOS: Record<Pieza, string> = { balance: 'Estado de situación financiera', resultados: 'Estado de resultados', flujo: 'Estado de flujos de efectivo', socios: 'Cuentas entre socios' };

function portada(d: Datos, piezas: Pieza[]): Content[] {
  return [
    { image: 'logo', width: 150, margin: [0, 120, 0, 40] },
    { text: 'Estados financieros', font: 'Titulo', fontSize: 34, color: C.ink, lineHeight: 1 },
    { image: 'brush', width: 210, margin: [0, 6, 0, 14] },
    { text: 'Relevo Brokers S.A.S.', fontSize: 15, bold: true, color: C.azul },
    { text: `NIT ${RELEVO_SAS.nit}  ·  ${RELEVO_SAS.domicilio}`, fontSize: 10.5, color: C.gris, margin: [0, 3, 0, 0] },
    { text: `Corte al ${fechaLarga(d.corte)}`, fontSize: 10.5, color: C.gris, italics: true, margin: [0, 2, 0, 46] },
    { text: 'C O N T E N I D O', fontSize: 8, bold: true, color: C.naranja, characterSpacing: 0.6, margin: [0, 0, 0, 8] },
    ...piezas.map((p, i) => ({ columns: [{ text: String(i + 1).padStart(2, '0'), width: 26, font: 'Serif', fontSize: 12, color: C.naranja }, { text: TITULOS[p], fontSize: 11, color: C.ink, margin: [0, 1, 0, 0] }], margin: [0, 0, 0, 7] } as Content)),
    { text: 'Cifras en pesos colombianos. Estructura del Plan Único de Cuentas (Decreto 2650 de 1993), cuentas a 4 dígitos.', fontSize: 8.5, color: C.gris, margin: [0, 30, 0, 0] },
  ];
}

export function documento(piezas: Pieza[], d: Datos, img: Marca): TDocumentDefinitions {
  const anchoV = 612 - 2 * M, anchoH = 792 - 2 * M;
  const mesesN = Math.max(estadoResultados(d.movs).meses.length, estadoFlujo(d.movs).meses.length);
  const horizontal = mesesN > Math.floor((anchoV - 42 - 74 - 190) / 64);
  const paquete = piezas.length > 1;
  const content: Content[] = [];
  if (paquete) content.push(...portada(d, piezas));
  piezas.forEach((p, i) => {
    const ancha = (p === 'resultados' || p === 'flujo') && horizontal;
    const cuerpo = p === 'balance' ? situacion(d) : p === 'resultados' ? resultados(d, ancha ? anchoH : anchoV) : p === 'flujo' ? flujo(d, ancha ? anchoH : anchoV) : socios(d);
    const brk = paquete || i > 0;
    content.push({ stack: cuerpo, ...(brk ? { pageBreak: 'before' as const, pageOrientation: ancha ? 'landscape' as const : 'portrait' as const } : {}) });
  });
  const unico = piezas.length === 1 ? TITULOS[piezas[0]] : 'Estados financieros';
  const primeraHorizontal = !paquete && (piezas[0] === 'resultados' || piezas[0] === 'flujo') && horizontal;
  return {
    pageSize: 'LETTER',
    pageOrientation: primeraHorizontal ? 'landscape' : 'portrait',
    pageMargins: [M, 80, M, 58],
    images: { logo: img.logo, brush: img.brush },
    info: { title: `${unico} · Relevo Brokers S.A.S.`, author: 'Relevo Brokers S.A.S.', subject: `Corte al ${fechaLarga(d.corte)}` },
    defaultStyle: { font: 'Sans', fontSize: 9.5, color: C.ink, lineHeight: 1.2 },
    header: (pagina, _total, size) => (paquete && pagina === 1 ? null : {
      margin: [M, 28, M, 0],
      stack: [
        { columns: [
          { image: 'logo', width: 80 },
          { text: 'E S T A D O S   F I N A N C I E R O S', alignment: 'right', fontSize: 7.5, bold: true, color: C.naranja, characterSpacing: 0.5, margin: [0, 8, 0, 0] },
        ] },
        { canvas: [{ type: 'line', x1: 0, y1: 9, x2: size.width - 2 * M, y2: 9, lineWidth: 0.75, lineColor: C.azul }] },
      ],
    }) as any,
    footer: (pagina, total, size) => (paquete && pagina === 1 ? null : {
      margin: [M, 22, M, 0],
      columns: [
        { text: `Relevo Brokers S.A.S.  ·  NIT ${RELEVO_SAS.nit}  ·  relevobrokers.com  ·  Emitido el ${fechaLarga(d.emitido)}`, fontSize: 7.5, color: C.gris, width: size.width - 2 * M - 90 },
        { text: [{ text: 'Página ', fontSize: 7.5, color: C.gris }, { text: String(pagina), font: 'Serif', fontSize: 9.5 }, { text: ' de ', fontSize: 7.5, color: C.gris }, { text: String(total), font: 'Serif', fontSize: 9.5 }], alignment: 'right', width: 90 },
      ],
    }) as any,
    content,
  };
}

export const nombrePdf = (piezas: Pieza[], corte: string) => `Relevo_${piezas.length > 1 ? 'Estados_financieros' : TITULOS[piezas[0]].replace(/\s+/g, '_').normalize('NFD').replace(/[̀-ͯ]/g, '')}_${corte}.pdf`;
