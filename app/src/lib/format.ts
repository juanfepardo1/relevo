const nf = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 });

/** Pesos en millones: 8400000000 -> "$8.400M" */
export const millones = (v: number | null | undefined) => (v == null ? '' : `$${nf.format(Math.round(v / 1e6))}M`);

export const rango = (min: number | null | undefined, max: number | null | undefined) => {
  if (min == null && max == null) return '';
  if (min == null) return `Hasta ${millones(max)}`;
  if (max == null) return `Más de ${millones(min)}`;
  return `${millones(min)} a ${millones(max)}`;
};

const df = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', timeZone: 'America/Bogota' });
const dfy = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'America/Bogota' });
const dtf = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'America/Bogota' });

/** Fecha "YYYY-MM-DD" (sin zona) o timestamp ISO. */
export const fecha = (v: string | null | undefined, year = false) => {
  if (!v) return '';
  const d = v.length === 10 ? new Date(v + 'T12:00:00-05:00') : new Date(v);
  return (year ? dfy : df).format(d).replace('.', '');
};
export const fechaHora = (v: string | null | undefined) => (v ? dtf.format(new Date(v)).replace('.', '') : '');

export const hoy = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date());

export const diasDesde = (v: string | null | undefined) => {
  if (!v) return null;
  const d = v.length === 10 ? new Date(v + 'T00:00:00-05:00') : new Date(v);
  return Math.floor((Date.now() - d.getTime()) / 86400000);
};

export const waLink = (phone: string | null | undefined) => {
  let d = String(phone || '').replace(/\D/g, '');
  if (d.length === 10 && d.startsWith('3')) d = '57' + d;
  return d.length >= 11 ? `https://wa.me/${d}` : null;
};
