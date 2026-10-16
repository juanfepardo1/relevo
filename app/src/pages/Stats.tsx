import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { WarningCircle } from '@phosphor-icons/react';
import { supabase, type Row } from '../lib/supabase';
import { useQuery, useCatalogo } from '../lib/data';
import { SECTORES, MOTIVO_PERDIDA, label } from '../lib/catalogos';
import { hoy, fecha } from '../lib/format';
import { Skeleton, ErrorBox } from '../components/ui';
import { Persona } from '../components/paneles';
import { Lineas } from '../components/Lineas';
import { tonoEtapa } from '../lib/colores';
import { contexto, embudo, tiempos, quietos, conversion, porDimension, semanas, tendencia, HITOS, type Hist } from '../lib/embudo';

type Rango = '7' | '30' | '90' | 'todo' | 'custom';
const RANGOS: [Rango, string][] = [['7', '7 días'], ['30', '30 días'], ['90', '90 días'], ['todo', 'Todo'], ['custom', 'Personalizado']];
const BUCKETS = ['A', 'B', 'C', 'D'];
const pct = (x: number) => `${Math.round(x * 100)}%`;
const d1 = (x: number) => (x < 10 ? x.toFixed(1).replace('.', ',') : String(Math.round(x)));
const restar = (iso: string, n: number) => { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() - n); return d.toISOString().slice(0, 10); };

