import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { CreditCard, Tray, Phone, VideoCamera, CaretRight, CaretDown, CheckCircle } from '@phosphor-icons/react';
import { faltan } from './Suscripciones';
import { cop } from '../lib/finanzas';
import { fecha, fechaHora, hoy } from '../lib/format';
import { supabase, type Row } from '../lib/supabase';
import { useCatalogo, useQuery } from '../lib/data';
import { tonoEtapa } from '../lib/colores';
import { REMITENTE } from '../flash/acciones';
import { Skeleton, ErrorBox } from '../components/ui';
import { BotonNota } from '../components/Nota';
import { NuevaTarea, TareaFila } from '../components/Tareas';
import { AvisoBotones } from '../components/Etapa';
import { cargarAvisos, type Aviso } from '../lib/alertas';

/** Inicio personal: lo de quien está en la cuenta. Lo del equipo completo vive en Embudo. */

type Nivel = 'urgente' | 'hoy' | 'pronto';
const nivel = (a: Aviso): Nivel => (a.tono === 'err' ? 'urgente' : a.tono === 'warn' || a.accion ? 'hoy' : 'pronto');

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

function EtapaTag({ codigo }: { codigo?: string }) {
  const { etapasDe } = useCatalogo();
  const e = etapasDe('vendedor').find((x) => x.codigo === codigo);
  if (!e) return null;
  return <span className={'tag ' + tonoEtapa(e.fase, e.codigo)}>{e.nombre}</span>;
}

function AvisoFila({ a, onCambio, compacta }: { a: Aviso; onCambio: () => void; compacta?: boolean }) {
  const n = nivel(a);
  const titulo = a.vendedorId ? <Link to={`/vendedores/${a.vendedorId}`} className="av-titulo">{a.titulo}</Link> : <span className="av-titulo">{a.titulo}</span>;
  if (compacta) return (
    <Link to={`/vendedores/${a.vendedorId}`} className={'av compacta nivel-' + n}>
      <span className="av-titulo">{a.titulo}</span>
      {a.cifra && <span className={'cifra ' + n}>{a.cifra}</span>}
    </Link>
  );
  return (
    <div className={'av nivel-' + n}>
      <div className="av-cab">
        {titulo}
        <EtapaTag codigo={a.etapa} />
        {a.cifra && <span className={'cifra ' + n}>{a.cifra}</span>}
      </div>
      <p className="av-det">{a.detalle}</p>
      {a.accion && <AvisoBotones a={a} onCambio={onCambio} />}
    </div>
  );
}

function Grupo({ titulo, n, tono, children }: { titulo: string; n?: number; tono?: Nivel; children: ReactNode }) {
  return (
    <div className="grupo">
      <h3 className={tono ? 'g-' + tono : ''}>{titulo}{n != null && n > 0 && <span className="g-n num">{n}</span>}</h3>
      {children}
    </div>
  );
}

function Contador({ n, etiqueta, tono }: { n: number; etiqueta: string; tono: Nivel | 'listo' }) {
  return <span className={'semaforo s-' + tono}><b className="num">{n}</b>{etiqueta}</span>;
}

const fechaLarga = () => {
  const s = new Intl.DateTimeFormat('es-CO', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'America/Bogota' }).format(new Date());
  return s.charAt(0).toUpperCase() + s.slice(1);
};
const SEL_TAREA = '*, vendedor:vendedores(empresa,nombre)';
const VISIBLES = 5;

