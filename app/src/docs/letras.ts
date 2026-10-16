/** Números y fechas en letras, como se escriben en documentos legales en Colombia. */
const U = ['cero', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve', 'veinte', 'veintiuno', 'veintidós', 'veintitrés', 'veinticuatro', 'veinticinco', 'veintiséis', 'veintisiete', 'veintiocho', 'veintinueve'];
const D = ['', '', '', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'];
const C = ['', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos', 'seiscientos', 'setecientos', 'ochocientos', 'novecientos'];

export function enLetras(n: number): string {
  if (n < 30) return U[n];
  if (n < 100) return D[Math.floor(n / 10)] + (n % 10 ? ' y ' + U[n % 10] : '');
  if (n === 100) return 'cien';
  if (n < 1000) return C[Math.floor(n / 100)] + (n % 100 ? ' ' + enLetras(n % 100) : '');
  if (n < 1e6) {
    const m = Math.floor(n / 1000), r = n % 1000;
    return (m === 1 ? 'mil' : enLetras(m).replace(/uno$/, 'ún') + ' mil') + (r ? ' ' + enLetras(r) : '');
  }
  return String(n);
}

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/** "2026-10-06" -> "el seis (6) de octubre de dos mil veintiséis (2026)" */
export function fechaEnLetras(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  const dia = d === 1 ? 'primero (1)' : `${enLetras(d)} (${d})`;
  return `el ${dia} de ${MESES[m - 1]} de ${enLetras(y)} (${y})`;
}

/** Cédula o NIT con puntos de miles: "1098070875" -> "1.098.070.875". Respeta guion de dígito de verificación. */
export function conPuntos(v: string) {
  const s = String(v || '').trim();
  const [base, dv] = s.replace(/\./g, '').split('-');
  if (!/^\d+$/.test(base || '')) return s;
  const f = base.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return dv ? `${f}-${dv}` : f;
}
