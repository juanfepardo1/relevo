import { useState, type FormEvent } from 'react';
import { Plus, WhatsappLogo, Envelope, Phone, PencilSimple, Trash } from '@phosphor-icons/react';
import { supabase, must, type Row } from '../lib/supabase';
import { useQuery } from '../lib/data';
import { waLink } from '../lib/format';
import { Modal, Skeleton, useToast } from './ui';

const CARGOS = ['Contador', 'Revisor fiscal', 'Abogado', 'Socio', 'Gerente', 'Asistente', 'Familiar'];

/** Otros contactos del vendedor: contador, revisor fiscal, abogado, socios. */
export function ContactosPanel({ vendedorId }: { vendedorId: string }) {
  const q = useQuery(() => supabase.from('personas').select('*').eq('vendedor_id', vendedorId).order('created_at'), [vendedorId]);
  const [edit, setEdit] = useState<Row | null>(null);
  const rows = (q.data || []) as Row[];
  return (
    <section className="panel">
      <header><h2>Otros contactos</h2><button className="btn" onClick={() => setEdit({})}><Plus className="ic" />Agregar</button></header>
      {q.error ? <p className="empty-state">No se pudieron cargar. ¿Ya corriste relevo_contactos.sql?</p> : q.loading ? <Skeleton rows={2} /> : !rows.length ? (
        <p className="empty-state">Contador, revisor fiscal, abogado o socios con los que hablamos por esta empresa.</p>
      ) : (
        <div className="list">
          {rows.map((p) => {
            const wa = waLink(p.telefono);
            return (
              <div className="li" key={p.id} style={{ gridTemplateColumns: 'minmax(0,1fr) auto' }}>
                <div>
                  <b>{p.nombre}</b>{p.cargo && <span className="tag tone-nuevo" style={{ marginLeft: 8 }}>{p.cargo}</span>}
                  <p className="meta">{[p.telefono, p.email].filter(Boolean).join(' · ') || 'Sin datos de contacto'}</p>
                  {p.notas && <p className="meta" style={{ whiteSpace: 'pre-wrap' }}>{p.notas}</p>}
                </div>
                <div style={{ display: 'flex', gap: 2 }}>
                  {wa && <a className="btn ghost" href={wa} target="_blank" rel="noopener" title="WhatsApp" aria-label="WhatsApp"><WhatsappLogo className="ic" /></a>}
                  {p.telefono && <a className="btn ghost" href={`tel:${String(p.telefono).replace(/[^\d+]/g, '')}`} title="Llamar" aria-label="Llamar"><Phone className="ic" /></a>}
                  {p.email && <a className="btn ghost" href={`mailto:${p.email}`} title="Correo" aria-label="Correo"><Envelope className="ic" /></a>}
                  <button className="btn ghost" title="Editar" aria-label="Editar" onClick={() => setEdit(p)}><PencilSimple className="ic" /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'Editar contacto' : 'Nuevo contacto'}>
        {edit && <ContactoForm vendedorId={vendedorId} p={edit} onDone={() => { setEdit(null); q.reload(); }} />}
      </Modal>
    </section>
  );
}

function ContactoForm({ vendedorId, p, onDone }: { vendedorId: string; p: Row; onDone: () => void }) {
  const toast = useToast();
  const [f, setF] = useState({ nombre: p.nombre ?? '', cargo: p.cargo ?? '', telefono: p.telefono ?? '', email: p.email ?? '', notas: p.notas ?? '' });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: any) => setF({ ...f, [k]: e.target.value });
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true);
    const body = { nombre: f.nombre.trim(), cargo: f.cargo.trim() || null, telefono: f.telefono.trim() || null, email: f.email.trim() || null, notas: f.notas.trim() || null, vendedor_id: vendedorId };
    try {
      if (p.id) await must(supabase.from('personas').update(body).eq('id', p.id));
      else await must(supabase.from('personas').insert(body));
      toast('Contacto guardado'); onDone();
    } catch (err: any) { toast(err.message, true); }
    setBusy(false);
  };
  const borrar = async () => {
    if (!confirm(`¿Eliminar a ${p.nombre}?`)) return;
    try { await must(supabase.from('personas').delete().eq('id', p.id)); toast('Contacto eliminado'); onDone(); } catch (err: any) { toast(err.message, true); }
  };
  return (
    <form onSubmit={submit}>
      <div className="row">
        <label>Nombre<input className="in" required autoFocus value={f.nombre} onChange={set('nombre')} /></label>
        <label>Cargo<input className="in" list="cargos-contacto" value={f.cargo} onChange={set('cargo')} placeholder="Ej.: Revisora fiscal" /></label>
      </div>
      <datalist id="cargos-contacto">{CARGOS.map((c) => <option key={c} value={c} />)}</datalist>
      <div className="row">
        <label>Celular<input className="in" type="tel" value={f.telefono} onChange={set('telefono')} /></label>
        <label>Correo<input className="in" type="email" value={f.email} onChange={set('email')} /></label>
      </div>
      <label>Notas<textarea className="in" rows={3} value={f.notas} onChange={set('notas')} placeholder="Ej.: nos lo pasó el dueño para dudas de los estados financieros" /></label>
      <footer style={{ justifyContent: p.id ? 'space-between' : undefined }}>
        {p.id && <button type="button" className="btn ghost danger" onClick={borrar}><Trash className="ic" />Eliminar</button>}
        <button className="btn primary" disabled={busy}>{busy ? 'Guardando' : 'Guardar contacto'}</button>
      </footer>
    </form>
  );
}
