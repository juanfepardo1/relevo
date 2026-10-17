import { useNavigate, Link } from 'react-router-dom';
import { FileArrowDown, WarningCircle, CreditCard, Tray, Phone, VideoCamera, ArrowRight } from '@phosphor-icons/react';
import { faltan } from './Suscripciones';
import { cop } from '../lib/finanzas';
import { fecha, fechaHora, hoy } from '../lib/format';
import { supabase, type Row } from '../lib/supabase';
import { useCatalogo, useQuery } from '../lib/data';
import { REMITENTE } from '../flash/acciones';
import { Skeleton, ErrorBox } from '../components/ui';
import { BotonNota } from '../components/Nota';
import { NuevaTarea, TareaFila } from '../components/Tareas';

/** Inicio personal: lo de quien está en la cuenta. Lo del equipo completo vive en Embudo. */

const AUTO: Record<string, { I: any; tono: string }> = {
  doc_atrasado: { I: FileArrowDown, tono: 'var(--orange)' },
  etapa_estancada: { I: WarningCircle, tono: 'var(--ink-3)' },
};

function saludo() {
  const h = Number(new Intl.DateTimeFormat('en-US', { hour: 'numeric', hourCycle: 'h23', timeZone: 'America/Bogota' }).format(new Date()));
  return h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches';
}
const fechaLarga = () => new Intl.DateTimeFormat('es-CO', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'America/Bogota' }).format(new Date());
const SEL_TAREA = '*, vendedor:vendedores(empresa,nombre)';

