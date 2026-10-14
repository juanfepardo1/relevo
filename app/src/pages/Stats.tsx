import { useState } from 'react';
import { supabase, type Row } from '../lib/supabase';
import { useQuery } from '../lib/data';
import { SECTORES, VENTAS, label } from '../lib/catalogos';
import { Skeleton, ErrorBox } from '../components/ui';

export default function Stats() {
  const [p, setP] = useState<'vendedor' | 'comprador'>('vendedor');
  const tiempos = useQuery(() => supabase.from('v_tiempos_etapa').select('*').eq('entidad', p).order('orden'), [p]);
  const vend = useQuery(() => supabase.from('v_vendedores').select('etapa,etapa_orden,fuente,sector,ventas_rango,motivo_perdida'));

  const rows = (tiempos.data || []) as Row[];
  const max = Math.max(1, ...rows.map((r) => Math.max(Number(r.dias_promedio) || 0, r.sla_dias || 0)));
  const cuello = [...rows].filter((r) => r.actuales > 0).sort((a, b) => (b.fuera_de_meta - a.fuera_de_meta) || (b.dias_promedio - a.dias_promedio))[0];

  const V = (vend.data || []) as Row[];
  const conteo = (k: string, opts?: [string, string][]) => {
    const m = new Map<string, number>();
    V.forEach((v) => { const key = v[k] ?? 'Sin dato'; m.set(key, (m.get(key) || 0) + 1); });
    return [...m.entries()].map(([k2, n]) => [opts ? label(opts, k2) || k2 : k2, n] as [string, number]).sort((a, b) => b[1] - a[1]);
  };
  const avanzados = V.filter((v) => v.etapa_orden >= 5 && v.etapa !== 'perdido').length;

  return (
    <div className="page">
      <div className="head">
        <div><h1>Embudo</h1><p>Cuánto tarda cada etapa y dónde se atasca.</p></div>
        <div className="seg" role="group" aria-label="Pipeline">
          <button className={p === 'vendedor' ? 'on' : ''} onClick={() => setP('vendedor')}>Vendedores</button>
          <button className={p === 'comprador' ? 'on' : ''} onClick={() => setP('comprador')}>Compradores</button>
        </div>
      </div>

      {tiempos.error ? <ErrorBox msg={tiempos.error} retry={tiempos.reload} /> : (
        <section className="panel" style={{ marginBottom: 16 }}>
          <header><h2>Días por etapa</h2>{cuello && <span className="b warn">Cuello de botella: {cuello.nombre}</span>}</header>
          <div className="body">
            {tiempos.loading ? <Skeleton /> : !rows.length ? <p className="empty-state">Todavía no hay historial de etapas.</p> : (
              <div className="bars">
                <div className="bar-row muted" style={{ fontSize: 12 }}><span>Etapa</span><span>Promedio en días. La línea es la meta.</span><span style={{ textAlign: 'right' }}>Ahora · fuera de meta</span></div>
                {rows.map((r) => (
                  <div className="bar-row" key={r.etapa}>
                    <span>{r.nombre}</span>
                    <div className="bar-track" title={`Promedio ${r.dias_promedio} días · mediana ${r.dias_mediana}`}>
                      <div className={'bar-fill' + (r.sla_dias != null && r.dias_promedio > r.sla_dias ? ' over' : '')} style={{ width: `${(Number(r.dias_promedio) / max) * 100}%` }} />
                      {r.sla_dias != null && <div className="bar-sla" style={{ left: `${(r.sla_dias / max) * 100}%` }} />}
                      <span className="num" style={{ position: 'absolute', left: `calc(${(Number(r.dias_promedio) / max) * 100}% + 8px)`, top: 2, fontSize: 12.5 }}>{r.dias_promedio} d</span>
                    </div>
                    <span className="num" style={{ textAlign: 'right' }}>{r.actuales}{r.fuera_de_meta ? <span className="b warn" style={{ marginLeft: 6 }}>{r.fuera_de_meta}</span> : null}</span>
                  </div>
                ))}
              </div>
            )}
            <p className="muted" style={{ fontSize: 12.5, marginTop: 14 }}>Los registros cargados antes de esta herramienta tienen fecha de entrada estimada. Los tiempos se vuelven exactos desde ahora.</p>
          </div>
        </section>
      )}

      {p === 'vendedor' && (vend.loading ? <div className="panel"><Skeleton /></div> : (
        <div className="grid2">
          <section className="panel"><header><h2>Conversión</h2></header>
            <div className="body"><dl className="kpis" style={{ gridTemplateColumns: '1fr 1fr', marginBottom: 0 }}>
              <div><dt>Vendedores en total</dt><dd className="num">{V.length}</dd></div>
              <div><dt>Llegaron a reunión hecha o más</dt><dd className="num">{V.length ? Math.round((avanzados / V.length) * 100) : 0}%</dd></div>
            </dl></div></section>
          <Dist titulo="Por fuente" data={conteo('fuente')} />
          <Dist titulo="Por sector" data={conteo('sector', SECTORES)} />
          <Dist titulo="Por ventas" data={conteo('ventas_rango', VENTAS)} />
        </div>
      ))}
    </div>
  );
}

function Dist({ titulo, data }: { titulo: string; data: [string, number][] }) {
  const max = Math.max(1, ...data.map((d) => d[1]));
  return (
    <section className="panel"><header><h2>{titulo}</h2></header>
      <div className="body bars">
        {!data.length ? <p className="empty-state">Sin datos.</p> : data.slice(0, 8).map(([k, n]) => (
          <div className="bar-row" key={k} style={{ gridTemplateColumns: '160px minmax(0,1fr) 40px' }}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{k}</span>
            <div className="bar-track" style={{ height: 14 }}><div className="bar-fill" style={{ width: `${(n / max) * 100}%` }} /></div>
            <span className="num" style={{ textAlign: 'right' }}>{n}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
