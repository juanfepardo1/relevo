import type { Opt } from './catalogos';

export type Mov = { id: string; fecha: string; tipo: 'ingreso' | 'gasto' | 'aporte' | 'reembolso'; categoria: string; descripcion: string | null; monto: number; pagado_por: 'felipe' | 'alejandro' | 'relevo' };
export type Tratamiento = 'deuda' | 'aporte';

export const TIPOS: Opt[] = [['gasto', 'Gasto'], ['ingreso', 'Ingreso'], ['aporte', 'Aporte a la cuenta de Relevo'], ['reembolso', 'Reembolso a socio']];
export const CAT_GASTO: Opt[] = [['marketing', 'Marketing'], ['software', 'Herramientas y software'], ['hosting', 'Dominio y hosting'], ['legal', 'Legal y registro'], ['transporte', 'Transporte'], ['otros', 'Otros gastos']];
export const CAT_INGRESO: Opt[] = [['exito', 'Comisión de éxito'], ['valoracion', 'Valoraciones'], ['asesoria', 'Asesoría'], ['otros_ingresos', 'Otros ingresos']];
export const CAT_MOV: Opt[] = [['aporte', 'Aporte'], ['reembolso', 'Reembolso']];
export const categoriasDe = (tipo: string): Opt[] => (tipo === 'gasto' ? CAT_GASTO : tipo === 'ingreso' ? CAT_INGRESO : tipo === 'aporte' ? [['aporte', 'Aporte']] : [['reembolso', 'Reembolso']]);
export const TODAS_CAT: Opt[] = [...CAT_GASTO, ...CAT_INGRESO, ...CAT_MOV];
export const QUIEN: Opt[] = [['felipe', 'Pardito'], ['alejandro', 'Alejito'], ['relevo', 'Cuenta de Relevo']];
export const SOCIOS = ['felipe', 'alejandro'] as const;

const nf = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 });
export const cop = (v: number) => (v < 0 ? '-$' : '$') + nf.format(Math.abs(Math.round(v)));
const mf = new Intl.DateTimeFormat('es-CO', { month: 'short', year: 'numeric', timeZone: 'UTC' });
export const nombreMes = (m: string) => mf.format(new Date(m + '-15T00:00:00Z')).replace('.', '').replace(' de ', ' ');

export function meses(movs: Mov[]): string[] {
  return [...new Set(movs.map((m) => m.fecha.slice(0, 7)))].sort();
}
const suma = (xs: Mov[]) => xs.reduce((a, m) => a + Number(m.monto), 0);

/** Estado de resultados: filas por categoría, columnas por mes. */
export function resultados(movs: Mov[]) {
  const ms = meses(movs);
  const linea = (tipo: 'ingreso' | 'gasto', cats: Opt[]) => cats.map(([k, l]) => {
    const xs = movs.filter((m) => m.tipo === tipo && m.categoria === k);
    return { k, l, porMes: ms.map((mm) => suma(xs.filter((m) => m.fecha.startsWith(mm)))), total: suma(xs) };
  }).filter((r) => r.total !== 0);
  const ingresos = linea('ingreso', CAT_INGRESO);
  const gastos = linea('gasto', CAT_GASTO);
  const tot = (rs: { porMes: number[]; total: number }[]) => ({ porMes: ms.map((_, i) => rs.reduce((a, r) => a + r.porMes[i], 0)), total: rs.reduce((a, r) => a + r.total, 0) });
  const ti = tot(ingresos), tg = tot(gastos);
  return { meses: ms, ingresos, gastos, totalIngresos: ti, totalGastos: tg, resultado: { porMes: ms.map((_, i) => ti.porMes[i] - tg.porMes[i]), total: ti.total - tg.total } };
}

/**
 * Efecto de cada movimiento en la caja de Relevo y en la cuenta de cada socio.
 * Cuenta del socio = lo que el socio ha puesto por Relevo, neto de lo que ha recibido.
 */
