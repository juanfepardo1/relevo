import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, X, CalendarBlank, WhatsappLogo, Phone, FilePdf, PaperPlaneTilt, Calculator, Archive, UserMinus } from '@phosphor-icons/react';
import { supabase, must, type Row } from '../lib/supabase';
import { useQuery } from '../lib/data';
import { fechaHora } from '../lib/format';
import { habilesDesde, diasDesde } from '../lib/habiles';
import { CLAVE_RECORDATORIO, estadoRecordatorios, escalonValoracion, PLAZO_VALORACION, type Aviso } from '../lib/alertas';
import { useToast } from './ui';

/** Botones para mover un vendedor por las etapas de captación y valoración, usados en Inicio y en la ficha. */

async function mover(id: string, etapa: string | null, resumen: string, extra: Row = {}, tipo = 'nota', clave: string | null = null) {
  if (etapa || Object.keys(extra).length) await must(supabase.from('vendedores').update({ ...(etapa ? { etapa } : {}), ...extra }).eq('id', id));
  await must(supabase.from('actividades').insert({ vendedor_id: id, tipo, resumen, clave }));
}

const aLocal = (iso: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 16);
};

function FechaReunion({ valor, texto, onGuardar }: { valor?: string | null; texto: string; onGuardar: (iso: string) => Promise<void> }) {
  const [v, setV] = useState(aLocal(valor ?? null));
  const [busy, setBusy] = useState(false);
  return (
    <span className="acciones">
      <input className="in" type="datetime-local" value={v} onChange={(e) => setV(e.target.value)} aria-label="Fecha y hora de la reunión" />
      <button className="btn primary" disabled={!v || busy} onClick={async () => { setBusy(true); await onGuardar(new Date(v).toISOString()); setBusy(false); }}><CalendarBlank className="ic" />{texto}</button>
    </span>
  );
}

/** Acciones de la etapa Reunión agendada cuando ya pasó la hora. */
function ReunionPaso({ id, reunionEn, onCambio }: { id: string; reunionEn: string | null; onCambio: () => void }) {
  const toast = useToast();
  const [reagendar, setReagendar] = useState(false);
  const cuando = reunionEn ? fechaHora(reunionEn) : '';
  const run = (f: () => Promise<unknown>, ok: string) => async () => { try { await f(); toast(ok); onCambio(); } catch (e: any) { toast(e.message, true); } };
  if (reagendar) return <FechaReunion texto="Reagendar" onGuardar={async (iso) => { await run(() => mover(id, null, `Se reagendó la reunión del ${cuando} para el ${fechaHora(iso)}.`, { reunion_en: iso }), 'Reunión reagendada')(); }} />;
  return (
    <span className="acciones">
      <button className="btn primary" onClick={run(() => mover(id, 'reunion_hecha', `Reunión hecha (${cuando}).`, {}, 'reunion'), 'Pasó a Reunión hecha')}><Check className="ic" />Se hizo</button>
      <button className="btn" onClick={run(() => mover(id, 'contactado', `No asistió a la reunión del ${cuando}.`, { reunion_en: null }), 'Volvió a Contactado')}><X className="ic" />No asistió</button>
      <button className="btn" onClick={() => setReagendar(true)}><CalendarBlank className="ic" />Se reagendó</button>
    </span>
  );
}