export default function Inicio() {
  const { yo, equipo } = useCatalogo();
  const me = yo?.email ?? '';
  const nav = useNavigate();
  const h = hoy();
  const inicioDia = `${h}T00:00:00-05:00`;
  const finDia = `${h}T23:59:59-05:00`;

  const mias = useQuery(() => supabase.from('tareas').select(SEL_TAREA).eq('asignado', me).is('hecha_en', null).order('fecha', { nullsFirst: false }).order('created_at'), [me]);
  const hechasHoy = useQuery(() => supabase.from('tareas').select(SEL_TAREA).eq('asignado', me).gte('hecha_en', inicioDia).order('hecha_en', { ascending: false }), [me, h]);
  const esperando = useQuery(() => supabase.from('tareas').select(SEL_TAREA).eq('creador', me).neq('asignado', me).is('hecha_en', null).order('fecha', { nullsFirst: false }), [me]);
  const misVend = useQuery(() => supabase.from('vendedores').select('id').eq('responsable', me), [me]);
  const alertas = useQuery(() => supabase.from('v_alertas').select('*').eq('entidad', 'vendedor').in('tipo', Object.keys(AUTO)).order('dias', { ascending: false }));
  const reuniones = useQuery(() => supabase.from('reuniones').select('*').eq('organizador', me).neq('estado', 'cancelada').gte('inicio', inicioDia).lte('inicio', finDia).order('inicio'), [me, h]);
  const bandeja = useQuery<number>(() => supabase.from('v_bandeja').select('id', { count: 'exact', head: true }).then((r) => ({ data: r.count ?? 0, error: r.error })));
  const llamadas = useQuery(() => supabase.from('vendedores').select('id, formulario_respuestas(respuestas, created_at)').eq('responsable', REMITENTE).not('form_respondido_en', 'is', null));
  const subs = useQuery(() => supabase.from('suscripciones').select('id,nombre,monto,proxima_renovacion').eq('estado', 'activa').order('proxima_renovacion'));

  const recargar = () => { mias.reload(); hechasHoy.reload(); esperando.reload(); };
  const ids = new Set(((misVend.data || []) as Row[]).map((v) => v.id));
  const auto = ((alertas.data || []) as Row[]).filter((a) => ids.has(a.entidad_id));
  const pend = (mias.data || []) as Row[];
  const ahora = pend.filter((t) => t.fecha && t.fecha <= h);
  const sinFecha = pend.filter((t) => !t.fecha);
  const proximas = pend.filter((t) => t.fecha && t.fecha > h);
  const hechas = (hechasHoy.data || []) as Row[];
  const nLlamadas = ((llamadas.data || []) as Row[]).filter((v) => {
    const r = [...(v.formulario_respuestas || [])].sort((a: Row, b: Row) => (a.created_at < b.created_at ? 1 : -1))[0];
    return r?.respuestas?.llamada === 'si';
  }).length;
  const renuevan = ((subs.data || []) as Row[]).filter((s) => faltan(s.proxima_renovacion) <= 7);
  const nombre = yo ? yo.apodo || yo.nombre.split(' ')[0] : '';
  const cargando = mias.loading || misVend.loading || alertas.loading;
  const nAhora = ahora.length + auto.length;

  return (
    <div className="page inicio">
      <div className="head">
        <div>
          <h1>{saludo()}{nombre && `, ${nombre}`}</h1>
          <p style={{ textTransform: 'none' }}>
            <span style={{ textTransform: 'capitalize' }}>{fechaLarga()}</span>
            {!cargando && <> · {nAhora ? `${nAhora} ${nAhora === 1 ? 'cosa' : 'cosas'} para hoy` : 'Nada urgente hoy'}{hechas.length > 0 && `, ${hechas.length} ${hechas.length === 1 ? 'hecha' : 'hechas'}`}</>}
          </p>
        </div>
        <BotonNota />
      </div>

      <div className="grid-inicio">
        <div className="stack">
          <section className="panel">
            <header><h2>Tus tareas</h2></header>
            <div className="body" style={{ paddingBottom: 8 }}><NuevaTarea onCreada={recargar} /></div>
            {mias.error ? <ErrorBox msg={mias.error} retry={mias.reload} /> : cargando ? <Skeleton rows={4} /> : (
              <div className="tareas">
                {!nAhora && !sinFecha.length && <p className="empty-state">Sin pendientes. Escribe arriba lo próximo que tienes que hacer.</p>}
                {nAhora > 0 && <h3 className="grupo">Para hoy</h3>}
                {ahora.map((t) => <TareaFila key={t.id} t={t} onCambio={recargar} />)}
                {auto.map((a, i) => { const { I, tono } = AUTO[a.tipo]; return (
                  <Link key={i} to={`/vendedores/${a.entidad_id}`} className="tarea auto">
                    <span className="check auto-ic"><I style={{ color: tono }} /></span>
                    <span className="tarea-txt"><span>{a.titulo}</span><span className="meta">{a.detalle}</span></span>
                    <ArrowRight className="ic muted" />
                  </Link>); })}
                {sinFecha.length > 0 && <h3 className="grupo">Sin fecha</h3>}
                {sinFecha.map((t) => <TareaFila key={t.id} t={t} onCambio={recargar} />)}
                {hechas.length > 0 && <h3 className="grupo">Hechas hoy</h3>}
                {hechas.map((t) => <TareaFila key={t.id} t={t} onCambio={recargar} />)}
              </div>
            )}
          </section>

          <section className="panel">
            <header><h2>Recordatorios</h2>{proximas.length > 0 && <span className="b num">{proximas.length}</span>}</header>
            {cargando ? <Skeleton rows={2} /> : !proximas.length ? (
              <p className="empty-state">Ponle fecha a una tarea y aparece aquí hasta que llegue el día.</p>
            ) : <div className="tareas">{proximas.map((t) => <TareaFila key={t.id} t={t} onCambio={recargar} />)}</div>}
          </section>
        </div>

        <div className="stack">
          <section className="panel">
            <header><h2>Hoy</h2></header>
            {reuniones.loading ? <Skeleton rows={2} /> : !(reuniones.data || []).length ? (
              <p className="empty-state">Sin reuniones agendadas hoy.</p>
            ) : (
              <div className="list">
                {((reuniones.data || []) as Row[]).map((r) => (
                  <div key={r.id} className={'li' + (r.vendedor_id ? ' click' : '')} onClick={() => r.vendedor_id && nav(`/vendedores/${r.vendedor_id}`)}>
                    <VideoCamera className="ic" />
                    <div><b>{r.invitado_nombre || r.evento}</b><p className="meta">{fechaHora(r.inicio).split(',').pop()} · {r.evento}</p></div>
                    {r.link && <a className="btn" href={r.link} target="_blank" rel="noopener" onClick={(e) => e.stopPropagation()}>Entrar</a>}
                  </div>
                ))}
              </div>
            )}
          </section>

          {(esperando.data || []).length > 0 && (
            <section className="panel">
              <header><h2>Esperando a otros</h2><span className="b num">{(esperando.data || []).length}</span></header>
              <div className="tareas">{((esperando.data || []) as Row[]).map((t) => <TareaFila key={t.id} t={t} onCambio={recargar} />)}</div>
            </section>
          )}

          <section className="panel">
            <header><h2>Del equipo</h2></header>
            <div className="list">
              <div className="li click" onClick={() => nav('/bandeja')}>
                <Tray className="ic" />
                <div><b>Bandeja</b><p className="meta">Leads de la web por aprobar o descartar</p></div>
                <span className="num">{bandeja.loading ? '·' : bandeja.data}</span>
              </div>
              <div className="li click" onClick={() => nav('/flash')}>
                <Phone className="ic" />
                <div><b>Pidieron llamada</b><p className="meta">Respondieron el formulario y nadie ha tomado el caso</p></div>
                <span className={'num' + (nLlamadas ? ' acento' : '')}>{llamadas.loading ? '·' : nLlamadas}</span>
              </div>
              {renuevan.map((s) => (
                <div key={s.id} className="li click" onClick={() => nav('/finanzas/suscripciones')}>
                  <CreditCard className="ic" style={{ color: 'var(--orange)' }} />
                  <div><b>{s.nombre} se renueva</b><p className="meta">{cop(Number(s.monto))} el {fecha(s.proxima_renovacion)}. Si no se usa, cancélala antes.</p></div>
                  <span />
                </div>
              ))}
            </div>
          </section>

          {equipo.length > 0 && !yo && <p className="meta">Tu correo no está en el equipo; las tareas personales no aparecerán.</p>}
        </div>
      </div>
    </div>
  );
}
