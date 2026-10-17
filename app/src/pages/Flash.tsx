import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Lightning, Pause, ArrowsClockwise, EnvelopeSimple, Check, ArrowSquareOut, Copy, Warning, CaretDown, DownloadSimple } from '@phosphor-icons/react';
import { supabase, must, type Row } from '../lib/supabase';
import { useQuery, useCatalogo } from '../lib/data';
import { fecha, hoy, waLink } from '../lib/format';
import { Skeleton, ErrorBox, useToast } from '../components/ui';
import { type Lead, type Supuestos, DEFAULTS, SECTORS, SUBS, TRAMO_TEXTO, mezclar, leadDe, calcular, motivosRevision, marcarRepetidos, mensaje, money, dec, fmtAdj, subOf } from '../flash/motor';
import { paginas, documento, generarPdf, nombreArchivo } from '../flash/pdf';
import { embudo, etiqueta, type Respuesta } from '../lib/formulario';
import { valorarYGuardar, marcarEnviado, borradorDeValorado, crearBorrador, probarGmail, htmlCorreo, enviarFormulario, proximosRecordatorios, REMITENTE, type Remitente, type Modo } from '../flash/acciones';
import { firmaRespaldo } from '../../api/_correo.js';
import { Modal } from '../components/ui';

type Grupo = 'flash' | 'revisar' | 'fuera' | 'porEnviar' | 'enviados';
const GRUPOS: { k: Grupo; t: string; tono: string }[] = [
  { k: 'flash', t: 'Listos para valorar', tono: 'tone-mercado' },
  { k: 'revisar', t: 'Para revisar', tono: 'tone-perdido' },
  { k: 'porEnviar', t: 'Valorados sin enviar', tono: 'tone-captacion' },
  { k: 'enviados', t: 'Enviados con formulario', tono: 'tone-ganado' },
];
const leer = (k: string, d: string) => { try { return localStorage.getItem(k) ?? d; } catch { return d; } };
const guardar = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* sin almacenamiento */ } };

