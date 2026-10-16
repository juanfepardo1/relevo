import { useMemo, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from '@phosphor-icons/react';
import { supabase, must, type Row } from '../lib/supabase';
import { useQuery, useCatalogo } from '../lib/data';
import { SECTORES, VENTAS, HORIZONTE, CANAL, label } from '../lib/catalogos';
import { fecha, hoy } from '../lib/format';
import { Skeleton, ErrorBox, Modal, Dias, useToast } from '../components/ui';
import { Persona } from '../components/paneles';
import { tonoEtapa, tonoBucket } from '../lib/colores';

const VENTAS_ORD = VENTAS.map((v) => v[0]);
export const BUCKETS: [string, string][] = [['A', '5.000 a 20.000M'], ['B', '1.000 a 5.000M'], ['C', 'menos de 1.000M'], ['D', 'más de 20.000M']];

export default function Vendedores({ mios = false }: { mios?: boolean }) {
  const nav = useNavigate();
  const { etapasDe, equipo, yo } = useCatalogo();
  const etapas = etapasDe('vendedor');
  const q = useQuery(() => supabase.from('v_vendedores').select('*').order('fecha_ingreso', { ascending: false }));
  const [vista, setVista] = useState<'tabla' | 'pipeline'>(() => (localStorage.getItem('v-vista') as any) || 'tabla');
  const [buscar, setBuscar] = useState('');
  const [etapa, setEtapa] = useState('activos');
  const [resp, setResp] = useState('');
  const [sector, setSector] = useState('');
  const [bucket, setBucket] = useState('');
  const [orden, setOrden] = useState<{ k: string; asc: boolean }>({ k: 'fecha_ingreso', asc: false });
  const [nuevo, setNuevo] = useState(false);
  const toast = useToast();

  const rows = useMemo(() => {
    const s = buscar.trim().toLowerCase();
    let r = (q.data || []).filter((v: Row) =>
      (etapa === 'todos' || (etapa === 'activos' ? !['cerrado', 'perdido', 'en_reserva'].includes(v.etapa) : v.etapa === etapa)) &&
      (mios ? v.responsable === yo?.email : (!resp || (resp === 'sin' ? !v.responsable : v.responsable === resp))) &&
      (!sector || v.sector === sector) && (!bucket || v.bucket === bucket) &&
      (!s || [v.nombre, v.empresa, v.ciudad, v.correo, v.celular].some((x) => String(x || '').toLowerCase().includes(s))));
    const k = orden.k;
    const val = (v: Row) => (k === 'ventas_rango' ? VENTAS_ORD.indexOf(v[k]) : k === 'etapa' ? v.etapa_orden : v[k]);
    r = [...r].sort((a, b) => { const x = val(a), y = val(b); if (x == null) return 1; if (y == null) return -1; return (x > y ? 1 : x < y ? -1 : 0) * (orden.asc ? 1 : -1); });
    return r;
  }, [q.data, buscar, etapa, resp, sector, bucket, orden, mios, yo]);

  const th = (k: string, t: string, cls = '') => (
    <th className={cls} onClick={() => setOrden((o) => ({ k, asc: o.k === k ? !o.asc : true }))} aria-sort={orden.k === k ? (orden.asc ? 'ascending' : 'descending') : 'none'}>
      {t}{orden.k === k ? (orden.asc ? ' ↑' : ' ↓') : ''}
    </th>
  );

  const mover = async (id: string, etapaNueva: string) => {
    try { await must(supabase.from('vendedores').update({ etapa: etapaNueva }).eq('id', id)); q.reload(); }
    catch (e: any) { toast(e.message, true); }
  };

  return (
    <div className="page">
      <div className="head">
        <div><h1>{mios ? 'Mis clientes' : 'Vendedores'}</h1><p>{q.loading ? 'Cargando' : mios ? `${rows.length} vendedores a cargo de ${yo?.apodo ?? yo?.nombre ?? 'ti'}` : `${rows.length} de ${q.data?.length ?? 0}`}</p></div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div className="seg" role="group" aria-label="Vista">
            {(['tabla', 'pipeline'] as const).map((k) => <button key={k} className={vista === k ? 'on' : ''} onClick={() => { setVista(k); try { localStorage.setItem('v-vista', k); } catch {} }}>{k === 'tabla' ? 'Tabla' : 'Pipeline'}</button>)}
          </div>
          <button className="btn primary" onClick={() => setNuevo(true)}><Plus className="ic" />Nuevo vendedor</button>
        </div>
      </div>

      <div className="toolbar">
        <input className="in" type="search" placeholder="Buscar nombre, empresa, ciudad" value={buscar} onChange={(e) => setBuscar(e.target.value)} />
        <select className="sel" value={etapa} onChange={(e) => setEtapa(e.target.value)} aria-label="Etapa">
          <option value="activos">Activos</option><option value="todos">Todos</option>
          {etapas.map((e) => <option key={e.codigo} value={e.codigo}>{e.nombre}</option>)}
        </select>
        {!mios && <select className="sel" value={resp} onChange={(e) => setResp(e.target.value)} aria-label="Responsable">
          <option value="">Cualquier responsable</option><option value="sin">Sin responsable</option>
          {equipo.map((m) => <option key={m.email} value={m.email}>{m.apodo ?? m.nombre}</option>)}
        </select>}
        <select className="sel" value={sector} onChange={(e) => setSector(e.target.value)} aria-label="Sector">
          <option value="">Todos los sectores</option>{SECTORES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
        <select className="sel" value={bucket} onChange={(e) => setBucket(e.target.value)} aria-label="Bucket">
          <option value="">Todos los buckets</option>{BUCKETS.map(([k, l]) => <option key={k} value={k}>{k} · {l}</option>)}
        </select>
      </div>

      {q.error ? <ErrorBox msg={q.error} retry={q.reload} /> : q.loading ? <div className="panel"><Skeleton rows={8} /></div> : vista === 'tabla' ? (
        <div className="tablewrap">
          <table className="t">
            <thead><tr>{th('nombre', 'Contacto')}{th('etapa', 'Etapa')}{th('dias_en_etapa', 'Días', 'r')}{th('bucket', 'Bucket')}{th('ventas_rango', 'Ventas')}{th('sector', 'Sector')}{th('ciudad', 'Ciudad')}{th('responsable', 'Responsable')}{th('fecha_proxima_accion', 'Próxima acción')}{th('docs_pendientes', 'Docs', 'r')}{th('fecha_ingreso', 'Ingreso')}</tr></thead>
            <tbody>
              {!rows.length ? <tr><td colSpan={11}><p className="empty-state">{mios ? 'No tienes vendedores asignados. Asígnate como responsable desde la ficha de un vendedor.' : 'Ningún vendedor coincide con los filtros.'}</p></td></tr> : rows.map((v: Row) => (
                <tr key={v.id} onClick={() => nav(`/vendedores/${v.id}`)}>
                  <td><span className="primary-cell">{v.empresa || v.nombre}</span><span className="sub">{v.empresa ? v.nombre : ''}</span></td>
                  <td><span className={'tag ' + tonoEtapa(v.fase, v.etapa)}>{v.etapa_nombre}</span></td>
                  <td className="r"><Dias d={v.dias_en_etapa} sla={v.sla_dias} /></td>
                  <td>{v.bucket ? <span className={'tag plain ' + tonoBucket(v.bucket)}>{v.bucket}</span> : <span className="muted">·</span>}</td>
                  <td>{label(VENTAS, v.ventas_rango)}</td>
                  <td>{label(SECTORES, v.sector)}</td>
                  <td>{v.ciudad}</td>
                  <td><Persona email={v.responsable} /></td>
                  <td>{v.fecha_proxima_accion ? <span className={v.fecha_proxima_accion <= hoy() ? 'b warn' : 'soft'}>{fecha(v.fecha_proxima_accion)} {v.proxima_accion ? '· ' + v.proxima_accion : ''}</span> : <span className="muted">Sin definir</span>}</td>
                  <td className="r">{v.docs_pendientes ? <span className="b warn num">{v.docs_pendientes}</span> : ''}</td>
                  <td className="num soft">{fecha(v.fecha_ingreso)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Pipeline rows={rows} etapas={etapas.filter((e) => etapa !== 'activos' || !e.terminal)} onOpen={(id) => nav(`/vendedores/${id}`)} onMove={mover} />
      )}

      <Modal open={nuevo} onClose={() => setNuevo(false)} title="Nuevo vendedor">
        <NuevoVendedor onDone={(id) => { setNuevo(false); nav(`/vendedores/${id}`); }} />
      </Modal>
    </div>
  );
}

function Pipeline({ rows, etapas, onOpen, onMove }: { rows: Row[]; etapas: { codigo: string; nombre: string; fase: string }[]; onOpen: (id: string) => void; onMove: (id: string, e: string) => void }) {
  const [over, setOver] = useState<string | null>(null);
  const cols = etapas.map((e) => ({ ...e, items: rows.filter((r) => r.etapa === e.codigo) })).filter((c) => c.items.length || etapas.length < 12 || true);
  return (
    <div className="board">
      {cols.map((c) => (
        <section key={c.codigo} className={'col ' + tonoEtapa(c.fase, c.codigo) + (over === c.codigo ? ' drop' : '')}
          onDragOver={(e) => { e.preventDefault(); setOver(c.codigo); }} onDragLeave={() => setOver(null)}
          onDrop={(e) => { e.preventDefault(); setOver(null); const id = e.dataTransfer.getData('text/plain'); if (id) onMove(id, c.codigo); }}>
          <header><span className="tag">{c.nombre}</span><span className="muted num">{c.items.length}</span></header>
          <div className="cards">
            {c.items.map((v) => (
              <article key={v.id} className={'card' + (v.sla_dias != null && v.dias_en_etapa > v.sla_dias ? ' over' : '')} draggable
                onDragStart={(e) => e.dataTransfer.setData('text/plain', v.id)} onClick={() => onOpen(v.id)}>
                <b>{v.empresa || v.nombre}</b>
                <span className="muted" style={{ fontSize: 12.5 }}>{[label(VENTAS, v.ventas_rango), v.ciudad].filter(Boolean).join(' · ')}</span>
                <div style={{ display: 'flex', gap: 6 }}><Dias d={v.dias_en_etapa} sla={v.sla_dias} />{v.docs_pendientes ? <span className="b warn">{v.docs_pendientes} docs</span> : null}</div>
              </article>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function NuevoVendedor({ onDone }: { onDone: (id: string) => void }) {
  const { equipo } = useCatalogo();
  const [f, setF] = useState<Row>({ nombre: '', empresa: '', celular: '', correo: '', ciudad: '', sector: '', ventas_rango: '', horizonte: '', canal: 'whatsapp', fuente: 'Referido', referido_por: '', responsable: '' });
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true);
    try {
      const body = Object.fromEntries(Object.entries(f).map(([k, v]) => [k, v === '' ? null : v]));
      const r = await must(supabase.from('vendedores').insert(body).select('id').single()) as Row;
      toast('Vendedor creado'); onDone(r.id);
    } catch (err: any) { toast(err.message, true); }
    setBusy(false);
  };
  return (
    <form onSubmit={submit}>
      <div className="row"><label>Nombre del contacto<input className="in" required value={f.nombre} onChange={set('nombre')} /></label><label>Empresa<input className="in" value={f.empresa} onChange={set('empresa')} /></label></div>
      <div className="row"><label>Celular<input className="in" type="tel" value={f.celular} onChange={set('celular')} /></label><label>Correo<input className="in" type="email" value={f.correo} onChange={set('correo')} /></label></div>
      <div className="row">
        <label>Sector<select className="sel" value={f.sector} onChange={set('sector')}><option value="">Sin definir</option>{SECTORES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
        <label>Ventas último año<select className="sel" value={f.ventas_rango} onChange={set('ventas_rango')}><option value="">Sin definir</option>{VENTAS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
      </div>
      <div className="row">
        <label>Horizonte<select className="sel" value={f.horizonte} onChange={set('horizonte')}><option value="">Sin definir</option>{HORIZONTE.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
        <label>Ciudad<input className="in" value={f.ciudad} onChange={set('ciudad')} /></label>
      </div>
      <div className="row">
        <label>Canal<select className="sel" value={f.canal} onChange={set('canal')}>{CANAL.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
        <label>Responsable<select className="sel" value={f.responsable} onChange={set('responsable')}><option value="">Nadie</option>{equipo.map((m) => <option key={m.email} value={m.email}>{m.nombre}</option>)}</select></label>
      </div>
      <div className="row"><label>Fuente<input className="in" value={f.fuente} onChange={set('fuente')} /></label><label>Referido por<input className="in" value={f.referido_por} onChange={set('referido_por')} /></label></div>
      <footer><button className="btn primary" disabled={busy}>{busy ? 'Creando' : 'Crear vendedor'}</button></footer>
    </form>
  );
}
