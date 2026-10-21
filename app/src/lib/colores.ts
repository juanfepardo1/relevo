/** Color por fase del pipeline. Las clases viven en styles.css (.tone-*). */
const FASE: Record<string, string> = {
  'Captación': 'captacion', 'Valoración': 'valoracion', 'Diagnóstico': 'valoracion',
  'Preparación': 'preparacion', 'Búsqueda': 'preparacion', 'Mercado': 'mercado', 'Cierre': 'cierre', 'Final': 'final',
};
export function tonoEtapa(fase: string | null | undefined, codigo?: string | null) {
  if (codigo === 'cerrado') return 'tone-ganado';
  if (codigo === 'perdido') return 'tone-perdido';
  if (codigo === 'no_contactado') return 'tone-nuevo';
  if (codigo === 'pausado') return 'tone-pausado';
  return 'tone-' + (FASE[fase ?? ''] ?? 'nuevo');
}
export const tonoBucket = (b: string | null | undefined) => (b ? 'tone-bucket-' + b.toLowerCase() : '');
const PERSONAS = ['tone-p1', 'tone-p2', 'tone-p3', 'tone-p4'];
export function tonoPersona(email: string | null | undefined) {
  if (!email) return '';
  if (email.startsWith('felipe@')) return 'tone-p1';
  if (email.startsWith('alejandro@')) return 'tone-p2';
  if (email.startsWith('valoraciones@')) return 'tone-valoraciones';
  let h = 0; for (const ch of email) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return PERSONAS[h % PERSONAS.length];
}
