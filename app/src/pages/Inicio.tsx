import { useNavigate } from 'react-router-dom';
import { WarningCircle, Clock, FileArrowDown, CalendarX, CreditCard } from '@phosphor-icons/react';
import { Faltan, faltan } from './Suscripciones';
import { cop } from '../lib/finanzas';
import { fecha } from '../lib/format';
import { supabase, type Row } from '../lib/supabase';
import { useQuery } from '../lib/data';
import { Skeleton, ErrorBox } from '../components/ui';
import { BotonNota } from '../components/Nota';

const TIPO: Record<string, { t: string; I: any }> = {
  doc_atrasado: { t: 'Documentos atrasados', I: FileArrowDown },
  accion_vencida: { t: 'Acciones para hoy o vencidas', I: Clock },
  etapa_estancada: { t: 'Vendedores fuera de la meta de su etapa', I: WarningCircle },
  orden_por_vencer: { t: 'Búsquedas de compradores por vencer', I: CalendarX },
};

export default function Inicio() {
  const nav = useNavigate();
  const alertas = useQuery(() => supabase.from('v_alertas').select('*').order('dias', { ascending: false }));
  const v = useQuery(() => supabase.from('v_vendedores').select('etapa,fase,dias_en_etapa,sla_dias,fecha_ingreso'));
  const c = useQuery(() => supabase.from('v_compradores').select('estado,etapa'));
  const subs = useQuery(() => supabase.from('suscripciones').select('id,nombre,monto,proxima_renovacion').eq('estado', 'activa').order('proxima_renovacion'));
  const renuevan = ((subs.data || []) as Row[]).filter((s) => faltan(s.proxima_renovacion) <= 7);

  const activos = (v.data || []).filter((x: Row) => !['cerrado', 'perdido', 'en_reserva'].includes(x.etapa));
  const enValoracion = activos.filter((x: Row) => x.fase === 'Valoración').length;
  const hace7 = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
  const nuevos = (v.data || []).filter((x: Row) => x.fecha_ingreso >= hace7).length;
  const registrados = (c.data || []).filter((x: Row) => x.estado === 'registrado').length;

  const grupos = Object.keys(TIPO).map((k) => ({ k, items: (alertas.data || []).filter((a: Row) => a.tipo === k) })).filter((g) => g.items.length);

  return (
    <div className="page">
      <div className="head"><div><h1>Inicio</h1><p>Lo que hay que mover hoy.</p></div><BotonNota /></div>
      <dl className="kpis">
        <div><dt>Vendedores activos</dt><dd className="num">{v.loading ? '·' : activos.length}</dd></div>
        <div><dt>En valoración</dt><dd className="num">{v.loading ? '·' : enValoracion}</dd></div>
        <div><dt>Compradores registrados</dt><dd className="num">{c.loading ? '·' : registrados}</dd></div>
        <div><dt>Vendedores nuevos, 7 días</dt><dd className="num">{v.loading ? '·' : nuevos}</dd></div>
      </dl>

      {renuevan.length > 0 && (
        <section className="panel" style={{ marginBottom: 16 }}>
          <header><h2 style={{ display: 'flex', gap: 8, alignItems: 'center' }}><CreditCard className="ic" style={{ color: 'var(--orange)' }} />Suscripciones que se renuevan esta semana</h2><span className="b num">{renuevan.length}</span></header>
          <div className="list">
            {renuevan.map((s) => (
              <div key={s.id} className="li click" style={{ gridTemplateColumns: 'minmax(0,1fr) auto' }} onClick={() => nav('/finanzas/suscripciones')}>
                <div><b>{s.nombre}</b><div className="meta">{cop(Number(s.monto))} el {fecha(s.proxima_renovacion)}. Si no se va a usar, cancélala antes.</div></div>
                <Faltan d={s.proxima_renovacion} />
              </div>
            ))}
          </div>
        </section>
      )}

      {alertas.error ? <ErrorBox msg={alertas.error} retry={alertas.reload} /> : alertas.loading ? <div className="panel"><Skeleton /></div> : !grupos.length ? (
        <div className="panel"><p className="empty-state">Nada atrasado. Cuando un documento lleve 15 días sin llegar o una acción se venza, aparece aquí.</p></div>
      ) : (
        <div className="stack">
          {grupos.map(({ k, items }) => { const { t, I } = TIPO[k]; return (
            <section className="panel" key={k}>
              <header><h2 style={{ display: 'flex', gap: 8, alignItems: 'center' }}><I className="ic" style={{ color: k === 'doc_atrasado' || k === 'accion_vencida' ? 'var(--orange)' : 'var(--ink-3)' }} />{t}</h2><span className="b num">{items.length}</span></header>
              <div className="list">
                {items.map((a: Row, i: number) => (
                  <div key={i} className="li click" style={{ gridTemplateColumns: 'minmax(0,1fr) auto' }} onClick={() => nav(`/${a.entidad === 'vendedor' ? 'vendedores' : 'compradores'}/${a.entidad_id}`)}>
                    <div><b>{a.titulo}</b><p className="meta">{a.detalle}</p></div>
                    <span className={'b ' + (a.prioridad === 'alta' ? 'err' : a.prioridad === 'media' ? 'warn' : '')}>{a.entidad === 'vendedor' ? 'Vendedor' : 'Comprador'}</span>
                  </div>
                ))}
              </div>
            </section>); })}
        </div>
      )}
    </div>
  );
}
