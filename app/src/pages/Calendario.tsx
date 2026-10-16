import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CaretLeft, CaretRight, ArrowsClockwise, VideoCamera } from '@phosphor-icons/react';
import { supabase, type Row } from '../lib/supabase';
import { useQuery, useCatalogo } from '../lib/data';
import { hoy, fecha } from '../lib/format';
import { useToast } from '../components/ui';

type Item = { id: string; dia: string; hora?: string; titulo: string; detalle?: string; tipo: 'reunion' | 'accion' | 'renovacion' | 'doc' | 'cancelada'; ir?: string; link?: string | null; de?: string | null };
const TONO: Record<Item['tipo'], string> = { reunion: 'tone-captacion', accion: 'tone-cierre', renovacion: 'tone-mercado', doc: 'tone-perdido', cancelada: 'tone-nuevo' };
const NOMBRE: Record<Item['tipo'], string> = { reunion: 'Reunión', accion: 'Próxima acción', renovacion: 'Renovación', doc: 'Docs por vencer', cancelada: 'Cancelada' };
const DIAS = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'];
const tz = 'America/Bogota';
const diaDe = (iso: string) => new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date(iso));
const horaDe = (iso: string) => new Intl.DateTimeFormat('es-CO', { timeZone: tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(iso));
const sumarDias = (d: string, n: number) => { d = String(d).slice(0, 10); const x = new Date(d + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const mesTitulo = (d: string) => { const t = new Intl.DateTimeFormat('es-CO', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(d + 'T12:00:00Z')); return t.charAt(0).toUpperCase() + t.slice(1); };

export default function Calendario() {
  const nav = useNavigate();
  const toast = useToast();
  const { yo } = useCatalogo();
  const [mes, setMes] = useState(hoy().slice(0, 7) + '-01');
  const [solo, setSolo] = useState(false);
  const [sync, setSync] = useState<{ estado: 'idle' | 'busy' | 'ok' | 'off' | 'err'; msg?: string }>({ estado: 'idle' });

  const reu = useQuery(() => supabase.from('reuniones').select('*, vendedores(empresa,nombre), compradores(nombre)').order('inicio'));
  const vend = useQuery(() => supabase.from('v_vendedores').select('id,empresa,nombre,responsable,proxima_accion,fecha_proxima_accion,etapa').not('fecha_proxima_accion', 'is', null));
  const subs = useQuery(() => supabase.from('suscripciones').select('id,nombre,monto,proxima_renovacion,pagado_por').eq('estado', 'activa'));
  const docs = useQuery(() => supabase.from('documentos').select('id,nombre,solicitado_en,vendedor_id,comprador_id,vendedores(empresa,nombre,responsable)').eq('estado', 'solicitado').not('solicitado_en', 'is', null));

  const sincronizar = async () => {
    setSync({ estado: 'busy' });
    try {
      const { data } = await supabase.auth.getSession();
      const r = await fetch('/api/calendly', { method: 'POST', headers: { Authorization: `Bearer ${data.session?.access_token}` } });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || `Error ${r.status}`);
      if (!j.configurado) { setSync({ estado: 'off' }); return; }
      const errores = (j.cuentas || []).filter((c: any) => c.error);
      setSync({ estado: errores.length ? 'err' : 'ok', msg: errores.length ? errores.map((c: any) => `${c.email.split('@')[0]}: ${c.error}`).join(' · ') : `${j.sincronizadas} reuniones al día` });
      reu.reload(); vend.reload();
    } catch (e: any) { setSync({ estado: 'err', msg: e.message }); }
  };
  useEffect(() => { sincronizar(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const items = useMemo<Item[]>(() => {
    const out: Item[] = [];
    const mio = (e: string | null | undefined) => !solo || e === yo?.email;
    for (const r of (reu.data || []) as Row[]) {
      if (!r.inicio || !mio(r.organizador)) continue;
      const quien = r.vendedores ? (r.vendedores.empresa || r.vendedores.nombre) : r.compradores?.nombre ?? r.invitado_nombre ?? r.invitado_email;
      out.push({ id: 'r' + r.id, dia: diaDe(r.inicio), hora: horaDe(r.inicio), titulo: quien || r.evento, detalle: r.evento, tipo: r.estado === 'cancelada' ? 'cancelada' : 'reunion', ir: r.vendedor_id ? `/vendedores/${r.vendedor_id}` : r.comprador_id ? `/compradores/${r.comprador_id}` : undefined, link: r.link, de: r.organizador });
    }
    for (const v of (vend.data || []) as Row[]) {
      if (!v.fecha_proxima_accion || !mio(v.responsable) || ['cerrado', 'perdido'].includes(v.etapa)) continue;
      out.push({ id: 'v' + v.id, dia: v.fecha_proxima_accion, titulo: v.empresa || v.nombre, detalle: v.proxima_accion, tipo: 'accion', ir: `/vendedores/${v.id}`, de: v.responsable });
    }
    for (const s of (subs.data || []) as Row[]) {
      if (!s.proxima_renovacion || (solo && s.pagado_por !== yo?.socio && s.pagado_por !== 'relevo')) continue;
      out.push({ id: 's' + s.id, dia: s.proxima_renovacion, titulo: s.nombre, detalle: 'Se renueva', tipo: 'renovacion', ir: '/finanzas/suscripciones' });
    }
    for (const d of (docs.data || []) as Row[]) {
      if (!d.solicitado_en) continue;
      if (solo && d.vendedores?.responsable !== yo?.email) continue;
      out.push({ id: 'd' + d.id, dia: sumarDias(d.solicitado_en, 15), titulo: d.vendedores ? (d.vendedores.empresa || d.vendedores.nombre) : d.nombre, detalle: `Cumple 15 días: ${d.nombre}`, tipo: 'doc', ir: d.vendedor_id ? `/vendedores/${d.vendedor_id}` : `/compradores/${d.comprador_id}` });
    }
    return out.sort((a, b) => (a.dia + (a.hora ?? '')).localeCompare(b.dia + (b.hora ?? '')));
  }, [reu.data, vend.data, subs.data, docs.data, solo, yo]);

  const porDia = useMemo(() => { const m = new Map<string, Item[]>(); items.forEach((i) => m.set(i.dia, [...(m.get(i.dia) || []), i])); return m; }, [items]);

  // cuadrícula: desde el lunes de la semana del día 1 hasta completar 6 semanas
  const primero = new Date(mes + 'T12:00:00Z');
  const desfase = (primero.getUTCDay() + 6) % 7;
  const inicio = sumarDias(mes, -desfase);
  const celdas = Array.from({ length: 42 }, (_, i) => sumarDias(inicio, i));
  const h = hoy();
  const agenda = items.filter((i) => i.dia >= h && i.dia <= sumarDias(h, 13));
  const moverMes = (n: number) => { const d = new Date(mes + 'T12:00:00Z'); d.setUTCMonth(d.getUTCMonth() + n); setMes(d.toISOString().slice(0, 7) + '-01'); };
  const abrir = (i: Item) => { if (i.ir) nav(i.ir); else if (i.link) window.open(i.link, '_blank', 'noopener'); else toast(i.detalle || i.titulo); };

  return (
    <div className="page">
      <div className="head">
        <div><h1>Calendario</h1><p>Reuniones de Calendly, próximas acciones, renovaciones y documentos por vencer.</p></div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span className={'muted'} style={{ fontSize: 12.5 }}>
            {sync.estado === 'busy' ? 'Sincronizando Calendly' : sync.estado === 'ok' ? `Calendly: ${sync.msg}` : sync.estado === 'off' ? 'Calendly sin conectar' : sync.estado === 'err' ? 'Calendly con error' : ''}
          </span>
          <button className="btn" onClick={sincronizar} disabled={sync.estado === 'busy'}><ArrowsClockwise className="ic" />Sincronizar</button>
        </div>
      </div>
      {sync.estado === 'err' && <div className="aviso" style={{ marginBottom: 12 }}><div><b>No se pudo leer Calendly.</b> {sync.msg}</div></div>}
      {sync.estado === 'off' && <div className="aviso" style={{ marginBottom: 12 }}><div><b>Falta conectar Calendly.</b> Hay que poner los tokens de Calendly en Vercel. Mientras tanto se ven las demás fechas.</div></div>}

      <div className="toolbar">
        <button className="btn ghost" aria-label="Mes anterior" onClick={() => moverMes(-1)}><CaretLeft className="ic" /></button>
        <b style={{ minWidth: 150, textAlign: 'center' }}>{mesTitulo(mes)}</b>
        <button className="btn ghost" aria-label="Mes siguiente" onClick={() => moverMes(1)}><CaretRight className="ic" /></button>
        <button className="btn ghost" onClick={() => setMes(h.slice(0, 7) + '-01')}>Hoy</button>
        <label className="who" style={{ marginLeft: 12 }}><input type="checkbox" checked={solo} onChange={(e) => setSolo(e.target.checked)} />Solo lo mío</label>
        <span className="cal-leyenda">{(['reunion', 'accion', 'renovacion', 'doc'] as Item['tipo'][]).map((t) => <span key={t} className={'tag ' + TONO[t]}>{NOMBRE[t]}</span>)}</span>
      </div>

      <div className="cal-wrap">
        <div className="cal">
          {DIAS.map((d) => <div key={d} className="cal-h">{d}</div>)}
          {celdas.map((d) => {
            const lista = porDia.get(d) || [];
            return (
              <div key={d} className={'cal-d' + (d.slice(0, 7) !== mes.slice(0, 7) ? ' fuera' : '') + (d === h ? ' hoy' : '')}>
                <span className="cal-n num">{Number(d.slice(8))}</span>
                {lista.slice(0, 3).map((i) => (
                  <button key={i.id} className={'cal-i ' + TONO[i.tipo]} title={`${NOMBRE[i.tipo]}: ${i.titulo}${i.detalle ? ' · ' + i.detalle : ''}`} onClick={() => abrir(i)}>
                    {i.hora && <span className="num">{i.hora}</span>}{i.titulo}
                  </button>
                ))}
                {lista.length > 3 && <span className="cal-mas">+{lista.length - 3} más</span>}
              </div>
            );
          })}
        </div>

        <section className="panel cal-agenda">
          <header><h2>Próximos 14 días</h2><span className="b num">{agenda.length}</span></header>
          <div className="list">
            {!agenda.length ? <p className="empty-state">Nada en los próximos 14 días.</p> : agenda.map((i) => (
              <div key={i.id} className="li click" style={{ gridTemplateColumns: 'auto minmax(0,1fr) auto' }} onClick={() => abrir(i)}>
                <span className={'tag ' + TONO[i.tipo]}>{NOMBRE[i.tipo]}</span>
                <div><b>{i.titulo}</b><div className="meta">{fecha(i.dia)}{i.hora ? ` · ${i.hora}` : ''}{i.detalle ? ` · ${i.detalle}` : ''}</div></div>
                {i.link && i.tipo === 'reunion' ? <a className="btn ghost" href={i.link} target="_blank" rel="noopener" onClick={(e) => e.stopPropagation()} title="Entrar a la reunión"><VideoCamera className="ic" /></a> : <span />}
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
