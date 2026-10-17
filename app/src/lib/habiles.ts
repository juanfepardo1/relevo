/** Días hábiles en Colombia: lunes a viernes sin festivos (Ley Emiliani y Semana Santa). Fechas "YYYY-MM-DD" en hora de Bogotá. */

const iso = (d: Date) => d.toISOString().slice(0, 10);
const utc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d));
const sumar = (d: Date, n: number) => new Date(d.getTime() + n * 864e5);
const lunesSiguiente = (d: Date) => { const w = d.getUTCDay(); return w === 1 ? d : sumar(d, (8 - w) % 7); };

function pascua(y: number) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31), dia = ((h + l - 7 * m + 114) % 31) + 1;
  return utc(y, mes, dia);
}

const cache = new Map<number, Set<string>>();
export function festivos(y: number): Set<string> {
  if (cache.has(y)) return cache.get(y)!;
  const p = pascua(y);
  const fijos = [[1, 1], [5, 1], [7, 20], [8, 7], [12, 8], [12, 25]].map(([m, d]) => utc(y, m, d));
  const emiliani = [[1, 6], [3, 19], [6, 29], [8, 15], [10, 12], [11, 1], [11, 11]].map(([m, d]) => lunesSiguiente(utc(y, m, d)));
  const santa = [sumar(p, -3), sumar(p, -2), sumar(p, 43), sumar(p, 64), sumar(p, 71)];
  const s = new Set([...fijos, ...emiliani, ...santa].map(iso));
  cache.set(y, s);
  return s;
}

export const esHabil = (dia: string) => {
  const d = new Date(dia + 'T12:00:00Z');
  const w = d.getUTCDay();
  return w !== 0 && w !== 6 && !festivos(d.getUTCFullYear()).has(dia);
};

/** Día en Bogotá de un timestamp o fecha. */
export const diaBogota = (v: string | Date) => new Date(v).toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });

/** Días hábiles completos desde el día `desde` (sin contarlo) hasta `hasta` inclusive. Entró un viernes: el lunes lleva 1. */
export function habilesDesde(desde: string | Date, hasta: string | Date = new Date()): number {
  let d = diaBogota(desde);
  const fin = diaBogota(hasta);
  let n = 0;
  for (let i = 0; i < 400 && d < fin; i++) {
    d = iso(sumar(new Date(d + 'T12:00:00Z'), 1));
    if (esHabil(d)) n++;
  }
  return n;
}

/** Días calendario desde `desde` (sin contarlo) hasta hoy, en hora de Bogotá. */
export const diasDesde = (desde: string | Date, hasta: string | Date = new Date()) =>
  Math.round((new Date(diaBogota(hasta) + 'T12:00:00Z').getTime() - new Date(diaBogota(desde) + 'T12:00:00Z').getTime()) / 864e5);
