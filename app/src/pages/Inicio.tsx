import { useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { WarningCircle, CreditCard, Tray, Phone, VideoCamera, ArrowRight, UserPlus } from '@phosphor-icons/react';
import { faltan } from './Suscripciones';
import { cop } from '../lib/finanzas';
import { fecha, fechaHora, hoy } from '../lib/format';
import { supabase, type Row } from '../lib/supabase';
import { useCatalogo, useQuery } from '../lib/data';
import { REMITENTE } from '../flash/acciones';
import { Skeleton, ErrorBox } from '../components/ui';
import { BotonNota } from '../components/Nota';
import { NuevaTarea, TareaFila } from '../components/Tareas';
import { AvisoBotones } from '../components/Etapa';
import { cargarAvisos, type Aviso } from '../lib/alertas';

/** Inicio personal: lo de quien está en la cuenta. Lo del equipo completo vive en Embudo. */

/** Trae las reuniones de Calendly para que agendar mueva la etapa sola. Máximo cada 10 minutos por pestaña. */
async function sincronizarCalendly() {
  try {
    const k = 'calendly:sync'; const t = Number(sessionStorage.getItem(k) || 0);
    if (Date.now() - t < 6e5) return false;
    sessionStorage.setItem(k, String(Date.now()));
    const { data } = await supabase.auth.getSession();
    const r = await fetch('/api/calendly', { method: 'POST', headers: { Authorization: `Bearer ${data.session?.access_token}` } });
    return r.ok;
  } catch { return false; }
}

function AvisoFila({ a, onCambio }: { a: Aviso; onCambio: () => void }) {
  return (
    <div className={'tarea aviso' + (a.accion ? ' con-accion' : '')}>
      <span className="check auto-ic"><WarningCircle className={'tono-' + (a.tono || 'n')} /></span>
      <span className="tarea-txt">
        {a.vendedorId ? <Link to={`/vendedores/${a.vendedorId}`} className="aviso-titulo">{a.titulo}</Link> : <span className="aviso-titulo">{a.titulo}</span>}
        <span className="meta">{a.detalle}</span>
        {a.accion && <AvisoBotones a={a} onCambio={onCambio} />}
      </span>
      {a.vendedorId && !a.accion ? <Link to={`/vendedores/${a.vendedorId}`} aria-label="Abrir ficha"><ArrowRight className="ic muted" /></Link> : <span />}
    </div>
  );
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
  const av = useQuery<{ avisos: Aviso[]; noContactados: number }>(() => cargarAvisos().then((data) => ({ data, error: null })));
  const reuniones = useQuery(() => supabase.from('reuniones').select('*').eq('organizador', me).neq('estado', 'cancelada').gte('inicio', inicioDia).lte('inicio', finDia).order('inicio'), [me, h]);
  const bandeja = useQuery<number>(() => supabase.from('v_bandeja').select('id', { count: 'exact', head: true }).then((r) => ({ data: r.count ?? 0, error: r.error })));
  const llamadas = useQuery(() => supabase.from('vendedores').select('id, formulario_respuestas(respuestas, created_at)').eq('responsable', REMITENTE).not('form_respondido_en', 'is', null));
  const subs = useQuery(() => supabase.from('suscripciones').select('id,nombre,monto,proxima_renovacion').eq('estado', 'activa').order('proxima_renovacion'));

  useEffect(() => { sincronizarCalendly().then((ok) => { if (ok) { av.reload(); reuniones.reload(); } }); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const recargar = () => { mias.reload(); hechasHoy.reload(); esperando.reload(); av.reload(); };
  const avisos = av.data?.avisos ?? [];
  const noContactados = av.data?.noContactados ?? 0;
  const auto = avisos.filter((a) => a.para === me);
  const delEquipo = avisos.filter((a) => a.para === null);
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
  const cargando = mias.loading || av.loading;
  const nAhora = ahora.length + auto.length;

  return (
    <div className="page inicio">
      <div className="head">
        <div>
          <h1>Hola{nombre && `, ${nombre}`}</h1>
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
            {mias.error || av.error ? <ErrorBox msg={(mias.error || av.error)!} retry={recargar} /> : cargando ? <Skeleton rows={4} /> : (
              <div className="tareas">
                {!nAhora && !sinFecha.length && <p className="empty-state">Sin pendientes. Escribe arriba lo próximo que tienes que hacer.</p>}
                {nAhora > 0 && <h3 className="grupo">Para hoy</h3>}
                {auto.map((a) => <AvisoFila key={a.key} a={a} onCambio={recargar} />)}
                {ahora.map((t) => <TareaFila key={t.id} t={t} onCambio={recargar} />)}
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
              <div className="li click" onClick={() => nav('/vendedores')}>
                <UserPlus className="ic" />
                <div><b>No contactados</b><p className="meta">Sin responsable. Quien lo contacte queda a cargo</p></div>
                <span className={'num' + (delEquipo.length ? ' acento' : '')}>{av.loading ? '·' : noContactados}</span>
              </div>
              {delEquipo.length > 0 && <div className="tareas">{delEquipo.map((a) => <AvisoFila key={a.key} a={a} onCambio={recargar} />)}</div>}
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
