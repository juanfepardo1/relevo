export type Correo = {
  preheader?: string; saludo?: string; parrafos?: string[]; despues?: string[];
  destacado?: { titulo: string; valor: string; nota?: string };
  boton?: { texto: string; url: string; nota?: string }; cierre?: string[];
};
export function correoHtml(c: Correo): string;
export function firmaRespaldo(): string;
export const FIRMA_TEXTO: string;
export function correoFormulario(v: { nombre?: string | null; empresa?: string | null; form_codigo: string; valoracion_min?: number | null; valoracion_max?: number | null }, tipo: 'invitacion' | 'r1' | 'r2'): { asunto: string; texto: string; html: string };
export function correoDesdeTexto(texto: string, extra?: { preheader?: string; destacado?: Correo['destacado']; boton?: string; notaBoton?: string }): string;
export function nombrePila(n: unknown): string;
export function empresaLimpia(e: unknown): string;
export function revisarCorreo(correo: unknown): { ok: boolean; motivo?: string; sugerencia?: string; comun?: boolean };
