/** Estado global del lote de valoración flash: sobrevive al cambiar de pantalla y evita recargas que lo corten. */
export type EstadoLote = { corriendo: boolean; i: number; n: number; texto: string };
let estado: EstadoLote = { corriendo: false, i: 0, n: 0, texto: '' };
export const loteActual = () => estado;
export function avisarLote(e: Partial<EstadoLote>) {
  estado = { ...estado, ...e };
  window.dispatchEvent(new CustomEvent('lote:progreso', { detail: estado }));
}
// Mientras corre, pedir confirmación antes de cerrar o recargar la pestaña
window.addEventListener('beforeunload', (e) => { if (estado.corriendo) { e.preventDefault(); e.returnValue = ''; } });
