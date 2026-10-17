/** Formulario "Afina tu valoración" (relevobrokers.com/afinar). Las etiquetas deben coincidir con afinar.html. */
export const LINK_FORM = (codigo: string) => `https://relevobrokers.com/afinar?c=${codigo}`;

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
