import type { Opt } from './catalogos';

export type Mov = { id: string; fecha: string; tipo: 'ingreso' | 'gasto' | 'aporte' | 'reembolso'; categoria: string; descripcion: string | null; monto: number; pagado_por: 'felipe' | 'alejandro' | 'relevo'; soporte_path?: string | null };
export type Tratamiento = 'deuda' | 'aporte';

export const TIPOS: Opt[] = [['gasto', 'Gasto'], ['ingreso', 'Ingreso'], ['aporte', 'Aporte de capital (a la cuenta de Relevo)'], ['reembolso', 'Reembolso a socio']];
export const CAT_GASTO: Opt[] = [['marketing', 'Marketing'], ['software', 'Herramientas y software'], ['hosting', 'Dominio y hosting'], ['legal', 'Legal y registro'], ['transporte', 'Transporte'], ['otros', 'Otros gastos']];
export const CAT_INGRESO: Opt[] = [['exito', 'Comisión de éxito'], ['valoracion', 'Valoraciones'], ['asesoria', 'Asesoría'], ['otros_ingresos', 'Otros ingresos']];
export const CAT_MOV: Opt[] = [['aporte', 'Aporte'], ['reembolso', 'Reembolso']];
export const categoriasDe = (tipo: string): Opt[] => (tipo === 'gasto' ? CAT_GASTO : tipo === 'ingreso' ? CAT_INGRESO : tipo === 'aporte' ? [['aporte', 'Aporte']] : [['reembolso', 'Reembolso']]);
export const TODAS_CAT: Opt[] = [...CAT_GASTO, ...CAT_INGRESO, ...CAT_MOV];
export const QUIEN: Opt[] = [['felipe', 'Pardo'], ['alejandro', 'Alejo'], ['relevo', 'Relevo']];
/** A nombre de quién puede registrar el usuario: él mismo o Relevo. */
export const quienPuede = (socio: string | null | undefined, soloSocio = false): Opt[] => QUIEN.filter(([k]) => k === socio || (!soloSocio && k === 'relevo'));
export const puedeEditar = (pagadoPor: string, socio: string | null | undefined) => pagadoPor === 'relevo' || pagadoPor === socio;
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
/** Capital de Relevo Brokers S.A.S. según el certificado de Cámara de Comercio. */
export const CAPITAL = { fecha: '2026-10-16', autorizado: 50_000_000, suscrito: 5_000_000, pagado: 10_000 };

/**
 * Situación financiera al corte.
 * - El capital pagado inicial está en efectivo (1105 Caja) desde la constitución.
 * - Los aportes a la cuenta de Relevo son capital pagado (3105) y entran a 1110 Bancos.
 * - Lo que un socio paga de su bolsillo es deuda de la SAS con él (2355); los reembolsos la disminuyen.
 */
export function balance(movs: Mov[], corte: string, _trato?: Tratamiento) {
  const xs = movs.filter((m) => m.fecha <= corte);
  const inicial = corte >= CAPITAL.fecha ? CAPITAL.pagado : 0;
  const v = (m: Mov) => Number(m.monto);
  let bancos = 0;
  const deuda: Record<string, number> = { felipe: 0, alejandro: 0 };
  const aportes: Record<string, number> = { felipe: 0, alejandro: 0 };
  for (const m of xs) {
    const p = m.pagado_por;
    if (m.tipo === 'gasto') { if (p === 'relevo') bancos -= v(m); else deuda[p] += v(m); }
    else if (m.tipo === 'ingreso') { if (p === 'relevo') bancos += v(m); else deuda[p] -= v(m); }
    else if (m.tipo === 'aporte') { bancos += v(m); if (p !== 'relevo') aportes[p] += v(m); }
    else if (m.tipo === 'reembolso') { bancos -= v(m); if (p !== 'relevo') deuda[p] -= v(m); }
  }
  const r = resultados(xs).resultado.total;
  const pasivo = deuda.felipe + deuda.alejandro;
  const pagado = inicial + aportes.felipe + aportes.alejandro;
  const caja = inicial;
  return {
    caja, bancos, efectivo: caja + bancos, cuenta: deuda, aportes, resultado: r, pagado, pasivo,
    porCobrar: Math.max(0, CAPITAL.suscrito - pagado), excedeSuscrito: pagado > CAPITAL.suscrito,
    patrimonio: pagado + r,
    cuadra: Math.round(caja + bancos) === Math.round(pasivo + pagado + r),
  };
}

