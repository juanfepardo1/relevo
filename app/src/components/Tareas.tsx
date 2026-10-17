import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Check, Trash, Plus } from '@phosphor-icons/react';
import { supabase, must, type Row } from '../lib/supabase';
import { useCatalogo, useQuery } from '../lib/data';
import { fecha, hoy } from '../lib/format';
import { useToast, Skeleton } from './ui';
import { tonoPersona } from '../lib/colores';

/** Tareas y recordatorios (tabla `tareas`). Una tarea con fecha funciona como recordatorio. */

export const apodo = (equipo: { email: string; apodo: string | null; nombre: string }[], e: string | null) => {
  const m = equipo.find((x) => x.email === e);
  return m ? m.apodo || m.nombre.split(' ')[0] : e ?? '';
};

/** Personas a las que se les puede asignar (sin el buzón de Valoraciones). */
export function useAsignables() {
  const { equipo } = useCatalogo();
  return equipo.filter((m) => !/^valoraciones@/.test(m.email));
}

export function cuando(f: string | null): { txt: string; tono: '' | 'err' | 'warn' } {
  if (!f) return { txt: '', tono: '' };
  const h = hoy();
  if (f < h) return { txt: `Vencida, ${fecha(f)}`, tono: 'err' };
  if (f === h) return { txt: 'Hoy', tono: 'warn' };
  const manana = new Date(Date.now() + 86400000).toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
  if (f === manana) return { txt: 'Mañana', tono: '' };
  return { txt: fecha(f), tono: '' };
}

const enDias = (n: number) => new Date(Date.now() + n * 864e5).toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });

export function NuevaTarea({ vendedorId, onCreada, compacta }: { vendedorId?: string; onCreada: () => void; compacta?: boolean }) {
  const { yo } = useCatalogo();
  const asignables = useAsignables();
  const toast = useToast();
  const [titulo, setTitulo] = useState('');
  const [cuandoSel, setCuandoSel] = useState<'' | 'hoy' | 'manana' | 'otra'>('');
  const [f, setF] = useState('');
  const [para, setPara] = useState('');
  const [busy, setBusy] = useState(false);
  const asignado = para || yo?.email || '';
  const fecha = cuandoSel === 'hoy' ? hoy() : cuandoSel === 'manana' ? enDias(1) : cuandoSel === 'otra' ? f : '';

  const crear = async (e: FormEvent) => {
    e.preventDefault(); if (!titulo.trim()) return; setBusy(true);
    try {
      await must(supabase.from('tareas').insert({ titulo: titulo.trim(), fecha: fecha || null, asignado, vendedor_id: vendedorId ?? null }));
      setTitulo(''); setCuandoSel(''); setF(''); setPara(''); onCreada();
    } catch (err: any) { toast(err.message, true); }
    setBusy(false);
  };
  const chip = (v: typeof cuandoSel, t: string) => <button type="button" className={'chip' + (cuandoSel === v ? ' on' : '')} onClick={() => setCuandoSel(v)}>{t}</button>;

  return (
    <form onSubmit={crear} className={'tarea-nueva' + (compacta ? ' compacta' : '')}>
      <div className="tn-fila">
        <Plus className="ic tn-ic" />
        <input className="tn-in" value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder={vendedorId ? 'Qué hay que hacer con este cliente' : 'Agrega una tarea o recordatorio'} aria-label="Tarea" />
        <button className="btn primary tn-ok" disabled={busy || !titulo.trim()}>Agregar</button>
      </div>
      {(titulo || compacta) && (
        <div className="tn-opciones">
          <span className="chips" role="group" aria-label="Cuándo">
            {chip('', 'Sin fecha')}{chip('hoy', 'Hoy')}{chip('manana', 'Mañana')}{chip('otra', 'Otro día')}
            {cuandoSel === 'otra' && <input className="in tn-fecha" type="date" value={f} min={hoy()} onChange={(e) => setF(e.target.value)} aria-label="Fecha" autoFocus />}
          </span>
          {asignables.length > 1 && (
            <span className="chips" role="group" aria-label="Para quién">
              {asignables.map((m) => (
                <button type="button" key={m.email} className={'chip persona ' + tonoPersona(m.email) + (asignado === m.email ? ' on' : '')} onClick={() => setPara(m.email)}>
                  {m.email === yo?.email ? 'Para mí' : `Para ${m.apodo || m.nombre.split(' ')[0]}`}
                </button>
              ))}
            </span>
          )}
        </div>
      )}
    </form>
  );
}

