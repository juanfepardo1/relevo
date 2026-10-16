import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDown, ArrowUp, ChatCircle, Envelope, FileText, Note, Phone, Plus, Users, Paperclip, Check, ArrowSquareOut, FilePlus } from '@phosphor-icons/react';
import { supabase, must, type Row } from '../lib/supabase';
import { useQuery, useCatalogo } from '../lib/data';
import { TIPO_DOC, ESTADO_DOC, TIPO_ACTIVIDAD, label } from '../lib/catalogos';
import { fecha, fechaHora, hoy, diasDesde } from '../lib/format';
import { Modal, Skeleton, useToast } from './ui';
import { tonoEtapa, tonoPersona } from '../lib/colores';

type Ent = 'vendedor' | 'comprador';
const fk = (e: Ent) => (e === 'vendedor' ? 'vendedor_id' : 'comprador_id');

/* ---------- Etapas ---------- */
export function Stepper({ pipeline, actual, onChange }: { pipeline: Ent; actual: string; onChange: (c: string) => Promise<unknown> }) {
  const { etapasDe } = useCatalogo();
  const etapas = etapasDe(pipeline);
  const toast = useToast();
  const [valor, setValor] = useState(actual);
  useEffect(() => setValor(actual), [actual]);
  const [busy, setBusy] = useState(false);
  const e = etapas.find((x) => x.codigo === valor);
  const fases = [...new Set(etapas.map((x) => x.fase))];
  const go = async (c: string) => {
    if (c === valor || busy) return;
    const antes = valor;
    setValor(c); setBusy(true);
    try { await onChange(c); toast('Etapa actualizada'); }
    catch (err: any) { setValor(antes); toast('No se cambió la etapa: ' + err.message, true); }
    setBusy(false);
  };
  return (
    <label className="who" style={{ gap: 10 }}>
      <span className="muted" style={{ fontSize: 12.5 }}>Etapa</span>
      <select className={'etapa-sel ' + tonoEtapa(e?.fase, valor)} value={valor} disabled={busy} onChange={(ev) => go(ev.target.value)}>
        {fases.map((f) => (
          <optgroup key={f} label={f}>
            {etapas.filter((x) => x.fase === f).map((x) => <option key={x.codigo} value={x.codigo}>{x.nombre}</option>)}
          </optgroup>
        ))}
      </select>
    </label>
  );
}

export function EtapaTag({ pipeline, codigo, nombre }: { pipeline: Ent; codigo: string; nombre?: string }) {
  const { etapasDe } = useCatalogo();
  const e = etapasDe(pipeline).find((x) => x.codigo === codigo);
  return <span className={'tag ' + tonoEtapa(e?.fase, codigo)}>{nombre ?? e?.nombre ?? codigo}</span>;
}

export function Persona({ email }: { email: string | null | undefined }) {
  const { equipo } = useCatalogo();
  if (!email) return <span className="muted">Nadie</span>;
  const n = equipo.find((m) => m.email === email)?.nombre ?? email;
  const m = equipo.find((x) => x.email === email);
  return <span className={'who ' + tonoPersona(email)} title={n}><span className="avatar">{n.split(' ').map((x) => x[0]).slice(0, 2).join('')}</span>{m?.apodo ?? n.split(' ')[0]}</span>;
}