export default function Flash() {
  const toast = useToast();
  const { yo } = useCatalogo();
  const vq = useQuery(() => supabase.from('vendedores').select('*').order('fecha_ingreso', { ascending: false }));
  const aq = useQuery(() => supabase.from('ajustes').select('valor').eq('clave', 'flash_supuestos').maybeSingle());
  const A = useMemo(() => { try { return mezclar(JSON.parse((aq.data as Row | null)?.valor || '{}')); } catch { return mezclar(null); } }, [aq.data]);
  const [sel, setSel] = useState<Lead | null>(null);
  const [gmail, setGmail] = useState<{ estado: string; msg?: string; firma?: boolean; alias?: boolean; envio?: boolean }>({ estado: 'probando' });
  const [modo, setModo] = useState<Modo>(() => (['nada', 'borrador', 'enviar'].includes(leer('flash-modo', 'nada')) ? leer('flash-modo', 'nada') : 'nada') as Modo);
  const [lote, setLote] = useState<{ corriendo: boolean; pausa: boolean; i: number; n: number; estado: string; log: { t: string; k: string }[] }>({ corriendo: false, pausa: false, i: 0, n: 0, estado: '', log: [] });
  const pausaRef = useRef(false);
  const de: Remitente = { email: yo?.email ?? '', nombre: yo?.nombre ?? 'Equipo Relevo' };

  useEffect(() => { probarGmail().then(setGmail); }, []);

  const grupos = useMemo(() => {
    const todos = (vq.data || []) as Row[];
    const g: Record<Grupo, { L: Lead; why?: string[] }[]> = { flash: [], revisar: [], fuera: [], porEnviar: [], enviados: [] };
    const pend = todos.filter((v) => v.etapa === 'no_contactado' && (!v.valoracion_tipo || v.valoracion_tipo === 'no_valorada') && v.bucket === 'B').map(leadDe);
    marcarRepetidos(pend, todos);
    for (const L of pend) {
      const r = calcular(A, L);
      if (r.route === 'flash') { const why = motivosRevision(A, L); (why.length ? g.revisar : g.flash).push({ L, why }); }
    }
    for (const v of todos) {
      if (v.valoracion_tipo !== 'flash') continue;
      if (!v.flash_enviado_en && ['no_contactado', 'en_reserva'].includes(v.etapa)) g.porEnviar.push({ L: leadDe(v) });
      else if (v.flash_enviado_en) g.enviados.push({ L: leadDe(v) });
    }
    g.enviados.sort((a, b) => String(b.L.enviado).localeCompare(String(a.L.enviado)));
    g.enviados = g.enviados.slice(0, 40);
    return g;
  }, [vq.data, A]);

  const grupoDe = (id: string): Grupo | null => (Object.keys(grupos) as Grupo[]).find((k) => grupos[k].some((x) => x.L.id === id)) ?? null;
  // Mantiene la selección al recargar
  useEffect(() => { if (sel) { const f = (Object.values(grupos).flat().find((x) => x.L.id === sel.id)); if (f) setSel({ ...f.L, subsector: sel.subsector, subtipo: sel.subtipo, multManual: sel.multManual, sector: sel.sector }); } }, [grupos]); // eslint-disable-line react-hooks/exhaustive-deps

  const recargar = () => { vq.reload(); };
  const correrLote = async () => {
    const cola = grupos.flash.map((x) => x.L);
    if (!cola.length) return;
    pausaRef.current = false;
    const log: { t: string; k: string }[] = [];
    const res = { ok: 0, drafts: 0, failed: 0 };
    setLote({ corriendo: true, pausa: false, i: 0, n: cola.length, estado: 'Empezando…', log });
    for (let i = 0; i < cola.length; i++) {
      if (pausaRef.current) break;
      const L = cola[i];
      const head = `${i + 1} de ${cola.length} · ${L.nombre || L.empresa}`;
      const say = (t: string) => setLote((s) => ({ ...s, i, estado: `${head}: ${t}` }));
      try {
        const { r, draft } = await valorarYGuardar(A, L, { modo, soloCorreo: false, de, say });
        res.ok++; if (draft.made) res.drafts++;
        log.unshift({ t: `${L.nombre || L.empresa}: entre ${money(r.lo)} y ${money(r.hi)} M` + (draft.enviado ? ', enviado por correo' : draft.made ? ', borrador en Gmail' : draft.error ? `. El correo falló: ${draft.error}` : ` (${draft.skip})`), k: draft.error ? 'warn' : 'ok' });
      } catch (e: any) {
        res.failed++;
        log.unshift({ t: `${L.nombre || L.empresa}: ${e.message}`, k: 'err' });
        if (/autoriz|sesión|Google rechazó/i.test(e.message)) { log.unshift({ t: 'Detuve el lote porque el problema afecta a todos.', k: 'err' }); break; }
      }
      setLote((s) => ({ ...s, i: i + 1, log: [...log] }));
    }
    setLote((s) => ({ ...s, corriendo: false, i: s.n, estado: `${pausaRef.current ? 'Pausado' : 'Terminado'}: ${res.ok} valorados, ${res.drafts} ${modo === 'enviar' ? 'enviados' : 'borradores en Gmail'}, ${res.failed} con error.` }));
    recargar();
  };

  const nFlash = grupos.flash.length;
  return (
    <div className="page">
      <div className="head">
        <div><h1>Valoración flash</h1><p>Bucket B: valoración express en PDF y borrador en Gmail con el formulario "Cuéntanos tu caso".</p></div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <EstadoGmail g={gmail} />
          <button className="btn" onClick={recargar}><ArrowsClockwise className="ic" />Actualizar</button>
          {lote.corriendo
            ? <button className="btn" onClick={() => { pausaRef.current = true; setLote((s) => ({ ...s, pausa: true, estado: 'Se detiene al terminar el lead actual…' })); }} disabled={lote.pausa}><Pause className="ic" />Pausar</button>
            : <button className="btn primary" disabled={!nFlash || vq.loading} onClick={correrLote}><Lightning className="ic" />Valorar todos{nFlash ? ` (${nFlash})` : ''}</button>}
        </div>
      </div>

      {gmail.estado !== 'ok' && gmail.estado !== 'probando' && <GuiaGmail g={gmail} />}

      <div className="flash-opts">
        <label className="who">Al valorar
          <select className="sel" style={{ width: 'auto' }} value={modo} onChange={(e) => { setModo(e.target.value as Modo); guardar('flash-modo', e.target.value); }}>
            <option value="nada">Solo valorar (envío después, uno por uno)</option>
            <option value="borrador">Crear borrador en Gmail</option>
            <option value="enviar">Enviar el correo de una vez</option>
          </select>
        </label>
        <span className="muted">{modo === 'enviar' ? 'Ojo: sale de inmediato desde valoraciones@relevobrokers.com.' : 'Desde cada lead puedes revisar el correo y enviarlo con un botón.'}</span>
      </div>

      {(lote.corriendo || lote.log.length > 0) && (
        <div className="panel flash-lote">
          <div className="flash-bar"><i style={{ width: `${lote.n ? Math.round(lote.i / lote.n * 100) : 0}%` }} /></div>
          <p>{lote.estado}</p>
          {lote.log.length > 0 && <ul>{lote.log.map((l, i) => <li key={i} className={'lg-' + l.k}>{l.t}</li>)}</ul>}
        </div>
      )}

      {!vq.loading && !vq.error && <ResultadosForm todos={(vq.data || []) as Row[]} yo={de} onCambio={recargar} toast={toast} />}
      {vq.error ? <ErrorBox msg={vq.error} retry={vq.reload} /> : vq.loading ? <div className="panel"><Skeleton rows={8} /></div> : (
        <div className="flash-grid">
          <div className="flash-trays">
            {GRUPOS.map(({ k, t, tono }) => (
              <details key={k} className="panel flash-tray" open={k !== 'enviados' && k !== 'fuera' ? true : grupos[k].length > 0 && k === 'fuera'}>
                <summary><span className={'dot ' + tono} />{t}<span className="muted num">{grupos[k].length}</span><CaretDown className="ic caret" /></summary>
                {!grupos[k].length ? <p className="empty-state">{k === 'flash' ? 'Nada listo por ahora.' : 'Nada aquí.'}</p> : (
                  <ul>
                    {grupos[k].map(({ L, why }) => (
                      <li key={L.id}>
                        <button className={'flash-lead' + (sel?.id === L.id ? ' on' : '')} disabled={lote.corriendo} onClick={() => setSel({ ...L })}>
                          <b>{L.nombre || 'Sin nombre'}</b>
                          <em>{k === 'porEnviar' || k === 'enviados' ? (L.min && L.max ? `${money(L.min / 1e6)} a ${money(L.max / 1e6)} M` : 'Valorado') : (TRAMO_TEXTO[L.ventas] || '').replace(' millones', '')}</em>
                          <span>{L.empresa || 'Sin empresa'} · {k === 'enviados' ? 'enviado ' + fecha(L.enviado) : k === 'porEnviar' && L.fechaVal ? 'valorado ' + fecha(L.fechaVal) : L.sector}</span>
                          {why && why.length > 0 && <small className="why">{why.join(' · ')}</small>}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </details>
            ))}
            <Supuestos A={A} onSaved={aq.reload} />
          </div>

          {sel ? <Ficha key={sel.id} L={sel} setL={setSel} A={A} grupo={grupoDe(sel.id)} de={de} gmailOk={gmail.estado === 'ok'} envioOk={!!gmail.envio} ocupado={lote.corriendo} onDone={recargar} toast={toast} />
            : <div className="panel flash-vacio"><Lightning className="ic" /><p>Escoge un lead de la izquierda para ver su valoración, el PDF y el mensaje.</p><p className="muted">O usa <b>Valorar todos</b> para los {nFlash} que están listos.</p></div>}
        </div>
      )}
    </div>
  );
}

function EstadoGmail({ g }: { g: { estado: string; msg?: string; firma?: boolean; alias?: boolean; envio?: boolean } }) {
  const t = g.estado === 'ok' ? ['tone-ganado', g.firma ? 'Gmail conectado · con tu firma' : 'Gmail conectado · firma básica'] : g.estado === 'probando' ? ['tone-nuevo', 'Revisando Gmail…'] : g.estado === 'error' ? ['tone-perdido', 'Gmail con error'] : ['tone-mercado', 'Gmail sin conectar'];
  const ayuda = g.estado === 'ok' && !g.firma ? 'Para usar tu firma de Gmail, agrega el permiso https://www.googleapis.com/auth/gmail.settings.basic al cliente de la app en admin.google.com > Seguridad > Controles de API > Delegación de todo el dominio.' : g.msg;
  return (
    <>
      <span className={'tag ' + t[0]} title={ayuda}>{t[1]}</span>
      {g.estado === 'ok' && <span className={'tag ' + (g.alias ? 'tone-ganado' : 'tone-mercado')} title={g.alias ? 'Los borradores salen desde valoraciones@relevobrokers.com' : 'Agrega valoraciones@relevobrokers.com en Gmail > Configuración > Cuentas > Enviar como. Mientras tanto salen desde tu correo.'}>{g.alias ? 'Desde valoraciones@' : 'Desde tu correo'}</span>}
      {g.estado === 'ok' && !g.envio && <span className="tag tone-mercado" title="Para enviar desde la app, agrega https://www.googleapis.com/auth/gmail.send a la delegación de dominio en admin.google.com. Mientras tanto solo se crean borradores.">Solo borradores</span>}
    </>
  );
}

function GuiaGmail({ g }: { g: { estado: string; msg?: string } }) {
  return (
    <details className="panel cal-guia" style={{ marginBottom: 14 }}>
      <summary><b>Conectar Gmail para crear los borradores</b> <span className="muted">Una vez, unos 20 minutos, lo hace Felipe (admin de Google Workspace). Sin llaves: Google no deja crearlas.</span></summary>
      {g.msg && <p className="aviso" style={{ margin: '0 16px 8px' }}>{g.msg}</p>}
      <ol>
        <li>En <b>console.cloud.google.com</b>, proyecto <b>Relevo App</b>: habilita <b>Gmail API</b>, <b>IAM Service Account Credentials API</b> y <b>Security Token Service API</b>. Crea la cuenta de servicio <b>relevo-gmail</b> (sin roles, sin llave).</li>
        <li><b>IAM y administración, Workload Identity Federation, Crear grupo</b>: nombre e ID <code>vercel</code>. Proveedor OpenID Connect, ID <code>vercel</code>, URL del emisor <code>https://oidc.vercel.com/juanfepardo1s-projects</code>, público permitido <code>https://vercel.com/juanfepardo1s-projects</code>, mapeo <code>google.subject = assertion.sub</code>.</li>
        <li>En <b>relevo-gmail, Principales con acceso, Otorgar acceso</b>: principal <code>principal://iam.googleapis.com/projects/NÚMERO_DEL_PROYECTO/locations/global/workloadIdentityPools/vercel/subject/owner:juanfepardo1s-projects:project:relevo_app:environment:production</code>, rol <b>Creador de tokens de cuenta de servicio</b>.</li>
        <li><b>admin.google.com, Seguridad, Control de acceso y de datos, Controles de API, Delegación de todo el dominio, Agregar nuevo</b>: ID único de relevo-gmail y permiso <code>https://www.googleapis.com/auth/gmail.compose</code>.</li>
        <li>En Vercel, proyecto relevo_app: <b>Settings, Security</b>, OIDC Federation activado (modo Team). En <b>Environment Variables</b>: <code>GCP_PROJECT_NUMBER</code> y <code>GCP_SERVICE_ACCOUNT_EMAIL</code>. <b>Redeploy</b>.</li>
        <li>Recarga esta página: arriba debe decir <b>Gmail conectado</b>.</li>
      </ol>
      <p className="muted" style={{ margin: '0 16px 14px' }}>El permiso solo deja crear borradores y enviar desde las cuentas @relevobrokers.com; no deja leer correos. Cada uno ve el borrador en su propio Gmail.</p>
    </details>
  );
}

function Ficha({ L, setL, A, grupo, de, gmailOk, envioOk, ocupado, onDone, toast }: { L: Lead; setL: (l: Lead) => void; A: Supuestos; grupo: Grupo | null; de: Remitente; gmailOk: boolean; envioOk: boolean; ocupado: boolean; onDone: () => void; toast: (m: string, e?: boolean) => void }) {
  const r = calcular(A, L);
  const m = mensaje(A, L, r);
  const [asunto, setAsunto] = useState(m.asunto);
  const [cuerpo, setCuerpo] = useState(m.cuerpo);
  const [editado, setEditado] = useState(false);
  const [busy, setBusy] = useState('');
  const [draftUrl, setDraftUrl] = useState('');
  const [vista, setVista] = useState(false);
  useEffect(() => { if (!editado) { setAsunto(m.asunto); setCuerpo(m.cuerpo); } }, [m.asunto, m.cuerpo, editado]);
  const pags = useMemo(() => (r.route === 'flash' && !r.excluido ? paginas(A, L, r) : []), [A, L, r.lo, r.hi, r.route]); // eslint-disable-line react-hooks/exhaustive-deps
  const yaValorado = grupo === 'porEnviar' || grupo === 'enviados';
  const rangoGuardadoDistinto = yaValorado && L.min != null && L.max != null && (r.lo * 1e6 !== L.min || r.hi * 1e6 !== L.max);

  const persistir = async (c: Partial<Lead>) => {
    const n = { ...L, ...c };
    if (c.subsector !== undefined) n.sector = c.subsector ? (SUBS.find((s) => s.id === c.subsector)?.padre || L.sector) : leadDe({ sector: L.sectorApp } as Row).sector;
    setL(n);
    if (yaValorado) return; // un lead valorado no cambia sus datos guardados
    await supabase.from('vendedores').update({ flash_subsector: n.subsector, flash_subtipo: n.subtipo || 0, flash_mult: n.multManual ? Number(n.multManual.replace(',', '.')) || null : null }).eq('id', L.id);
  };
  const correr = async (etiqueta: string, fn: () => Promise<void>) => {
    setBusy(etiqueta);
    try { await fn(); } catch (e: any) { toast(e.message, true); }
    setBusy('');
  };
  const valorar = () => correr('Valorando…', async () => {
    const { r: rr } = await valorarYGuardar(A, L, { modo: 'nada', soloCorreo: false, de, say: setBusy, asunto, cuerpo });
    toast(`Listo: valorado entre ${money(rr.lo)} y ${money(rr.hi)} M. Ahora revisa el correo y envíalo.`);
    onDone();
  });
  const enviarYa = () => correr('Enviando…', async () => {
    if (!window.confirm(`¿Enviar ahora la valoración a ${L.correo} desde ${REMITENTE}?`)) return;
    const d = await borradorDeValorado(A, L, de, asunto, cuerpo, 'enviar');
    if (!d.made) throw new Error(d.skip ? 'No se envió: ' + d.skip : d.error);
    toast('Enviado desde valoraciones@. Quedó en Val. flash enviada.'); onDone();
  });
  const soloBorrador = () => correr('Creando borrador…', async () => {
    const d = grupo === 'fuera' ? await crearBorrador(L, asunto, cuerpo, de, null) : await borradorDeValorado(A, L, de, asunto, cuerpo);
    if (!d.made) throw new Error(d.skip ? 'No se creó: ' + d.skip : 'Gmail: ' + d.error);
    setDraftUrl(d.url || ''); toast('Borrador creado en el Gmail de valoraciones@. Envíalo y luego marca Enviado.');
  });
  const enviado = () => correr('Guardando…', async () => { await marcarEnviado(L, grupo === 'fuera' ? 'fuera' : 'flash'); toast(grupo === 'fuera' ? 'Listo: quedó en Perdido (empresa muy pequeña).' : 'Listo: quedó en Val. flash enviada esperando el formulario.'); onDone(); });
  const descargar = () => correr('Armando el PDF…', async () => {
    const blob = await generarPdf(pags, 0.9);
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = nombreArchivo(L); a.click(); setTimeout(() => URL.revokeObjectURL(url), 2000);
  });
  const sec = A.sectors[L.sector] || A.sectors['Otro'];
  const subsActual = subOf(A, L.subsector);

  return (
    <div className="flash-ficha">
      <Modal open={vista} onClose={() => setVista(false)} title={`Vista previa: ${asunto}`}>
        <p className="muted" style={{ fontSize: 12.5, marginBottom: 8 }}>De {REMITENTE} para {L.correo || 'sin correo'}. Lleva el PDF adjunto. Firma: Equipo Relevo.</p>
        <iframe title="Vista previa del correo" style={{ width: '100%', height: '70vh', border: '1px solid var(--line)', borderRadius: 10, background: '#fff' }}
          srcDoc={htmlCorreo(L, cuerpo, r.route === 'flash' ? { lo: L.min != null ? L.min / 1e6 : r.lo, hi: L.max != null ? L.max / 1e6 : r.hi } : null).replace('<!--FIRMA-->', firmaRespaldo())} />
      </Modal>
      <section className="panel">
        <header>
          <div><h2>{L.nombre || 'Sin nombre'}</h2><p className="muted">{[L.empresa || 'Sin empresa', L.ciudad].filter(Boolean).join(' · ')}</p></div>
          <Link className="btn ghost" to={`/vendedores/${L.id}`}><ArrowSquareOut className="ic" />Ficha</Link>
        </header>
        <div className="body flash-datos">
          <div className="flash-contacto"><span>Celular <b>{L.celular || 'sin dato'}</b></span><span>Correo <b>{L.correo || 'sin dato'}</b></span><span>Prefiere <b>{L.canal}</b></span><span>Ventas <b>{TRAMO_TEXTO[L.ventas]}</b></span></div>
          <div className="flash-campos">
            <label>Subsector
              <select className="sel" value={L.subsector} disabled={yaValorado} onChange={(e) => persistir({ subsector: e.target.value, subtipo: 0 })}>
                <option value="">Sin subsector: usa el sector ({L.sector})</option>
                {SECTORS.map((p) => <optgroup key={p} label={p}>{SUBS.filter((s) => s.padre === p).map((s0) => { const s = subOf(A, s0.id)!; return <option key={s.id} value={s.id}>{s.nombre}{s.confianza === 'Excluido' ? ' (no se valora)' : ` · ${dec(s.margen!, 1)}% · ${fmtAdj(s.ajuste!)}`}</option>; })}</optgroup>)}
              </select>
            </label>
            {sec.alt && !L.subsector && (
              <label>Tipo de negocio
                <select className="sel" value={String(L.subtipo ? 1 : 0)} disabled={yaValorado} onChange={(e) => persistir({ subtipo: Number(e.target.value) })}>
                  <option value="0">{sec.alt.base} ({fmtAdj(sec.ajuste)})</option><option value="1">{sec.alt.label} ({fmtAdj(sec.alt.ajuste)})</option>
                </select>
              </label>
            )}
            <label>Múltiplo manual (opcional)<input className="in num" placeholder="Ej.: 3,5" disabled={yaValorado} defaultValue={L.multManual} onBlur={(e) => e.target.value.trim() !== L.multManual && persistir({ multManual: e.target.value.trim() })} /></label>
          </div>
          {subsActual && <p className="muted" style={{ fontSize: 12.5 }}>{subsActual.razon}{subsActual.ciiu ? ` · CIIU ${subsActual.ciiu}` : ''}</p>}
        </div>
      </section>

      <section className="panel">
        <header><h2>{r.route === 'flash' ? 'Rango que va en el PDF' : r.route === 'fuera' ? 'Solo mensaje' : 'No va por flash'}</h2>{r.route === 'flash' && <span className="flash-rango num">{money(r.lo)} a {money(r.hi)} M</span>}</header>
        <div className="body">
          <p className="muted" style={{ marginBottom: 10 }}>{r.why}</p>
          {r.route === 'flash' && (
            <div className="flash-calc">
              <div><span>Ventas usadas (M)</span><b>{money(r.vLo)} a {money(r.vHi)}</b></div>
              <div><span>Margen EBITDA</span><b>{dec(r.mLo, 1)}%</b></div>
              <div><span>EBITDA (M)</span><b>{money(r.eLo)} a {money(r.eHi)}</b></div>
              <div><span>Múltiplo</span><b>{Math.abs(r.xLo - r.xHi) < 0.005 ? `${dec(r.xLo, 2)}x` : `${dec(r.xLo, 2)}x a ${dec(r.xHi, 2)}x`}</b></div>
            </div>
          )}
          {(r.flags.length > 0 || rangoGuardadoDistinto) && <ul className="flash-flags">
            {rangoGuardadoDistinto && <li><Warning className="ic" />El rango guardado ({money(L.min! / 1e6)} a {money(L.max! / 1e6)} M) no coincide con el cálculo de hoy. El PDF guardado en la ficha usa el rango guardado.</li>}
            {r.flags.map((f, i) => <li key={i}><Warning className="ic" />{f}</li>)}
          </ul>}
        </div>
      </section>

      <section className="panel">
        <header><h2>Mensaje</h2><span className="muted">{L.correo ? `Correo a ${L.correo}` : 'Sin correo'}</span></header>
        <div className="body flash-msg">
          <label>Asunto<input className="in" value={asunto} onChange={(e) => { setAsunto(e.target.value); setEditado(true); }} /></label>
          <textarea className="in" rows={8} value={cuerpo} onChange={(e) => { setCuerpo(e.target.value); setEditado(true); }} />
          <div className="flash-acciones">
            {grupo === 'flash' || grupo === 'revisar' ? (
              <button className="btn primary" disabled={!!busy || ocupado || r.excluido} onClick={valorar}><Lightning className="ic" />{busy || 'Valorar y guardar'}</button>
            ) : grupo === 'porEnviar' || grupo === 'fuera' ? (
              <>
                {L.correo && gmailOk && envioOk && <button className="btn primary" disabled={!!busy || ocupado} onClick={enviarYa}><EnvelopeSimple className="ic" />{busy || 'Enviar correo'}</button>}
                {L.correo && gmailOk && !envioOk && <button className="btn" disabled={!!busy || ocupado} onClick={soloBorrador}><EnvelopeSimple className="ic" />Crear borrador en Gmail</button>}
                {!L.correo && <span className="muted" style={{ fontSize: 12.5 }}>Sin correo: los B se atienden solo por correo.</span>}
                <button className={'btn' + (L.correo && envioOk ? ' ghost' : ' primary')} disabled={!!busy || ocupado} onClick={enviado}><Check className="ic" />{grupo === 'fuera' ? 'Marcar mensaje enviado' : 'Ya lo envié por otro lado'}</button>
              </>
            ) : null}
            {L.correo && <button className="btn ghost" onClick={() => setVista(true)}><ArrowSquareOut className="ic" />Ver correo</button>}
            <button className="btn ghost" onClick={() => navigator.clipboard.writeText(cuerpo).then(() => toast('Mensaje copiado'))}><Copy className="ic" />Copiar</button>
            {pags.length > 0 && <button className="btn ghost" disabled={!!busy} onClick={descargar}><DownloadSimple className="ic" />PDF</button>}
            {draftUrl && <a className="btn ghost" href={draftUrl} target="_blank" rel="noopener"><ArrowSquareOut className="ic" />Abrir Gmail</a>}
          </div>
          {grupo === 'revisar' && <p className="aviso">Está en revisión, no entra al lote. Si lo revisaste y está bien, valóralo con el botón.</p>}
        </div>
      </section>

      {pags.length > 0 && (
        <section className="panel">
          <header><h2>Vista previa del PDF</h2><span className="muted">3 páginas, carta</span></header>
          <div className="body flash-prev"><iframe title="Vista previa del PDF" srcDoc={documento(pags, 0.5)} /></div>
        </section>
      )}
    </div>
  );
}

function Supuestos({ A, onSaved }: { A: Supuestos; onSaved: () => void }) {
  const toast = useToast();
  const [draft, setDraft] = useState<Supuestos>(A);
  useEffect(() => setDraft(A), [A]);
  const num = (s: string) => Number(String(s).replace(/\./g, '').replace(',', '.'));
  const save = async (n: Supuestos) => {
    setDraft(n);
    const { subs, ...rest } = n; void subs;
    const diff: Partial<Supuestos> = { ...rest, subs: n.subs };
    try { await must(supabase.from('ajustes').upsert({ clave: 'flash_supuestos', valor: JSON.stringify(diff), updated_at: new Date().toISOString() })); toast('Supuesto guardado para los dos'); onSaved(); }
    catch (e: any) { toast(e.message, true); }
  };
  const campo = (v: number, on: (x: number) => void, d = 1) => <input className="in num" defaultValue={dec(v, d)} key={v} onBlur={(e) => { const x = num(e.target.value); if (isFinite(x) && x !== v) on(x); }} />;
  return (
    <details className="panel flash-tray flash-sup">
      <summary><span className="dot tone-nuevo" />Supuestos (iguales para los dos)<CaretDown className="ic caret" /></summary>
      <div className="body">
        <h3>Múltiplo por tamaño de EBITDA (M)</h3>
        <table className="t"><tbody>{draft.ladder.map((s, i) => { const prev = i === 0 ? 0 : draft.ladder[i - 1].hasta!; return (
          <tr key={i}><td>{s.hasta === null ? `Más de ${money(prev).slice(1)}` : i === 0 ? `Menos de ${money(s.hasta).slice(1)}` : `${money(prev).slice(1)} a ${money(s.hasta).slice(1)}`}</td>
            <td>{campo(s.mult, (x) => save({ ...draft, ladder: draft.ladder.map((l, j) => (j === i ? { ...l, mult: x } : l)) }))}</td></tr>); })}</tbody></table>
        <label className="who"><input type="checkbox" checked={draft.suave} onChange={(e) => save({ ...draft, suave: e.target.checked })} />Suavizar entre escalones</label>
        <h3>Sector: margen EBITDA % y ajuste al múltiplo</h3>
        <table className="t"><thead><tr><th>Sector</th><th>Margen</th><th>Ajuste</th><th>Si aplica</th></tr></thead><tbody>{SECTORS.map((s) => { const x = draft.sectors[s]; return (
          <tr key={s}><td>{s}</td><td>{campo(x.margen, (v) => save({ ...draft, sectors: { ...draft.sectors, [s]: { ...x, margen: v } } }))}</td>
            <td>{campo(x.ajuste, (v) => save({ ...draft, sectors: { ...draft.sectors, [s]: { ...x, ajuste: v } } }))}</td>
            <td>{x.alt ? <span title={x.alt.label}>{campo(x.alt.ajuste, (v) => save({ ...draft, sectors: { ...draft.sectors, [s]: { ...x, alt: { ...x.alt!, ajuste: v } } } }))}</span> : <span className="muted">No aplica</span>}</td></tr>); })}</tbody></table>
        <h3>Ventas representativas por tramo (M)</h3>
        <table className="t"><tbody>{['1000_2000', '2000_3000', '3000_5000', '2000_5000'].map((k) => (
          <tr key={k}><td>{TRAMO_TEXTO[k]}</td><td>{campo(draft.tramos[k][0], (v) => save({ ...draft, tramos: { ...draft.tramos, [k]: [v, draft.tramos[k][1]] } }), 0)}</td><td>{campo(draft.tramos[k][1], (v) => save({ ...draft, tramos: { ...draft.tramos, [k]: [draft.tramos[k][0], v] } }), 0)}</td></tr>))}</tbody></table>
        <button className="btn ghost" onClick={() => { if (confirm('¿Volver a los supuestos originales del artefacto?')) save({ ...DEFAULTS }); }}>Volver a los originales</button>
      </div>
    </details>
  );
}

/** Resultados del formulario: los números de la hipótesis, quién pidió llamada y a quién recordarle por WhatsApp. */
function ResultadosForm({ todos, yo, onCambio, toast }: { todos: Row[]; yo: Remitente; onCambio: () => void; toast: (m: string, e?: boolean) => void }) {
  const q = useQuery(() => supabase.from('formulario_respuestas').select('vendedor_id, respuestas, created_at').order('created_at', { ascending: false }));
  const [abierto, setAbierto] = useState(true);
  const [prox, setProx] = useState<Awaited<ReturnType<typeof proximosRecordatorios>> | null>(null);
  const [enviando, setEnviando] = useState('');
  useEffect(() => { proximosRecordatorios().then(setProx); }, [todos.length]);
  if (q.error || q.loading) return null;
  const ultimo = new Map<string, Respuesta>();
  for (const x of (q.data || []) as Row[]) if (!ultimo.has(x.vendedor_id)) ultimo.set(x.vendedor_id, x.respuestas);
  const enviados = todos.filter((v) => v.form_enviado_en).length;
  const e = embudo([...ultimo.values()]);
  const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : '·');
  const items: [string, string, string][] = [
    ['Respondieron', `${e.n}`, `de ${enviados} enviados (${pct(e.n, enviados)})`],
    ['Ya conversaron con un comprador', pct(e.conv, e.n), `${e.conv} de ${e.n}`],
    ['Llegaron a precio o forma de pago', pct(e.avanz, e.conv), `${e.avanz} de ${e.conv} que conversaron`],
    ['Frenados por plata', pct(e.plata, e.conv), `${e.plata} de ${e.conv} que conversaron`],
    ['Precio sin valoración profesional', pct(e.sinBase, e.n), `${e.sinBase} de ${e.n}`],
    ['Aceptan parte en cuotas', pct(e.cuotas, e.n), `${e.cuotas} de ${e.n}`],
  ];
  // Pidieron llamada y siguen a cargo de Valoraciones: alguien del equipo los toma
  const llamar = todos.filter((v) => ultimo.get(v.id)?.llamada === 'si' && v.responsable === REMITENTE);
  // Recibieron su flash antes del formulario: hay que invitarlos por correo
  const sinForm = todos.filter((v) => v.bucket === 'B' && v.flash_enviado_en && !v.form_enviado_en && !v.form_respondido_en && v.correo && v.etapa === 'en_reserva');
  const invitar = async (lista: Row[]) => {
    if (!window.confirm(lista.length > 1 ? `¿Enviar el formulario a ${lista.length} personas desde ${REMITENTE}?` : `¿Enviar el formulario a ${lista[0].correo}?`)) return;
    let ok = 0;
    for (const v of lista) {
      setEnviando(v.id);
      try { await enviarFormulario(v); ok++; } catch (err: any) { toast(`${v.empresa || v.nombre}: ${err.message}`, true); if (/permiso|autoriz/i.test(err.message)) break; }
    }
    setEnviando(''); toast(`Formulario enviado a ${ok} de ${lista.length}`); onCambio();
  };
  const tomar = async (v: Row) => {
    try {
      await must(supabase.from('vendedores').update({ responsable: yo.email, etapa: 'contactado', ultimo_contacto: hoy() }).eq('id', v.id));
      await supabase.from('actividades').insert({ vendedor_id: v.id, tipo: 'nota', resumen: `${yo.nombre} tomó el caso: pidió llamada en el formulario.` });
      toast(`${v.nombre || v.empresa} quedó a tu nombre y en Contactado`); onCambio();
    } catch (err: any) { toast(err.message, true); }
  };
  return (
    <section className="panel" style={{ marginBottom: 14 }}>
      <header><h2>Formulario "Cuéntanos tu caso"</h2><button className="btn ghost" onClick={() => setAbierto(!abierto)}>{abierto ? 'Ocultar' : 'Ver'}</button></header>
      {abierto && <>
        <dl className="kpis" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', margin: 0, padding: 14 }}>
          {items.map(([l, v, d]) => <div key={l}><dt>{l}</dt><dd className="num">{v}</dd><span className="muted" style={{ fontSize: 12 }}>{d}</span></div>)}
        </dl>
        <div className="flash-pend">
          <div>
            <h3>Pidieron llamada <span className="muted num">{llamar.length}</span></h3>
            {!llamar.length ? <p className="muted">Nadie por ahora.</p> : <ul>{llamar.map((v) => {
              const r = ultimo.get(v.id)!; const wa = waLink(v.celular);
              return <li key={v.id}><Link to={`/vendedores/${v.id}`}><b>{v.nombre || 'Sin nombre'}</b> · {v.empresa || 'Sin empresa'}</Link><span className="muted">{etiqueta('quien', r.quien)}{r.avance ? ' · ' + etiqueta('avance', r.avance) : ''}</span>
                <span className="acc">{wa && <a className="btn ghost" href={wa} target="_blank" rel="noopener">WhatsApp</a>}<button className="btn primary" onClick={() => tomar(v)}>Lo tomo</button></span></li>;
            })}</ul>}
          </div>
          <div>
            <h3>Recibieron la flash sin formulario <span className="muted num">{sinForm.length}</span>{sinForm.length > 1 && <button className="btn ghost" style={{ marginLeft: 'auto', minHeight: 26 }} disabled={!!enviando} onClick={() => invitar(sinForm)}>Enviar a todos</button>}</h3>
            {!sinForm.length ? <p className="muted">Nadie pendiente.</p> : <ul>{sinForm.map((v) => (
              <li key={v.id}><Link to={`/vendedores/${v.id}`}><b>{v.nombre || 'Sin nombre'}</b> · {v.empresa || 'Sin empresa'}</Link><span className="muted">Flash enviada el {fecha(v.flash_enviado_en)}</span>
                <span className="acc"><button className="btn" disabled={!!enviando} onClick={() => invitar([v])}>{enviando === v.id ? 'Enviando…' : 'Enviar formulario'}</button></span></li>
            ))}</ul>}
          </div>
          <div>
            <h3>Recordatorios automáticos <span className="muted num">{prox?.pendientes?.length ?? '·'}</span></h3>
            {!prox ? <p className="muted">Revisando…</p> : !prox.ok ? <p className="err-text">{prox.error}</p> : (
              <>
                <p className="muted">{prox.cronListo ? 'Activos: salen de lunes a viernes a las 9 a. m. (a los 2 y a los 5 días sin respuesta).' : 'Falta CRON_SECRET en Vercel: no van a salir solos.'}</p>
                {!!prox.pendientes?.length && <ul style={{ marginTop: 6 }}>{prox.pendientes.map((x) => <li key={x.id}><Link to={`/vendedores/${x.id}`}><b>{x.nombre || 'Sin nombre'}</b> · {x.empresa || 'Sin empresa'}</Link><span className="muted">Próximo: recordatorio {x.recordatorio} de 2</span></li>)}</ul>}
              </>
            )}
          </div>
        </div>
      </>}
    </section>
  );
}
