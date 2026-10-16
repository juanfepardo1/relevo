import { useMemo, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from '@phosphor-icons/react';
import { supabase, must, type Row } from '../lib/supabase';
import { useQuery, useCatalogo } from '../lib/data';
import { TIPO_COMPRADOR, SUBTIPO, ESTADO_COMPRADOR, CERTEZA, ORIGEN, SECTORES, label } from '../lib/catalogos';
import { rango, fecha } from '../lib/format';
import { Skeleton, ErrorBox, Modal, Dias, useToast } from '../components/ui';
import { EtapaTag } from '../components/paneles';

export default function Compradores() {
  const nav = useNavigate();
  const { etapasDe } = useCatalogo();
  const q = useQuery(() => supabase.from('v_compradores').select('*').order('created_at', { ascending: false }));
  const [buscar, setBuscar] = useState('');
  const [tipo, setTipo] = useState('');
  const [estado, setEstado] = useState('');
  const [etapa, setEtapa] = useState('');
  const [sector, setSector] = useState('');
  const [nuevo, setNuevo] = useState(false);

  const rows = useMemo(() => {
    const s = buscar.trim().toLowerCase();
    return (q.data || []).filter((c: Row) =>
      (!tipo || c.tipo === tipo) && (!estado || c.estado === estado) && (!etapa || c.etapa === etapa) &&
      (!sector || (c.categorias || []).includes(sector)) &&
      (!s || [c.nombre, c.contacto_nombre, c.contacto_email, c.ciudad].some((x) => String(x || '').toLowerCase().includes(s))));
  }, [q.data, buscar, tipo, estado, etapa, sector]);

  return (
    <div className="page">
      <div className="head">
        <div><h1>Compradores</h1><p>{q.loading ? 'Cargando' : `${rows.length} de ${q.data?.length ?? 0}`}</p></div>
        <button className="btn primary" onClick={() => setNuevo(true)}><Plus className="ic" />Nuevo comprador</button>
      </div>
      <div className="toolbar">
        <input className="in" type="search" placeholder="Buscar nombre, contacto, correo" value={buscar} onChange={(e) => setBuscar(e.target.value)} />
        <select className="sel" value={tipo} onChange={(e) => setTipo(e.target.value)} aria-label="Tipo"><option value="">Todos los tipos</option>{TIPO_COMPRADOR.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        <select className="sel" value={estado} onChange={(e) => setEstado(e.target.value)} aria-label="Estado"><option value="">Todos los estados</option>{ESTADO_COMPRADOR.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        <select className="sel" value={etapa} onChange={(e) => setEtapa(e.target.value)} aria-label="Etapa"><option value="">Todas las etapas</option>{etapasDe('comprador').map((e) => <option key={e.codigo} value={e.codigo}>{e.nombre}</option>)}</select>
        <select className="sel" value={sector} onChange={(e) => setSector(e.target.value)} aria-label="Sector buscado"><option value="">Cualquier sector</option>{SECTORES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
      </div>
      {q.error ? <ErrorBox msg={q.error} retry={q.reload} /> : q.loading ? <div className="panel"><Skeleton rows={6} /></div> : (
        <div className="tablewrap">
          <table className="t">
            <thead><tr><th>Comprador</th><th>Tipo</th><th>Estado</th><th>Certeza</th><th>Etapa</th><th className="r">Días</th><th>Ticket</th><th>Sectores</th><th>Próxima acción</th><th>Ingreso</th></tr></thead>
            <tbody>
              {!rows.length ? <tr><td colSpan={10}><p className="empty-state">Ningún comprador coincide.</p></td></tr> : rows.map((c: Row) => (
                <tr key={c.id} onClick={() => nav(`/compradores/${c.id}`)}>
                  <td><span className="primary-cell">{c.nombre}</span><span className="sub">{c.contacto_nombre !== c.nombre ? c.contacto_nombre : c.contacto_email}</span></td>
                  <td>{label(TIPO_COMPRADOR, c.tipo)}{c.subtipo ? <span className="sub">{label(SUBTIPO[c.tipo] || [], c.subtipo)}</span> : null}</td>
                  <td><span className={'b ' + (c.estado === 'registrado' ? 'ok' : c.estado === 'inactivo' ? '' : 'bl')}>{label(ESTADO_COMPRADOR, c.estado)}</span></td>
                  <td>{c.certeza === 'sin_verificar' ? <span className="muted">Sin verificar</span> : <span className="b or">{c.certeza}</span>}</td>
                  <td><EtapaTag pipeline="comprador" codigo={c.etapa} nombre={c.etapa_nombre} /></td>
                  <td className="r"><Dias d={c.dias_en_etapa} /></td>
                  <td className="num">{rango(c.ticket_min, c.ticket_max)}</td>
                  <td style={{ maxWidth: 220 }}>{(c.categorias || []).map((s: string) => label(SECTORES, s)).join(', ')}</td>
                  <td>{c.fecha_proxima_accion ? `${fecha(c.fecha_proxima_accion)} · ${c.proxima_accion ?? ''}` : <span className="muted">Sin definir</span>}</td>
                  <td className="num soft">{fecha(c.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Modal open={nuevo} onClose={() => setNuevo(false)} title="Nuevo comprador">
        <NuevoComprador onDone={(id) => { setNuevo(false); nav(`/compradores/${id}`); }} />
      </Modal>
    </div>
  );
}

function NuevoComprador({ onDone }: { onDone: (id: string) => void }) {
  const [f, setF] = useState<Row>({ nombre: '', tipo: 'estrategico', subtipo: '', origen: 'referido', origen_referido: '', contacto: '', email: '', telefono: '', cargo: '' });
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value, ...(k === 'tipo' ? { subtipo: '' } : {}) });
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true);
    try {
      const c = await must(supabase.from('compradores').insert({ nombre: f.nombre.trim(), tipo: f.tipo, subtipo: f.subtipo || null, estado: 'contactado', etapa: 'contactado', origen: f.origen, origen_referido: f.origen_referido || null }).select('id').single()) as Row;
      if (f.contacto.trim()) {
        const p = await must(supabase.from('personas').insert({ nombre: f.contacto.trim(), comprador_id: c.id, email: f.email || null, telefono: f.telefono || null, cargo: f.cargo || null, rol: 'decisor' }).select('id').single()) as Row;
        await must(supabase.from('compradores').update({ contacto_principal_id: p.id }).eq('id', c.id));
      }
      toast('Comprador creado'); onDone(c.id);
    } catch (err: any) { toast(err.message, true); }
    setBusy(false);
  };
  return (
    <form onSubmit={submit}>
      <label>Empresa, fondo o persona<input className="in" required value={f.nombre} onChange={set('nombre')} /></label>
      <div className="row">
        <label>Tipo<select className="sel" value={f.tipo} onChange={set('tipo')}>{TIPO_COMPRADOR.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
        <label>Subtipo<select className="sel" value={f.subtipo} onChange={set('subtipo')}><option value="">Sin definir</option>{(SUBTIPO[f.tipo] || []).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
      </div>
      <div className="row">
        <label>Origen<select className="sel" value={f.origen} onChange={set('origen')}>{ORIGEN.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
        <label>Referido por<input className="in" value={f.origen_referido} onChange={set('origen_referido')} /></label>
      </div>
      <div className="row"><label>Contacto principal<input className="in" value={f.contacto} onChange={set('contacto')} /></label><label>Cargo<input className="in" value={f.cargo} onChange={set('cargo')} /></label></div>
      <div className="row"><label>Correo<input className="in" type="email" value={f.email} onChange={set('email')} /></label><label>WhatsApp<input className="in" type="tel" value={f.telefono} onChange={set('telefono')} /></label></div>
      <p className="muted" style={{ fontSize: 12.5 }}>Queda como Contactado. Pasa a Registrado cuando tenga una orden vigente. La certeza se define en la ficha: {label(CERTEZA, 'sin_verificar')} por defecto.</p>
      <footer><button className="btn primary" disabled={busy}>{busy ? 'Creando' : 'Crear comprador'}</button></footer>
    </form>
  );
}
