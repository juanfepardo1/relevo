import { supabase, must, type Row } from '../lib/supabase';
import { hoy } from '../lib/format';
import { type Lead, type Supuestos, type Resultado, calcular, mensaje, money, dec } from './motor';
import { paginas, generarPdf, nombreArchivo } from './pdf';
import { correoDesdeTexto, correoFormulario, firmaRespaldo, FIRMA_TEXTO } from '../../api/_correo.js';

/** Las valoraciones salen desde una dirección de Relevo, no desde el correo personal, y los B quedan a su nombre. */
export const REMITENTE = 'valoraciones@relevobrokers.com';
export type Modo = 'nada' | 'borrador' | 'enviar';
export type Remitente = { email: string; nombre: string };
type Draft = { made: boolean; enviado?: boolean; url?: string; skip?: string; error?: string };

const blobToBase64 = (blob: Blob) => new Promise<string>((res, rej) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result).split(',')[1]); fr.onerror = rej; fr.readAsDataURL(blob); });

async function token() { const { data } = await supabase.auth.getSession(); return data.session?.access_token ?? ''; }

/** Estado de la conexión con Gmail: prueba la autorización sin crear nada. */
export async function probarGmail(): Promise<{ estado: 'ok' | 'sin_configurar' | 'pendiente' | 'error'; msg?: string; firma?: boolean; alias?: boolean; envio?: boolean }> {
  try {
    const r = await fetch('/api/gmail', { method: 'POST', headers: { Authorization: `Bearer ${await token()}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ probar: true }) });
    if (r.status === 404) return { estado: 'sin_configurar', msg: 'La función de Gmail todavía no está publicada.' };
    const j = await r.json().catch(() => ({}));
    if (j.ok) return { estado: 'ok', firma: !!j.firmaGmail, alias: !!j.aliasListo, envio: !!j.puedeEnviar };
    if (j.configurado === false) return { estado: 'sin_configurar', msg: j.error };
    if (j.configurado === 'pendiente') return { estado: 'pendiente', msg: j.error };
    return { estado: 'error', msg: j.error || `Error ${r.status}` };
  } catch (e: any) { return { estado: 'error', msg: e.message }; }
}

/** El texto editable de la app convertido en el correo con diseño de Relevo (con el rango destacado). */
export function htmlCorreo(L: Lead, cuerpo: string, rango?: { lo: number; hi: number } | null) {
  const lo = rango?.lo ?? (L.min != null ? L.min / 1e6 : null), hi = rango?.hi ?? (L.max != null ? L.max / 1e6 : null);
  return correoDesdeTexto(cuerpo, {
    preheader: 'Tu valoración flash y el siguiente paso con Relevo.',
    destacado: lo != null && hi != null ? { titulo: 'Tu valoración flash', valor: `$${money(lo)} a $${money(hi)} millones`, nota: 'El detalle está en el PDF adjunto.' } : undefined,
    boton: 'Contar mi caso', notaBoton: '4 minutos · sin documentos · confidencial',
  });
}

/** Envía el correo (o lo deja en borrador) desde valoraciones@relevobrokers.com, con el PDF adjunto. */
export async function crearBorrador(L: Lead, asunto: string, cuerpo: string, de: Remitente, pdf?: Blob | null, modo: 'borrador' | 'enviar' = 'borrador', rango?: { lo: number; hi: number } | null): Promise<Draft> {
  if (!L.correo) return { made: false, skip: 'el lead no dejó correo' };
  const r = await fetch('/api/gmail', {
    method: 'POST', headers: { Authorization: `Bearer ${await token()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ modo, para: L.correo, asunto, texto: `${cuerpo}\n\n${FIRMA_TEXTO}`, html: htmlCorreo(L, cuerpo, rango), firmaHtml: firmaRespaldo(), alias: REMITENTE, nombreDe: 'Equipo Relevo', pdfBase64: pdf ? await blobToBase64(pdf) : undefined, pdfNombre: nombreArchivo(L) }),
  });
  const j = await r.json().catch(() => ({}));
  if (!j.ok) return { made: false, error: j.error || `Error ${r.status}` };
  return { made: true, enviado: !!j.enviado, url: j.url };
}

async function sigueePendiente(id: string) {
  const v = (await must(supabase.from('vendedores').select('etapa, valoracion_tipo').eq('id', id).single())) as Row;
  return v.etapa === 'no_contactado' && (!v.valoracion_tipo || v.valoracion_tipo === 'no_valorada');
}

export type Opciones = { modo: Modo; soloCorreo: boolean; de: Remitente; say: (t: string) => void; asunto?: string; cuerpo?: string };

/** Valora un lead: PDF a la ficha, guarda el rango y crea el borrador en Gmail (si aplica). Sigue en No contactado hasta que se envíe. */
export async function valorarYGuardar(A: Supuestos, L: Lead, op: Opciones): Promise<{ r: Resultado; draft: Draft }> {
  op.say('revisando que siga pendiente…');
  if (!(await sigueePendiente(L.id))) throw new Error('Este lead ya no está pendiente. Recarga la bandeja');
  const r = calcular(A, L);
  if (r.route !== 'flash' || r.excluido) throw new Error('Este lead no va por valoración flash');
  op.say('dibujando las 3 páginas…');
  const pdf = await generarPdf(paginas(A, L, r), 0.85);
  op.say('guardando el PDF en la ficha…');
  const path = `vendedor/${L.id}/${Date.now()}-${nombreArchivo(L)}`;
  const up = await supabase.storage.from('documentos').upload(path, pdf, { contentType: 'application/pdf' });
  if (up.error) throw new Error('No se guardó el PDF: ' + up.error.message);
  await must(supabase.from('documentos').insert({ vendedor_id: L.id, tipo: 'valoracion_preliminar', nombre: 'Valoración flash', direccion: 'enviar', estado: 'pendiente', archivo_path: path, notas: `Entre ${money(r.lo)} y ${money(r.hi)} millones` }));

  const m = mensaje(A, L, r);
  let draft: Draft = { made: false };
  const skip = op.modo === 'nada' ? 'solo se valoró' : !L.correo ? 'el lead no dejó correo' : op.soloCorreo && L.canal !== 'Correo' ? `eligió ${L.canal}` : '';
  if (skip) draft = { made: false, skip };
  else {
    op.say(op.modo === 'enviar' ? 'enviando el correo…' : 'creando el borrador en Gmail…');
    try { draft = await crearBorrador(L, op.asunto ?? m.asunto, op.cuerpo ?? m.cuerpo, op.de, pdf, op.modo as 'borrador' | 'enviar', r); } catch (e: any) { draft = { made: false, error: e.message }; }
  }

  op.say('actualizando la ficha…');
  await must(supabase.from('vendedores').update({
    responsable: REMITENTE,
    valoracion_tipo: 'flash', valoracion_min: r.lo * 1e6, valoracion_max: r.hi * 1e6, valoracion_fecha: hoy(),
    flash_enviado_en: null,
    flash_subsector: L.subsector || null, flash_subtipo: L.subtipo || 0, flash_mult: L.multManual ? Number(L.multManual.replace(',', '.')) : null,
  }).eq('id', L.id));
  const calc = `${r.sub ? 'subsector ' + r.sub.nombre : 'sector ' + L.sector} · margen ${dec(r.mLo, 1)}% · múltiplo ${dec(r.xLo, 2)}x${Math.abs(r.xLo - r.xHi) > 0.005 ? ' a ' + dec(r.xHi, 2) + 'x' : ''}${r.hasManual ? ' (manual)' : ''}`;
  await supabase.from('actividades').insert({ vendedor_id: L.id, tipo: 'nota', resumen: `Valoración flash: entre ${money(r.lo)} y ${money(r.hi)} millones (${calc}). ${draft.enviado ? 'Enviada por correo desde valoraciones@.' : draft.made ? 'Borrador creado en Gmail.' : 'Falta enviarla.'}` });
  if (draft.enviado) await marcarEnviado({ ...L, min: r.lo * 1e6, max: r.hi * 1e6 }, 'flash', 'correo');
  return { r, draft };
}

/** Correo (borrador o envío) para un lead ya valorado que sigue por enviar (usa el PDF guardado si existe). */
export async function borradorDeValorado(A: Supuestos, L: Lead, de: Remitente, asunto: string, cuerpo: string, modo: 'borrador' | 'enviar' = 'borrador'): Promise<Draft> {
  const r = calcular(A, L);
  const doc = (await supabase.from('documentos').select('archivo_path').eq('vendedor_id', L.id).eq('tipo', 'valoracion_preliminar').not('archivo_path', 'is', null).order('created_at', { ascending: false }).limit(1).maybeSingle()).data as Row | null;
  let pdf: Blob | null = null;
  if (doc?.archivo_path) { const d = await supabase.storage.from('documentos').download(doc.archivo_path); pdf = d.data; }
  if (!pdf) pdf = await generarPdf(paginas(A, L, r), 0.85);
  const d = await crearBorrador(L, asunto, cuerpo, de, pdf, modo);
  if (d.enviado) await marcarEnviado(L, 'flash', 'correo');
  return d;
}

/** Marca como enviada la valoración (o el mensaje de "empresa muy pequeña"). */
export async function marcarEnviado(L: Lead, tipo: 'flash' | 'fuera', via?: 'correo' | 'whatsapp') {
  const d = hoy();
  if (tipo === 'fuera') {
    await must(supabase.from('vendedores').update({ etapa: 'perdido', motivo_perdida: 'muy_pequena', ultimo_contacto: d }).eq('id', L.id));
    await supabase.from('actividades').insert({ vendedor_id: L.id, tipo: L.canal === 'Correo' ? 'correo' : 'whatsapp', resumen: 'Se envió el mensaje de empresa muy pequeña (ventas bajo el piso).' });
    return;
  }
  const base = { etapa: 'val_preliminar', valoracion_tipo: 'flash', flash_enviado_en: d, ultimo_contacto: d };
  // form_enviado_en solo existe después de correr formulario_b.sql
  const conForm = await supabase.from('vendedores').update({ ...base, form_enviado_en: L.codigo ? d : null }).eq('id', L.id);
  if (conForm.error) await must(supabase.from('vendedores').update(base).eq('id', L.id));
  await supabase.from('documentos').update({ estado: 'enviado', completado_en: d }).eq('vendedor_id', L.id).eq('tipo', 'valoracion_preliminar').eq('estado', 'pendiente');
  await supabase.from('actividades').insert({ vendedor_id: L.id, tipo: via ?? (L.canal === 'Correo' ? 'correo' : 'whatsapp'), resumen: 'Se envió la valoración flash con el formulario "Cuéntanos tu caso".' });
}

/** Invitación al formulario para quien ya recibió su flash (sale desde valoraciones@, firmado Equipo Relevo). */
export async function enviarFormulario(v: Row): Promise<void> {
  if (!v.correo) throw new Error('No tiene correo');
  if (!v.form_codigo) throw new Error('No tiene código de formulario');
  const c = correoFormulario(v as any, 'invitacion');
  const r = await fetch('/api/gmail', {
    method: 'POST', headers: { Authorization: `Bearer ${await token()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ modo: 'enviar', para: v.correo, asunto: c.asunto, texto: c.texto, html: c.html, firmaHtml: firmaRespaldo(), alias: REMITENTE, nombreDe: 'Equipo Relevo' }),
  });
  const j = await r.json().catch(() => ({}));
  if (!j.ok) throw new Error(j.error || `Error ${r.status}`);
  const d = hoy();
  await must(supabase.from('vendedores').update({ form_enviado_en: d, etapa: 'val_preliminar', ultimo_contacto: d }).eq('id', v.id));
  await supabase.from('actividades').insert({ vendedor_id: v.id, tipo: 'correo', resumen: 'Se envió por correo el formulario "Cuéntanos tu caso".' });
}

/** Qué recordatorios automáticos saldrían en la próxima corrida (no envía nada). */
export async function proximosRecordatorios(): Promise<{ ok: boolean; cronListo?: boolean; pendientes?: { id: string; nombre: string; empresa: string; recordatorio: number }[]; error?: string }> {
  try {
    const r = await fetch('/api/seguimientos?prueba=1', { headers: { Authorization: `Bearer ${await token()}` } });
    const j = await r.json().catch(() => ({}));
    return r.ok ? j : { ok: false, error: j.error || `Error ${r.status}` };
  } catch (e: any) { return { ok: false, error: e.message }; }
}