export default function Stats() {
  const nav = useNavigate();
  const { etapasDe, equipo } = useCatalogo();
  const etapas = etapasDe('vendedor');
  const vq = useQuery(() => supabase.from('v_vendedores').select('id,nombre,empresa,etapa,etapa_orden,fase,sla_dias,dias_en_etapa,responsable,bucket,sector,fuente,anuncio,campana_id,fecha_ingreso,motivo_perdida'));
  const hq = useQuery(() => supabase.from('etapa_historial').select('entidad_id,etapa,desde,hasta').eq('entidad', 'vendedor'));
  const aq = useQuery(() => supabase.from('actividades').select('vendedor_id,fecha').not('vendedor_id', 'is', null));
  const ajq = useQuery(() => supabase.from('ajustes').select('valor').eq('clave', 'dias_sin_actividad').maybeSingle());
  const diasSinAct = Number((ajq.data as Row | null)?.valor) || 7;

  const [rango, setRango] = useState<Rango>('todo');
  const [desde, setDesde] = useState(restar(hoy(), 30));
  const [hasta, setHasta] = useState(hoy());
  const [resp, setResp] = useState('');
  const [buckets, setBuckets] = useState<string[]>([]);
  const [sector, setSector] = useState('');
  const [dim, setDim] = useState<'fuente' | 'anuncio' | 'campana_id'>('anuncio');
  const [verTodas, setVerTodas] = useState(false);

  const todos = (vq.data || []) as Row[];
  const hist = (hq.data || []) as Hist[];
  const ini = rango === 'todo' ? (todos.map((v) => v.fecha_ingreso).filter(Boolean).sort()[0] ?? restar(hoy(), 30)) : rango === 'custom' ? desde : restar(hoy(), Number(rango) - 1);
  const fin = rango === 'custom' ? hasta : hoy();

  // filtros que no son de fecha (aplican a todo); la fecha define la cohorte de entrada
  const base = useMemo(() => todos.filter((v) =>
    (!resp || (resp === 'sin' ? !v.responsable : v.responsable === resp)) &&
    (!buckets.length || buckets.includes(v.bucket)) && (!sector || v.sector === sector)), [todos, resp, buckets, sector]);
  const cohorte = useMemo(() => base.filter((v) => v.fecha_ingreso && v.fecha_ingreso >= ini && v.fecha_ingreso <= fin), [base, ini, fin]);
  const ctx = useMemo(() => contexto(etapas, todos, hist), [etapas, todos, hist]);

  const emb = useMemo(() => embudo(etapas, cohorte, ctx), [etapas, cohorte, ctx]);
  const tie = useMemo(() => tiempos(etapas, cohorte, ctx), [etapas, cohorte, ctx]);
  const qui = useMemo(() => quietos(base, ctx, (aq.data || []) as Row[], diasSinAct), [base, ctx, aq.data, diasSinAct]);
  const conv = useMemo(() => conversion(cohorte, ctx), [cohorte, ctx]);
  const mk = useMemo(() => porDimension(cohorte, ctx, dim), [cohorte, ctx, dim]);
  const weeks = useMemo(() => semanas(ini, fin), [ini, fin]);
  const tend = useMemo(() => tendencia(base.filter((v) => !v.fecha_ingreso || v.fecha_ingreso <= fin), ctx, weeks), [base, ctx, weeks, fin]);
  const personas = useMemo(() => {
    const grupos: [string, Row[]][] = [...equipo.map((m) => [m.email, cohorte.filter((v) => v.responsable === m.email)] as [string, Row[]]), ['', cohorte.filter((v) => !v.responsable)]];
    return grupos.map(([email, g]) => {
      const activos = base.filter((v) => (email ? v.responsable === email : !v.responsable) && !['cerrado', 'perdido'].includes(v.etapa));
      return { email, n: g.length, activos: activos.length, quietos: qui.filter((q) => (email ? q.v.responsable === email : !q.v.responsable)).length, conv: conversion(g, ctx) };
    });
  }, [equipo, cohorte, base, qui, ctx]);

  const cargando = vq.loading || hq.loading;
  const error = vq.error || hq.error;
  const maxDias = Math.max(1, ...tie.filas.map((f) => Math.max(f.promedio, f.e.sla_dias ?? 0)));

  return (
    <div className="page">
      <div className="head"><div><h1>Embudo</h1><p>Cómo avanzan los vendedores desde que se aprueban, dónde se atascan y qué los trae.</p></div></div>

      <div className="toolbar filtros-embudo">
        <div className="seg" role="group" aria-label="Fecha de entrada">
          {RANGOS.map(([k, l]) => <button key={k} className={rango === k ? 'on' : ''} onClick={() => setRango(k)}>{l}</button>)}
        </div>
        {rango === 'custom' && <><input className="in" type="date" value={desde} onChange={(e) => setDesde(e.target.value)} aria-label="Desde" style={{ width: 150 }} /><span className="muted">a</span><input className="in" type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} aria-label="Hasta" style={{ width: 150 }} /></>}
        <select className="sel" value={resp} onChange={(e) => setResp(e.target.value)} aria-label="Responsable" style={{ width: 'auto' }}>
          <option value="">Pardo y Alejo</option>{equipo.map((m) => <option key={m.email} value={m.email}>{m.apodo ?? m.nombre}</option>)}<option value="sin">Sin responsable</option>
        </select>
        <div className="seg" role="group" aria-label="Bucket">
          {BUCKETS.map((b) => <button key={b} className={buckets.includes(b) ? 'on' : ''} onClick={() => setBuckets(buckets.includes(b) ? buckets.filter((x) => x !== b) : [...buckets, b].sort())}>Bucket {b}</button>)}
        </div>
        <select className="sel" value={sector} onChange={(e) => setSector(e.target.value)} aria-label="Sector" style={{ width: 'auto' }}>
          <option value="">Todos los sectores</option>{SECTORES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
      </div>
      <p className="muted" style={{ fontSize: 12.5, margin: '-4px 0 14px' }}>Entraron entre {fecha(ini, true)} y {fecha(fin, true)}. Los quietos y la carga actual miran a todos los activos, sin importar cuándo entraron.</p>

      {error ? <ErrorBox msg={error} retry={() => { vq.reload(); hq.reload(); }} /> : cargando ? <div className="panel"><Skeleton rows={8} /></div> : (
        <>
          {/* 1. Resumen */}
          <dl className="kpis" style={{ gridTemplateColumns: 'repeat(5,minmax(0,1fr))' }}>
            <div><dt>Vendedores que entraron</dt><dd className="num">{cohorte.length}</dd></div>
            {HITOS.map(([cod, nombre], i) => <div key={cod}><dt>Llegaron a {nombre.toLowerCase()}</dt><dd className="num">{pct(conv[i].pct)} <small className="muted">{conv[i].n}</small></dd></div>)}
            <div><dt>Quietos hoy</dt><dd className="num" style={{ color: qui.length ? 'var(--warn)' : undefined }}>{qui.length}</dd></div>
          </dl>

          {/* 2. Embudo clásico */}
          <section className="panel" style={{ marginBottom: 16 }}>
            <header><h2>Embudo</h2><span className="muted" style={{ fontSize: 12.5 }}>Cuántos llegaron al menos a cada etapa, en el orden del proceso</span></header>
            <div className="body">
              {!cohorte.length ? <p className="empty-state">Ningún vendedor entró en este rango.</p> : (
                <div className="embudo">
                  <div className="emb-h"><span>Etapa</span><span /><span className="r">Llegaron</span><span className="r">Del total</span><span className="r">De la anterior</span><span>Se perdieron aquí</span></div>
                  {(verTodas ? emb : emb.slice(0, Math.min(emb.length, Math.max(...emb.map((f, i) => (f.llegaron ? i : 0))) + 2))).map((f, i) => (
                    <div key={f.e.codigo} className={'emb-f ' + tonoEtapa(f.e.fase, f.e.codigo) + (f.llegaron ? '' : ' cero')}>
                      <span className="emb-n">{f.e.nombre}</span>
                      <div className="emb-track"><div className="emb-bar" style={{ width: `${f.pctTotal * 100}%` }} /></div>
                      <span className="r num">{f.llegaron}</span>
                      <span className="r num soft">{pct(f.pctTotal)}</span>
                      <span className={'r num' + (i && f.pctPrev < 0.5 && f.llegaron ? ' caida' : ' soft')}>{i ? pct(f.pctPrev) : ''}</span>
                      <span className="soft" style={{ fontSize: 12.5 }} title={f.motivos.map((m) => label(MOTIVO_PERDIDA, m) || m).join(', ')}>{f.perdidos ? `${f.perdidos}${f.motivos.length ? ' · ' + [...new Set(f.motivos.map((m) => label(MOTIVO_PERDIDA, m) || m))].join(', ') : ''}` : ''}</span>
                    </div>
                  ))}
                  {emb.length > 2 && <button type="button" className="linkish" style={{ alignSelf: 'flex-start', marginTop: 6, fontSize: 12.5 }} onClick={() => setVerTodas(!verTodas)}>
                    {verTodas ? 'Ocultar las etapas a las que no ha llegado nadie' : `Ver las ${emb.length - Math.min(emb.length, Math.max(...emb.map((f, i) => (f.llegaron ? i : 0))) + 2)} etapas siguientes, sin vendedores todavía`}
                  </button>}
                </div>
              )}
            </div>
          </section>

          {/* 3. Dónde se atasca */}
          <section className="panel" style={{ marginBottom: 16 }}>
            <header><h2>Días por etapa</h2>{tie.cuello ? <span className="b warn"><WarningCircle className="ic" style={{ width: 14, height: 14 }} />Cuello de botella: {tie.cuello.e.nombre}</span> : <span className="muted" style={{ fontSize: 12.5 }}>La raya es la meta</span>}</header>
            <div className="body">
              {!tie.filas.length ? <p className="empty-state">Sin historial todavía.</p> : (
                <div className="bars">
                  <div className="bar-row muted" style={{ fontSize: 12 }}><span>Etapa, en orden</span><span>Promedio de días · la raya es la meta</span><span className="r">Ahí ahora · fuera de meta</span></div>
                  {tie.filas.map((f) => (
                    <div className="bar-row" key={f.e.codigo}>
                      <span>{f.e.nombre}</span>
                      <div className="bar-track" title={`Promedio ${d1(f.promedio)} d · mediana ${d1(f.mediana)} d · ${f.n} pasos medidos${f.e.sla_dias ? ` · meta ${f.e.sla_dias} d` : ''}`}>
                        <div className={'bar-fill' + (f.e.sla_dias != null && f.promedio > f.e.sla_dias ? ' over' : '')} style={{ width: `${(f.promedio / maxDias) * 100}%` }} />
                        {f.e.sla_dias != null && <div className="bar-sla" style={{ left: `${(f.e.sla_dias / maxDias) * 100}%` }} />}
                        <span className="num bar-val" style={{ left: `calc(${(f.promedio / maxDias) * 100}% + 8px)` }}>{f.n ? `${d1(f.promedio)} d` : '·'}</span>
                      </div>
                      <span className="r num">{f.actuales}{f.fuera ? <span className="b warn" style={{ marginLeft: 6 }}>{f.fuera}</span> : null}</span>
                    </div>
                  ))}
                </div>
              )}
              <p className="muted" style={{ fontSize: 12.5, marginTop: 12 }}>Los vendedores que vienen de Notion tienen fechas estimadas, salvo los 10 con fechas reales. Los tiempos se vuelven exactos con el uso.</p>
            </div>
          </section>

          {/* 4. Quietos */}
          <section className="panel" style={{ marginBottom: 16 }}>
            <header><h2>Quietos</h2><span className="muted" style={{ fontSize: 12.5 }}>Pasaron la meta de su etapa o llevan {diasSinAct}+ días sin actividad. Los más quietos primero.</span></header>
            {!qui.length ? <p className="empty-state">Nadie quieto. Bien.</p> : (
              <div className="tablewrap" style={{ border: 0, borderRadius: 0, maxHeight: 420 }}>
                <table className="t">
                  <thead><tr><th>Vendedor</th><th>Etapa</th><th className="r">Días en etapa</th><th className="r">Meta</th><th className="r">Sin actividad</th><th>Por qué</th><th>Responsable</th></tr></thead>
                  <tbody>
                    {qui.map(({ v, sinAct, fueraMeta, porInactividad }) => (
                      <tr key={v.id} onClick={() => nav(`/vendedores/${v.id}`)}>
                        <td><span className="primary-cell">{v.empresa || v.nombre}</span>{v.empresa && <span className="sub">{v.nombre}</span>}</td>
                        <td><span className={'tag ' + tonoEtapa(v.fase, v.etapa)}>{etapas.find((e) => e.codigo === v.etapa)?.nombre ?? v.etapa}</span></td>
                        <td className={'r num' + (fueraMeta ? ' neg' : '')}>{v.dias_en_etapa ?? 0}</td>
                        <td className="r num soft">{v.sla_dias ?? '·'}</td>
                        <td className={'r num' + (porInactividad ? ' neg' : '')}>{sinAct} d</td>
                        <td>{[fueraMeta && 'Pasó la meta', porInactividad && 'Sin actividad'].filter(Boolean).join(' y ')}</td>
                        <td><Persona email={v.responsable} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* 5. Por persona */}
          <section className="panel" style={{ marginBottom: 16 }}>
            <header><h2>Pardo vs Alejo</h2><span className="muted" style={{ fontSize: 12.5 }}>Carga actual y conversión de los vendedores que atiende cada uno</span></header>
            <div className="tablewrap" style={{ border: 0, borderRadius: 0 }}>
              <table className="t fin-t">
                <thead><tr><th>Responsable</th><th className="r">Activos hoy</th><th className="r">Quietos hoy</th><th className="r">Entraron en el rango</th>{HITOS.map(([c, n]) => <th key={c} className="r">{n}</th>)}</tr></thead>
                <tbody>
                  {personas.map((p) => (
                    <tr key={p.email || 'sin'}>
                      <td>{p.email ? <Persona email={p.email} /> : <span className="muted">Sin responsable</span>}</td>
                      <td className="r num">{p.activos}</td>
                      <td className={'r num' + (p.quietos ? ' neg' : '')}>{p.quietos}</td>
                      <td className="r num">{p.n}</td>
                      {p.conv.map((c) => <td key={c.cod} className="r num">{p.n ? <>{pct(c.pct)} <span className="muted">{c.n}</span></> : <span className="muted">·</span>}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* 6. Marketing */}
          <section className="panel" style={{ marginBottom: 16 }}>
            <header>
              <h2>Qué marketing funciona</h2>
              <div className="seg" role="group" aria-label="Agrupar por">
                {([['fuente', 'Fuente'], ['anuncio', 'Anuncio'], ['campana_id', 'Campaña']] as const).map(([k, l]) => <button key={k} className={dim === k ? 'on' : ''} onClick={() => setDim(k)}>{l}</button>)}
              </div>
            </header>
            <div className="tablewrap" style={{ border: 0, borderRadius: 0 }}>
              <table className="t fin-t">
                <thead><tr><th>{dim === 'fuente' ? 'Fuente' : dim === 'anuncio' ? 'Anuncio' : 'Campaña'}</th><th className="r">Vendedores</th>{HITOS.map(([c, n]) => <th key={c} className="r">{n}</th>)}<th className="r">Perdidos</th></tr></thead>
                <tbody>
                  {!mk.length ? <tr><td colSpan={6}><p className="empty-state">Sin vendedores en este rango.</p></td></tr> : mk.map((r) => (
                    <tr key={r.k}>
                      <td className={r.k === 'Sin dato' ? 'muted' : ''}>{r.k}</td>
                      <td className="r num">{r.n}</td>
                      {r.conv.map((c) => <td key={c.cod} className="r num"><span className="mini-bar" style={{ ['--w' as any]: `${c.pct * 100}%` }} />{pct(c.pct)} <span className="muted">{c.n}</span></td>)}
                      <td className="r num soft">{r.perdidos || ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="muted" style={{ fontSize: 12.5, padding: '10px 16px 14px' }}>Ordenado por cantidad de vendedores. Con pocos vendedores por fila, los porcentajes se mueven mucho: fíjate también en el número.</p>
          </section>

          {/* 7. Tendencia */}
          <section className="panel">
            <header><h2>Tendencia por semana</h2></header>
            <div className="body">
              {weeks.length < 2 ? <p className="empty-state">Escoge un rango de al menos dos semanas para ver la tendencia.</p>
                : <Lineas etiquetas={weeks.map((w) => fecha(w))} series={tend} />}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