/* ---------- Documentos ---------- */
export function DocumentosPanel({ entidad, id }: { entidad: Ent; id: string }) {
  const q = useQuery(() => supabase.from('documentos').select('*').eq(fk(entidad), id).order('created_at', { ascending: false }), [id]);
  const [open, setOpen] = useState(false);
  const toast = useToast();

  const marcar = async (d: Row) => {
    const estado = d.direccion === 'recibir' ? 'recibido' : 'enviado';
    try { await must(supabase.from('documentos').update({ estado, completado_en: hoy() }).eq('id', d.id)); toast('Documento actualizado'); q.reload(); }
    catch (e: any) { toast(e.message, true); }
  };
  const abrir = async (d: Row) => {
    if (d.url) return window.open(d.url, '_blank', 'noopener');
    const { data, error } = await supabase.storage.from('documentos').createSignedUrl(d.archivo_path, 120);
    if (error) return toast('No se pudo abrir: ' + error.message, true);
    window.open(data.signedUrl, '_blank', 'noopener');
  };

  return (
    <section className="panel">
      <header><h2>Documentos</h2><div style={{ display: 'flex', gap: 6 }}>{entidad === 'vendedor' && <Link className="btn" to={`/documentos?tipo=nda&vendedor=${id}`}><FilePlus className="ic" />Generar NDA</Link>}<button className="btn" onClick={() => setOpen(true)}><Plus className="ic" />Registrar</button></div></header>
      {q.loading ? <Skeleton rows={3} /> : !q.data?.length ? (
        <p className="empty-state">Sin documentos. Registra lo que pides, recibes o envías para que el sistema avise cuando algo se atrase.</p>
      ) : (
        <div className="list">
          {q.data.map((d: Row) => {
            const atraso = d.estado === 'solicitado' ? diasDesde(d.solicitado_en) : null;
            const pend = d.estado === 'solicitado' || d.estado === 'pendiente';
            return (
              <div className="li" key={d.id}>
                {d.direccion === 'recibir' ? <ArrowDown className="ic" aria-label="Recibir" /> : <ArrowUp className="ic" aria-label="Enviar" />}
                <div style={{ minWidth: 0 }}>
                  <b>{d.nombre}</b>
                  <p className="meta">
                    {label(TIPO_DOC, d.tipo)} · {d.direccion === 'recibir' ? 'Lo envía la contraparte' : 'Lo enviamos nosotros'}
                    {d.solicitado_en && ` · pedido ${fecha(d.solicitado_en)}`}{d.completado_en && ` · completado ${fecha(d.completado_en)}`}
                  </p>
                  {d.notas && <p className="meta">{d.notas}</p>}
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <span className={'b ' + (atraso != null && atraso >= 15 ? 'err' : pend ? 'warn' : d.estado === 'descartado' ? '' : 'ok')}>
                    {label(ESTADO_DOC, d.estado)}{atraso != null ? ` · ${atraso} d` : ''}
                  </span>
                  {(d.archivo_path || d.url) && <button className="btn ghost" title="Abrir" onClick={() => abrir(d)}><ArrowSquareOut className="ic" /></button>}
                  {pend && <button className="btn ghost" title={d.direccion === 'recibir' ? 'Marcar recibido' : 'Marcar enviado'} onClick={() => marcar(d)}><Check className="ic" /></button>}
                </div>
              </div>
            );
          })}
        </div>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title="Registrar documento">
        <DocForm entidad={entidad} id={id} onDone={() => { setOpen(false); q.reload(); }} />
      </Modal>
    </section>
  );
}

function DocForm({ entidad, id, onDone }: { entidad: Ent; id: string; onDone: () => void }) {
  const [tipo, setTipo] = useState('estados_financieros');
  const [nombre, setNombre] = useState('');
  const [direccion, setDireccion] = useState('recibir');
  const [estado, setEstado] = useState('solicitado');
  const [solicitado, setSolicitado] = useState(hoy());
  const [url, setUrl] = useState('');
  const [notas, setNotas] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const submit = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true);
    try {
      let archivo_path: string | null = null;
      if (file) {
        archivo_path = `${entidad}/${id}/${Date.now()}-${file.name.replace(/[^\w.\-]+/g, '_')}`;
        const up = await supabase.storage.from('documentos').upload(archivo_path, file);
        if (up.error) throw new Error(up.error.message);
      }
      const terminado = ['recibido', 'enviado', 'firmado'].includes(estado);
      await must(supabase.from('documentos').insert({
        [fk(entidad)]: id, tipo, nombre: nombre.trim() || label(TIPO_DOC, tipo), direccion, estado,
        solicitado_en: estado === 'solicitado' || direccion === 'recibir' ? solicitado || null : null,
        completado_en: terminado ? hoy() : null, archivo_path, url: url.trim() || null, notas: notas.trim() || null,
      }));
      toast('Documento registrado'); onDone();
    } catch (err: any) { toast(err.message, true); }
    setBusy(false);
  };

  return (
    <form onSubmit={submit}>
      <div className="row">
        <label>Tipo<select className="sel" value={tipo} onChange={(e) => setTipo(e.target.value)}>{TIPO_DOC.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
        <label>Nombre<input className="in" value={nombre} placeholder={label(TIPO_DOC, tipo)} onChange={(e) => setNombre(e.target.value)} /></label>
      </div>
      <div className="row">
        <label>Dirección<select className="sel" value={direccion} onChange={(e) => { setDireccion(e.target.value); setEstado(e.target.value === 'recibir' ? 'solicitado' : 'enviado'); }}>
          <option value="recibir">Lo envía la contraparte</option><option value="enviar">Lo enviamos nosotros</option></select></label>
        <label>Estado<select className="sel" value={estado} onChange={(e) => setEstado(e.target.value)}>{ESTADO_DOC.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
      </div>
      {estado === 'solicitado' && <label>Pedido el<input className="in" type="date" value={solicitado} onChange={(e) => setSolicitado(e.target.value)} /></label>}
      <label>Archivo<input className="in" type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></label>
      <label>O enlace (Drive, etc.)<input className="in" type="url" value={url} placeholder="https://" onChange={(e) => setUrl(e.target.value)} /></label>
      <label>Notas<textarea className="in" value={notas} onChange={(e) => setNotas(e.target.value)} /></label>
      <footer><button className="btn primary" disabled={busy}><Paperclip className="ic" />{busy ? 'Guardando' : 'Registrar documento'}</button></footer>
    </form>
  );
}

/* ---------- Actividades ---------- */
const ICONO: Record<string, any> = { llamada: Phone, reunion: Users, correo: Envelope, whatsapp: ChatCircle, nota: Note };
export function ActividadesPanel({ entidad, id, onChange }: { entidad: Ent; id: string; onChange?: () => void }) {
  const q = useQuery(() => supabase.from('actividades').select('*').eq(fk(entidad), id).order('fecha', { ascending: false }), [id]);
  const { equipo } = useCatalogo();
  const [tipo, setTipo] = useState('llamada');
  const [txt, setTxt] = useState('');
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const quien = (e: string | null) => equipo.find((m) => m.email === e)?.nombre.split(' ')[0] ?? e ?? '';

  const add = async (e: FormEvent) => {
    e.preventDefault(); if (!txt.trim()) return; setBusy(true);
    try { await must(supabase.from('actividades').insert({ [fk(entidad)]: id, tipo, resumen: txt.trim() })); setTxt(''); q.reload(); onChange?.(); }
    catch (err: any) { toast(err.message, true); }
    setBusy(false);
  };

  return (
    <section className="panel">
      <header><h2>Actividad</h2></header>
      <form onSubmit={add} style={{ padding: 16, display: 'grid', gap: 8, borderBottom: '1px solid var(--line)' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <select className="sel" style={{ width: 140 }} value={tipo} onChange={(e) => setTipo(e.target.value)} aria-label="Tipo">
            {TIPO_ACTIVIDAD.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
          <input className="in" value={txt} onChange={(e) => setTxt(e.target.value)} placeholder="Qué pasó o qué se acordó" aria-label="Resumen" />
          <button className="btn primary" disabled={busy || !txt.trim()}>Registrar</button>
        </div>
      </form>
      {q.loading ? <Skeleton rows={3} /> : !q.data?.length ? <p className="empty-state">Sin actividad registrada.</p> : (
        <div className="list">
          {q.data.map((a: Row) => { const I = ICONO[a.tipo] ?? FileText; return (
            <div className="li" key={a.id}>
              <I className="ic" />
              <div><p>{a.resumen}</p><p className="meta">{label(TIPO_ACTIVIDAD, a.tipo)} · {quien(a.autor)}</p></div>
              <span className="meta">{fechaHora(a.fecha)}</span>
            </div>); })}
        </div>
      )}
    </section>
  );
}

/* ---------- Historial de etapas ---------- */
export function HistorialPanel({ entidad, id }: { entidad: Ent; id: string }) {
  const q = useQuery(() => supabase.from('etapa_historial').select('*').eq('entidad', entidad).eq('entidad_id', id).order('desde', { ascending: false }), [id]);
  const { nombreEtapa } = useCatalogo();
  return (
    <section className="panel">
      <header><h2>Historial de etapas</h2></header>
      {q.loading ? <Skeleton rows={2} /> : !q.data?.length ? <p className="empty-state">Sin historial.</p> : (
        <div className="list">
          {q.data.map((h: Row) => {
            const fin = h.hasta ? new Date(h.hasta) : new Date();
            const d = Math.max(0, Math.floor((fin.getTime() - new Date(h.desde).getTime()) / 86400000));
            return (
              <div className="li" key={h.id} style={{ gridTemplateColumns: 'minmax(0,1fr) auto' }}>
                <div><b>{nombreEtapa(entidad, h.etapa)}</b><p className="meta">Desde {fecha(h.desde, true)}{h.hasta ? ` hasta ${fecha(h.hasta, true)}` : ' · actual'}{h.estimado ? ' · fecha estimada' : ''}</p></div>
                <span className="b num">{d} d</span>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