function Recordar({ id, n, onCambio }: { id: string; n: number; onCambio: () => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const hecho = (canal: 'whatsapp' | 'llamada') => async () => {
    setBusy(true);
    try { await mover(id, null, `Recordatorio de documentos ${n} de 3 por ${canal === 'whatsapp' ? 'WhatsApp' : 'llamada'}.`, {}, canal, CLAVE_RECORDATORIO); toast('Recordatorio registrado'); onCambio(); }
    catch (e: any) { toast(e.message, true); }
    setBusy(false);
  };
  return (
    <span className="acciones">
      <span className="meta">Ya le recordé por</span>
      <button className="btn" disabled={busy} onClick={hecho('whatsapp')}><WhatsappLogo className="ic" />WhatsApp</button>
      <button className="btn" disabled={busy} onClick={hecho('llamada')}><Phone className="ic" />Llamada</button>
    </span>
  );
}

function Vincular({ reunionId, onCambio }: { reunionId: string; onCambio: () => void }) {
  const toast = useToast();
  const q = useQuery(() => supabase.from('vendedores').select('id,empresa,nombre,etapa,correo').not('etapa', 'in', '(cerrado,perdido)').order('empresa'));
  const [sel, setSel] = useState('');
  const vincular = async () => {
    try {
      const r = (await must(supabase.from('reuniones').update({ vendedor_id: sel }).eq('id', reunionId).select('inicio,evento').single())) as Row;
      const v = ((q.data || []) as Row[]).find((x) => x.id === sel);
      const temprano = ['no_contactado', 'contactado', 'val_preliminar'].includes(v?.etapa);
      await mover(sel, temprano ? 'reunion_agendada' : null, `Reunión de Calendly vinculada a mano: ${r.evento ?? 'reunión'} el ${fechaHora(r.inicio)}.`, temprano || v?.etapa === 'reunion_agendada' ? { reunion_en: r.inicio } : {}, 'reunion');
      toast('Reunión vinculada'); onCambio();
    } catch (e: any) { toast(e.message, true); }
  };
  return (
    <span className="acciones">
      <select className="sel" value={sel} onChange={(e) => setSel(e.target.value)} aria-label="Vendedor">
        <option value="">Elige el vendedor</option>
        {((q.data || []) as Row[]).map((v) => <option key={v.id} value={v.id}>{v.empresa || v.nombre}</option>)}
      </select>
      <button className="btn primary" disabled={!sel} onClick={vincular}>Vincular</button>
    </span>
  );
}

/** Botones de un aviso en Inicio. Las alertas sin acción no muestran nada (se resuelven en la ficha). */
export function AvisoBotones({ a, onCambio }: { a: Aviso; onCambio: () => void }) {
  const toast = useToast();
  const id = a.vendedorId!;
  switch (a.tipo) {
    case 'reunion_fecha':
      return <FechaReunion texto="Guardar" onGuardar={async (iso) => { try { await mover(id, null, `Reunión agendada para el ${fechaHora(iso)}.`, { reunion_en: iso }); toast('Fecha guardada'); onCambio(); } catch (e: any) { toast(e.message, true); } }} />;
    case 'reunion_paso':
      return <ReunionPasoCarga id={id} onCambio={onCambio} />;
    case 'recordar_docs':
      return <Recordar id={id} n={a.n ?? 1} onCambio={onCambio} />;
    case 'reserva':
      return <span className="acciones"><button className="btn" onClick={async () => { try { await mover(id, 'en_reserva', 'Pasó a En reserva: no envió documentos tras 3 recordatorios.'); toast('Pasó a En reserva'); onCambio(); } catch (e: any) { toast(e.message, true); } }}><Archive className="ic" />Pasar a En reserva</button></span>;
    case 'reunion_sin_vincular':
      return <Vincular reunionId={a.reunionId!} onCambio={onCambio} />;
    default:
      return null;
  }
}

function ReunionPasoCarga({ id, onCambio }: { id: string; onCambio: () => void }) {
  const q = useQuery<Row>(() => supabase.from('vendedores').select('reunion_en').eq('id', id).single(), [id]);
  if (q.loading) return null;
  return <ReunionPaso id={id} reunionEn={q.data?.reunion_en ?? null} onCambio={onCambio} />;
}

/** Panel "Siguiente paso" de la ficha del vendedor según su etapa. */
export function SiguientePaso({ v, onCambio }: { v: Row; onCambio: () => void }) {
  const toast = useToast();
  const hist = useQuery<Row | null>(() => supabase.from('etapa_historial').select('desde').eq('entidad', 'vendedor').eq('entidad_id', v.id).is('hasta', null).maybeSingle(), [v.id, v.etapa]);
  const recs = useQuery(() => supabase.from('actividades').select('fecha').eq('vendedor_id', v.id).eq('clave', CLAVE_RECORDATORIO), [v.id, v.etapa]);
  const reu = useQuery<Row>(() => supabase.from('vendedores').select('reunion_en').eq('id', v.id).single(), [v.id, v.etapa]);
  const [noSigue, setNoSigue] = useState(false);
  const reunionEn = (reu.data?.reunion_en ?? null) as string | null;
  const desde = hist.data?.desde as string | undefined;
  const recargar = () => { onCambio(); recs.reload(); hist.reload(); reu.reload(); };
  const run = (f: () => Promise<unknown>, ok: string) => async () => { try { await f(); toast(ok); recargar(); } catch (e: any) { toast(e.message, true); } };

  let cuerpo: JSX.Element | null = null;
  let texto = '';
  switch (v.etapa) {
    case 'reunion_agendada':
      if (reu.loading) break;
      if (!reunionEn) { texto = 'Indica para cuándo quedó la reunión.'; cuerpo = <FechaReunion texto="Guardar" onGuardar={async (iso) => run(() => mover(v.id, null, `Reunión agendada para el ${fechaHora(iso)}.`, { reunion_en: iso }), 'Fecha guardada')()} />; }
      else if (new Date(reunionEn).getTime() < Date.now()) { texto = `La reunión era el ${fechaHora(reunionEn)}. ¿Se hizo?`; cuerpo = <ReunionPaso id={v.id} reunionEn={reunionEn} onCambio={recargar} />; }
      else { texto = `Reunión el ${fechaHora(reunionEn)}.`; cuerpo = <FechaReunion valor={reunionEn} texto="Cambiar fecha" onGuardar={async (iso) => run(() => mover(v.id, null, `Se movió la reunión para el ${fechaHora(iso)}.`, { reunion_en: iso }), 'Fecha cambiada')()} />; }
      break;
    case 'reunion_hecha':
      texto = 'Envía el NDA y la lista de documentos antes de 48 horas.';
      cuerpo = noSigue ? (
        <span className="acciones">
          <span className="meta">¿No quiere seguir?</span>
          <button className="btn danger" onClick={run(() => mover(v.id, 'perdido', 'No quiso seguir después de la reunión: no quiso recibir NDA ni lista de documentos.', { motivo_perdida: 'desistio' }), 'Pasó a Perdido')}>Sí, pasar a Perdido</button>
          <button className="btn ghost" onClick={() => setNoSigue(false)}>Cancelar</button>
        </span>
      ) : (
        <span className="acciones">
          <Link className="btn" to={`/documentos?tipo=nda&vendedor=${v.id}`}><FilePdf className="ic" />Generar NDA</Link>
          <button className="btn primary" onClick={run(() => mover(v.id, 'nda_docs', 'Se enviaron el NDA y la lista de documentos.', {}, 'correo'), 'Pasó a NDA + docs solicitados')}><PaperPlaneTilt className="ic" />Ya los envié</button>
          <button className="btn ghost" onClick={() => setNoSigue(true)}><UserMinus className="ic" />No quiere seguir</button>
        </span>
      );
      break;
    case 'nda_docs': {
      if (!desde) break;
      const hab = habilesDesde(desde);
      const hechos = ((recs.data || []) as Row[]).filter((r) => r.fecha >= desde).length;
      const e = estadoRecordatorios(hab, hechos);
      texto = `Lleva ${hab} ${hab === 1 ? 'día hábil' : 'días hábiles'}. Recordatorios: ${hechos} de 3.` + (e.reserva ? ' Ya toca pasarlo a En reserva.' : e.pendiente ? ' Toca recordarle hoy.' : e.siguienteEn != null ? ` El siguiente en ${e.siguienteEn} ${e.siguienteEn === 1 ? 'día hábil' : 'días hábiles'}.` : '') + ' Al subir los documentos recibidos pasa solo a Docs recibidos.';
      cuerpo = e.reserva ? <button className="btn" onClick={run(() => mover(v.id, 'en_reserva', 'Pasó a En reserva: no envió documentos tras 3 recordatorios.'), 'Pasó a En reserva')}><Archive className="ic" />Pasar a En reserva</button>
        : hechos < 3 ? <Recordar id={v.id} n={hechos + 1} onCambio={recargar} /> : null;
      break;
    }
    case 'docs_recibidos':
      texto = 'Cuando tengas documentos suficientes para empezar, toca Valorar. El plazo de 14 días corre desde ahí.';
      cuerpo = <button className="btn primary" onClick={run(() => mover(v.id, 'val_profunda', 'Empezó la valoración.'), 'Valoración en curso')}><Calculator className="ic" />Valorar</button>;
      break;
    case 'val_profunda': {
      if (!desde) break;
      const dias = diasDesde(desde);
      const s = escalonValoracion(dias);
      texto = s ? s.texto + '.' : `Día ${dias} de ${PLAZO_VALORACION}.`;
      cuerpo = <button className="btn primary" onClick={run(() => mover(v.id, 'val_completa', 'Valoración completa.'), 'Valoración completa')}><Check className="ic" />Valoración completa</button>;
      break;
    }
    case 'val_completa': {
      if (!desde) break;
      const dias = diasDesde(desde);
      texto = `Completa hace ${dias} ${dias === 1 ? 'día' : 'días'}. Preséntala antes de 7 días.`;
      break;
    }
  }
  if (!texto) return null;
  return (
    <section className="panel siguiente">
      <header><h2>Siguiente paso</h2></header>
      <div className="body"><p>{texto}</p>{cuerpo && <div style={{ marginTop: 10 }}>{cuerpo}</div>}</div>
    </section>
  );
}
