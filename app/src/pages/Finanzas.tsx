import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Plus, Trash, DownloadSimple, Printer, Paperclip, UploadSimple } from '@phosphor-icons/react';
import { supabase, must, type Row } from '../lib/supabase';
import { useQuery, useCatalogo } from '../lib/data';
import { label } from '../lib/catalogos';
import { fecha, hoy } from '../lib/format';
import { Skeleton, ErrorBox, Modal, useToast } from '../components/ui';
import { TIPOS, QUIEN, TODAS_CAT, quienPuede, puedeEditar, type Transfer, categoriasDe, cop, nombreMes, resultados, flujo, balance, socios, csv, type Mov, type Tratamiento } from '../lib/finanzas';

export type Seccion = 'movimientos' | 'estados' | 'socios';
type Estado = 'resultados' | 'flujo' | 'balance';
const ESTADOS: [Estado, string][] = [['resultados', 'Estado de resultados'], ['flujo', 'Flujo de caja'], ['balance', 'Balance']];
const TITULO: Record<Seccion, [string, string]> = {
  movimientos: ['Movimientos', 'Registra cada ingreso, gasto, aporte o reembolso. Lo demás se calcula solo.'],
  estados: ['Estados financieros', 'Se arman solos a partir de los movimientos.'],
  socios: ['Cuentas entre socios', 'Cuánto ha puesto cada uno y cómo quedar 50/50.'],
};
const quien = (k: string) => label(QUIEN, k);

export default function Finanzas({ seccion }: { seccion: Seccion }) {
  const q = useQuery(() => supabase.from('movimientos').select('*').order('fecha', { ascending: false }).order('created_at', { ascending: false }));
  const aj = useQuery(() => supabase.from('ajustes').select('valor').eq('clave', 'gastos_socios').maybeSingle());
  const [estado, setEstado] = useState<Estado>(() => { try { return (localStorage.getItem('fin-estado') as Estado) || 'resultados'; } catch { return 'resultados'; } });
  const toast = useToast();
  const movs = (q.data || []) as Mov[];
  const trato = ((aj.data as Row | null)?.valor as Tratamiento) || 'deuda';

  const cambiarTrato = async (t: Tratamiento) => {
    try { await must(supabase.from('ajustes').upsert({ clave: 'gastos_socios', valor: t, updated_at: new Date().toISOString() })); aj.reload(); }
    catch (e: any) { toast(e.message, true); }
  };
  const ir = (v: Estado) => { setEstado(v); try { localStorage.setItem('fin-estado', v); } catch {} };
  const [t, sub] = TITULO[seccion];

  return (
    <div className="page fin">
      <div className="head">
        <div><h1>{t}</h1><p>{sub}</p></div>
        {seccion !== 'movimientos' && <button className="btn" onClick={() => window.print()}><Printer className="ic" />Imprimir o guardar PDF</button>}
      </div>
      {seccion === 'estados' && (
        <div className="seg no-print" role="tablist" style={{ marginBottom: 16 }}>
          {ESTADOS.map(([k, l]) => <button key={k} role="tab" aria-selected={estado === k} className={estado === k ? 'on' : ''} onClick={() => ir(k)}>{l}</button>)}
        </div>
      )}
      {q.error ? <ErrorBox msg={q.error} retry={q.reload} /> : q.loading ? <div className="panel"><Skeleton rows={6} /></div> : (
        seccion === 'movimientos' ? <Movimientos movs={movs} reload={q.reload} /> :
        seccion === 'socios' ? <Socios movs={movs} /> :
        estado === 'resultados' ? <Resultados movs={movs} /> :
        estado === 'flujo' ? <Flujo movs={movs} /> :
        <Balance movs={movs} trato={trato} onTrato={cambiarTrato} />
      )}
    </div>
  );
}

/* ---------- Movimientos ---------- */
const ACEPTA = 'application/pdf,image/*';
const rutaSoporte = (id: string, f: File) => `movimientos/${id}/${Date.now()}-${f.name.replace(/[^\w.\-]+/g, '_')}`;

async function subirSoporte(id: string, file: File) {
  const path = rutaSoporte(id, file);
  const up = await supabase.storage.from('documentos').upload(path, file);
  if (up.error) throw new Error('No se subió el soporte: ' + up.error.message);
  await must(supabase.from('movimientos').update({ soporte_path: path }).eq('id', id));
}

