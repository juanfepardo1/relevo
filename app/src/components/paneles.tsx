import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDown, ArrowUp, ChatCircle, Envelope, FileText, Note, Phone, Plus, Users, Paperclip, Check, ArrowSquareOut, FilePlus, UploadSimple, CaretRight, DownloadSimple } from '@phosphor-icons/react';
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
export function DocumentosPanel({ entidad, id, direccion }: { entidad: Ent; id: string; direccion?: 'recibir' | 'enviar' }) {
  const q = useQuery(() => { let r = supabase.from('documentos').select('*').eq(fk(entidad), id); if (direccion) r = r.eq('direccion', direccion); return r.order('created_at', { ascending: false }); }, [id, direccion]);
  const [subiendo, setSubiendo] = useState('');
  const [open, setOpen] = useState(false);
  const [lote, setLote] = useState<File[] | null>(null);
  const [arrastre, setArrastre] = useState(false);
  const [abiertos, setAbiertos] = useState<Record<string, boolean>>({});
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

  const descargar = async (d: Row) => {
    const nombre = String(d.archivo_path).split('/').pop()?.replace(/^\d+-/, '') || 'documento';
    const { data, error } = await supabase.storage.from('documentos').createSignedUrl(d.archivo_path, 120, { download: nombre });
    if (error) return toast('No se pudo descargar: ' + error.message, true);
    window.location.assign(data.signedUrl);
  };

  const subirA = async (d: Row, f: File) => {
    setSubiendo(d.id);
    try {
      const path = `${entidad}/${id}/${Date.now()}-${f.name.replace(/[^\w.\-]+/g, '_')}`;
      const up = await supabase.storage.from('documentos').upload(path, f);
      if (up.error) throw new Error(up.error.message);
      await must(supabase.from('documentos').update({ archivo_path: path, estado: 'recibido', completado_en: hoy() }).eq('id', d.id));
      toast(`${d.nombre}: recibido`); q.reload();
    } catch (e: any) { toast(e.message, true); }
    setSubiendo('');
  };

  const fila = (d: Row) => {
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
          {d.archivo_path && <button className="btn ghost" title="Descargar" aria-label="Descargar" onClick={() => descargar(d)}><DownloadSimple className="ic" /></button>}
          {pend && d.direccion === 'recibir' && <label className="btn ghost" title="Subir el archivo de este documento" style={{ cursor: 'pointer' }}><UploadSimple className="ic" />{subiendo === d.id ? '…' : ''}<input type="file" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) subirA(d, f); }} /></label>}
          {pend && <button className="btn ghost" title={d.direccion === 'recibir' ? 'Marcar recibido' : 'Marcar enviado'} onClick={() => marcar(d)}><Check className="ic" /></button>}
        </div>
      </div>
    );
  };
  const lista = (q.data || []) as Row[];
  const pedidos = lista.filter((d) => d.direccion === 'recibir' && d.paquete_id && d.estado !== 'descartado');
  const progreso = { total: pedidos.length, recibidos: pedidos.filter((d) => d.estado === 'recibido').length, faltan: pedidos.filter((d) => d.estado === 'solicitado').length };
  const pendientes = lista.filter((d) => d.estado === 'solicitado' || d.estado === 'pendiente');
  const resto = lista.filter((d) => !(d.estado === 'solicitado' || d.estado === 'pendiente'));
  const grupos = Object.entries(resto.reduce((m: Record<string, Row[]>, d) => { (m[d.tipo] ||= []).push(d); return m; }, {}));
  return (
    <section className={'panel' + (arrastre ? ' drop-on' : '')} onDragOver={(e) => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); setArrastre(true); } }} onDragLeave={() => setArrastre(false)} onDrop={(e) => { e.preventDefault(); setArrastre(false); const f = Array.from(e.dataTransfer.files || []); if (f.length) setLote(f); }}>
      <header>
        <h2>{direccion === 'enviar' ? 'Enviados por Relevo' : direccion === 'recibir' ? 'Documentos del cliente' : 'Documentos'}</h2>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {entidad === 'vendedor' && direccion !== 'recibir' && <Link className="btn" to={`/vendedores/${id}/enviar`}><FilePlus className="ic" />Preparar NDA y documentos</Link>}
          {direccion !== 'enviar' && <label className="btn" style={{ cursor: 'pointer' }} title="Sube varios archivos de una vez"><UploadSimple className="ic" />Subir varios<input type="file" multiple hidden onChange={(e) => { const f = Array.from(e.target.files || []); e.target.value = ''; if (f.length) setLote(f); }} /></label>}
          <button className="btn" onClick={() => setOpen(true)}><Plus className="ic" />Registrar</button>
        </div>
      </header>
      {direccion === 'recibir' && progreso.total > 0 && (
        <div className="doc-progreso">
          <div className="dp-txt"><b className="num">{progreso.recibidos} de {progreso.total}</b> documentos pedidos han llegado{progreso.faltan ? `. Faltan ${progreso.faltan}` : '. Están todos'}</div>
          <div className="dp-barra"><span style={{ width: `${Math.round((progreso.recibidos / progreso.total) * 100)}%` }} /></div>
        </div>
      )}
      {q.loading ? <Skeleton rows={3} /> : !q.data?.length ? (
        <p className="empty-state">{direccion === 'enviar' ? 'Aún no le hemos enviado nada. El NDA y la lista de documentos quedan aquí al prepararlos.' : direccion === 'recibir' ? 'Aún no hay documentos del cliente. Lo que le pidamos aparece aquí como pendiente.' : 'Sin documentos. Registra lo que pides, recibes o envías para que el sistema avise cuando algo se atrase.'}</p>
      ) : (
        <>
          {pendientes.length > 0 && <div className="list">{pendientes.map(fila)}</div>}
          {grupos.length > 1 && (
            <div className="doc-todos">
              <span className="muted">{resto.length} documentos en {grupos.length} grupos</span>
              <button type="button" className="linkish" onClick={() => { const todos = grupos.every(([t]) => abiertos[t]); setAbiertos(Object.fromEntries(grupos.map(([t]) => [t, !todos]))); }}>{grupos.every(([t]) => abiertos[t]) ? 'Recoger todo' : 'Expandir todo'}</button>
            </div>
          )}
          {grupos.map(([tipo, docs]) => {
            const abierto = abiertos[tipo] ?? (grupos.length === 1 && docs.length <= 5);
            return (
              <div key={tipo} className="doc-grupo">
                <button type="button" className="doc-grupo-h" aria-expanded={abierto} onClick={() => setAbiertos({ ...abiertos, [tipo]: !abierto })}>
                  <CaretRight className="ic caret" style={{ transform: abierto ? 'rotate(90deg)' : 'none' }} />
                  <span>{label(TIPO_DOC, tipo)}</span><span className="b num">{docs.length}</span>
                  <span className="muted" style={{ marginLeft: 'auto', fontSize: 12 }}>{fecha(docs[0].completado_en || docs[0].created_at)}</span>
                </button>
                {abierto && <div className="list">{docs.map(fila)}</div>}
              </div>
            );
          })}
        </>
      )}
      <Modal open={!!lote} onClose={() => setLote(null)} title={`Subir ${lote?.length ?? 0} documentos recibidos`}>
        {lote && <SubirVarios entidad={entidad} id={id} archivos={lote} pendientes={((q.data || []) as Row[]).filter((d) => d.direccion === 'recibir' && d.estado === 'solicitado')} onDone={() => { setLote(null); q.reload(); }} />}
      </Modal>
      <Modal open={open} onClose={() => setOpen(false)} title="Registrar documento">
        <DocForm entidad={entidad} id={id} direccionInicial={direccion} onDone={() => { setOpen(false); q.reload(); }} />
      </Modal>
    </section>
  );
}

