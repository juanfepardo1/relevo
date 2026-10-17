import { supabase, must, type Row } from './supabase';
import { habilesDesde, diasDesde } from './habiles';

/**
 * Avisos automáticos por etapa del vendedor (definidos con Felipe el 17 oct 2026).
 * Alerta: se calcula del estado y desaparece sola al avanzar. Acción: pide contestar con botones.
 * Etapas de Docs recibidos hacia abajo de "Valoración completa" no tienen avisos todavía.
 */
export type TipoAviso = 'no_contactado' | 'contactado' | 'reunion_fecha' | 'reunion_paso' | 'reunion_hecha' | 'recordar_docs' | 'reserva' | 'valoracion' | 'val_completa' | 'reunion_sin_vincular';
export type Aviso = {
  key: string; tipo: TipoAviso; accion: boolean; vendedorId?: string; reunionId?: string;
  titulo: string; detalle: string; tono: '' | 'warn' | 'err'; para: string | null; // null = todo el equipo
  peso: number; n?: number;
};

export const ETAPAS_CON_AVISO = ['no_contactado', 'contactado', 'reunion_agendada', 'reunion_hecha', 'nda_docs', 'val_profunda', 'val_completa'];
export const CLAVE_RECORDATORIO = 'recordatorio_docs';
export const PLAZO_VALORACION = 14;

const nombre = (v: Row) => v.empresa || v.nombre || 'Sin nombre';
const plural = (n: number, s: string, p = s + 's') => `${n} ${n === 1 ? s : p}`;

/** Estado de recordatorios de documentos: cuántos tocan según días hábiles y cuántos se hicieron. */
export function estadoRecordatorios(habiles: number, hechos: number) {
  const tocan = Math.min(3, Math.floor(habiles / 5));
  return { tocan, hechos, pendiente: hechos < tocan, reserva: hechos >= 3 && habiles >= 20, siguienteEn: hechos < 3 ? (hechos + 1) * 5 - habiles : null };
}

/** Escalón de la valoración en curso contra el plazo de 14 días desde que se tocó Valorar. */
export function escalonValoracion(dias: number): { tono: '' | 'warn' | 'err'; texto: string } | null {
  if (dias > PLAZO_VALORACION) return { tono: 'err', texto: `Vencida hace ${plural(dias - PLAZO_VALORACION, 'día')}` };
  if (dias >= 13) return { tono: 'err', texto: `Día ${dias} de ${PLAZO_VALORACION}. Se vence ${dias === PLAZO_VALORACION ? 'hoy' : 'mañana'}` };
  if (dias >= 10) return { tono: 'warn', texto: `Día ${dias} de ${PLAZO_VALORACION}. Quedan ${PLAZO_VALORACION - dias} días` };
  if (dias >= 7) return { tono: '', texto: `Día ${dias} de ${PLAZO_VALORACION}. Vas a mitad de plazo` };
  return null;
}

