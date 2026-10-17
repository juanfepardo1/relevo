import { Warning } from '@phosphor-icons/react';
import { supabase, must, type Row } from '../lib/supabase';
import { hoy } from '../lib/format';
import { revisarCorreo } from '../../api/_correo.js';
import { useToast } from './ui';

/** Aviso de correo mal escrito (o que ya rebotó), con un botón para aplicar la corrección sugerida. */
export function AvisoCorreo({ vendedorId, correo, reboto, onCambio }: { vendedorId: string; correo: string | null | undefined; reboto?: string | null; onCambio: () => void }) {
  const toast = useToast();
  const rev = revisarCorreo(correo);
  const yaReboto = !!reboto && !!correo && reboto.toLowerCase() === String(correo).trim().toLowerCase();
  if ((rev.ok || !correo) && !yaReboto) return null;
  const usar = async (nuevo: string) => {
    try {
      await must(supabase.from('vendedores').update({ correo: nuevo }).eq('id', vendedorId));
      await supabase.from('actividades').insert({ vendedor_id: vendedorId, tipo: 'nota', resumen: `Correo corregido: ${correo} → ${nuevo}` });
      toast('Correo corregido'); onCambio();
    } catch (e: any) { toast(e.message, true); }
  };
  return (
    <p className="aviso" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
      <Warning className="ic" />
      <span>{yaReboto ? `Un correo a ${correo} rebotó. Corrige la dirección antes de volver a enviar.` : rev.motivo + '.'}</span>
      {rev.sugerencia && <button className="btn ghost" style={{ minHeight: 28 }} onClick={() => usar(rev.sugerencia!)}>Usar {rev.sugerencia}</button>}
    </p>
  );
}

/** Registra que el correo rebotó: el lead vuelve a "por enviar" y no recibe recordatorios hasta corregirlo. */
export async function marcarRebote(v: Row) {
  const d = hoy();
  await must(supabase.from('vendedores').update({ flash_enviado_en: null, form_enviado_en: null, etapa: 'no_contactado', ultimo_contacto: d }).eq('id', v.id));
  await must(supabase.from('actividades').insert({ vendedor_id: v.id, tipo: 'correo', resumen: `Rebotó el correo a ${String(v.correo || '').trim().toLowerCase()}` }));
}
