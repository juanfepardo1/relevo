/** Filas de los estados financieros. Las usan la pantalla y el PDF, para que digan lo mismo. */
import { resultadosPuc, flujoPuc, balance, GRUPOS, CAPITAL, CONSTITUCION, cop, type Mov } from './finanzas';

export type Fila = { l: string; c?: string; v: number[]; t: number; k?: 'tot' | 'resultado' | 'grupo' };
export type Linea = { l: string; c?: string; v?: number; k?: 'tot' | 'resultado' | 'grupo' | 'subcta' };
export type Presentacion = 'activo' | 'patrimonio';

export const fechaLarga = (d: string) => new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(d + 'T12:00:00Z'));
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

export function estadoResultados(movs: Mov[]) {
  const r = resultadosPuc(movs);
  const n = r.meses.length, cero = Array(n).fill(0);
  const grupo = (c: string, l: string, lineas: { codigo: string; nombre: string; porMes: number[]; total: number }[], tot: { porMes: number[]; total: number }, totL: string): Fila[] =>
    lineas.length ? [{ c, l, v: [], t: 0, k: 'grupo' }, ...lineas.map((x) => ({ c: x.codigo, l: x.nombre, v: x.porMes, t: x.total })), { l: totL, v: tot.porMes, t: tot.total, k: 'tot' }] : [];
  const res = (l: string, x: { porMes: number[]; total: number }): Fila => ({ l, v: x.porMes, t: x.total, k: 'resultado' });
  const filas: Fila[] = [
    ...grupo('41', GRUPOS['41'], r.i41, r.t41, 'Total ingresos operacionales'),
    ...(r.i41.length ? [] : [{ c: '41', l: GRUPOS['41'], v: cero, t: 0, k: 'tot' as const }]),
    ...grupo('51', GRUPOS['51'], r.g51, r.t51, 'Total gastos de administración'),
    ...grupo('52', GRUPOS['52'], r.g52, r.t52, 'Total gastos de ventas'),
    res(r.operacional.total >= 0 ? 'Utilidad operacional' : 'Pérdida operacional', r.operacional),
    ...grupo('42', GRUPOS['42'], r.i42, r.t42, 'Total ingresos no operacionales'),
    ...grupo('53', GRUPOS['53'], r.g53, r.t53, 'Total gastos no operacionales'),
    res(r.antesImp.total >= 0 ? 'Utilidad antes de impuestos' : 'Pérdida antes de impuestos', r.antesImp),
    { c: '54', l: 'Impuesto de renta y complementarios', v: cero, t: 0 },
    res(r.neta.total >= 0 ? 'Utilidad neta del ejercicio' : 'Pérdida neta del ejercicio', r.neta),
  ];
  const kpis: [string, number][] = [['Ingresos operacionales', r.t41.total], ['Gastos operacionales', r.t51.total + r.t52.total], [r.neta.total >= 0 ? 'Utilidad neta' : 'Pérdida neta', r.neta.total]];
  const notas = [
    'Cifras en pesos colombianos, base caja.',
    `Incluye ${cop(r.preoperativos)} de gastos preoperativos, causados antes de la constitución de la sociedad el ${fechaLarga(CONSTITUCION)}.`,
    'El impuesto de renta lo calcula el contador al cierre del ejercicio.',
  ];
  return { meses: r.meses, filas, kpis, notas, r };
}

export function estadoFlujo(movs: Mov[]) {
  const f = flujoPuc(movs);
  const filas: Fila[] = [
    { l: 'Actividades de operación', v: [], t: 0, k: 'grupo' },
    { l: 'Cobros a clientes', v: f.cobros, t: sum(f.cobros) },
    { l: 'Pagos a proveedores', v: f.pagos, t: sum(f.pagos) },
    { l: 'Efectivo neto de actividades de operación', v: f.op, t: sum(f.op), k: 'tot' },
    { l: 'Actividades de inversión', v: [], t: 0, k: 'grupo' },
    { l: 'Efectivo neto de actividades de inversión', v: f.op.map(() => 0), t: 0, k: 'tot' },
    { l: 'Actividades de financiación', v: [], t: 0, k: 'grupo' },
    { c: '3105', l: 'Aportes de capital', v: f.capital, t: sum(f.capital) },
    { c: '2355', l: 'Reembolsos a socios', v: f.pagadoSocios, t: sum(f.pagadoSocios) },
    { l: 'Efectivo neto de actividades de financiación', v: f.fin, t: sum(f.fin), k: 'tot' },
    { l: 'Aumento (disminución) neto del efectivo', v: f.neto, t: sum(f.neto), k: 'resultado' },
    { l: 'Efectivo al inicio del periodo', v: f.inicio, t: 0 },
    { c: '11', l: 'Efectivo al final del periodo', v: f.final, t: f.final[f.final.length - 1] ?? 0, k: 'tot' },
  ];
  const kpis: [string, number][] = [['Efectivo neto de operación', sum(f.op)], ['Financiación de socios', sum(f.fin)], ['Efectivo al final', f.final[f.final.length - 1] ?? 0]];
  const notas = [
    'Método directo, sobre el efectivo de Relevo (1105 Caja y 1110 Bancos).',
    'Los aportes a la cuenta de Relevo son capital. Los gastos que pagan los socios de su bolsillo no mueven el efectivo de Relevo: aumentan la deuda con ellos (2355).',
    ...(f.sinCaja.gastosSocios > 0 || f.sinCaja.ingresosSocios > 0 ? [`Transacciones que no movieron efectivo: gastos pagados por los socios ${cop(f.sinCaja.gastosSocios)}${f.sinCaja.ingresosSocios ? `, ingresos cobrados por los socios ${cop(f.sinCaja.ingresosSocios)}` : ''}.`] : []),
  ];
  return { meses: f.meses, filas, kpis, notas, f };
}