/** Cuentas entre socios: cuánto ha puesto cada uno y la transferencia para quedar 50/50. */
export type Transfer = { id: string; fecha: string; de: 'felipe' | 'alejandro'; a: 'felipe' | 'alejandro'; monto: number; nota: string | null; soporte_path: string | null };

/** Lo puesto por cada socio, neto de transferencias entre ellos: quien transfiere suma, quien recibe resta. */
export function socios(movs: Mov[], transf: Transfer[] = []) {
  const puesto: Record<string, number> = { felipe: 0, alejandro: 0 };
  const enRelevo: Record<string, number> = { felipe: 0, alejandro: 0 };
  for (const m of movs) { const e = efecto(m); if (e.socio) { puesto[e.socio] += e.cuenta ?? 0; enRelevo[e.socio] += e.cuenta ?? 0; } }
  const cruces: Record<string, number> = { felipe: 0, alejandro: 0 };
  for (const t of transf) { puesto[t.de] += Number(t.monto); puesto[t.a] -= Number(t.monto); cruces[t.de] += Number(t.monto); cruces[t.a] -= Number(t.monto); }
  const total = puesto.felipe + puesto.alejandro;
  const mitad = total / 2;
  const dif = puesto.felipe - mitad; // > 0: Alejo le debe a Pardo
  return { puesto, enRelevo, cruces, total, mitad, transferencia: Math.abs(dif), de: dif > 0 ? 'alejandro' : 'felipe', a: dif > 0 ? 'felipe' : 'alejandro' };
}