export async function cargarAvisos(): Promise<{ avisos: Aviso[]; noContactados: number }> {
  const vend = (await must(supabase.from('vendedores').select('id,nombre,empresa,etapa,responsable,bucket,reunion_en').in('etapa', ETAPAS_CON_AVISO))) as Row[];
  const ids = vend.map((v) => v.id);
  const [hist, recs, sueltas] = await Promise.all([
    ids.length ? must(supabase.from('etapa_historial').select('entidad_id,desde').eq('entidad', 'vendedor').is('hasta', null).in('entidad_id', ids)) : Promise.resolve([]),
    ids.length ? must(supabase.from('actividades').select('vendedor_id,fecha').eq('clave', CLAVE_RECORDATORIO).in('vendedor_id', ids)) : Promise.resolve([]),
    must(supabase.from('reuniones').select('id,organizador,invitado_nombre,invitado_email,inicio').is('vendedor_id', null).is('comprador_id', null).eq('estado', 'activa').gte('inicio', new Date(Date.now() - 14 * 864e5).toISOString())),
  ]) as [Row[], Row[], Row[]];
  const desde = new Map(hist.map((h) => [h.entidad_id, h.desde as string]));
  const ahora = Date.now();
  const avisos: Aviso[] = [];
  let noContactados = 0;

  for (const v of vend) {
    const d = desde.get(v.id);
    if (!d) continue;
    const base = { vendedorId: v.id, titulo: nombre(v), para: v.responsable as string | null };
    const hab = habilesDesde(d);
    switch (v.etapa) {
      case 'no_contactado':
        if (v.bucket === 'B') break; // los B los atiende Valoraciones por correo
        noContactados++;
        if (hab >= 3) avisos.push({ ...base, key: 'nc' + v.id, tipo: 'no_contactado', accion: false, para: v.responsable ?? null, detalle: `Lleva ${plural(hab, 'día hábil', 'días hábiles')} sin contactar`, tono: hab >= 5 ? 'err' : 'warn', peso: 60 + hab });
        break;
      case 'contactado':
        if (hab >= 3) avisos.push({ ...base, key: 'ct' + v.id, tipo: 'contactado', accion: false, detalle: `${plural(hab, 'día hábil', 'días hábiles')} en Contactado sin agendar reunión`, tono: hab >= 5 ? 'err' : 'warn', peso: 50 + hab });
        break;
      case 'reunion_agendada':
        if (!v.reunion_en) avisos.push({ ...base, key: 'rf' + v.id, tipo: 'reunion_fecha', accion: true, detalle: '¿Para cuándo quedó la reunión?', tono: '', peso: 40 });
        else if (new Date(v.reunion_en).getTime() < ahora) avisos.push({ ...base, key: 'rp' + v.id, tipo: 'reunion_paso', accion: true, detalle: 'Ya pasó la hora de la reunión. ¿Se hizo?', tono: 'warn', peso: 90 });
        break;
      case 'reunion_hecha': {
        const horas = (ahora - new Date(d).getTime()) / 36e5;
        if (horas >= 48) avisos.push({ ...base, key: 'rh' + v.id, tipo: 'reunion_hecha', accion: false, detalle: `Reunión hecha hace ${plural(Math.floor(horas / 24), 'día')} sin enviar NDA y lista de documentos`, tono: 'err', peso: 85 });
        break;
      }
      case 'nda_docs': {
        const hechos = recs.filter((r) => r.vendedor_id === v.id && r.fecha >= d).length;
        const e = estadoRecordatorios(hab, hechos);
        if (e.reserva) avisos.push({ ...base, key: 'rs' + v.id, tipo: 'reserva', accion: true, detalle: `${plural(hab, 'día hábil', 'días hábiles')} y 3 recordatorios sin documentos. Pásalo a En reserva`, tono: 'err', peso: 70 });
        else if (e.pendiente) avisos.push({ ...base, key: 'rd' + v.id + e.tocan, tipo: 'recordar_docs', accion: true, n: hechos + 1, detalle: `Recuérdale enviar los documentos (${hechos + 1} de 3). Lleva ${plural(hab, 'día hábil', 'días hábiles')}`, tono: hechos + 1 === 3 ? 'err' : 'warn', peso: 75 });
        break;
      }
      case 'val_profunda': {
        const s = escalonValoracion(diasDesde(d));
        if (s) avisos.push({ ...base, key: 'vp' + v.id, tipo: 'valoracion', accion: false, detalle: `Valoración: ${s.texto}`, tono: s.tono, peso: s.tono === 'err' ? 95 : s.tono === 'warn' ? 65 : 30 });
        break;
      }
      case 'val_completa': {
        const dias = diasDesde(d);
        if (dias > 7) avisos.push({ ...base, key: 'vc' + v.id, tipo: 'val_completa', accion: false, detalle: `Valoración completa hace ${dias} días y sin presentar`, tono: 'err', peso: 80 });
        break;
      }
    }
  }

  for (const r of sueltas) {
    avisos.push({ key: 'rv' + r.id, tipo: 'reunion_sin_vincular', accion: true, reunionId: r.id, titulo: r.invitado_nombre || r.invitado_email || 'Reunión de Calendly', para: r.organizador,
      detalle: `Agendó por Calendly con un correo que no está en ningún vendedor (${r.invitado_email ?? 'sin correo'}). ¿De quién es?`, tono: 'warn', peso: 45 });
  }

  avisos.sort((a, b) => b.peso - a.peso);
  return { avisos, noContactados };
}
