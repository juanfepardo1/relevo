import { useState, type FormEvent } from 'react';
import { Plus, ArrowSquareOut, CheckCircle, Prohibit, ArrowCounterClockwise } from '@phosphor-icons/react';
import { supabase, must, type Row } from '../lib/supabase';
import { useQuery } from '../lib/data';
import { label } from '../lib/catalogos';
import { fecha, hoy, diasDesde } from '../lib/format';
import { Skeleton, ErrorBox, Modal, Field, useToast } from '../components/ui';
import { CAT_GASTO, QUIEN, cop } from '../lib/finanzas';

export const PERIODO: [string, string][] = [['mensual', 'Mensual'], ['trimestral', 'Trimestral'], ['anual', 'Anual']];
const MESES: Record<string, number> = { mensual: 1, trimestral: 3, anual: 12 };
export const alMes = (s: Row) => Number(s.monto) / (MESES[s.periodicidad] ?? 1);
export const faltan = (d: string) => -(diasDesde(d) ?? 0);

function siguiente(d: string, periodicidad: string) {
  const [y, m, day] = d.split('-').map(Number);
  const n = new Date(Date.UTC(y, m - 1 + (MESES[periodicidad] ?? 1), 1));
  const last = new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth() + 1, 0)).getUTCDate();
  n.setUTCDate(Math.min(day, last));
  return n.toISOString().slice(0, 10);
}

export function Faltan({ d }: { d: string }) {
  const n = faltan(d);
  const t = n < 0 ? 'tone-perdido' : n <= 3 ? 'tone-perdido' : n <= 7 ? 'tone-mercado' : 'tone-nuevo';
  return <span className={'tag ' + t}>{n < 0 ? `Venció hace ${-n} d` : n === 0 ? 'Se renueva hoy' : n === 1 ? 'Mañana' : `En ${n} días`}</span>;
}