export function estadoSituacion(movs: Mov[], corte: string, modo: Presentacion) {
  const b = balance(movs, corte);
  const constituida = corte >= CAPITAL.fecha;
  const cxc = modo === 'activo' ? b.porCobrar : 0;
  const capital = modo === 'activo' ? b.pagado + b.porCobrar : b.pagado;
  const activo = b.efectivo + cxc;
  const patrimonio = capital + b.resultado;
  const gan = b.resultado >= 0;
  const activoL: Linea[] = [
    { c: '1', l: 'Activo', k: 'grupo' }, { c: '11', l: 'Efectivo y equivalentes al efectivo', k: 'grupo' },
    { c: '1105', l: 'Caja', v: b.caja },
    { c: '1110', l: 'Bancos (cuenta de Relevo)', v: b.bancos },
    ...(modo === 'activo' && constituida ? [{ c: '13', l: 'Deudores', k: 'grupo' as const }, { c: '1325', l: 'Cuentas por cobrar a socios y accionistas', v: cxc }, { l: 'Capital suscrito pendiente de pago', k: 'subcta' as const }] : []),
    { l: 'Total activo corriente', v: activo, k: 'tot' },
    { l: 'Total activo', v: activo, k: 'tot' },
  ];
  const pasivoL: Linea[] = [
    { c: '2', l: 'Pasivo', k: 'grupo' }, { c: '23', l: 'Cuentas por pagar', k: 'grupo' },
    { c: '2355', l: 'Deudas con accionistas o socios', v: b.pasivo },
    { l: 'Juan Felipe Pardo (Pardo)', v: b.cuenta.felipe, k: 'subcta' },
    { l: 'Alejandro González (Alejo)', v: b.cuenta.alejandro, k: 'subcta' },
    { l: 'Total pasivo', v: b.pasivo, k: 'tot' },
  ];
  const patL: Linea[] = [
    { c: '3', l: 'Patrimonio', k: 'grupo' },
    { c: '3105', l: modo === 'activo' ? 'Capital suscrito' : 'Capital suscrito y pagado', v: capital },
    ...(constituida ? [
      { c: '310505', l: 'Capital autorizado', v: CAPITAL.autorizado, k: 'subcta' as const },
      { c: '310510', l: 'Capital por suscribir', v: -(CAPITAL.autorizado - CAPITAL.suscrito), k: 'subcta' as const },
      ...(modo === 'patrimonio' ? [{ c: '310515', l: 'Capital suscrito por cobrar', v: -b.porCobrar, k: 'subcta' as const }] : []),
    ] : []),
    { c: gan ? '3605' : '3610', l: gan ? 'Utilidad del ejercicio' : 'Pérdida del ejercicio', v: b.resultado, k: 'resultado' },
    { l: 'Total patrimonio', v: patrimonio, k: 'tot' },
  ];
  const totalPP = b.pasivo + patrimonio;
  const notas = [
    'Cifras en pesos colombianos.',
    'Lo que los socios pagan de su bolsillo queda como deuda de la sociedad con ellos (2355). Los aportes a la cuenta de Relevo son capital pagado.',
    `Capital autorizado ${cop(CAPITAL.autorizado)}, suscrito ${cop(CAPITAL.suscrito)}, pagado ${cop(b.pagado)}.`,
    modo === 'activo' ? 'El capital suscrito pendiente de pago se presenta como cuenta por cobrar a los accionistas (1325).' : 'El capital suscrito pendiente de pago se presenta restando del patrimonio (NIIF para Pymes, sección 22.7).',
  ];
  const csv: [string, string, number | ''][] = [...activoL, ...pasivoL, ...patL, { l: 'Total pasivo y patrimonio', v: totalPP }].filter((x) => x.k !== 'grupo').map((x) => [x.c ?? '', x.l, x.v ?? '']);
  return { b, activo, patrimonio, totalPP, activoL, pasivoL, patL, notas, csv, cuadra: Math.round(activo) === Math.round(totalPP) };
}
