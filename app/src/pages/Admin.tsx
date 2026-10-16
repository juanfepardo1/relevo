import { useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Copy } from '@phosphor-icons/react';
import { supabase, must, type Row } from '../lib/supabase';
import { useQuery, useCatalogo } from '../lib/data';
import { label } from '../lib/catalogos';
import { fechaHora } from '../lib/format';
import { Skeleton, ErrorBox, useToast } from '../components/ui';
import { TIPO_NOTA } from '../components/Nota';

const ESTADO_NOTA: [string, string][] = [['nueva', 'Nueva'], ['en_curso', 'En curso'], ['resuelta', 'Resuelta'], ['descartada', 'Descartada']];
const TONO_TIPO: Record<string, string> = { falla: 'tone-perdido', falta: 'tone-captacion', sobra: 'tone-nuevo', idea: 'tone-valoracion' };
type Vista = 'notas' | 'equipo' | 'datos' | 'metas';

export default function Admin() {
  const { yo } = useCatalogo();
  const [vista, setVista] = useState<Vista>('notas');
  if (yo && !yo.es_admin) return <Navigate to="/" replace />;
  return (
    <div className="page">
      <div className="head"><div><h1>Admin</h1><p>Solo lo ves tú.</p></div></div>
      <div className="seg" role="tablist" style={{ marginBottom: 16 }}>
        {([['notas', 'Notas de la app'], ['equipo', 'Equipo'], ['datos', 'Calidad de datos'], ['metas', 'Metas del embudo']] as [Vista, string][]).map(([k, l]) =>
          <button key={k} role="tab" aria-selected={vista === k} className={vista === k ? 'on' : ''} onClick={() => setVista(k)}>{l}</button>)}
      </div>
      {vista === 'notas' ? <Notas /> : vista === 'equipo' ? <Equipo /> : vista === 'metas' ? <Metas /> : <Datos />}
    </div>
  );
}