export default function Suscripciones() {
  const q = useQuery(() => supabase.from('suscripciones').select('*').order('proxima_renovacion'));
  const toast = useToast();
  const [nueva, setNueva] = useState(false);
  const [abierta, setAbierta] = useState<Row | null>(null);
  const [verCanceladas, setVerCanceladas] = useState(false);
  const rows = (q.data || []) as Row[];
  const activas = rows.filter((s) => s.estado === 'activa');
  const lista = verCanceladas ? rows : activas;
  const mensual = activas.reduce((a, s) => a + alMes(s), 0);
  const prox7 = activas.filter((s) => faltan(s.proxima_renovacion) <= 7);

  const upd = async (s: Row, cambios: Row, msg: string) => {
    try { await must(supabase.from('suscripciones').update(cambios).eq('id', s.id)); toast(msg); q.reload(); }
    catch (e: any) { toast(e.message, true); }
  };
  const pagada = async (s: Row) => {
    try {
      await must(supabase.from('movimientos').insert({ fecha: hoy() < s.proxima_renovacion ? s.proxima_renovacion : hoy(), tipo: 'gasto', categoria: s.categoria, descripcion: 'Suscripción ' + s.nombre, monto: s.monto, pagado_por: s.pagado_por }));
      await upd(s, { proxima_renovacion: siguiente(s.proxima_renovacion, s.periodicidad) }, `Cobro registrado en Finanzas. Próxima: ${fecha(siguiente(s.proxima_renovacion, s.periodicidad))}`);
    } catch (e: any) { toast(e.message, true); }
  };

  return (
    <div className="page">
      <div className="head">
        <div><h1>Suscripciones</h1><p>Qué pagamos cada mes y cuándo se renueva cada cosa, para cancelar a tiempo.</p></div>
        <button className="btn primary" onClick={() => setNueva(true)}><Plus className="ic" />Nueva suscripción</button>
      </div>
      {q.error ? <ErrorBox msg={q.error} retry={q.reload} /> : q.loading ? <div className="panel"><Skeleton rows={5} /></div> : (
        <>
          <dl className="kpis" style={{ gridTemplateColumns: 'repeat(3,minmax(0,1fr))' }}>
            <div><dt>Costo mensual</dt><dd className="num">{cop(mensual)}</dd></div>
            <div><dt>Costo al año</dt><dd className="num">{cop(mensual * 12)}</dd></div>
            <div><dt>Se renuevan en 7 días</dt><dd className="num">{prox7.length}</dd></div>
          </dl>
          <div className="toolbar">
            <label className="who"><input type="checkbox" checked={verCanceladas} onChange={(e) => setVerCanceladas(e.target.checked)} />Ver canceladas</label>
          </div>
          <div className="tablewrap">
            <table className="t">
              <thead><tr><th>Suscripción</th><th>Renueva</th><th></th><th className="r">Monto</th><th>Cada</th><th className="r">Al mes</th><th>La paga</th><th className="r">Acciones</th></tr></thead>
              <tbody>
                {!lista.length ? <tr><td colSpan={8}><p className="empty-state">Sin suscripciones.</p></td></tr> : lista.map((s) => (
                  <tr key={s.id} onClick={() => setAbierta(s)} style={s.estado === 'cancelada' ? { opacity: 0.55 } : undefined}>
                    <td><span className="primary-cell">{s.nombre}</span><span className="sub">{label(CAT_GASTO, s.categoria)}</span></td>
                    <td className="num">{fecha(s.proxima_renovacion, true)}</td>
                    <td>{s.estado === 'cancelada' ? <span className="tag tone-final">Cancelada</span> : <Faltan d={s.proxima_renovacion} />}</td>
                    <td className="r num">{cop(Number(s.monto))}</td>
                    <td>{label(PERIODO, s.periodicidad)}</td>
                    <td className="r num soft">{cop(alMes(s))}</td>
                    <td><span className={'tag plain ' + (s.pagado_por === 'felipe' ? 'tone-p1' : s.pagado_por === 'alejandro' ? 'tone-p2' : 'tone-nuevo')}>{label(QUIEN, s.pagado_por)}</span></td>
                    <td className="r" onClick={(e) => e.stopPropagation()}><div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                      {s.url_gestion && <a className="btn ghost" href={s.url_gestion} target="_blank" rel="noopener" title="Abrir para gestionar o cancelar"><ArrowSquareOut className="ic" />Gestionar</a>}
                      {s.estado === 'activa' ? <>
                        <button className="btn" title="Registra el gasto en Finanzas y mueve la fecha al siguiente periodo" onClick={() => pagada(s)}><CheckCircle className="ic" />Se cobró</button>
                        <button className="btn ghost danger" title="Marcar como cancelada" onClick={() => upd(s, { estado: 'cancelada' }, 'Marcada como cancelada')}><Prohibit className="ic" /></button>
                      </> : <button className="btn ghost" title="Reactivar" onClick={() => upd(s, { estado: 'activa' }, 'Reactivada')}><ArrowCounterClockwise className="ic" /></button>}
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="muted" style={{ fontSize: 12.5, marginTop: 10 }}>"Se cobró" registra el gasto en Finanzas y pasa la fecha al siguiente periodo. Cancelar aquí no cancela en el proveedor: usa Gestionar.</p>
        </>
      )}
      <Modal open={nueva} onClose={() => setNueva(false)} title="Nueva suscripción"><NuevaSuscripcion onDone={() => { setNueva(false); q.reload(); }} /></Modal>
      <Modal open={!!abierta} onClose={() => setAbierta(null)} title={abierta?.nombre ?? ''}>
        {abierta && <Editar s={abierta} onSaved={(n) => { setAbierta(n); q.reload(); }} />}
      </Modal>
    </div>
  );
}

function Editar({ s, onSaved }: { s: Row; onSaved: (n: Row) => void }) {
  const save = (k: string) => async (v: any) => { const n = await must(supabase.from('suscripciones').update({ [k]: v }).eq('id', s.id).select().single()); onSaved(n as Row); };
  return (
    <div className="fields" style={{ padding: '14px 20px 20px' }}>
      <Field label="Nombre" value={s.nombre} onSave={save('nombre')} />
      <Field label="Próxima renovación" type="date" value={s.proxima_renovacion} display={fecha(s.proxima_renovacion, true)} onSave={save('proxima_renovacion')} />
      <Field label="Monto (COP)" type="number" value={Number(s.monto)} display={cop(Number(s.monto))} onSave={save('monto')} />
      <Field label="Cada" type="select" options={PERIODO} value={s.periodicidad} onSave={save('periodicidad')} />
      <Field label="La paga" type="select" options={QUIEN} value={s.pagado_por} onSave={save('pagado_por')} />
      <Field label="Categoría" type="select" options={CAT_GASTO} value={s.categoria} onSave={save('categoria')} />
      <Field label="Link para gestionar" value={s.url_gestion} onSave={save('url_gestion')} wide />
      <Field label="Notas" type="textarea" value={s.notas} onSave={save('notas')} wide />
    </div>
  );
}

function NuevaSuscripcion({ onDone }: { onDone: () => void }) {
  const toast = useToast();
  const [f, setF] = useState<Row>({ nombre: '', monto: '', periodicidad: 'mensual', proxima_renovacion: '', pagado_por: 'felipe', categoria: 'software', url_gestion: '' });
  const [busy, setBusy] = useState(false);
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });
  const monto = Number(String(f.monto).replace(/\D/g, ''));
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true);
    try { await must(supabase.from('suscripciones').insert({ ...f, nombre: f.nombre.trim(), monto, url_gestion: f.url_gestion || null })); toast('Suscripción creada'); onDone(); }
    catch (err: any) { toast(err.message, true); }
    setBusy(false);
  };
  return (
    <form onSubmit={submit}>
      <label>Nombre<input className="in" required value={f.nombre} onChange={set('nombre')} placeholder="Notion, Lemlist, Claude" /></label>
      <div className="row">
        <label>Monto (COP)<input className="in num" inputMode="numeric" required value={monto ? '$' + new Intl.NumberFormat('es-CO').format(monto) : ''} onChange={(e) => setF({ ...f, monto: e.target.value.replace(/\D/g, '') })} /></label>
        <label>Cada<select className="sel" value={f.periodicidad} onChange={set('periodicidad')}>{PERIODO.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
      </div>
      <div className="row">
        <label>Próxima renovación<input className="in" type="date" required value={f.proxima_renovacion} onChange={set('proxima_renovacion')} /></label>
        <label>La paga<select className="sel" value={f.pagado_por} onChange={set('pagado_por')}>{QUIEN.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
      </div>
      <div className="row">
        <label>Categoría<select className="sel" value={f.categoria} onChange={set('categoria')}>{CAT_GASTO.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
        <label>Link para gestionar o cancelar<input className="in" type="url" value={f.url_gestion} onChange={set('url_gestion')} placeholder="https://" /></label>
      </div>
      <footer><button className="btn primary" disabled={busy}>{busy ? 'Creando' : 'Crear suscripción'}</button></footer>
    </form>
  );
}
