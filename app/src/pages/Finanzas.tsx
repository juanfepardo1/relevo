import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Plus, Trash, DownloadSimple, Printer, Paperclip, UploadSimple } from '@phosphor-icons/react';
import { supabase, must, type Row } from '../lib/supabase';
import { useQuery, useCatalogo } from '../lib/data';
import { label } from '../lib/catalogos';
import { fecha, hoy } from '../lib/format';
import { Skeleton, ErrorBox, Modal, useToast } from '../components/ui';
import { TIPOS, QUIEN, TODAS_CAT, quienPuede, puedeEditar, type Transfer, categoriasDe, cop, nombreMes, balance, socios, csv, resultadosPuc, flujoPuc, GRUPOS, CONSTITUCION, cuentaDe, type Mov } from '../lib/finanzas';

export type Seccion = 'movimientos' | 'estados' | 'socios';
type Estado = 'resultados' | 'flujo' | 'balance';
const ESTADOS: [Estado, string][] = [['balance', 'Situación financiera'], ['resultados', 'Resultados'], ['flujo', 'Flujos de efectivo']];
const TITULO: Record<Seccion, [string, string]> = {
  movimientos: ['Movimientos', 'Registra cada ingreso, gasto, aporte o reembolso. Lo demás se calcula solo.'],
  estados: ['Estados financieros', 'Formato PUC colombiano (cuentas a 4 dígitos). Se arman solos a partir de los movimientos.'],
  socios: ['Cuentas entre socios', 'Cuánto ha puesto cada uno y cómo quedar 50/50.'],
};
const quien = (k: string) => label(QUIEN, k);

