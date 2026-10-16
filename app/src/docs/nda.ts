/**
 * Plantilla: Compromiso de Confidencialidad (NDA unilateral de RELEVO frente al propietario).
 * Texto idéntico al documento modelo de Unicaribe. Solo cambian los campos variables.
 */
import type { Content, TDocumentDefinitions } from 'pdfmake/interfaces';
import type { Marca } from './pdf';
import { fechaEnLetras, conPuntos } from './letras';

/** Datos de la sociedad que firma. */
export const RELEVO_SAS = { razon_social: 'RELEVO BROKERS S.A.S.', nit: '902.117.149-4', domicilio: 'Bogotá D.C.', rep_email: 'felipe@relevobrokers.com' };

/** Representante legal que firma en nombre de la SAS. */
export type Firmante = { nombre_legal: string; cedula: string; cedula_expedida: string; email: string; firma: string | null };
export type Modo = 'persona' | 'empresa' | 'ambas';
export type Propietario = { modo: Modo; nombre: string; cedula: string; cedula_expedida: string; email: string; razon_social: string | null; nombre_corto: string | null; nit: string | null };
export type DatosNda = { firmante: Firmante; propietario: Propietario; fecha: string; ciudad_firma: string };

/** Lo único indispensable para generar. Todo lo demás es opcional y, si falta, la frase se omite. */
export function faltantesNda(d: DatosNda): string[] {
  const f: string[] = [];
  const { firmante: s, propietario: p } = d;
  if (!s.nombre_legal) f.push('Nombre legal del representante legal (Mi perfil de Felipe)');
  if (!s.cedula) f.push('Cédula del representante legal (Mi perfil de Felipe)');
  if (!s.firma) f.push('Firma del representante legal (Mi perfil de Felipe)');
  if (p.modo !== 'empresa' && !p.nombre) f.push('Nombre de la persona');
  if (p.modo !== 'persona' && !p.razon_social) f.push('Razón social de la empresa');
  return f;
}

/** Datos que conviene tener pero no bloquean. */
export function sugeridosNda(d: DatosNda): string[] {
  const p = d.propietario, f: string[] = [];
  if (p.modo !== 'empresa' && !p.cedula) f.push('Cédula de la persona');
  if (p.modo !== 'persona' && !p.nit) f.push('NIT de la empresa');
  if (!p.email) f.push('Correo para notificaciones');
  return f;
}

const C = { ink: '#14243d', azul: '#2c5186', naranja: '#f47b3d', gris: '#5b6577' };
const B = (text: string): Content => ({ text, bold: true });
const empresaTexto = (p: Propietario) => (p.nombre_corto ? `${p.razon_social} (${p.nombre_corto})` : p.razon_social ?? '');
const cc = (cedula: string, exp: string) => (cedula ? `C.C. ${conPuntos(cedula)}${exp ? ` de ${exp}` : ''}` : '');
const nitTxt = (nit: string | null) => (nit ? (/[.-]/.test(nit) ? nit : conPuntos(nit)) : '');

export function nombreArchivoNda(p: Propietario) {
  const quien = (p.modo === 'persona' ? p.nombre : (p.nombre_corto || p.razon_social || p.nombre)).replace(/[^\p{L}\p{N} ]+/gu, '').trim();
  return `Compromiso de Confidencialidad - ${quien}.pdf`;
}