function DocForm({ entidad, id, onDone, direccionInicial }: { entidad: Ent; id: string; onDone: () => void; direccionInicial?: 'recibir' | 'enviar' }) {
  const [tipo, setTipo] = useState('estados_financieros');
  const [nombre, setNombre] = useState('');
  const [direccion, setDireccion] = useState<string>(direccionInicial ?? 'recibir');
  const [estado, setEstado] = useState(direccionInicial === 'enviar' ? 'enviado' : 'solicitado');
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

/* ---------- Subir varios documentos recibidos ---------- */
function adivinarTipo(nombre: string) {
  const n = nombre.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (/renta|declaracion|dian|110\b/.test(n)) return 'declaracion_renta';
  if (/estado|financ|balance|eeff|pyg|p&g|resultado|flujo|patrimonio|notas a los/.test(n)) return 'estados_financieros';
  if (/factur/.test(n)) return 'facturacion';
  if (/extracto|bancari/.test(n)) return 'extractos';
  if (/camara|existencia|representacion|rues|rut\b/.test(n)) return 'camara_comercio';
  if (/nda|confidencial/.test(n)) return 'nda';
  return 'otro';
}

function SubirVarios({ entidad, id, archivos, pendientes, onDone }: { entidad: Ent; id: string; archivos: File[]; pendientes: Row[]; onDone: () => void }) {
  const toast = useToast();
  const [filas, setFilas] = useState(() => archivos.map((f) => ({ f, nombre: f.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim(), tipo: adivinarTipo(f.name), pedido: '' })));
  const [busy, setBusy] = useState(false);
  const [hechos, setHechos] = useState(0);
  const subir = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true);
    let ok = 0; const fallos: string[] = [];
    for (const r of filas) {
      try {
        const path = `${entidad}/${id}/${Date.now()}-${r.f.name.replace(/[^\w.\-]+/g, '_')}`;
        const up = await supabase.storage.from('documentos').upload(path, r.f);
        if (up.error) throw new Error(up.error.message);
        if (r.pedido) await must(supabase.from('documentos').update({ archivo_path: path, estado: 'recibido', completado_en: hoy() }).eq('id', r.pedido));
        else await must(supabase.from('documentos').insert({ [fk(entidad)]: id, tipo: r.tipo, nombre: r.nombre || r.f.name, direccion: 'recibir', estado: 'recibido', completado_en: hoy(), archivo_path: path }));
        ok++; setHechos(ok);
      } catch (err: any) { fallos.push(`${r.f.name}: ${err.message}`); }
    }
    setBusy(false);
    if (fallos.length) toast(`Subidos ${ok} de ${filas.length}. Fallaron: ${fallos.join(' · ')}`, true);
    else toast(`${ok} documentos subidos`);
    onDone();
  };
  return (
    <form onSubmit={subir}>
      <div className="lote">
        {filas.map((r, i) => (
          <div key={i} className="lote-fila">
            <input className="in" value={r.nombre} onChange={(e) => setFilas(filas.map((x, j) => (j === i ? { ...x, nombre: e.target.value } : x)))} aria-label="Nombre" />
            <select className="sel" value={r.tipo} onChange={(e) => setFilas(filas.map((x, j) => (j === i ? { ...x, tipo: e.target.value } : x)))} aria-label="Tipo">
              {TIPO_DOC.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
            {pendientes.length > 0 && (
              <select className="sel" value={r.pedido} onChange={(e) => setFilas(filas.map((x, j) => (j === i ? { ...x, pedido: e.target.value } : x)))} aria-label="Corresponde a" title="¿Es uno de los documentos que pedimos?">
                <option value="">Documento nuevo</option>
                {pendientes.filter((d) => d.id === r.pedido || !filas.some((x) => x.pedido === d.id)).map((d) => <option key={d.id} value={d.id}>Es: {d.nombre}</option>)}
              </select>
            )}
            <button type="button" className="btn ghost" aria-label="Quitar" onClick={() => setFilas(filas.filter((_, j) => j !== i))}>×</button>
          </div>
        ))}
      </div>
      {pendientes.length > 0 && <p className="meta">Si un archivo es uno de los documentos que pedimos, escoge cuál: ese pendiente queda recibido.</p>}
      <footer><button className="btn primary" disabled={busy || !filas.length}>{busy ? `Subiendo ${hechos} de ${filas.length}` : `Subir ${filas.length} documentos`}</button></footer>
    </form>
  );
}