export default function Finanzas({ seccion }: { seccion: Seccion }) {
  const q = useQuery(() => supabase.from('movimientos').select('*').order('fecha', { ascending: false }).order('created_at', { ascending: false }));
  const [estado, setEstado] = useState<Estado>(() => { try { return (localStorage.getItem('fin-estado') as Estado) || 'resultados'; } catch { return 'resultados'; } });
  const toast = useToast();
  const movs = (q.data || []) as Mov[];
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
        <Balance movs={movs} />
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
        <button className="btn ghost" style={{ marginLeft: 'auto' }} onClick={() => csv('relevo_movimientos', [['Fecha', 'Tipo', 'Categoría', 'Cuenta PUC', 'Descripción', 'Monto', 'Quién', 'Soporte'], ...lista.map((m) => [m.fecha, label(TIPOS, m.tipo), label(TODAS_CAT, m.categoria), m.tipo === 'gasto' || m.tipo === 'ingreso' ? cuentaDe(m.categoria, m.tipo).codigo : m.tipo === 'aporte' || m.tipo === 'reembolso' ? '2355' : '', m.descripcion ?? '', Number(m.monto), quien(m.pagado_por), m.soporte_path ? 'Sí' : 'No'])])}><DownloadSimple className="ic" />Descargar CSV</button>
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
                  <td>{label(TODAS_CAT, m.categoria)}{(m.tipo === 'gasto' || m.tipo === 'ingreso') && <span className="muted num" style={{ marginLeft: 6, fontSize: 12 }}>{cuentaDe(m.categoria, m.tipo).codigo}</span>}</td>
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

/* ---------- Reportes (estructura del PUC colombiano, cuentas a 4 dígitos) ---------- */
type Fila = { l: string; c?: string; v: number[]; t: number; k?: 'tot' | 'resultado' | 'grupo' };
function Reporte({ titulo, nota, meses, filas, descargar }: { titulo: string; nota?: string; meses: string[]; filas: Fila[]; descargar: string }) {
  return (
    <section className="panel report">
      <header>
        <div><h2>{titulo}</h2>{nota && <p className="muted" style={{ fontSize: 12.5, marginTop: 2 }}>{nota}</p>}</div>
        <button className="btn ghost no-print" onClick={() => csv(descargar, [['Código', 'Cuenta', ...meses.map(nombreMes), 'Total'], ...filas.map((f) => [f.c ?? '', f.l, ...(f.k === 'grupo' ? meses.map(() => '') : f.v), f.k === 'grupo' ? '' : f.t])])}><DownloadSimple className="ic" />CSV</button>
      </header>
      <div style={{ overflowX: 'auto' }}>
        <table className="t fin-t">
          <thead><tr><th className="puc-c">Código</th><th>Cuenta</th>{meses.map((m) => <th key={m} className="r">{nombreMes(m)}</th>)}<th className="r">Total</th></tr></thead>
          <tbody>
            {filas.map((f, i) => f.k === 'grupo' ? (
              <tr key={i} className="grupo"><td className="puc-c num">{f.c}</td><td colSpan={meses.length + 2}>{f.l}</td></tr>
            ) : (
              <tr key={i} className={f.k ?? ''}>
                <td className="puc-c num">{f.c}</td>
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
const fechaCorta = (d: string) => new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(d + 'T12:00:00Z'));

function Resultados({ movs }: { movs: Mov[] }) {
  const r = useMemo(() => resultadosPuc(movs), [movs]);
  const n = r.meses.length, cero = { porMes: Array(n).fill(0), total: 0 };
  const grupo = (c: string, l: string, lineas: { codigo: string; nombre: string; porMes: number[]; total: number }[], tot: { porMes: number[]; total: number }, totL: string): Fila[] =>
    lineas.length ? [{ c, l, v: [], t: 0, k: 'grupo' }, ...lineas.map((x) => ({ c: x.codigo, l: x.nombre, v: x.porMes, t: x.total })), { l: totL, v: tot.porMes, t: tot.total, k: 'tot' }] : [];
  const res = (l: string, x: { porMes: number[]; total: number }): Fila => ({ l, v: x.porMes, t: x.total, k: 'resultado' });
  const filas: Fila[] = [
    ...grupo('41', GRUPOS['41'], r.i41, r.t41, 'Total ingresos operacionales'),
    ...(r.i41.length ? [] : [{ c: '41', l: GRUPOS['41'], v: cero.porMes, t: 0, k: 'tot' as const }]),
    ...grupo('51', GRUPOS['51'], r.g51, r.t51, 'Total gastos de administración'),
    ...grupo('52', GRUPOS['52'], r.g52, r.t52, 'Total gastos de ventas'),
    res(r.operacional.total >= 0 ? 'Utilidad operacional' : 'Pérdida operacional', r.operacional),
    ...grupo('42', GRUPOS['42'], r.i42, r.t42, 'Total ingresos no operacionales'),
    ...grupo('53', GRUPOS['53'], r.g53, r.t53, 'Total gastos no operacionales'),
    res(r.antesImp.total >= 0 ? 'Utilidad antes de impuestos' : 'Pérdida antes de impuestos', r.antesImp),
    { c: '54', l: 'Impuesto de renta y complementarios', v: cero.porMes, t: 0 },
    res(r.neta.total >= 0 ? 'Utilidad neta del ejercicio' : 'Pérdida neta del ejercicio', r.neta),
  ];
  return (
    <>
      <Kpis items={[['Ingresos operacionales', r.t41.total], ['Gastos operacionales', r.t51.total + r.t52.total], [r.neta.total >= 0 ? 'Utilidad neta' : 'Pérdida neta', r.neta.total]]} />
      <Reporte titulo="Estado de resultados" descargar="relevo_estado_resultados"
        nota={`Relevo Brokers S.A.S. · NIT 902.117.149-4 · Cifras en pesos colombianos, base caja. Incluye ${cop(r.preoperativos)} de gastos preoperativos (antes de la constitución, el ${fechaCorta(CONSTITUCION)}). El impuesto de renta lo calcula el contador al cierre.`}
        meses={r.meses} filas={filas} />
    </>
  );
}

function Flujo({ movs }: { movs: Mov[] }) {
  const f = useMemo(() => flujoPuc(movs), [movs]);
  const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
  const filas: Fila[] = [
    { l: 'Actividades de operación', v: [], t: 0, k: 'grupo' },
    { l: 'Cobros a clientes', v: f.cobros, t: sum(f.cobros) },
    { l: 'Pagos a proveedores', v: f.pagos, t: sum(f.pagos) },
    { l: 'Efectivo neto de actividades de operación', v: f.op, t: sum(f.op), k: 'tot' },
    { l: 'Actividades de inversión', v: [], t: 0, k: 'grupo' },
    { l: 'Efectivo neto de actividades de inversión', v: f.op.map(() => 0), t: 0, k: 'tot' },
    { l: 'Actividades de financiación', v: [], t: 0, k: 'grupo' },
    { l: 'Préstamos recibidos de socios', v: f.recibidoSocios, t: sum(f.recibidoSocios) },
    { l: 'Pagos a socios', v: f.pagadoSocios, t: sum(f.pagadoSocios) },
    { l: 'Efectivo neto de actividades de financiación', v: f.fin, t: sum(f.fin), k: 'tot' },
    { l: 'Aumento (disminución) neto del efectivo', v: f.neto, t: sum(f.neto), k: 'resultado' },
    { l: 'Efectivo al inicio del periodo', v: f.inicio, t: 0 },
    { c: '11', l: 'Efectivo al final del periodo', v: f.final, t: f.final[f.final.length - 1] ?? 0, k: 'tot' },
  ];
  return (
    <>
      <Kpis items={[['Efectivo neto de operación', sum(f.op)], ['Financiación de socios', sum(f.fin)], ['Efectivo al final', f.final[f.final.length - 1] ?? 0]]} />
      <Reporte titulo="Estado de flujos de efectivo" descargar="relevo_flujo_efectivo" meses={f.meses} filas={filas}
        nota="Método directo, sobre la cuenta bancaria de Relevo (1110). Los gastos que pagan los socios de su bolsillo no mueven el efectivo de Relevo: aumentan la deuda con ellos (2355)." />
      {(f.sinCaja.gastosSocios > 0 || f.sinCaja.ingresosSocios > 0) && (
        <p className="muted" style={{ fontSize: 12.5, marginTop: 10 }}>Transacciones que no movieron efectivo: gastos pagados por los socios {cop(f.sinCaja.gastosSocios)}{f.sinCaja.ingresosSocios ? ` · ingresos cobrados por los socios ${cop(f.sinCaja.ingresosSocios)}` : ''}.</p>
      )}
    </>
  );
}

function Balance({ movs }: { movs: Mov[] }) {
  const [corte, setCorte] = useState(hoy());
  const b = useMemo(() => balance(movs, corte, 'deuda'), [movs, corte]);
  const L = ({ c, l, v, k }: { c?: string; l: string; v?: number; k?: string }) => (
    <tr className={k ?? ''}><td className="puc-c num">{c}</td><td>{l}</td><td className={'r num' + (k === 'resultado' ? (Number(v) < 0 ? ' neg' : '') : '')}>{v == null ? '' : cop(v)}</td></tr>
  );
  const socios = b.cuenta.felipe + b.cuenta.alejandro;
  const filas: [string, string, number | ''][] = [['1110', 'Bancos', b.caja], ['', 'Total activo', b.caja], ['2355', 'Deudas con accionistas o socios', socios], ['', 'Total pasivo', b.pasivo], ['3105', 'Capital suscrito y pagado', 0], [b.resultado >= 0 ? '3605' : '3610', b.resultado >= 0 ? 'Utilidad del ejercicio' : 'Pérdida del ejercicio', b.resultado], ['', 'Total patrimonio', b.patrimonio], ['', 'Total pasivo y patrimonio', b.pasivo + b.patrimonio]];
  return (
    <>
      <div className="toolbar no-print">
        <label className="who">Corte<input className="in" type="date" value={corte} onChange={(e) => setCorte(e.target.value)} style={{ width: 160 }} /></label>
        <button className="btn ghost" style={{ marginLeft: 'auto' }} onClick={() => csv('relevo_situacion_financiera_' + corte, [['Código', 'Cuenta', 'Valor'], ...filas])}><DownloadSimple className="ic" />CSV</button>
      </div>
      <p className="muted" style={{ fontSize: 12.5, marginBottom: 12 }}>Estado de situación financiera de Relevo Brokers S.A.S. al {fechaCorta(corte)}. Lo que los socios pagan de su bolsillo queda como deuda de la sociedad con ellos (2355).</p>
      <div className="grid2">
        <section className="panel report"><header><h2>Activo</h2></header>
          <table className="t fin-t"><tbody>
            <L c="1" l="Activo" k="grupo" /><L c="11" l="Efectivo y equivalentes al efectivo" k="grupo" />
            <L c="1110" l="Bancos (cuenta de Relevo)" v={b.caja} />
            <L l="Total activo corriente" v={b.caja} k="tot" />
            <L l="Total activo" v={b.caja} k="tot" />
          </tbody></table>
        </section>
        <section className="panel report"><header><h2>Pasivo y patrimonio</h2></header>
          <table className="t fin-t"><tbody>
            <L c="2" l="Pasivo" k="grupo" /><L c="23" l="Cuentas por pagar" k="grupo" />
            <L c="2355" l="Deudas con accionistas o socios" v={socios} />
            <L l="Juan Felipe Pardo (Pardo)" v={b.cuenta.felipe} k="subcta" />
            <L l="Alejandro González (Alejo)" v={b.cuenta.alejandro} k="subcta" />
            <L l="Total pasivo" v={b.pasivo} k="tot" />
            <L c="3" l="Patrimonio" k="grupo" />
            <L c="3105" l="Capital suscrito y pagado" v={0} />
            <L c={b.resultado >= 0 ? '3605' : '3610'} l={b.resultado >= 0 ? 'Utilidad del ejercicio' : 'Pérdida del ejercicio'} v={b.resultado} k="resultado" />
            <L l="Total patrimonio" v={b.patrimonio} k="tot" />
            <L l="Total pasivo y patrimonio" v={b.pasivo + b.patrimonio} k="tot" />
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
