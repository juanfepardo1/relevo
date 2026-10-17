/** Lista de documentos para la valoración: catálogo (base fija + módulos) y PDF con la portada de Relevo. Firma "Equipo Relevo". */
import type { Content, TDocumentDefinitions } from 'pdfmake/interfaces';
import type { Marca } from './pdf';

const C = { ink: '#14243d', azul: '#2c5186', naranja: '#f47b3d', gris: '#5b6577', linea: '#dfe5ee', suave: '#eef3fa' };

export type Bloque = 'cifras' | 'deudas' | 'clientes' | 'operacion' | 'sociedades' | 'antecedentes';
export const BLOQUES: { id: Bloque; titulo: string; texto: string }[] = [
  { id: 'cifras', titulo: 'Cifras de la empresa', texto: 'La base de la valoración: cuánto vende, cuánto gana y cuánto genera de verdad para los socios.' },
  { id: 'deudas', titulo: 'Deudas y pasivos', texto: 'Definen cuánto del valor de la empresa le queda a los socios.' },
  { id: 'clientes', titulo: 'Clientes y contratos', texto: 'De dónde vienen las ventas y qué tan seguras son.' },
  { id: 'operacion', titulo: 'Personal y operación', texto: 'Cómo se organiza el equipo y con qué recursos opera la empresa.' },
  { id: 'sociedades', titulo: 'Sociedades y activos', texto: 'Quién es dueño de qué y cuánto valen los activos.' },
  { id: 'antecedentes', titulo: 'Antecedentes', texto: 'Referencias que ya existen sobre el valor de la empresa.' },
];

export type Item = { id: string; bloque: Bloque; titulo: string; detalle: string; origen: string };
type Def = Omit<Item, 'id' | 'origen'>;