export function csv(nombre: string, filas: (string | number)[][]) {
  const txt = filas.map((f) => f.map((c) => { const s = String(c ?? ''); return /[",;\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }).join(',')).join('\n');
  const url = URL.createObjectURL(new Blob(['﻿' + txt], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a'); a.href = url; a.download = nombre + '.csv'; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ---------- PUC (Decreto 2650 de 1993), a 4 dígitos ---------- */
/** Fecha de constitución de Relevo Brokers S.A.S. Lo anterior son gastos preoperativos. */
export const CONSTITUCION = '2026-10-16';
type Cta = { codigo: string; nombre: string; grupo: '41' | '42' | '51' | '52' | '53' };
export const GRUPOS: Record<Cta['grupo'], string> = {
  '41': 'Ingresos operacionales', '42': 'Ingresos no operacionales',
  '51': 'Gastos operacionales de administración', '52': 'Gastos operacionales de ventas', '53': 'Gastos no operacionales',
};
/** Categoría de la app → cuenta del PUC. */
export const PUC: Record<string, Cta> = {
  exito: { codigo: '4155', nombre: 'Actividades inmobiliarias, empresariales y de alquiler', grupo: '41' },
  valoracion: { codigo: '4155', nombre: 'Actividades inmobiliarias, empresariales y de alquiler', grupo: '41' },
  asesoria: { codigo: '4155', nombre: 'Actividades inmobiliarias, empresariales y de alquiler', grupo: '41' },
  otros_ingresos: { codigo: '4295', nombre: 'Diversos', grupo: '42' },
  software: { codigo: '5135', nombre: 'Servicios', grupo: '51' },
  hosting: { codigo: '5135', nombre: 'Servicios', grupo: '51' },
  legal: { codigo: '5140', nombre: 'Gastos legales', grupo: '51' },
  transporte: { codigo: '5155', nombre: 'Gastos de viaje', grupo: '51' },
  otros: { codigo: '5195', nombre: 'Diversos', grupo: '51' },
  marketing: { codigo: '5235', nombre: 'Servicios (publicidad y promoción)', grupo: '52' },
};
export const cuentaDe = (categoria: string, tipo: string): Cta => PUC[categoria] ?? (tipo === 'ingreso' ? PUC.otros_ingresos : PUC.otros);

type Linea = { codigo: string; nombre: string; porMes: number[]; total: number };
const porCuenta = (movs: Mov[], ms: string[], grupo: Cta['grupo']): Linea[] => {
  const m = new Map<string, Linea>();
  for (const x of movs) {
    if (x.tipo !== 'ingreso' && x.tipo !== 'gasto') continue;
    const c = cuentaDe(x.categoria, x.tipo);
    if (c.grupo !== grupo) continue;
    const l = m.get(c.codigo) ?? { codigo: c.codigo, nombre: c.nombre, porMes: ms.map(() => 0), total: 0 };
    const i = ms.indexOf(x.fecha.slice(0, 7)); l.porMes[i] += Number(x.monto); l.total += Number(x.monto);
    m.set(c.codigo, l);
  }
  return [...m.values()].sort((a, b) => a.codigo.localeCompare(b.codigo));
};
const sumaL = (ls: Linea[], n: number) => ({ porMes: Array.from({ length: n }, (_, i) => ls.reduce((a, l) => a + l.porMes[i], 0)), total: ls.reduce((a, l) => a + l.total, 0) });
const resta = (a: { porMes: number[]; total: number }, ...bs: { porMes: number[]; total: number }[]) => ({ porMes: a.porMes.map((v, i) => bs.reduce((x, b) => x - b.porMes[i], v)), total: bs.reduce((x, b) => x - b.total, a.total) });
const mas = (a: { porMes: number[]; total: number }, b: { porMes: number[]; total: number }) => ({ porMes: a.porMes.map((v, i) => v + b.porMes[i]), total: a.total + b.total });

/** Estado de resultados con la estructura del PUC. Base caja. */
export function resultadosPuc(movs: Mov[]) {
  const ms = meses(movs), n = ms.length;
  const g = (k: Cta['grupo']) => porCuenta(movs, ms, k);
  const i41 = g('41'), i42 = g('42'), g51 = g('51'), g52 = g('52'), g53 = g('53');
  const t41 = sumaL(i41, n), t42 = sumaL(i42, n), t51 = sumaL(g51, n), t52 = sumaL(g52, n), t53 = sumaL(g53, n);
  const operacional = resta(t41, t51, t52);
  const antesImp = resta(mas(operacional, t42), t53);
  const preoperativos = movs.filter((m) => m.tipo === 'gasto' && m.fecha < CONSTITUCION).reduce((a, m) => a + Number(m.monto), 0);
  return { meses: ms, i41, i42, g51, g52, g53, t41, t42, t51, t52, t53, operacional, antesImp, neta: antesImp, preoperativos };
}

/** Estado de flujos de efectivo, método directo, sobre la cuenta bancaria de Relevo. */
export function flujoPuc(movs: Mov[]) {
  const ms = meses(movs);
  const fila = (f: (m: Mov) => number) => ms.map((mm) => movs.filter((m) => m.fecha.startsWith(mm)).reduce((a, m) => a + f(m), 0));
  const v = (m: Mov) => Number(m.monto);
  const cobros = fila((m) => (m.tipo === 'ingreso' && m.pagado_por === 'relevo' ? v(m) : 0));
  const pagos = fila((m) => (m.tipo === 'gasto' && m.pagado_por === 'relevo' ? -v(m) : 0));
  const recibidoSocios = fila((m) => (m.tipo === 'aporte' ? v(m) : 0));
  const capital = ms.map((mm, i) => (mm === CAPITAL.fecha.slice(0, 7) ? CAPITAL.pagado : 0) + recibidoSocios[i]);
  const pagadoSocios = fila((m) => (m.tipo === 'reembolso' ? -v(m) : 0));
  const op = cobros.map((x, i) => x + pagos[i]);
  const fin = capital.map((x, i) => x + pagadoSocios[i]);
  const neto = op.map((x, i) => x + fin[i]);
  let acc = 0; const inicio: number[] = [], fin_: number[] = [];
  neto.forEach((x) => { inicio.push(acc); acc += x; fin_.push(acc); });
  const sinCaja = { gastosSocios: movs.filter((m) => m.tipo === 'gasto' && m.pagado_por !== 'relevo').reduce((a, m) => a + v(m), 0), ingresosSocios: movs.filter((m) => m.tipo === 'ingreso' && m.pagado_por !== 'relevo').reduce((a, m) => a + v(m), 0) };
  return { meses: ms, cobros, pagos, op, capital, recibidoSocios, pagadoSocios, fin, neto, inicio, final: fin_, sinCaja };
}
