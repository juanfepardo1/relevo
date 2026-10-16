import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Plus, Trash, DownloadSimple, Printer } from '@phosphor-icons/react';
import { supabase, must, type Row } from '../lib/supabase';
import { useQuery } from '../lib/data';
import { label } from '../lib/catalogos';
import { fecha, hoy } from '../lib/format';
import { Skeleton, ErrorBox, useToast } from '../components/ui';
import { TIPOS, QUIEN, TODAS_CAT, categoriasDe, cop, nombreMes, resultados, flujo, balance, socios, csv, type Mov, type Tratamiento } from '../lib/finanzas';

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
function Movimientos({ movs, reload }: { movs: Mov[]; reload: () => void }) {
  const toast = useToast();
  const vacio = { fecha: hoy(), tipo: 'gasto', categoria: 'marketing', descripcion: '', monto: '', pagado_por: 'felipe' };
  const [f, setF] = useState<Row>(vacio);
  const [busy, setBusy] = useState(false);
  const [mes, setMes] = useState('');
  const cats = categoriasDe(f.tipo);
  useEffect(() => { if (!cats.some(([k]) => k === f.categoria)) setF((x) => ({ ...x, categoria: cats[0][0] })); }, [f.tipo]); // eslint-disable-line
  useEffect(() => { if ((f.tipo === 'aporte' || f.tipo === 'reembolso') && f.pagado_por === 'relevo') setF((x) => ({ ...x, pagado_por: 'felipe' })); }, [f.tipo, f.pagado_por]);
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });
  const monto = Number(String(f.monto).replace(/\D/g, ''));

  const add = async (e: FormEvent) => {
    e.preventDefault();
    if (!monto) { toast('Falta el monto', true); return; }
    setBusy(true);
    try {
      await must(supabase.from('movimientos').insert({ fecha: f.fecha, tipo: f.tipo, categoria: f.categoria, descripcion: f.descripcion.trim() || null, monto, pagado_por: f.pagado_por }));
      setF({ ...vacio, fecha: f.fecha, tipo: f.tipo, categoria: f.categoria, pagado_por: f.pagado_por });
      toast('Movimiento registrado'); reload();
    } catch (err: any) { toast(err.message, true); }
    setBusy(false);
  };
  const borrar = async (m: Mov) => {
    try { await must(supabase.from('movimientos').delete().eq('id', m.id)); toast('Movimiento borrado'); reload(); }
    catch (err: any) { toast(err.message, true); }
  };

  const ms = [...new Set(movs.map((m) => m.fecha.slice(0, 7)))].sort().reverse();
  const lista = movs.filter((m) => !mes || m.fecha.startsWith(mes));
  const quienOpts = f.tipo === 'aporte' || f.tipo === 'reembolso' ? QUIEN.filter(([k]) => k !== 'relevo') : QUIEN;
  const pagoLabel = f.tipo === 'ingreso' ? 'Lo recibió' : f.tipo === 'aporte' ? 'Lo puso' : f.tipo === 'reembolso' ? 'Se le devolvió a' : 'Lo pagó';

  return (
    <>
      <form className="panel mov-form" onSubmit={add}>
        <label>Fecha<input className="in" type="date" required value={f.fecha} onChange={set('fecha')} /></label>
        <label>Tipo<select className="sel" value={f.tipo} onChange={set('tipo')}>{TIPOS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
        <label>Categoría<select className="sel" value={f.categoria} onChange={set('categoria')} disabled={cats.length === 1}>{cats.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
        <label className="grow">Descripción<input className="in" placeholder="Meta Ads, Notion, valoración UNICARIBE" value={f.descripcion} onChange={set('descripcion')} /></label>
        <label>Monto (COP)<input className="in num" inputMode="numeric" required placeholder="0" value={f.monto ? '$' + new Intl.NumberFormat('es-CO').format(monto) : ''} onChange={(e) => setF({ ...f, monto: e.target.value.replace(/\D/g, '') })} /></label>
        <label>{pagoLabel}<select className="sel" value={f.pagado_por} onChange={set('pagado_por')}>{quienOpts.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
        <button className="btn primary" disabled={busy}><Plus className="ic" />Agregar</button>
      </form>

      <div className="toolbar">
        <select className="sel" value={mes} onChange={(e) => setMes(e.target.value)} aria-label="Mes">
          <option value="">Todos los meses</option>{ms.map((m) => <option key={m} value={m}>{nombreMes(m)}</option>)}
        </select>
        <span className="muted">{lista.length} movimientos</span>
        <button className="btn ghost" style={{ marginLeft: 'auto' }} onClick={() => csv('relevo_movimientos', [['Fecha', 'Tipo', 'Categoría', 'Descripción', 'Monto', 'Quién'], ...lista.map((m) => [m.fecha, label(TIPOS, m.tipo), label(TODAS_CAT, m.categoria), m.descripcion ?? '', Number(m.monto), quien(m.pagado_por)])])}><DownloadSimple className="ic" />Descargar CSV</button>
      </div>
      <div className="tablewrap">
        <table className="t">
          <thead><tr><th>Fecha</th><th>Tipo</th><th>Categoría</th><th>Descripción</th><th className="r">Monto</th><th>Quién</th><th></th></tr></thead>
          <tbody>
            {!lista.length ? <tr><td colSpan={7}><p className="empty-state">Sin movimientos todavía.</p></td></tr> : lista.map((m) => (
              <tr key={m.id} style={{ cursor: 'default' }}>
                <td className="num soft">{fecha(m.fecha)}</td>
                <td><span className={'tag tone-' + (m.tipo === 'ingreso' ? 'ganado' : m.tipo === 'gasto' ? 'cierre' : 'captacion')}>{label(TIPOS, m.tipo)}</span></td>
                <td>{label(TODAS_CAT, m.categoria)}</td>
                <td>{m.descripcion}</td>
                <td className={'r num' + (m.tipo === 'ingreso' ? ' pos' : m.tipo === 'gasto' ? ' neg' : '')}>{m.tipo === 'gasto' ? '-' : ''}{cop(Number(m.monto))}</td>
                <td><span className={'tag plain ' + (m.pagado_por === 'felipe' ? 'tone-p1' : m.pagado_por === 'alejandro' ? 'tone-p2' : 'tone-nuevo')}>{quien(m.pagado_por)}</span></td>
                <td className="r"><button className="btn ghost danger" aria-label="Borrar" title="Borrar" onClick={() => borrar(m)}><Trash className="ic" /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
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
        <button className="btn ghost" style={{ marginLeft: 'auto' }} onClick={() => csv('relevo_balance_' + corte, [['Cuenta', 'Valor'], ['Caja', b.caja], ['Total activos', b.caja], ['Cuentas por pagar a Pardito', trato === 'deuda' ? b.cuenta.felipe : 0], ['Cuentas por pagar a Alejito', trato === 'deuda' ? b.cuenta.alejandro : 0], ['Total pasivos', b.pasivo], ['Aportes de Pardito', trato === 'aporte' ? b.cuenta.felipe : 0], ['Aportes de Alejito', trato === 'aporte' ? b.cuenta.alejandro : 0], ['Resultado acumulado', b.resultado], ['Total patrimonio', b.patrimonio]])}><DownloadSimple className="ic" />CSV</button>
      </div>
      <p className="muted" style={{ fontSize: 12.5, marginBottom: 12 }}>Esta regla está pendiente de decidir entre ustedes. Cambiarla aquí solo cambia cómo se presenta el balance, no los movimientos.</p>
      <div className="grid2">
        <section className="panel report"><header><h2>Activos</h2></header>
          <table className="t fin-t"><tbody><L l="Caja (cuenta de Relevo)" v={b.caja} /><L l="Total activos" v={b.caja} k="tot" /></tbody></table>
        </section>
        <section className="panel report"><header><h2>Pasivos y patrimonio</h2></header>
          <table className="t fin-t"><tbody>
            {trato === 'deuda' && <><L l="Por pagar a Pardito" v={b.cuenta.felipe} /><L l="Por pagar a Alejito" v={b.cuenta.alejandro} /></>}
            <L l="Total pasivos" v={b.pasivo} k="tot" />
            {trato === 'aporte' && <><L l="Aportes de Pardito" v={b.cuenta.felipe} /><L l="Aportes de Alejito" v={b.cuenta.alejandro} /></>}
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
  const s = useMemo(() => socios(movs), [movs]);
  return (
    <>
      <Kpis items={[['Pardito ha puesto', s.puesto.felipe], ['Alejito ha puesto', s.puesto.alejandro], ['Total puesto por socios', s.total]]} />
      <section className="panel report">
        <header><h2>Para quedar 50/50</h2></header>
        <div className="body">
          {s.transferencia < 1 ? <p>Están a mano.</p> : (
            <p style={{ fontSize: 16 }}><b>{quien(s.de)}</b> le transfiere <b className="num">{cop(s.transferencia)}</b> a <b>{quien(s.a)}</b>. Así cada uno queda con <span className="num">{cop(s.mitad)}</span> puestos.</p>
          )}
          <p className="muted" style={{ fontSize: 12.5, marginTop: 8 }}>Neto de lo puesto: gastos pagados y aportes, menos reembolsos e ingresos que recibió cada uno.</p>
        </div>
      </section>
    </>
  );
}

function Kpis({ items }: { items: [string, number][] }) {
  return <dl className="kpis" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0,1fr))` }}>{items.map(([l, v]) => <div key={l}><dt>{l}</dt><dd className="num">{cop(v)}</dd></div>)}</dl>;
}