export function TareaFila({ t, onCambio, mostrarCliente = true }: { t: Row; onCambio: () => void; mostrarCliente?: boolean }) {
  const { equipo, yo } = useCatalogo();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const c = cuando(t.fecha);
  const hecha = !!t.hecha_en;
  const deOtro = t.creador && t.creador !== yo?.email && t.asignado === yo?.email;
  const paraOtro = t.asignado !== yo?.email;

  const marcar = async () => {
    setBusy(true);
    try { await must(supabase.from('tareas').update({ hecha_en: hecha ? null : new Date().toISOString() }).eq('id', t.id)); onCambio(); }
    catch (err: any) { toast(err.message, true); }
    setBusy(false);
  };
  const borrar = async () => {
    if (!confirm(`¿Borrar "${t.titulo}"?`)) return;
    try { await must(supabase.from('tareas').delete().eq('id', t.id)); onCambio(); } catch (err: any) { toast(err.message, true); }
  };

  return (
    <div className={'tarea' + (hecha ? ' hecha' : '') + (!hecha && c.tono === 'err' ? ' nivel-urgente' : !hecha && c.tono === 'warn' ? ' nivel-hoy' : '')}>
      <button className="check" onClick={marcar} disabled={busy} aria-label={hecha ? 'Marcar pendiente' : 'Marcar hecha'}>{hecha && <Check weight="bold" />}</button>
      <div className="tarea-txt">
        <span>{t.titulo}</span>
        <span className="meta">
          {mostrarCliente && t.vendedor && <Link to={`/vendedores/${t.vendedor_id}`}>{t.vendedor.empresa || t.vendedor.nombre}</Link>}
          {deOtro && <span className={'tag ' + tonoPersona(t.creador)}>De {apodo(equipo, t.creador)}</span>}
          {paraOtro && <span className={'tag ' + tonoPersona(t.asignado)}>Para {apodo(equipo, t.asignado)}</span>}
        </span>
      </div>
      {c.txt && !hecha ? <span className={'cifra ' + (c.tono === 'err' ? 'urgente' : c.tono === 'warn' ? 'hoy' : '')}>{c.txt}</span> : <span />}
      <button className="btn ghost borrar" onClick={borrar} aria-label="Borrar"><Trash className="ic" /></button>
    </div>
  );
}

/** Panel de tareas en la ficha de un vendedor: lo pendiente de cualquiera del equipo con este cliente. */
export function TareasFichaPanel({ vendedorId }: { vendedorId: string }) {
  const q = useQuery(() => supabase.from('tareas').select('*').eq('vendedor_id', vendedorId).order('hecha_en', { nullsFirst: true }).order('fecha', { nullsFirst: false }), [vendedorId]);
  const [verHechas, setVerHechas] = useState(false);
  const todas = (q.data || []) as Row[];
  const pend = todas.filter((t) => !t.hecha_en);
  const hechas = todas.filter((t) => t.hecha_en);
  return (
    <section className="panel">
      <header><h2>Tareas</h2>{pend.length > 0 && <span className="b num">{pend.length}</span>}</header>
      <div className="body" style={{ paddingBottom: 8 }}><NuevaTarea vendedorId={vendedorId} onCreada={q.reload} compacta /></div>
      {q.loading ? <Skeleton rows={2} /> : q.error ? <p className="empty-state">No se pudieron cargar las tareas.</p> : (
        <div className="tareas">
          {!pend.length && <p className="empty-state" style={{ padding: 16 }}>Nada pendiente con este cliente.</p>}
          {pend.map((t) => <TareaFila key={t.id} t={t} onCambio={q.reload} mostrarCliente={false} />)}
          {hechas.length > 0 && <button className="linkish ver-hechas" onClick={() => setVerHechas(!verHechas)}>{verHechas ? 'Ocultar hechas' : `Ver hechas (${hechas.length})`}</button>}
          {verHechas && hechas.map((t) => <TareaFila key={t.id} t={t} onCambio={q.reload} mostrarCliente={false} />)}
        </div>
      )}
    </section>
  );
}