export default function Inicio() {
  const { yo, equipo } = useCatalogo();
  const me = yo?.email ?? '';
  const nav = useNavigate();
  const h = hoy();
  const inicioDia = `${h}T00:00:00-05:00`;
  const finDia = `${h}T23:59:59-05:00`;
  const [verTodos, setVerTodos] = useState(false);

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
  const mios = avisos.filter((a) => a.para === me);
  const urgentes = mios.filter((a) => nivel(a) === 'urgente');
  const deHoy = mios.filter((a) => nivel(a) === 'hoy');
  const pronto = mios.filter((a) => nivel(a) === 'pronto');
  const sinContactar = avisos.filter((a) => a.para === null);
  const noContactados = av.data?.noContactados ?? 0;

  const pend = (mias.data || []) as Row[];
  const tareasHoy = pend.filter((t) => t.fecha && t.fecha <= h);
  const tareasVencidas = tareasHoy.filter((t) => t.fecha < h);
  const sinFecha = pend.filter((t) => !t.fecha);
  const proximas = pend.filter((t) => t.fecha && t.fecha > h);
  const hechas = (hechasHoy.data || []) as Row[];
  const espera = (esperando.data || []) as Row[];
  const reus = (reuniones.data || []) as Row[];
  const nLlamadas = ((llamadas.data || []) as Row[]).filter((v) => {
    const r = [...(v.formulario_respuestas || [])].sort((a: Row, b: Row) => (a.created_at < b.created_at ? 1 : -1))[0];
    return r?.respuestas?.llamada === 'si';
  }).length;
  const renuevan = ((subs.data || []) as Row[]).filter((s) => faltan(s.proxima_renovacion) <= 7);
  const nombre = yo ? yo.apodo || yo.nombre.split(' ')[0] : '';
  const cargando = mias.loading || av.loading;
  const nUrg = urgentes.length + tareasVencidas.length;
  const nHoy = deHoy.length + tareasHoy.length - tareasVencidas.length;
  const nada = !nUrg && !nHoy && !pronto.length && !sinFecha.length;

  return (
    <div className="page inicio">
      <header className="ini-cab">
        <div>
          <h1>Hola{nombre && `, ${nombre}`}</h1>
          <p>{fechaLarga()}</p>
        </div>
        <div className="ini-der">
          {!cargando && (nUrg || nHoy ? (
            <div className="semaforos">
              {nUrg > 0 && <Contador n={nUrg} etiqueta={nUrg === 1 ? 'urgente' : 'urgentes'} tono="urgente" />}
              {nHoy > 0 && <Contador n={nHoy} etiqueta="para hoy" tono="hoy" />}
              {hechas.length > 0 && <Contador n={hechas.length} etiqueta={hechas.length === 1 ? 'hecha' : 'hechas'} tono="listo" />}
            </div>
          ) : <div className="semaforos"><span className="semaforo s-listo"><CheckCircle weight="fill" />Al día</span></div>)}
          <BotonNota />
        </div>
      </header>

      <div className="grid-inicio">
        <section className="panel dia">
          <header className="dia-cab"><h2>Tu día</h2><NuevaTarea onCreada={recargar} /></header>
          {mias.error || av.error ? <ErrorBox msg={(mias.error || av.error)!} retry={recargar} /> : cargando ? <Skeleton rows={5} /> : (
            <div className="dia-cuerpo">
              {nada && !hechas.length && <p className="vacio">Nada pendiente. Escribe arriba lo próximo que tienes que hacer.</p>}
              {nUrg > 0 && (
                <Grupo titulo="Urgente" n={nUrg} tono="urgente">
                  {urgentes.map((a) => <AvisoFila key={a.key} a={a} onCambio={recargar} />)}
                  {tareasVencidas.map((t) => <TareaFila key={t.id} t={t} onCambio={recargar} />)}
                </Grupo>
              )}
              {nHoy > 0 && (
                <Grupo titulo="Para hoy" n={nHoy} tono="hoy">
                  {deHoy.map((a) => <AvisoFila key={a.key} a={a} onCambio={recargar} />)}
                  {tareasHoy.filter((t) => t.fecha === h).map((t) => <TareaFila key={t.id} t={t} onCambio={recargar} />)}
                </Grupo>
              )}
              {pronto.length > 0 && (
                <Grupo titulo="Ojo esta semana" n={pronto.length} tono="pronto">
                  {pronto.map((a) => <AvisoFila key={a.key} a={a} onCambio={recargar} />)}
                </Grupo>
              )}
              {sinFecha.length > 0 && (
                <Grupo titulo="Cuando puedas" n={sinFecha.length}>
                  {sinFecha.map((t) => <TareaFila key={t.id} t={t} onCambio={recargar} />)}
                </Grupo>
              )}
              {hechas.length > 0 && (
                <Grupo titulo="Hechas hoy">
                  {hechas.map((t) => <TareaFila key={t.id} t={t} onCambio={recargar} />)}
                </Grupo>
              )}
            </div>
          )}
        </section>

        <aside className="stack lateral">
          <section className="panel">
            <header><h2>Reuniones de hoy</h2></header>
            {reuniones.loading ? <Skeleton rows={1} /> : !reus.length ? <p className="vacio chico">Sin reuniones hoy.</p> : (
              <div className="list">
                {reus.map((r) => (
                  <div key={r.id} className={'li reu' + (r.vendedor_id ? ' click' : '')} onClick={() => r.vendedor_id && nav(`/vendedores/${r.vendedor_id}`)}>
                    <span className="reu-hora num">{fechaHora(r.inicio).split(',').pop()?.trim()}</span>
                    <div><b>{r.invitado_nombre || r.evento}</b><p className="meta">{r.evento}</p></div>
                    {r.link ? <a className="btn" href={r.link} target="_blank" rel="noopener" onClick={(e) => e.stopPropagation()}><VideoCamera className="ic" />Entrar</a> : <span />}
                  </div>
                ))}
              </div>
            )}
          </section>

          {proximas.length > 0 && (
            <section className="panel">
              <header><h2>Próximos recordatorios</h2><span className="g-n num">{proximas.length}</span></header>
              <div className="tareas">{proximas.map((t) => <TareaFila key={t.id} t={t} onCambio={recargar} />)}</div>
            </section>
          )}

          {espera.length > 0 && (
            <section className="panel">
              <header><h2>Esperando a otros</h2><span className="g-n num">{espera.length}</span></header>
              <div className="tareas">{espera.map((t) => <TareaFila key={t.id} t={t} onCambio={recargar} />)}</div>
            </section>
          )}

          <section className="panel equipo">
            <header><h2>Equipo</h2></header>
            <div className="eq-nc">
              <button className="eq-fila" onClick={() => nav('/vendedores')}>
                <span className={'eq-n num' + (sinContactar.length ? ' alerta' : '')}>{av.loading ? '·' : noContactados}</span>
                <span className="eq-txt"><b>No contactados</b><span className="meta">{sinContactar.length ? `${sinContactar.length} llevan 3 días hábiles o más. Quien lo contacte queda a cargo` : 'Quien lo contacte queda a cargo'}</span></span>
                <CaretRight className="ic muted" />
              </button>
              {sinContactar.length > 0 && (
                <div className="eq-lista">
                  {(verTodos ? sinContactar : sinContactar.slice(0, VISIBLES)).map((a) => <AvisoFila key={a.key} a={a} onCambio={recargar} compacta />)}
                  {sinContactar.length > VISIBLES && (
                    <button className="linkish ver-mas" onClick={() => setVerTodos(!verTodos)}>
                      <CaretDown className="ic" style={{ transform: verTodos ? 'rotate(180deg)' : undefined }} />{verTodos ? 'Ver menos' : `Ver los ${sinContactar.length}`}
                    </button>
                  )}
                </div>
              )}
            </div>
            <div className="list">
              <div className="li click" onClick={() => nav('/bandeja')}>
                <Tray className="ic" />
                <div><b>Bandeja</b><p className="meta">Leads de la web por aprobar</p></div>
                <span className={'num eq-mini' + ((bandeja.data ?? 0) > 0 ? ' activo' : '')}>{bandeja.loading ? '·' : bandeja.data}</span>
              </div>
              <div className="li click" onClick={() => nav('/flash')}>
                <Phone className="ic" />
                <div><b>Pidieron llamada</b><p className="meta">Nadie ha tomado el caso</p></div>
                <span className={'num eq-mini' + (nLlamadas ? ' activo' : '')}>{llamadas.loading ? '·' : nLlamadas}</span>
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
        </aside>
      </div>
    </div>
  );
}
