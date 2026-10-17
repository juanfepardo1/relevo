/** Formulario "Cuéntanos tu caso" (relevobrokers.com/caso). Las etiquetas y la limpieza de nombres deben coincidir con caso.html. */
export const LINK_FORM = (codigo: string) => `https://relevobrokers.com/caso?c=${codigo}`;

export const PREGUNTAS: { k: string; t: string; o: [string, string][] }[] = [
  { k: 'oferta', t: '¿Alguien le propuso comprar en los últimos 12 meses?', o: [['concreta', 'Sí, oferta concreta'], ['informal', 'Sí, informal'], ['no', 'No']] },
  { k: 'quien', t: '¿Quién?', o: [['empleado', 'Empleado o gerente'], ['socio', 'Socio'], ['familiar', 'Familiar'], ['competidor', 'Competidor'], ['proveedor', 'Proveedor'], ['cliente', 'Cliente'], ['inversionista', 'Inversionista o fondo'], ['otro', 'Otra persona']] },
  { k: 'avance', t: '¿Hasta dónde llegó?', o: [['mencion', 'Solo se mencionó'], ['precio', 'Hablaron de precio'], ['pago', 'Hablaron de forma de pago'], ['casi', 'Casi cierran'], ['cayo', 'Se cayó']] },
  { k: 'freno', t: '¿Qué impidió cerrar?', o: [['plata', 'Comprador sin toda la plata'], ['precio', 'Desacuerdo en precio'], ['confianza', 'Inseguridad con el proceso'], ['legal', 'No sabe cómo hacerlo legalmente'], ['impuestos', 'Impuestos'], ['no_listo', 'No está listo'], ['otro', 'Otra razón']] },
  { k: 'precio_def', t: '¿Cómo define el precio?', o: [['creo', 'Lo que cree que vale'], ['contador', 'Lo que dice el contador'], ['oferta', 'Lo que le ofrezcan'], ['valoracion', 'Valoración profesional'], ['no', 'No lo ha pensado']] },
  { k: 'cuotas', t: '¿Acepta parte en cuotas?', o: [['si', 'Sí'], ['garantias', 'Sí, con garantías'], ['no', 'No, todo al cierre']] },
  { k: 'seguridad', t: '¿Qué lo haría sentir seguro?', o: [['precio_justo', 'Precio justo'], ['contrato', 'Contrato bien hecho'], ['pago_garantizado', 'Pago garantizado'], ['negociador', 'Alguien que negocie'], ['impuestos', 'Impuestos bien manejados']] },
  { k: 'utilidad', t: 'Utilidad antes de impuestos', o: [['perdida', 'Pierde o cero'], ['lt100', 'Menos de $100M'], ['100_250', '$100M a $250M'], ['250_500', '$250M a $500M'], ['gt500', 'Más de $500M'], ['nd', 'No dijo']] },
  { k: 'tendencia', t: 'Ventas en 3 años', o: [['crece', 'Creciendo'], ['estable', 'Estables'], ['baja', 'Bajando']] },
  { k: 'deuda', t: 'Deuda financiera', o: [['ninguna', 'Ninguna'], ['lt200', 'Menos de $200M'], ['200_500', '$200M a $500M'], ['gt500', 'Más de $500M'], ['nd', 'No dijo']] },
  { k: 'dependencia', t: '¿Funciona 3 meses sin el dueño?', o: [['si', 'Sí'], ['parcial', 'Más o menos'], ['no', 'No, depende de él']] },
  { k: 'concentracion', t: '¿Cliente de más del 30%?', o: [['no', 'No'], ['si', 'Sí']] },
  { k: 'contabilidad', t: 'Contabilidad', o: [['formal', 'Formal'], ['mixta', 'Formal en parte'], ['informal', 'Mayormente informal']] },
  { k: 'que_vende', t: 'Qué quiere vender', o: [['todo', 'Todo'], ['mayoria', 'La mayoría'], ['socio', 'Que entre un socio'], ['nose', 'No sabe']] },
  { k: 'transicion', t: '¿Acompaña la transición?', o: [['si', 'Sí, lo que haga falta'], ['corto', 'Unos meses'], ['no', 'Sale de inmediato']] },
  { k: 'llamada', t: '¿Acepta una llamada?', o: [['si', 'Sí'], ['no', 'Por ahora no']] },
];