export function nda(d: DatosNda, img: Marca): TDocumentDefinitions {
  const { firmante: s, propietario: p } = d;
  const persona = p.modo !== 'empresa', empresa = p.modo !== 'persona';
  const parrafo = (text: Content[] | string, extra: object = {}): Content => ({ text, style: 'p', ...extra });
  const clausula = (titulo: string, cuerpo: (string | Content)[]): Content => parrafo([{ text: titulo + ' ', bold: true, color: C.azul }, ...cuerpo as any]);
  const ccS = cc(s.cedula, s.cedula_expedida), ccP = cc(p.cedula, p.cedula_expedida);

  const frentePersona: Content[] = [B(p.nombre.toUpperCase()), ccP ? `, identificado con ${ccP}` : ''];
  const frenteEmpresa: Content[] = [B(empresaTexto(p).toUpperCase()), p.nit ? `, NIT ${nitTxt(p.nit)}` : '', !persona && p.nombre ? `, representada por ${p.nombre}${ccP ? `, identificado con ${ccP}` : ''}` : ''];
  const intro: Content[] = [
    B(RELEVO_SAS.razon_social + ','), ` sociedad identificada con NIT ${RELEVO_SAS.nit}, domiciliada en ${RELEVO_SAS.domicilio}, representada legalmente por `, B(s.nombre_legal.toUpperCase() + ','),
    ` mayor de edad, identificado con ${ccS} (en adelante, `, B('RELEVO'), '), se obliga de manera unilateral frente a ',
    ...(persona && empresa
      ? [...frentePersona, ', y frente a ', ...frenteEmpresa, ' (en adelante, conjuntamente, ', B('EL PROPIETARIO'), ')']
      : persona ? [...frentePersona, ' (en adelante, ', B('EL PROPIETARIO'), ')'] : [...frenteEmpresa, ' (en adelante, ', B('EL PROPIETARIO'), ')']),
    ', a guardar la confidencialidad de su información en los siguientes términos.',
  ] as Content[];

  const consideraciones = [
    'EL PROPIETARIO evalúa la posible venta, total o parcial, de la empresa o de su participación en ella.',
    'RELEVO presta servicios de valoración y asesoría en la venta de empresas, y para evaluar la empresa necesita conocer información que EL PROPIETARIO considera reservada.',
    'Con este documento, RELEVO deja por escrito las condiciones en que recibirá, usará y protegerá esa información.',
  ];

  return {
    pageSize: 'LETTER',
    pageMargins: [72, 93, 72, 72],
    info: { title: 'Compromiso de Confidencialidad', author: 'Relevo Brokers S.A.S.', subject: (empresa ? empresaTexto(p) : '') || p.nombre },
    defaultStyle: { font: 'Sans', fontSize: 10.5, color: C.ink, lineHeight: 1.24 },
    styles: {
      p: { alignment: 'justify', margin: [0, 0, 0, 7] },
      h2: { font: 'Titulo', fontSize: 13, color: C.azul, margin: [0, 6, 0, 6], lineHeight: 1 },
    },
    header: () => ({
      margin: [72, 30, 72, 0],
      stack: [
        { columns: [
          { image: img.logo, width: 88 },
          { text: 'C O N F I D E N C I A L', alignment: 'right', fontSize: 8, bold: true, color: C.naranja, characterSpacing: 0.6, margin: [0, 9, 0, 0] },
        ] },
        { canvas: [{ type: 'line', x1: 0, y1: 10, x2: 468, y2: 10, lineWidth: 0.75, lineColor: C.azul }] },
      ],
    }),
    footer: (pagina, total) => ({
      margin: [72, 2, 72, 0],
      stack: [
        { image: img.brush, width: 72, margin: [0, 0, 0, 7] },
        { columns: [
          { text: `Relevo Brokers S.A.S.  ·  relevobrokers.com  ·  ${s.email}`, fontSize: 8, color: C.gris },
          { text: [{ text: 'Página ', fontSize: 8, color: C.gris }, { text: String(pagina), font: 'Serif', fontSize: 10 }, { text: ' de ', fontSize: 8, color: C.gris }, { text: String(total), font: 'Serif', fontSize: 10 }], alignment: 'right' },
        ] },
      ],
    }),
    content: [
      { text: 'Compromiso de Confidencialidad', font: 'Titulo', fontSize: 20, color: C.ink, lineHeight: 1, margin: [0, -2, 0, 4] },
      { image: img.brush, width: 144, margin: [0, 0, 0, 6] },
      { text: empresa ? empresaTexto(p) : p.nombre, italics: true, fontSize: 10, color: C.gris, margin: [0, 0, 0, 16] },
      parrafo(intro),
      { text: 'Consideraciones', style: 'h2' },
      { stack: consideraciones.map((t, i) => ({ columns: [{ text: `${i + 1}.`, width: 17, bold: true, color: C.azul, fontSize: 10 }, { text: t, fontSize: 10, alignment: 'justify' }], margin: [7, 0, 0, 5] })), margin: [0, 0, 0, 6] },
      { text: 'Cláusulas', style: 'h2' },
      clausula('Primera. Información Confidencial.', ['Es toda información que EL PROPIETARIO entregue a RELEVO, por cualquier medio, sobre la empresa: estados financieros, contabilidad, clientes, proveedores, contratos, deudas y planes, así como el hecho de que EL PROPIETARIO esté evaluando una venta. Incluye los análisis y valoraciones que RELEVO prepare con ella.']),
      clausula('Segunda. Exclusiones.', ['No es confidencial la información que: (a) sea pública, incluida la reportada a Supersociedades o Cámaras de Comercio; (b) RELEVO ya tuviera legítimamente; (c) RELEVO reciba de un tercero sin deber de reserva; o (d) deba revelarse por orden de autoridad, caso en el cual RELEVO avisará antes a EL PROPIETARIO, si la ley lo permite.']),
      clausula('Tercera. Obligaciones de RELEVO.', ['RELEVO usará la Información Confidencial solo para valorar la empresa y asesorar a EL PROPIETARIO en una posible venta, la protegerá con medidas de seguridad razonables y no la revelará a terceros. Podrá compartirla únicamente con: (a) sus asesores y proveedores de servicios tecnológicos que la necesiten y estén sujetos a reserva, respondiendo por ellos; y (b) posibles compradores, solo con autorización previa y escrita de EL PROPIETARIO, que puede darse por correo electrónico.']),
      clausula('Cuarta. Sin obligación para EL PROPIETARIO.', ['Este compromiso no obliga a EL PROPIETARIO a nada: ni a vender, ni a contratar a RELEVO, ni a guardar reserva alguna. Cualquier encargo de venta constará en un documento aparte. Las valoraciones de RELEVO son estimaciones y no constituyen oferta de compra.']),
      clausula('Quinta. Devolución.', ['A solicitud escrita de EL PROPIETARIO, RELEVO devolverá o destruirá la Información Confidencial dentro de los quince (15) días hábiles siguientes.']),
      clausula('Sexta. Vigencia.', ['Este compromiso rige desde su firma, es irrevocable y la obligación de reserva dura tres (3) años desde la última entrega de información.']),
      clausula('Séptima. Ley y controversias.', ['Este compromiso se rige por la ley colombiana. Cualquier diferencia se intentará resolver primero de forma directa y luego mediante conciliación, que podrá adelantarse de forma virtual. A falta de acuerdo, serán competentes los jueces de Bogotá D.C.']),
      clausula('Octava. Disposiciones finales.', [`RELEVO tratará los datos personales que reciba conforme a la Ley 1581 de 2012. Este compromiso se firma electrónicamente, conforme a la Ley 527 de 1999, y solo puede modificarse a favor de EL PROPIETARIO. Notificaciones: RELEVO en ${s.email}${p.email ? `; EL PROPIETARIO en ${p.email}` : '; EL PROPIETARIO en el correo que indique por escrito'}.`]),
      parrafo(`Se firma en ${d.ciudad_firma}, ${fechaEnLetras(d.fecha)}.`, { margin: [0, 0, 0, 0] }),
      {
        unbreakable: true,
        margin: [0, 6, 0, 0],
        stack: [
          s.firma ? { image: s.firma, fit: [201, 72], margin: [-11, 0, 0, 0] } : { text: ' ', margin: [0, 0, 0, 40] },
          { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 186, y2: 0, lineWidth: 0.6, lineColor: C.ink }] },
          { text: RELEVO_SAS.razon_social, bold: true, margin: [0, 3, 0, 0] },
          { text: `NIT ${RELEVO_SAS.nit}`, fontSize: 9.5, color: C.gris },
          { text: s.nombre_legal, margin: [0, 4, 0, 0] },
          { text: `Representante legal${ccS ? ' · ' + ccS : ''}`, fontSize: 9.5, color: C.gris },
        ],
      },
    ],
  };
}