function Notas() {
  const q = useQuery(() => supabase.from('notas_app').select('*').order('created_at', { ascending: false }));
  const { equipo } = useCatalogo();
  const toast = useToast();
  const [estado, setEstado] = useState('abiertas');
  const quien = (e: string) => equipo.find((m) => m.email === e)?.apodo ?? e;
  const rows = ((q.data || []) as Row[]).filter((n) => estado === 'todas' || (estado === 'abiertas' ? ['nueva', 'en_curso'].includes(n.estado) : n.estado === estado));
  const cambiar = async (n: Row, est: string) => {
    try { await must(supabase.from('notas_app').update({ estado: est, resuelta_en: est === 'resuelta' ? new Date().toISOString() : null }).eq('id', n.id)); q.reload(); }
    catch (e: any) { toast(e.message, true); }
  };
  const copiar = async () => {
    const txt = rows.map((n, i) => `${i + 1}. [${label(TIPO_NOTA, n.tipo)}] ${n.texto} (${n.pagina || 'sin página'}, ${quien(n.autor)}, ${fechaHora(n.created_at)})`).join('\n');
    try { await navigator.clipboard.writeText('Notas de la app interna de Relevo para arreglar:\n' + txt); toast('Copiadas. Pégalas en el chat con Claude.'); } catch { toast('No se pudo copiar', true); }
  };
  if (q.error) return <ErrorBox msg={q.error} retry={q.reload} />;
  if (q.loading) return <div className="panel"><Skeleton rows={5} /></div>;
  const abiertas = ((q.data || []) as Row[]).filter((n) => ['nueva', 'en_curso'].includes(n.estado)).length;
  return (
    <>
      <div className="toolbar">
        <select className="sel" value={estado} onChange={(e) => setEstado(e.target.value)} aria-label="Estado">
          <option value="abiertas">Abiertas ({abiertas})</option><option value="todas">Todas</option>
          {ESTADO_NOTA.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
        <button className="btn" disabled={!rows.length} onClick={copiar} style={{ marginLeft: 'auto' }}><Copy className="ic" />Copiar para Claude</button>
      </div>
      <div className="panel">
        <div className="list">
          {!rows.length ? <p className="empty-state">Sin notas en este filtro.</p> : rows.map((n) => (
            <div className="li" key={n.id} style={{ gridTemplateColumns: 'auto minmax(0,1fr) auto' }}>
              <span className={'tag ' + (TONO_TIPO[n.tipo] ?? '')}>{label(TIPO_NOTA, n.tipo)}</span>
              <div>
                <div style={{ whiteSpace: 'pre-wrap' }}>{n.texto}</div>
                <div className="meta">{quien(n.autor)} · {fechaHora(n.created_at)}{n.pagina ? ` · ${n.pagina}` : ''}</div>
              </div>
              <select className="sel" style={{ width: 'auto' }} value={n.estado} onChange={(e) => cambiar(n, e.target.value)} aria-label="Estado de la nota">
                {ESTADO_NOTA.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function Equipo() {
  const q = useQuery(() => supabase.from('equipo').select('*').order('created_at'));
  const toast = useToast();
  const toggle = async (m: Row) => {
    try { await must(supabase.from('equipo').update({ activo: !m.activo }).eq('email', m.email)); q.reload(); toast(m.activo ? 'Acceso desactivado' : 'Acceso activado'); }
    catch (e: any) { toast(e.message, true); }
  };
  if (q.error) return <ErrorBox msg={q.error} retry={q.reload} />;
  if (q.loading) return <div className="panel"><Skeleton rows={3} /></div>;
  return (
    <>
      <div className="tablewrap">
        <table className="t">
          <thead><tr><th>Persona</th><th>Correo</th><th>Apodo</th><th>Rol</th><th>Datos para firmar</th><th>Acceso</th></tr></thead>
          <tbody>
            {((q.data || []) as Row[]).map((m) => (
              <tr key={m.email} style={{ cursor: 'default' }}>
                <td className="primary-cell">{m.nombre}</td>
                <td className="soft">{m.email}</td>
                <td>{m.apodo}</td>
                <td>{m.es_admin ? <span className="tag tone-cierre">Admin</span> : <span className="tag tone-nuevo">Equipo</span>}</td>
                <td>{m.nombre_legal && m.cedula && m.firma_path ? <span className="tag tone-ganado">Completos</span> : <span className="tag tone-mercado">Incompletos</span>}</td>
                <td>{m.es_admin ? <span className="muted">Siempre</span> : <button className={'btn' + (m.activo ? ' ghost danger' : '')} onClick={() => toggle(m)}>{m.activo ? 'Desactivar' : 'Activar'}</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted" style={{ fontSize: 12.5, marginTop: 10 }}>Para sumar a alguien: créale el usuario en Supabase (Authentication, Add user) y pídeme que lo agregue al equipo. Desactivar le quita el acceso a la app sin borrar nada.</p>
    </>
  );
}

function Datos() {
  const nav = useNavigate();
  const v = useQuery(() => supabase.from('v_vendedores').select('id,etapa,responsable,bucket,correo,celular,sector,ciudad,docs_pendientes'));
  const m = useQuery(() => supabase.from('movimientos').select('id,tipo,soporte_path'));
  const b = useQuery(() => supabase.from('v_bandeja').select('id'));
  const items = useMemo(() => {
    const V = ((v.data || []) as Row[]).filter((x) => !['cerrado', 'perdido', 'en_reserva'].includes(x.etapa));
    const M = (m.data || []) as Row[];
    return [
      { t: 'Vendedores activos sin responsable', n: V.filter((x) => !x.responsable).length, ir: '/vendedores' },
      { t: 'Vendedores sin bucket (sin ventas)', n: V.filter((x) => !x.bucket).length, ir: '/vendedores' },
      { t: 'Vendedores sin correo ni celular', n: V.filter((x) => !x.correo && !x.celular).length, ir: '/vendedores' },
      { t: 'Vendedores sin sector o ciudad', n: V.filter((x) => !x.sector || !x.ciudad).length, ir: '/vendedores' },
      { t: 'Gastos sin soporte de pago', n: M.filter((x) => x.tipo === 'gasto' && !x.soporte_path).length, ir: '/finanzas/movimientos' },
      { t: 'Leads esperando en la bandeja', n: ((b.data || []) as Row[]).length, ir: '/bandeja' },
    ];
  }, [v.data, m.data, b.data]);
  if (v.loading || m.loading) return <div className="panel"><Skeleton rows={6} /></div>;
  return (
    <div className="panel">
      <div className="list">
        {items.map((i) => (
          <div key={i.t} className="li click" style={{ gridTemplateColumns: 'minmax(0,1fr) auto' }} onClick={() => nav(i.ir)}>
            <b>{i.t}</b>
            <span className={'tag ' + (i.n ? 'tone-mercado' : 'tone-ganado')}>{i.n}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Metas() {
  const q = useQuery(() => supabase.from('etapas').select('*').eq('pipeline', 'vendedor').order('orden'));
  const aj = useQuery(() => supabase.from('ajustes').select('valor').eq('clave', 'dias_sin_actividad').maybeSingle());
  const toast = useToast();
  const guardar = async (codigo: string, v: string) => {
    const n = v.trim() === '' ? null : Math.max(0, Math.round(Number(v)));
    if (n !== null && Number.isNaN(n)) return;
    const { data, error } = await supabase.from('etapas').update({ sla_dias: n }).eq('pipeline', 'vendedor').eq('codigo', codigo).select();
    if (error || !data?.length) toast('No se guardó: ' + (error?.message ?? 'falta correr el SQL de metas'), true); else { toast('Meta guardada'); q.reload(); }
  };
  const guardarN = async (v: string) => {
    const n = Math.max(1, Math.round(Number(v)));
    if (!n) return;
    try { await must(supabase.from('ajustes').upsert({ clave: 'dias_sin_actividad', valor: String(n), updated_at: new Date().toISOString() })); toast('Guardado'); aj.reload(); }
    catch (e: any) { toast(e.message, true); }
  };
  if (q.loading) return <div className="panel"><Skeleton rows={6} /></div>;
  return (
    <div className="grid2">
      <section className="panel">
        <header><h2>Días meta por etapa</h2><span className="muted" style={{ fontSize: 12.5 }}>En el orden del proceso</span></header>
        <div className="list">
          {((q.data || []) as Row[]).filter((e) => !e.terminal).map((e) => (
            <div className="li" key={e.codigo} style={{ gridTemplateColumns: 'minmax(0,1fr) 110px', alignItems: 'center' }}>
              <div><b>{e.nombre}</b><div className="meta">{e.fase}</div></div>
              <label className="who" style={{ justifySelf: 'end' }}><input className="in num" style={{ width: 64, textAlign: 'right' }} inputMode="numeric" defaultValue={e.sla_dias ?? ''} placeholder="·" onBlur={(ev) => { if (ev.target.value !== String(e.sla_dias ?? '')) guardar(e.codigo, ev.target.value); }} />días</label>
            </div>
          ))}
        </div>
      </section>
      <section className="panel">
        <header><h2>Quieto por inactividad</h2></header>
        <div className="body">
          <label className="who">Un vendedor activo cuenta como quieto si lleva
            <input key={(aj.data as Row | null)?.valor ?? '7'} className="in num" style={{ width: 64, textAlign: 'right' }} inputMode="numeric" defaultValue={(aj.data as Row | null)?.valor ?? '7'} onBlur={(e) => guardarN(e.target.value)} />
            días sin actividad.</label>
          <p className="muted" style={{ fontSize: 12.5, marginTop: 10 }}>Cuenta como actividad: una llamada, reunión o nota registrada, o un cambio de etapa. Deja una meta vacía si esa etapa no debe tener límite.</p>
        </div>
      </section>
    </div>
  );
}