export const etiqueta = (k: string, v: unknown): string => {
  const p = PREGUNTAS.find((x) => x.k === k);
  const una = (x: string) => p?.o.find(([c]) => c === x)?.[1] ?? x;
  return Array.isArray(v) ? v.map(String).map(una).join(', ') : v == null ? '' : una(String(v));
};

export type Respuesta = Record<string, any>;

/** Los 4 números de la hipótesis del mercado informal. */
export function embudo(rs: Respuesta[]) {
  const n = rs.length;
  const conv = rs.filter((r) => r.oferta && r.oferta !== 'no');
  const avanz = conv.filter((r) => ['precio', 'pago', 'casi', 'cayo'].includes(r.avance));
  const plata = conv.filter((r) => (r.freno || []).includes('plata'));
  const sinBase = rs.filter((r) => ['creo', 'contador', 'oferta', 'no'].includes(r.precio_def));
  const cuotas = rs.filter((r) => r.cuotas === 'si' || r.cuotas === 'garantias');
  const llamar = rs.filter((r) => r.llamada === 'si');
  return { n, conv: conv.length, avanz: avanz.length, plata: plata.length, sinBase: sinBase.length, cuotas: cuotas.length, llamar: llamar.length };
}

/** Señal rápida para la ficha: ¿hay un negocio casi hecho? */
export function senal(r: Respuesta): 'caliente' | 'tibio' | 'frio' {
  if (r.oferta && r.oferta !== 'no' && ['precio', 'pago', 'casi'].includes(r.avance)) return 'caliente';
  if (r.oferta && r.oferta !== 'no') return 'tibio';
  return 'frio';
}

/* Nombres como los escribió el lead: a veces vienen mal o vacíos. Si no se ven bien, mejor no usarlos. */
const TITULOS = new Set(['sr', 'sra', 'srta', 'don', 'dona', 'doña', 'dr', 'dra', 'ing', 'lic', 'arq']);
const NO_NOMBRE = new Set(['gerencia', 'gerente', 'admin', 'administracion', 'administración', 'info', 'contacto', 'ventas', 'empresa', 'prueba', 'test', 'na', 'ninguno', 'usuario', 'cliente', 'propietario', 'dueno', 'dueño']);
const NO_EMPRESA = /^((una|mi|la|nuestra) empresa.*|(una|mi) (compañía|compania|firma|sociedad|negocio).*|n\/?a|no|ninguna|ninguno|empresa|privad[ao]|confidencial|prueba|test|x+|\.+|-+|sin nombre|no aplica|reservad[ao]|educaci[oó]n|salud|comercio|transporte|construcci[oó]n|servicios|restaurante|alimentos|tecnolog[ií]a|agro|manufactura|log[ií]stica|turismo|retail)$/i;
const titulo = (w: string) => (w.length <= 3 && w === w.toUpperCase() && /[A-ZÁÉÍÓÚÑ]/.test(w) ? w : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());

/** Primer nombre presentable, o '' si no se ve confiable. */
export function nombrePila(n: unknown): string {
  const ws = String(n ?? '').replace(/^[^\p{L}]+/u, '').replace(/^PRUEBA\s+/i, '').trim().split(/\s+/).filter(Boolean);
  while (ws.length && TITULOS.has(ws[0].replace(/\./g, '').toLowerCase())) ws.shift();
  const w = ws[0] || '';
  if (!/^[\p{L}'’]{2,20}$/u.test(w) || NO_NOMBRE.has(w.toLowerCase())) return '';
  return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
}

/** Nombre de empresa presentable (sin S.A.S, sin mayúsculas sostenidas), o '' si no se ve confiable. */
export function empresaLimpia(e: unknown): string {
  let t = String(e ?? '').replace(/^[^\p{L}\p{N}]+/u, '').replace(/^PRUEBA\s+/i, '').replace(/\(.*?\)/g, '').replace(/[*]+/g, '').split(/[,;|]/)[0].trim();
  t = t.replace(/\s+(s\.?\s?a\.?\s?s\.?|s\.?\s?a\.?|ltda\.?|e\.?\s?u\.?|s\.?\s?en\s?c\.?|bic)\.?$/i, '').replace(/\s+(s\.?\s?a\.?\s?s\.?)$/i, '').trim();
  if (t.length < 3 || t.length > 60 || NO_EMPRESA.test(t) || /@|https?:|www\./i.test(t) || !/\p{L}/u.test(t)) return '';
  if (t === t.toUpperCase()) t = t.split(/\s+/).map(titulo).join(' ');
  return t;
}