function Movimientos({ movs, reload }: { movs: Mov[]; reload: () => void }) {
  const toast = useToast();
  const { yo } = useCatalogo();
  const [nuevo, setNuevo] = useState(false);
  const [mes, setMes] = useState('');
  const [subiendo, setSubiendo] = useState<string | null>(null);

  const borrar = async (m: Mov) => {
    if (!confirmar(m)) return;
    try {
      if (m.soporte_path) await supabase.storage.from('documentos').remove([m.soporte_path]);
      await must(supabase.from('movimientos').delete().eq('id', m.id)); toast('Movimiento borrado'); reload();
    } catch (err: any) { toast(err.message, true); }
  };
  const ver = async (m: Mov) => {
    const { data, error } = await supabase.storage.from('documentos').createSignedUrl(m.soporte_path!, 120);
    if (error) return toast('No se pudo abrir: ' + error.message, true);
    window.open(data.signedUrl, '_blank', 'noopener');
  };
  const adjuntar = async (m: Mov, file: File | undefined) => {
    if (!file) return;
    setSubiendo(m.id);
    try { await subirSoporte(m.id, file); toast('Soporte adjuntado'); reload(); } catch (err: any) { toast(err.message, true); }
    setSubiendo(null);
  };

  const ms = [...new Set(movs.map((m) => m.fecha.slice(0, 7)))].sort().reverse();
  const lista = movs.filter((m) => !mes || m.fecha.startsWith(mes));
  const sinSoporte = lista.filter((m) => !m.soporte_path && m.tipo === 'gasto').length;

  return (
    <>
      <div className="toolbar">
        <button className="btn primary" onClick={() => setNuevo(true)}><Plus className="ic" />Nuevo movimiento</button>
        <select className="sel" value={mes} onChange={(e) => setMes(e.target.value)} aria-label="Mes">
          <option value="">Todos los meses</option>{ms.map((m) => <option key={m} value={m}>{nombreMes(m)}</option>)}
        </select>
        <span className="muted">{lista.length} movimientos{sinSoporte ? ` · ${sinSoporte} gastos sin soporte` : ''}</span>
        <button className="btn ghost" style={{ marginLeft: 'auto' }} onClick={() => csv('relevo_movimientos', [['Fecha', 'Tipo', 'Categoría', 'Descripción', 'Monto', 'Quién', 'Soporte'], ...lista.map((m) => [m.fecha, label(TIPOS, m.tipo), label(TODAS_CAT, m.categoria), m.descripcion ?? '', Number(m.monto), quien(m.pagado_por), m.soporte_path ? 'Sí' : 'No'])])}><DownloadSimple className="ic" />Descargar CSV</button>
      </div>
      <div className="tablewrap">
        <table className="t">
          <thead><tr><th>Fecha</th><th>Tipo</th><th>Categoría</th><th>Descripción</th><th className="r">Monto</th><th>Quién</th><th>Soporte</th><th></th></tr></thead>
          <tbody>
            {!lista.length ? <tr><td colSpan={8}><p className="empty-state">Sin movimientos todavía.</p></td></tr> : lista.map((m) => {
              const mio = puedeEditar(m.pagado_por, yo?.socio);
              return (
                <tr key={m.id} style={{ cursor: 'default' }}>
                  <td className="num soft">{fecha(m.fecha)}</td>
                  <td><span className={'tag tone-' + (m.tipo === 'ingreso' ? 'ganado' : m.tipo === 'gasto' ? 'cierre' : 'captacion')}>{label(TIPOS, m.tipo)}</span></td>
                  <td>{label(TODAS_CAT, m.categoria)}</td>
                  <td>{m.descripcion}</td>
                  <td className={'r num' + (m.tipo === 'ingreso' ? ' pos' : m.tipo === 'gasto' ? ' neg' : '')}>{m.tipo === 'gasto' ? '-' : ''}{cop(Number(m.monto))}</td>
                  <td><span className={'tag plain ' + (m.pagado_por === 'felipe' ? 'tone-p1' : m.pagado_por === 'alejandro' ? 'tone-p2' : 'tone-nuevo')}>{quien(m.pagado_por)}</span></td>
                  <td>
                    {m.soporte_path ? <button className="btn ghost" onClick={() => ver(m)}><Paperclip className="ic" />Ver</button>
                      : mio ? <label className="btn ghost" style={{ cursor: 'pointer' }}>{subiendo === m.id ? 'Subiendo' : <><UploadSimple className="ic" />Adjuntar</>}<input type="file" accept={ACEPTA} hidden onChange={(e) => adjuntar(m, e.target.files?.[0])} /></label>
                      : <span className="muted">Sin soporte</span>}
                  </td>
                  <td className="r">{mio && <button className="btn ghost danger" aria-label="Borrar" title="Borrar" onClick={() => borrar(m)}><Trash className="ic" /></button>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="muted" style={{ fontSize: 12.5, marginTop: 10 }}>Cada uno registra, edita y borra solo lo que está a su nombre o a nombre de Relevo.</p>
      <Modal open={nuevo} onClose={() => setNuevo(false)} title="Nuevo movimiento">
        <NuevoMovimiento onDone={() => { setNuevo(false); reload(); }} />
      </Modal>
    </>
  );
}

function confirmar(m: Mov) {
  return window.confirm(`¿Borrar "${m.descripcion ?? label(TODAS_CAT, m.categoria)}" por ${cop(Number(m.monto))}?`);
}

function NuevoMovimiento({ onDone }: { onDone: () => void }) {
  const toast = useToast();
  const { yo } = useCatalogo();
  const socio = yo?.socio ?? null;
  const [f, setF] = useState<Row>({ fecha: hoy(), tipo: 'gasto', categoria: 'marketing', descripcion: '', monto: '', pagado_por: socio ?? 'relevo' });
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const cats = categoriasDe(f.tipo);
  const soloSocio = f.tipo === 'aporte' || f.tipo === 'reembolso';
  const opts = quienPuede(socio, soloSocio);
  useEffect(() => { if (!cats.some(([k]) => k === f.categoria)) setF((x) => ({ ...x, categoria: cats[0][0] })); }, [f.tipo]); // eslint-disable-line
  useEffect(() => { if (!opts.some(([k]) => k === f.pagado_por) && opts[0]) setF((x) => ({ ...x, pagado_por: opts[0][0] })); }, [f.tipo]); // eslint-disable-line
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });
  const monto = Number(String(f.monto).replace(/\D/g, ''));
  const pagoLabel = f.tipo === 'ingreso' ? 'Lo recibió' : f.tipo === 'aporte' ? 'Lo puso' : f.tipo === 'reembolso' ? 'Se le devolvió a' : 'Lo pagó';

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!monto) { toast('Falta el monto', true); return; }
    setBusy(true);
    try {
      const m = await must(supabase.from('movimientos').insert({ fecha: f.fecha, tipo: f.tipo, categoria: f.categoria, descripcion: f.descripcion.trim() || null, monto, pagado_por: f.pagado_por }).select('id').single()) as Row;
      if (file) {
        try { await subirSoporte(m.id, file); } catch (err: any) { toast('Movimiento guardado, pero ' + err.message.toLowerCase(), true); onDone(); setBusy(false); return; }
      }
      toast('Movimiento registrado'); onDone();
    } catch (err: any) { toast(err.message, true); }
    setBusy(false);
  };

  if (!socio) return <form><p className="err-text">Tu usuario no tiene socio asignado. Pide que lo configuren en la tabla equipo.</p></form>;
  return (
    <form onSubmit={submit}>
      <div className="row">
        <label>Tipo<select className="sel" value={f.tipo} onChange={set('tipo')}>{TIPOS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
        <label>Fecha<input className="in" type="date" required value={f.fecha} onChange={set('fecha')} /></label>
      </div>
      <div className="row">
        <label>Categoría<select className="sel" value={f.categoria} onChange={set('categoria')} disabled={cats.length === 1}>{cats.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
        <label>Monto (COP)<input className="in num" inputMode="numeric" required autoFocus placeholder="$0" value={f.monto ? '$' + new Intl.NumberFormat('es-CO').format(monto) : ''} onChange={(e) => setF({ ...f, monto: e.target.value.replace(/\D/g, '') })} /></label>
      </div>
      <label>Descripción<input className="in" placeholder="Meta Ads, Notion, valoración UNICARIBE" value={f.descripcion} onChange={set('descripcion')} /></label>
      <label>{pagoLabel}
        <div className="seg" role="radiogroup">
          {opts.map(([k, l]) => <button type="button" key={k} role="radio" aria-checked={f.pagado_por === k} className={f.pagado_por === k ? 'on' : ''} onClick={() => setF({ ...f, pagado_por: k })}>{l}</button>)}
        </div>
      </label>
      <label>Soporte de pago (PDF o imagen)
        <input className="in" type="file" accept={ACEPTA} onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      </label>
      <footer><button className="btn primary" disabled={busy}>{busy ? 'Guardando' : 'Registrar movimiento'}</button></footer>
    </form>
  );
}

/* ---------- Reportes ---------- */
function Reporte({ titulo, nota, meses, filas, descargar }: { titulo: string; nota?: string; meses: string[]; filas: { l: string; v: number[]; t: number; k?: 'tot' | 'resultado' }[]; descargar: string }) {
  return (
    <section className="panel report">
      <header>
        <div><h2>{titulo}</h2>{nota && <p className="muted" style={{ fontSize: 12.5, marginTop: 2 }}>{nota}</p>}</div>
        <button className="btn ghost no-print" onClick={() => csv(descargar, [['', ...meses.map(nombreMes), 'Total'], ...filas.map((f) => [f.l, ...f.v, f.t])])}><DownloadSimple className="ic" />CSV</button>
      </header>
      <div style={{ overflowX: 'auto' }}>
        <table className="t fin-t">
          <thead><tr><th></th>{meses.map((m) => <th key={m} className="r">{nombreMes(m)}</th>)}<th className="r">Total</th></tr></thead>
          <tbody>
            {filas.map((f, i) => (
              <tr key={i} className={f.k ?? ''}>
                <td>{f.l}</td>
                {f.v.map((x, j) => <td key={j} className={'r num' + (f.k === 'resultado' ? (x < 0 ? ' neg' : x > 0 ? ' pos' : '') : '')}>{x ? cop(x) : <span className="muted">·</span>}</td>)}
                <td className={'r num' + (f.k === 'resultado' ? (f.t < 0 ? ' neg' : f.t > 0 ? ' pos' : '') : '')}>{cop(f.t)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Resultados({ movs }: { movs: Mov[] }) {
  const r = useMemo(() => resultados(movs), [movs]);
  const filas = [
    ...r.ingresos.map((x) => ({ l: x.l, v: x.porMes, t: x.total })),
    { l: 'Total ingresos', v: r.totalIngresos.porMes, t: r.totalIngresos.total, k: 'tot' as const },
    ...r.gastos.map((x) => ({ l: x.l, v: x.porMes, t: x.total })),
    { l: 'Total gastos', v: r.totalGastos.porMes, t: r.totalGastos.total, k: 'tot' as const },
    { l: r.resultado.total >= 0 ? 'Utilidad' : 'Pérdida', v: r.resultado.porMes, t: r.resultado.total, k: 'resultado' as const },
  ];
  return (
    <>
      <Kpis items={[['Ingresos', r.totalIngresos.total], ['Gastos', r.totalGastos.total], ['Resultado', r.resultado.total]]} />
      <Reporte titulo="Estado de resultados" nota="Base caja: cada ingreso o gasto cuenta el día que se pagó." meses={r.meses} filas={filas} descargar="relevo_estado_resultados" />
    </>
  );
}

function Flujo({ movs }: { movs: Mov[] }) {
  const f = useMemo(() => flujo(movs), [movs]);
  const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
  const filas = [
    ...f.porSocio.map((s) => ({ l: `Gastos pagados por ${quien(s.s)}`, v: s.porMes, t: sum(s.porMes) })),
    ...f.cobradoSocio.filter((s) => sum(s.porMes)).map((s) => ({ l: `Ingresos recibidos por ${quien(s.s)}`, v: s.porMes, t: sum(s.porMes) })),
    { l: 'Entradas a la cuenta de Relevo', v: f.entradasRelevo, t: sum(f.entradasRelevo) },
    { l: 'Salidas de la cuenta de Relevo', v: f.salidasRelevo.map((x) => -x), t: -sum(f.salidasRelevo) },
    { l: 'Saldo de la cuenta de Relevo', v: f.cajaFinal, t: f.cajaFinal[f.cajaFinal.length - 1] ?? 0, k: 'resultado' as const },
  ];
  const quema = f.gastoTotal.length ? f.gastoTotal[f.gastoTotal.length - 1] : 0;
  return (
    <>
      <Kpis items={[['Gasto del último mes', quema], ['Gasto total', sum(f.gastoTotal)], ['Saldo en la cuenta de Relevo', f.cajaFinal[f.cajaFinal.length - 1] ?? 0]]} />
      <Reporte titulo="Flujo de caja" nota="Mientras Relevo no tenga cuenta propia, la plata sale del bolsillo de cada socio." meses={f.meses} filas={filas} descargar="relevo_flujo_caja" />
    </>
  );
}

function Balance({ movs, trato, onTrato }: { movs: Mov[]; trato: Tratamiento; onTrato: (t: Tratamiento) => void }) {
  const [corte, setCorte] = useState(hoy());
  const b = useMemo(() => balance(movs, corte, trato), [movs, corte, trato]);
  const L = ({ l, v, k }: { l: string; v: number; k?: string }) => <tr className={k ?? ''}><td>{l}</td><td className={'r num' + (k === 'resultado' ? (v < 0 ? ' neg' : '') : '')}>{cop(v)}</td></tr>;
  return (
    <>
      <div className="toolbar no-print">
        <label className="who">Corte<input className="in" type="date" value={corte} onChange={(e) => setCorte(e.target.value)} style={{ width: 160 }} /></label>
        <label className="who" style={{ marginLeft: 12 }}>Lo que pagan los socios cuenta como
          <select className="sel" style={{ width: 'auto' }} value={trato} onChange={(e) => onTrato(e.target.value as Tratamiento)}>
            <option value="deuda">Deuda de Relevo con el socio</option><option value="aporte">Aporte de capital</option>
          </select>
        </label>
        <button className="btn ghost" style={{ marginLeft: 'auto' }} onClick={() => csv('relevo_balance_' + corte, [['Cuenta', 'Valor'], ['Caja', b.caja], ['Total activos', b.caja], ['Cuentas por pagar a Pardo', trato === 'deuda' ? b.cuenta.felipe : 0], ['Cuentas por pagar a Alejo', trato === 'deuda' ? b.cuenta.alejandro : 0], ['Total pasivos', b.pasivo], ['Aportes de Pardo', trato === 'aporte' ? b.cuenta.felipe : 0], ['Aportes de Alejo', trato === 'aporte' ? b.cuenta.alejandro : 0], ['Resultado acumulado', b.resultado], ['Total patrimonio', b.patrimonio]])}><DownloadSimple className="ic" />CSV</button>
      </div>
      <p className="muted" style={{ fontSize: 12.5, marginBottom: 12 }}>Esta regla está pendiente de decidir entre ustedes. Cambiarla aquí solo cambia cómo se presenta el balance, no los movimientos.</p>
      <div className="grid2">
        <section className="panel report"><header><h2>Activos</h2></header>
          <table className="t fin-t"><tbody><L l="Caja (cuenta de Relevo)" v={b.caja} /><L l="Total activos" v={b.caja} k="tot" /></tbody></table>
        </section>
        <section className="panel report"><header><h2>Pasivos y patrimonio</h2></header>
          <table className="t fin-t"><tbody>
            {trato === 'deuda' && <><L l="Por pagar a Pardo" v={b.cuenta.felipe} /><L l="Por pagar a Alejo" v={b.cuenta.alejandro} /></>}
            <L l="Total pasivos" v={b.pasivo} k="tot" />
            {trato === 'aporte' && <><L l="Aportes de Pardo" v={b.cuenta.felipe} /><L l="Aportes de Alejo" v={b.cuenta.alejandro} /></>}
            <L l="Resultado acumulado" v={b.resultado} k="resultado" />
            <L l="Total patrimonio" v={b.patrimonio} k="tot" />
            <L l="Pasivos más patrimonio" v={b.pasivo + b.patrimonio} k="tot" />
          </tbody></table>
        </section>
      </div>
      {!b.cuadra && <p className="err-text" style={{ marginTop: 12 }}>El balance no cuadra. Revisa movimientos de aporte o reembolso marcados como Cuenta de Relevo.</p>}
    </>
  );
}

function Socios({ movs }: { movs: Mov[] }) {
  const tq = useQuery(() => supabase.from('transferencias_socios').select('*').order('fecha', { ascending: false }).order('created_at', { ascending: false }));
  const transf = (tq.data || []) as Transfer[];
  const s = useMemo(() => socios(movs, transf), [movs, transf]);
  const { yo } = useCatalogo();
  const toast = useToast();
  const [nueva, setNueva] = useState(false);
  const borrar = async (t: Transfer) => {
    if (!window.confirm(`¿Borrar la transferencia de ${cop(Number(t.monto))} de ${quien(t.de)} a ${quien(t.a)}?`)) return;
    try {
      if (t.soporte_path) await supabase.storage.from('documentos').remove([t.soporte_path]);
      await must(supabase.from('transferencias_socios').delete().eq('id', t.id)); toast('Transferencia borrada'); tq.reload();
    } catch (e: any) { toast(e.message, true); }
  };
  const ver = async (t: Transfer) => {
    const { data, error } = await supabase.storage.from('documentos').createSignedUrl(t.soporte_path!, 120);
    if (error) return toast('No se pudo abrir: ' + error.message, true);
    window.open(data.signedUrl, '_blank', 'noopener');
  };
  const SOC = ['felipe', 'alejandro'] as const;
  return (
    <>
      <Kpis items={[['Pardo ha puesto', s.puesto.felipe], ['Alejo ha puesto', s.puesto.alejandro], ['Total puesto por socios', s.total]]} />
      <section className="panel report" style={{ marginBottom: 16 }}>
        <header><h2>Para quedar 50/50</h2>{yo?.socio && <button className="btn primary" onClick={() => setNueva(true)}><Plus className="ic" />Registrar transferencia</button>}</header>
        <div className="body">
          {s.transferencia < 1 ? <p style={{ fontSize: 16 }}>Están a mano.</p> : (
            <p style={{ fontSize: 16 }}><b>{quien(s.de)}</b> le transfiere <b className="num">{cop(s.transferencia)}</b> a <b>{quien(s.a)}</b>. Así cada uno queda con <span className="num">{cop(s.mitad)}</span> puestos.</p>
          )}
        </div>
        <table className="t fin-t">
          <thead><tr><th></th>{SOC.map((k) => <th key={k} className="r">{quien(k)}</th>)}</tr></thead>
          <tbody>
            <tr><td>Puesto en Relevo (gastos y aportes, menos reembolsos e ingresos recibidos)</td>{SOC.map((k) => <td key={k} className="r num">{cop(s.enRelevo[k])}</td>)}</tr>
            <tr><td>Transferencias entre ustedes (dio + / recibió −)</td>{SOC.map((k) => <td key={k} className={'r num' + (s.cruces[k] < 0 ? ' neg' : '')}>{s.cruces[k] ? cop(s.cruces[k]) : <span className="muted">·</span>}</td>)}</tr>
            <tr className="tot"><td>Total puesto</td>{SOC.map((k) => <td key={k} className="r num">{cop(s.puesto[k])}</td>)}</tr>
            <tr><td>Le corresponde (50%)</td>{SOC.map((k) => <td key={k} className="r num soft">{cop(s.mitad)}</td>)}</tr>
            <tr className="resultado"><td>Diferencia</td>{SOC.map((k) => { const d = s.puesto[k] - s.mitad; return <td key={k} className={'r num' + (d < -0.5 ? ' neg' : d > 0.5 ? ' pos' : '')}>{Math.abs(d) < 1 ? '$0' : (d > 0 ? '+' : '') + cop(d)}</td>; })}</tr>
          </tbody>
        </table>
      </section>

      <section className="panel report">
        <header><h2>Transferencias entre socios</h2><span className="muted" style={{ fontSize: 12.5 }}>No cuentan como gasto ni ingreso de Relevo, solo cruzan cuentas</span></header>
        {tq.error ? <div className="body"><ErrorBox msg={tq.error} retry={tq.reload} /></div> : !transf.length ? <p className="empty-state">Sin transferencias todavía.</p> : (
          <table className="t">
            <thead><tr><th>Fecha</th><th>De</th><th>A</th><th className="r">Monto</th><th>Nota</th><th>Soporte</th><th></th></tr></thead>
            <tbody>
              {transf.map((t) => {
                const mia = yo?.socio === t.de || yo?.socio === t.a;
                return (
                  <tr key={t.id} style={{ cursor: 'default' }}>
                    <td className="num soft">{fecha(t.fecha)}</td>
                    <td><span className={'tag plain ' + (t.de === 'felipe' ? 'tone-p1' : 'tone-p2')}>{quien(t.de)}</span></td>
                    <td><span className={'tag plain ' + (t.a === 'felipe' ? 'tone-p1' : 'tone-p2')}>{quien(t.a)}</span></td>
                    <td className="r num">{cop(Number(t.monto))}</td>
                    <td>{t.nota}</td>
                    <td>{t.soporte_path ? <button className="btn ghost" onClick={() => ver(t)}><Paperclip className="ic" />Ver</button> : <span className="muted">·</span>}</td>
                    <td className="r">{mia && <button className="btn ghost danger" aria-label="Borrar" title="Borrar" onClick={() => borrar(t)}><Trash className="ic" /></button>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
      <Modal open={nueva} onClose={() => setNueva(false)} title="Registrar transferencia entre socios">
        {nueva && <NuevaTransferencia sugerida={s} onDone={() => { setNueva(false); tq.reload(); }} />}
      </Modal>
    </>
  );
}

function NuevaTransferencia({ sugerida, onDone }: { sugerida: { transferencia: number; de: string; a: string }; onDone: () => void }) {
  const toast = useToast();
  const { yo } = useCatalogo();
  const otro = (k: string) => (k === 'felipe' ? 'alejandro' : 'felipe');
  const de0 = sugerida.transferencia >= 1 && [sugerida.de, sugerida.a].includes(yo?.socio ?? '') ? sugerida.de : otro(yo?.socio ?? 'felipe');
  const [f, setF] = useState({ fecha: hoy(), de: de0, monto: sugerida.transferencia >= 1 ? String(Math.round(sugerida.transferencia)) : '', nota: '' });
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const monto = Number(String(f.monto).replace(/\D/g, ''));
  const a = otro(f.de);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!monto) { toast('Falta el monto', true); return; }
    setBusy(true);
    try {
      const t = await must(supabase.from('transferencias_socios').insert({ fecha: f.fecha, de: f.de, a, monto, nota: f.nota.trim() || null }).select('id').single()) as Row;
      if (file) {
        const path = `transferencias/${t.id}/${Date.now()}-${file.name.replace(/[^\w.\-]+/g, '_')}`;
        const up = await supabase.storage.from('documentos').upload(path, file);
        if (up.error) toast('Transferencia guardada, pero no se subió el soporte: ' + up.error.message, true);
        else await supabase.from('transferencias_socios').update({ soporte_path: path }).eq('id', t.id);
      }
      toast('Transferencia registrada'); onDone();
    } catch (err: any) { toast(err.message, true); }
    setBusy(false);
  };
  return (
    <form onSubmit={submit}>
      <label>Quién transfirió
        <div className="seg" role="radiogroup">
          {(['felipe', 'alejandro'] as const).map((k) => <button type="button" key={k} role="radio" aria-checked={f.de === k} className={f.de === k ? 'on' : ''} onClick={() => setF({ ...f, de: k })}>{quien(k)} le transfirió a {quien(otro(k))}</button>)}
        </div>
      </label>
      <div className="row">
        <label>Monto (COP)<input className="in num" inputMode="numeric" required autoFocus value={monto ? '$' + new Intl.NumberFormat('es-CO').format(monto) : ''} onChange={(e) => setF({ ...f, monto: e.target.value.replace(/\D/g, '') })} /></label>
        <label>Fecha<input className="in" type="date" required value={f.fecha} onChange={(e) => setF({ ...f, fecha: e.target.value })} /></label>
      </div>
      <label>Nota (opcional)<input className="in" value={f.nota} onChange={(e) => setF({ ...f, nota: e.target.value })} placeholder="Ej.: su mitad de Meta Ads de octubre" /></label>
      <label>Comprobante (opcional)<input className="in" type="file" accept="application/pdf,image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></label>
      {sugerida.transferencia >= 1 && <p className="muted" style={{ fontSize: 12.5 }}>Para quedar 50/50 faltaba que {quien(sugerida.de)} le transfiriera {cop(sugerida.transferencia)} a {quien(sugerida.a)}.</p>}
      <footer><button className="btn primary" disabled={busy}>{busy ? 'Guardando' : 'Registrar transferencia'}</button></footer>
    </form>
  );
}

function Kpis({ items }: { items: [string, number][] }) {
  return <dl className="kpis" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0,1fr))` }}>{items.map(([l, v]) => <div key={l}><dt>{l}</dt><dd className="num">{cop(v)}</dd></div>)}</dl>;
}
