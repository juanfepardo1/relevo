import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trash } from '@phosphor-icons/react';
import { supabase, must, type Row } from '../lib/supabase';
import { Modal, useToast } from './ui';

type Ent = 'vendedor' | 'comprador';

/** Borra un vendedor o comprador con todo lo que cuelga de él: documentos (y sus archivos), actividad, historial, presentaciones. */
async function borrar(entidad: Ent, id: string) {
  const fk = entidad === 'vendedor' ? 'vendedor_id' : 'comprador_id';
  const docs = (await must(supabase.from('documentos').select('archivo_path').eq(fk, id))) as Row[];
  const archivos = docs.map((d) => d.archivo_path).filter(Boolean);
  if (archivos.length) await supabase.storage.from('documentos').remove(archivos);

  if (entidad === 'vendedor') {
    const v = (await must(supabase.from('vendedores').select('lead_id').eq('id', id).single())) as Row;
    await must(supabase.from('vendedores').delete().eq('id', id));
    if (v.lead_id) await supabase.from('leads').update({ status: 'descartado' }).eq('id', v.lead_id);
  } else {
    const personas = ((await must(supabase.from('personas').select('id').eq('comprador_id', id))) as Row[]).map((p) => p.id);
    await must(supabase.from('compradores').delete().eq('id', id));
    if (personas.length) await supabase.from('personas').delete().in('id', personas);
  }
  // El historial de etapas lo borra un trigger en la base.
}

export function BotonEliminar({ entidad, id, nombre }: { entidad: Ent; id: string; nombre: string }) {
  const [open, setOpen] = useState(false);
  const [escrito, setEscrito] = useState('');
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const nav = useNavigate();
  const palabra = 'ELIMINAR';
  const ir = async () => {
    setBusy(true);
    try { await borrar(entidad, id); toast(`${nombre} eliminado`); nav(entidad === 'vendedor' ? '/vendedores' : '/compradores', { replace: true }); }
    catch (e: any) { toast('No se eliminó: ' + e.message, true); setBusy(false); }
  };
  return (
    <>
      <button className="btn ghost danger" title="Eliminar" aria-label="Eliminar" onClick={() => { setEscrito(''); setOpen(true); }}><Trash className="ic" /></button>
      <Modal open={open} onClose={() => setOpen(false)} title={`Eliminar ${nombre}`}>
        <form onSubmit={(e) => { e.preventDefault(); if (escrito === palabra) ir(); }}>
          <p>Se borra para siempre, con sus documentos y archivos, su actividad y su historial de etapas. No se puede deshacer.</p>
          {entidad === 'vendedor' && <p className="muted" style={{ fontSize: 13 }}>Si solo no avanzó, es mejor moverlo a la etapa Perdido: queda el registro y cuenta en las estadísticas.</p>}
          <label>Escribe {palabra} para confirmar<input className="in" autoFocus value={escrito} onChange={(e) => setEscrito(e.target.value.toUpperCase())} /></label>
          <footer>
            <button type="button" className="btn ghost" onClick={() => setOpen(false)}>Cancelar</button>
            <button className="btn danger-solid" disabled={escrito !== palabra || busy}>{busy ? 'Eliminando' : 'Eliminar para siempre'}</button>
          </footer>
        </form>
      </Modal>
    </>
  );
}