const anio = () => Number(new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' }).slice(0, 4));

/** Va siempre (aparece en la mayoría de las listas que ya se han enviado). */
export function base(): Def[] {
  const a = anio();
  return [
    { bloque: 'cifras', titulo: `Estados financieros ${a - 3}, ${a - 2} y ${a - 1}`, detalle: 'Completos, con sus notas.' },
    { bloque: 'cifras', titulo: `Estados financieros con el corte más reciente de ${a}`, detalle: 'Balance y estado de resultados.' },
    { bloque: 'cifras', titulo: 'Lo que retira y gasta el dueño en la empresa', detalle: 'Salario, dividendos y gastos personales que pasan por la empresa en el último año.' },
    { bloque: 'deudas', titulo: 'Relación de deudas', detalle: 'Entidad, saldo, tasa, plazo y garantías de cada una.' },
    { bloque: 'clientes', titulo: 'Ventas por cliente', detalle: `De ${a - 2} y ${a - 1}.` },
    { bloque: 'clientes', titulo: 'Cartera por edades', detalle: 'Saldo por cliente y por días de vencimiento.' },
    { bloque: 'operacion', titulo: 'Nómina mensual', detalle: 'Costo y número de empleados.' },
  ];
}

/** Se encienden según lo que cuente el cliente en la reunión. */
export function modulos(): { id: string; nombre: string; items: Def[] }[] {
  const a = anio();
  return [
    { id: 'sedes', nombre: 'Varias sedes o unidades', items: [
      { bloque: 'cifras', titulo: 'Ventas y utilidad por sede o unidad de negocio', detalle: `De ${a - 2} y ${a - 1}, para cada una.` },
      { bloque: 'operacion', titulo: 'Nómina por sede o unidad', detalle: 'Costo y número de empleados en cada una.' },
    ] },
    { id: 'sociedades', nombre: 'Varias sociedades', items: [
      { bloque: 'sociedades', titulo: 'Estados financieros de cada sociedad', detalle: 'Los mismos años y el mismo corte.' },
      { bloque: 'sociedades', titulo: 'Certificado de cámara de comercio y composición accionaria', detalle: 'De cada sociedad.' },
      { bloque: 'sociedades', titulo: 'Mapa de activos por sociedad', detalle: 'Qué sociedad es dueña de cada activo y de la marca.' },
    ] },
    { id: 'inmuebles', nombre: 'Inmuebles', items: [
      { bloque: 'sociedades', titulo: 'Certificados de tradición y libertad', detalle: 'De cada inmueble.' },
      { bloque: 'sociedades', titulo: 'Avalúos comerciales recientes', detalle: 'Con su fecha.' },
    ] },
    { id: 'contratos', nombre: 'Contratos clave', items: [
      { bloque: 'clientes', titulo: 'Contratos vigentes con los clientes principales', detalle: 'Plazo, tarifas, exclusividad, causales de terminación y si se pueden ceder.' },
      { bloque: 'operacion', titulo: 'Contratos de arriendo', detalle: 'Canon, plazo y si se pueden ceder.' },
    ] },
    { id: 'riesgos', nombre: 'Riesgos y pasivos', items: [
      { bloque: 'deudas', titulo: 'Procesos laborales y requerimientos de la UGPP', detalle: 'Demandas o reclamaciones, si las hay.' },
      { bloque: 'deudas', titulo: 'Otros pasivos', detalle: 'DIAN, proveedores, embargos y procesos judiciales.' },
    ] },
    { id: 'reorganizacion', nombre: 'Reorganización o factoring', items: [
      { bloque: 'deudas', titulo: 'Acuerdo de reorganización (Ley 1116)', detalle: 'El acuerdo y el estado de los pagos: cuánto se ha pagado y cuánto falta.' },
      { bloque: 'deudas', titulo: 'Contratos de factoring', detalle: 'Entidad, costo, monto promedio por mes y qué clientes se ceden.' },
    ] },
    { id: 'operacion', nombre: 'Operación', items: [
      { bloque: 'operacion', titulo: 'Volumen o capacidad instalada', detalle: 'Producción, unidades o servicios por mes.' },
      { bloque: 'operacion', titulo: 'Permisos, licencias y certificaciones', detalle: 'Vigentes, con su fecha de vencimiento.' },
      { bloque: 'operacion', titulo: 'Organigrama', detalle: 'Quién maneja cada área y qué decisiones dependen del dueño.' },
    ] },
    { id: 'marca', nombre: 'Marcas', items: [
      { bloque: 'sociedades', titulo: 'Registros de marca ante la SIC', detalle: 'A nombre de quién están y su vigencia.' },
    ] },
    { id: 'impuestos', nombre: 'Impuestos', items: [
      { bloque: 'cifras', titulo: `Declaraciones de renta ${a - 2} y ${a - 1}`, detalle: '' },
    ] },
    { id: 'proyecciones', nombre: 'Proyecciones', items: [
      { bloque: 'cifras', titulo: `Presupuesto o proyección ${a} y ${a + 1}`, detalle: 'Lo que esperan vender y ganar en los próximos dos años.' },
      { bloque: 'cifras', titulo: 'Flujo de caja mensual', detalle: `De ${a - 1} y lo que va de ${a}.` },
    ] },
    { id: 'referencias', nombre: 'Valoraciones u ofertas', items: [
      { bloque: 'antecedentes', titulo: 'Valoraciones u ofertas de compra anteriores', detalle: 'El informe o la oferta, con su fecha.' },
    ] },
  ];
}

export type DatosLista = { empresa: string; contacto?: string; items: Item[]; fecha: string };

const mes = (f: string) => {
  const s = new Intl.DateTimeFormat('es-CO', { month: 'long', year: 'numeric', timeZone: 'America/Bogota' }).format(new Date(f + 'T12:00:00-05:00'));
  return s.charAt(0).toUpperCase() + s.slice(1).replace(' de ', ' de ');
};
const numero = ['cero', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis'];

export const archivoLista = (empresa: string) => `Documentos para la valoración ${empresa}`.replace(/[\\/:*?"<>|]+/g, '').trim() + '.pdf';

export function listaDocumentos(d: DatosLista, img: Marca): TDocumentDefinitions {
  const W = 612, H = 792, M = 64;
  const bloques = BLOQUES.map((b) => ({ ...b, items: d.items.filter((i) => i.bloque === b.id && i.titulo.trim()) })).filter((b) => b.items.length);
  const total = bloques.reduce((n, b) => n + b.items.length, 0);
  const altoCiudad = (W * 346) / 1200;
  let n = 0;

  const marcaBlanca: Content = {
    columns: [
      { width: '*', text: '' },
      { width: 20, canvas: [{ type: 'rect', x: 0, y: 4, w: 13, h: 5.5, r: 2.75, color: '#ffffff' }, { type: 'rect', x: 5, y: 11, w: 13, h: 5.5, r: 2.75, color: C.naranja }] },
      { width: 'auto', text: 'Relevo', bold: true, fontSize: 19, color: '#ffffff' },
      { width: '*', text: '' },
    ],
    columnGap: 6,
  };

  const portada: Content[] = [
    { ...marcaBlanca, margin: [0, 0, 0, 120] } as Content,
    { text: `Documentos para la valoración de ${d.empresa}`, bold: true, fontSize: 34, lineHeight: 1.02, color: '#ffffff', alignment: 'center', characterSpacing: -0.6, margin: [24, 0, 24, 14] },
    { image: img.brush, width: 120, alignment: 'center', margin: [0, 0, 0, 20] },
    { text: d.contacto ? `Lista de información para la valoración a fondo de ${d.empresa}, preparada para ${d.contacto}.` : `Lista de información para la valoración a fondo de ${d.empresa}.`, fontSize: 10.5, color: '#d9e3f2', alignment: 'center', margin: [70, 0, 70, 16], lineHeight: 1.3 },
    {
      columns: [{ width: '*', text: '' }, { width: 'auto', table: { body: [[{ text: mes(d.fecha), bold: true, fontSize: 9, color: C.ink, fillColor: C.naranja, margin: [10, 4, 10, 4] }]] }, layout: 'noBorders' }, { width: '*', text: '' }],
      pageBreak: 'after',
    },
  ];

  const cuerpo: Content[] = [
    { text: 'Lo que necesitamos para valorar tu empresa', bold: true, fontSize: 21, color: C.ink, characterSpacing: -0.4, margin: [0, 0, 0, 8] },
    { text: `Son ${total} documentos en ${numero[bloques.length] ?? bloques.length} ${bloques.length === 1 ? 'bloque' : 'bloques'}. Si algo no lo tienes a la mano, envía lo que tengas y avanzamos con eso.`, fontSize: 11, color: C.gris, lineHeight: 1.35, margin: [0, 0, 120, 18] },
  ];
  for (const b of bloques) {
    cuerpo.push({
      unbreakable: true,
      stack: [
        { columns: [{ width: 16, canvas: [{ type: 'line', x1: 0, y1: 7, x2: 11, y2: 7, lineWidth: 1.6, lineColor: C.naranja }] }, { text: b.titulo, bold: true, fontSize: 12.5, color: C.ink }], margin: [0, 6, 0, 4] },
        { text: b.texto, fontSize: 9, color: C.gris, margin: [0, 0, 0, 6] },
        { canvas: [{ type: 'line', x1: 0, y1: 0, x2: W - 2 * M, y2: 0, lineWidth: 0.6, lineColor: C.linea }] },
        ...fila(b.items.slice(0, 1)),
      ],
    });
    cuerpo.push(...fila(b.items.slice(1)));
    cuerpo.push({ text: '', margin: [0, 0, 0, 10] });
  }
  function fila(items: Item[]): Content[] {
    return items.map((i) => {
      n++;
      return {
        unbreakable: true,
        stack: [
          { columns: [
            { width: 22, text: String(n), bold: true, fontSize: 13, color: C.naranja, margin: [0, -1, 0, 0] },
            { stack: [{ text: i.titulo.trim(), bold: true, fontSize: 10, color: C.ink }, ...(i.detalle.trim() ? [{ text: i.detalle.trim(), fontSize: 9, color: C.gris, margin: [0, 2, 0, 0] as [number, number, number, number] }] : [])] },
          ], margin: [0, 8, 0, 8] },
          { canvas: [{ type: 'line', x1: 0, y1: 0, x2: W - 2 * M, y2: 0, lineWidth: 0.6, lineColor: C.linea }] },
        ],
      } as Content;
    });
  }
  cuerpo.push(
    { unbreakable: true, stack: [
      { table: { widths: ['*'], body: [[{ stack: [
        { text: [{ text: 'Confidencialidad. ', bold: true, color: C.azul }, `Toda la información que nos compartas se usa solo para la valoración de ${d.empresa} y no se comparte con terceros.`], fontSize: 9, color: C.ink, lineHeight: 1.3 },
      ], fillColor: C.suave, margin: [12, 10, 12, 10] }]] }, layout: 'noBorders', margin: [0, 6, 0, 18] },
      { text: 'Envíanos los documentos', bold: true, fontSize: 13, color: C.ink, margin: [0, 0, 0, 4] },
      { text: 'Responde el correo con los archivos o compártenos una carpeta. Tu contador también nos los puede enviar directamente.', fontSize: 10, color: C.gris, lineHeight: 1.3, margin: [0, 0, 0, 10] },
      { text: [{ text: 'Equipo Relevo', bold: true, color: C.ink }, { text: '  ·  relevobrokers.com', color: C.gris }], fontSize: 10 },
    ] },
  );

  return {
    pageSize: 'LETTER',
    pageMargins: [M, 60, M, 64],
    info: { title: `Documentos para la valoración de ${d.empresa}`, author: 'Equipo Relevo', subject: d.empresa },
    defaultStyle: { font: 'Sans', fontSize: 10, color: C.ink, lineHeight: 1.2 },
    background: (pagina: number) => (pagina === 1 ? [
      { canvas: [{ type: 'rect', x: 0, y: 0, w: W, h: H, color: C.azul }] },
      { image: img.ciudad, width: W, absolutePosition: { x: 0, y: H - altoCiudad } },
    ] : null) as any,
    footer: (pagina: number) => (pagina === 1 ? null : {
      margin: [M, 24, M, 0],
      columns: [{ image: img.logo, width: 54 }, { text: `Documentos para la valoración de ${d.empresa}`, fontSize: 8, color: C.gris, alignment: 'right', margin: [0, 3, 0, 0] }],
    }) as any,
    content: [{ stack: portada, margin: [0, 50, 0, 0] }, ...cuerpo],
  };
}
