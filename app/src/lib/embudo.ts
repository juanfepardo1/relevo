/** Cálculos del Embudo de vendedores. Funciones puras: reciben filas y devuelven números. */
import type { Row } from './supabase';
import type { Etapa } from './data';

export type Hist = { entidad_id: string; etapa: string; desde: string; hasta: string | null };
const DIA = 86400000;
const dias = (a: string | number, b: number = Date.now()) => Math.max(0, (b - new Date(a).getTime()) / DIA);

export const HITOS = [['reunion_hecha', 'Reunión hecha'], ['docs_recibidos', 'Docs recibidos'], ['mandato', 'Mandato']] as const;

export function contexto(etapas: Etapa[], vend: Row[], hist: Hist[]) {
  const orden = new Map(etapas.map((e) => [e.codigo, e.orden]));
  const porVend = new Map<string, Hist[]>();
  for (const h of hist) porVend.set(h.entidad_id, [...(porVend.get(h.entidad_id) || []), h]);
  /** Etapa más avanzada alcanzada por cada vendedor (sin contar "perdido"). */
  const maxOrden = new Map<string, number>();
  for (const v of vend) {
    const cods = [...(porVend.get(v.id) || []).map((h) => h.etapa), v.etapa].filter((c) => c !== 'perdido' && c !== 'en_reserva' && c !== 'pausado');
    maxOrden.set(v.id, Math.max(1, ...cods.map((c) => orden.get(c) ?? 1)));
  }
  return { orden, porVend, maxOrden };
}
type Ctx = ReturnType<typeof contexto>;

/** Embudo clásico: cuántos llegaron al menos a cada etapa, en el orden del proceso. */
export function embudo(etapas: Etapa[], vend: Row[], ctx: Ctx) {
  const pasos = etapas.filter((e) => !e.terminal || e.codigo === 'cerrado');
  const total = vend.length;
  const perdidos = vend.filter((v) => v.etapa === 'perdido');
  return pasos.map((e, i) => {
    const llegaron = vend.filter((v) => (ctx.maxOrden.get(v.id) ?? 1) >= e.orden).length;
    const prev = i === 0 ? total : vend.filter((v) => (ctx.maxOrden.get(v.id) ?? 1) >= pasos[i - 1].orden).length;
    const seQuedan = perdidos.filter((v) => (ctx.maxOrden.get(v.id) ?? 1) === e.orden);
    return { e, llegaron, pctTotal: total ? llegaron / total : 0, pctPrev: prev ? llegaron / prev : 0, perdidos: seQuedan.length, motivos: seQuedan.map((v) => v.motivo_perdida).filter(Boolean) as string[] };
  });
}

