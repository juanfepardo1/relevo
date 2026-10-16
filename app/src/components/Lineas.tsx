import { useEffect, useRef, useState } from 'react';

type Serie = { k: string; nombre: string; color: string; v: number[] };

/** Gráfico de líneas simple: un eje, etiquetas directas al final, cruz y tooltip al pasar el mouse. */
export function Lineas({ etiquetas, series, alto = 220 }: { etiquetas: string[]; series: Serie[]; alto?: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const caja = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(760);
  useEffect(() => { const el = caja.current; if (!el) return; const ro = new ResizeObserver(([e]) => setW(Math.max(320, Math.round(e.contentRect.width)))); ro.observe(el); return () => ro.disconnect(); }, []);
  const H = alto, pl = 32, pr = 170, pt = 12, pb = 26;
  const n = etiquetas.length;
  const max = Math.max(1, ...series.flatMap((s) => s.v));
  const paso = max <= 5 ? 1 : max <= 10 ? 2 : Math.ceil(max / 5);
  const top = Math.ceil(max / paso) * paso;
  const x = (i: number) => pl + (n <= 1 ? 0 : (i * (W - pl - pr)) / (n - 1));
  const y = (v: number) => pt + (H - pt - pb) * (1 - v / top);
  const ticks = Array.from({ length: top / paso + 1 }, (_, i) => i * paso);
  const cada = Math.max(1, Math.ceil(n / 8));
  const finales = series.map((s) => ({ s, yv: y(s.v[n - 1] ?? 0) })).sort((a, b) => a.yv - b.yv);
  for (let i = 1; i < finales.length; i++) if (finales[i].yv - finales[i - 1].yv < 14) finales[i].yv = finales[i - 1].yv + 14;

  return (
    <div className="lineas" ref={caja}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={series.map((s) => s.nombre).join(', ') + ' por semana'}
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => { const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect(); const px = ((e.clientX - r.left) / r.width) * W; const i = Math.round(((px - pl) / (W - pl - pr)) * (n - 1)); setHover(i >= 0 && i < n ? i : null); }}>
        {ticks.map((t) => <g key={t}><line x1={pl} x2={W - pr} y1={y(t)} y2={y(t)} stroke="var(--line)" /><text x={pl - 8} y={y(t) + 4} textAnchor="end" className="ax">{t}</text></g>)}
        {etiquetas.map((l, i) => (i % cada === 0 || i === n - 1) && <text key={i} x={x(i)} y={H - 6} textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'} className="ax">{l}</text>)}
        {hover != null && <line x1={x(hover)} x2={x(hover)} y1={pt} y2={H - pb} stroke="var(--ink-3)" strokeDasharray="3 3" />}
        {series.map((s) => (
          <g key={s.k}>
            <polyline fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" points={s.v.map((v, i) => `${x(i)},${y(v)}`).join(' ')} />
            {hover != null && <circle cx={x(hover)} cy={y(s.v[hover])} r={4} fill={s.color} stroke="var(--bg-2)" strokeWidth={2} />}
          </g>
        ))}
        {finales.map(({ s, yv }) => <text key={s.k} x={W - pr + 10} y={yv + 4} className="lbl"><tspan fill={s.color}>●</tspan> {s.nombre} <tspan className="num">{s.v[n - 1] ?? 0}</tspan></text>)}
      </svg>
      {hover != null && (
        <div className="lineas-tip" style={{ left: `${(x(hover) / W) * 100}%` }}>
          <b>Semana del {etiquetas[hover]}</b>
          {series.map((s) => <div key={s.k}><span style={{ color: s.color }}>●</span> {s.nombre}: <span className="num">{s.v[hover]}</span></div>)}
        </div>
      )}
      <div className="lineas-leyenda">{series.map((s) => <span key={s.k}><span style={{ color: s.color }}>●</span> {s.nombre}</span>)}</div>
    </div>
  );
}