function efecto(m: Mov) {
  const v = Number(m.monto);
  const p = m.pagado_por;
  switch (m.tipo) {
    case 'gasto': return p === 'relevo' ? { caja: -v } : { caja: 0, socio: p, cuenta: v };
    case 'ingreso': return p === 'relevo' ? { caja: v } : { caja: 0, socio: p, cuenta: -v };
    case 'aporte': return { caja: v, socio: p === 'relevo' ? undefined : p, cuenta: v };
    case 'reembolso': return { caja: -v, socio: p === 'relevo' ? undefined : p, cuenta: -v };
  }
}

/** Flujo de caja por mes: cuánto movió la cuenta de Relevo y cuánto pusieron los socios de su bolsillo. */
export function flujo(movs: Mov[]) {
  const ms = meses(movs);
  const fila = (f: (m: Mov) => number) => ms.map((mm) => movs.filter((m) => m.fecha.startsWith(mm)).reduce((a, m) => a + f(m), 0));
  const entradasRelevo = fila((m) => (m.pagado_por === 'relevo' && m.tipo === 'ingreso') || m.tipo === 'aporte' ? Number(m.monto) : 0);
  const salidasRelevo = fila((m) => (m.pagado_por === 'relevo' && m.tipo === 'gasto') || m.tipo === 'reembolso' ? Number(m.monto) : 0);
  const porSocio = SOCIOS.map((s) => ({ s, porMes: fila((m) => (m.tipo === 'gasto' && m.pagado_por === s ? Number(m.monto) : 0)) }));
  const cobradoSocio = SOCIOS.map((s) => ({ s, porMes: fila((m) => (m.tipo === 'ingreso' && m.pagado_por === s ? Number(m.monto) : 0)) }));
  let acum = 0;
  const cajaFinal = ms.map((_, i) => (acum += entradasRelevo[i] - salidasRelevo[i]));
  const gastoTotal = fila((m) => (m.tipo === 'gasto' ? Number(m.monto) : 0));
  return { meses: ms, entradasRelevo, salidasRelevo, cajaFinal, porSocio, cobradoSocio, gastoTotal };
}

/** Balance a la fecha de corte. */
export function balance(movs: Mov[], corte: string, trato: Tratamiento) {
  const xs = movs.filter((m) => m.fecha <= corte);
  let caja = 0;
  const cuenta: Record<string, number> = { felipe: 0, alejandro: 0 };
  for (const m of xs) { const e = efecto(m); caja += e.caja; if (e.socio) cuenta[e.socio] += e.cuenta ?? 0; }
  const r = resultados(xs).resultado.total;
  const socios = cuenta.felipe + cuenta.alejandro;
  return {
    caja, cuenta, resultado: r,
    pasivo: trato === 'deuda' ? socios : 0,
    capital: trato === 'aporte' ? socios : 0,
    patrimonio: (trato === 'aporte' ? socios : 0) + r,
    cuadra: Math.round(caja) === Math.round(socios + r),
  };
}

/** Cuentas entre socios: cuánto ha puesto cada uno y la transferencia para quedar 50/50. */
export function socios(movs: Mov[]) {
  const puesto: Record<string, number> = { felipe: 0, alejandro: 0 };
  for (const m of movs) { const e = efecto(m); if (e.socio) puesto[e.socio] += e.cuenta ?? 0; }
  const total = puesto.felipe + puesto.alejandro;
  const mitad = total / 2;
  const dif = puesto.felipe - mitad; // > 0: Alejito le debe a Pardito
  return { puesto, total, mitad, transferencia: Math.abs(dif), de: dif > 0 ? 'alejandro' : 'felipe', a: dif > 0 ? 'felipe' : 'alejandro' };
}

export function csv(nombre: string, filas: (string | number)[][]) {
  const txt = filas.map((f) => f.map((c) => { const s = String(c ?? ''); return /[",;\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }).join(',')).join('\n');
  const url = URL.createObjectURL(new Blob(['﻿' + txt], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a'); a.href = url; a.download = nombre + '.csv'; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