const mediana = (xs: number[]) => { if (!xs.length) return 0; const s = [...xs].sort((a, b) => a - b); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

/** Días en cada etapa (terminadas y en curso), contra su meta. */
export function tiempos(etapas: Etapa[], vend: Row[], ctx: Ctx) {
  const ids = new Set(vend.map((v) => v.id));
  const filas = etapas.filter((e) => !e.terminal).map((e) => {
    const d: number[] = [];
    for (const [id, hs] of ctx.porVend) if (ids.has(id)) for (const h of hs) if (h.etapa === e.codigo) d.push(dias(h.desde, h.hasta ? new Date(h.hasta).getTime() : Date.now()));
    const actuales = vend.filter((v) => v.etapa === e.codigo);
    const fuera = actuales.filter((v) => e.sla_dias != null && (v.dias_en_etapa ?? 0) > e.sla_dias).length;
    const prom = d.length ? d.reduce((a, b) => a + b, 0) / d.length : 0;
    return { e, n: d.length, promedio: prom, mediana: mediana(d), actuales: actuales.length, fuera, ratio: e.sla_dias ? prom / e.sla_dias : 0 };
  });
  // corta las etapas finales a las que todavía no ha llegado nadie
  let ultimo = 0; filas.forEach((f, i) => { if (f.n) ultimo = i; });
  const visibles = filas.slice(0, ultimo + 1);
  const cuello = [...visibles].filter((f) => f.n >= 1 && f.e.sla_dias).sort((a, b) => b.ratio - a.ratio)[0];
  return { filas: visibles, cuello: cuello && cuello.ratio > 1 ? cuello : undefined };
}

/** Vendedores activos quietos: pasaron la meta de su etapa o llevan N días sin actividad. */
export function quietos(vend: Row[], ctx: Ctx, acts: Row[], diasSinAct: number) {
  const ultimaAct = new Map<string, number>();
  for (const a of acts) { const t = new Date(a.fecha).getTime(); if (t > (ultimaAct.get(a.vendedor_id) ?? 0)) ultimaAct.set(a.vendedor_id, t); }
  return vend.filter((v) => !['cerrado', 'perdido', 'en_reserva', 'pausado'].includes(v.etapa)).map((v) => {
    const actual = (ctx.porVend.get(v.id) || []).find((h) => !h.hasta);
    const ref = Math.max(ultimaAct.get(v.id) ?? 0, actual ? new Date(actual.desde).getTime() : 0, v.fecha_ingreso ? new Date(v.fecha_ingreso + 'T12:00:00-05:00').getTime() : 0);
    const sinAct = Math.floor(dias(ref));
    const fueraMeta = v.sla_dias != null && (v.dias_en_etapa ?? 0) > v.sla_dias;
    const score = Math.max(v.sla_dias ? (v.dias_en_etapa ?? 0) / v.sla_dias : 0, sinAct / diasSinAct);
    return { v, sinAct, fueraMeta, porInactividad: sinAct >= diasSinAct, score };
  }).filter((q) => q.fueraMeta || q.porInactividad).sort((a, b) => b.score - a.score);
}

/** Conversión a los hitos para un grupo de vendedores. */
export function conversion(grupo: Row[], ctx: Ctx) {
  return HITOS.map(([cod]) => {
    const o = ctx.orden.get(cod) ?? 99;
    const n = grupo.filter((v) => (ctx.maxOrden.get(v.id) ?? 1) >= o).length;
    return { cod, n, pct: grupo.length ? n / grupo.length : 0 };
  });
}

/** Agrupa por una columna; orden: más vendedores primero, "Sin dato" al final. */
export function porDimension(vend: Row[], ctx: Ctx, campo: string) {
  const m = new Map<string, Row[]>();
  for (const v of vend) { const k = (v[campo] ?? '').toString().trim() || 'Sin dato'; m.set(k, [...(m.get(k) || []), v]); }
  return [...m.entries()].map(([k, g]) => ({ k, n: g.length, conv: conversion(g, ctx), perdidos: g.filter((v) => v.etapa === 'perdido').length }))
    .sort((a, b) => (a.k === 'Sin dato' ? 1 : b.k === 'Sin dato' ? -1 : b.n - a.n || a.k.localeCompare(b.k)));
}

/** Semanas (lunes) entre dos fechas YYYY-MM-DD. */
export function semanas(desde: string, hasta: string) {
  const d = new Date(desde + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  const out: string[] = [];
  for (let x = d; x.toISOString().slice(0, 10) <= hasta && out.length < 60; x = new Date(x.getTime() + 7 * DIA)) out.push(x.toISOString().slice(0, 10));
  return out;
}
const lunesDe = (iso: string) => { const d = new Date(iso.slice(0, 10) + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return d.toISOString().slice(0, 10); };
const diaBogota = (iso: string) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date(iso));

/** Por semana: vendedores nuevos, reuniones hechas y docs recibidos. */
export function tendencia(vend: Row[], ctx: Ctx, weeks: string[]) {
  const ids = new Set(vend.map((v) => v.id));
  const cuenta = (fechas: string[]) => weeks.map((w) => fechas.filter((f) => lunesDe(f) === w).length);
  const entradas = (cod: string) => { const f: string[] = []; for (const [id, hs] of ctx.porVend) if (ids.has(id)) for (const h of hs) if (h.etapa === cod) f.push(diaBogota(h.desde)); return f; };
  return [
    { k: 'nuevos', nombre: 'Vendedores nuevos', color: '#3b6fc4', v: cuenta(vend.map((x) => x.fecha_ingreso).filter(Boolean)) },
    { k: 'reuniones', nombre: 'Reuniones hechas', color: '#14a39b', v: cuenta(entradas('reunion_hecha')) },
    { k: 'docs', nombre: 'Docs recibidos', color: '#e8692b', v: cuenta(entradas('docs_recibidos')) },
  ];
}
