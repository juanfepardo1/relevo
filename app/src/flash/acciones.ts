import { supabase, must, type Row } from '../lib/supabase';
import { hoy } from '../lib/format';
import { type Lead, type Supuestos, type Resultado, calcular, mensaje, money, dec } from './motor';
import { paginas, generarPdf, nombreArchivo } from './pdf';

export type Remitente = { email: string; nombre: string };
type Draft = { made: boolean; url?: string; skip?: string; error?: string };

const blobToBase64 = (blob: Blob) => new Promise<string>((res, rej) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result).split(',')[1]); fr.onerror = rej; fr.readAsDataURL(blob); });
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

async function token() { const { data } = await supabase.auth.getSession(); return data.session?.access_token ?? ''; }

/** Estado de la conexión con Gmail: prueba la autorización sin crear nada. */
export async function probarGmail(): Promise<{ estado: 'ok' | 'sin_configurar' | 'pendiente' | 'error'; msg?: string; firma?: boolean }> {
  try {
    const r = await fetch('/api/gmail', { method: 'POST', headers: { Authorization: `Bearer ${await token()}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ probar: true }) });
    if (r.status === 404) return { estado: 'sin_configurar', msg: 'La función de Gmail todavía no está publicada.' };
    const j = await r.json().catch(() => ({}));
    if (j.ok) return { estado: 'ok', firma: !!j.firmaGmail };
    if (j.configurado === false) return { estado: 'sin_configurar', msg: j.error };
    if (j.configurado === 'pendiente') return { estado: 'pendiente', msg: j.error };
    return { estado: 'error', msg: j.error || `Error ${r.status}` };
  } catch (e: any) { return { estado: 'error', msg: e.message }; }
}

function cuerpoHtml(cuerpo: string) {
  const paras = cuerpo.split(/\n{2,}/).map((p) => `<p style="margin:0 0 14px">${esc(p).replace(/\n/g, '<br>')}</p>`).join('');
  return `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.5;color:#222">${paras}</div>`;
}
/** Firma de respaldo si Gmail no deja leer la firma configurada. */
function firmaRespaldo(de: Remitente) {
  return `<div style="margin-top:22px;font-family:Arial,sans-serif;font-size:13px;line-height:1.45;color:#222"><div style="font-weight:bold;color:#444">${esc(de.nombre)}</div><div style="color:#666">Equipo Relevo</div><div><a href="https://relevobrokers.com" style="color:#1a55c4">relevobrokers.com</a></div></div>`;
}

export async function crearBorrador(L: Lead, asunto: string, cuerpo: string, de: Remitente, pdf?: Blob | null): Promise<Draft> {
  if (!L.correo) return { made: false, skip: 'el lead no dejó correo' };
  const r = await fetch('/api/gmail', {
    method: 'POST', headers: { Authorization: `Bearer ${await token()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ para: L.correo, asunto, texto: `${cuerpo}\n\n--\n${de.nombre}\nEquipo Relevo\nrelevobrokers.com`, html: cuerpoHtml(cuerpo), firmaHtml: firmaRespaldo(de), nombreDe: de.nombre, pdfBase64: pdf ? await blobToBase64(pdf) : undefined, pdfNombre: nombreArchivo(L) }),
  });
  const j = await r.json().catch(() => ({}));
  if (!j.ok) return { made: false, error: j.error || `Error ${r.status}` };
  return { made: true, url: j.url };
}

async function sigueePendiente(id: string) {
  const v = (await must(supabase.from('vendedores').select('etapa, valoracion_tipo').eq('id', id).single())) as Row;
  return v.etapa === 'no_contactado' && (!v.valoracion_tipo || v.valoracion_tipo === 'no_valorada');
}

export type Opciones = { borrador: boolean; soloCorreo: boolean; de: Remitente; say: (t: string) => void; asunto?: string; cuerpo?: string };

/** Valora un lead: PDF a la ficha, borrador en Gmail (si aplica) y queda En reserva con su rango. */
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
  const skip = !op.borrador ? 'los borradores están apagados' : !L.correo ? 'el lead no dejó correo' : op.soloCorreo && L.canal !== 'Correo' ? `eligió ${L.canal}` : '';
  if (skip) draft = { made: false, skip };
  else {
    op.say('creando el borrador en Gmail…');
    try { draft = await crearBorrador(L, op.asunto ?? m.asunto, op.cuerpo ?? m.cuerpo, op.de, pdf); } catch (e: any) { draft = { made: false, error: e.message }; }
  }

  op.say('actualizando la ficha…');
  await must(supabase.from('vendedores').update({
    etapa: 'en_reserva', valoracion_tipo: 'flash', valoracion_min: r.lo * 1e6, valoracion_max: r.hi * 1e6, valoracion_fecha: hoy(),
    flash_enviado_en: null,
    flash_subsector: L.subsector || null, flash_subtipo: L.subtipo || 0, flash_mult: L.multManual ? Number(L.multManual.replace(',', '.')) : null,
  }).eq('id', L.id));
  const calc = `${r.sub ? 'subsector ' + r.sub.nombre : 'sector ' + L.sector} · margen ${dec(r.mLo, 1)}% · múltiplo ${dec(r.xLo, 2)}x${Math.abs(r.xLo - r.xHi) > 0.005 ? ' a ' + dec(r.xHi, 2) + 'x' : ''}${r.hasManual ? ' (manual)' : ''}`;
  await supabase.from('actividades').insert({ vendedor_id: L.id, tipo: 'nota', resumen: `Valoración flash: entre ${money(r.lo)} y ${money(r.hi)} millones (${calc}). ${draft.made ? 'Borrador creado en Gmail.' : 'Falta enviarla.'}` });
  return { r, draft };
}

/** Borrador para un lead ya valorado que sigue por enviar (usa el PDF guardado si existe). */
export async function borradorDeValorado(A: Supuestos, L: Lead, de: Remitente, asunto: string, cuerpo: string): Promise<Draft> {
  const r = calcular(A, L);
  const doc = (await supabase.from('documentos').select('archivo_path').eq('vendedor_id', L.id).eq('tipo', 'valoracion_preliminar').not('archivo_path', 'is', null).order('created_at', { ascending: false }).limit(1).maybeSingle()).data as Row | null;
  let pdf: Blob | null = null;
  if (doc?.archivo_path) { const d = await supabase.storage.from('documentos').download(doc.archivo_path); pdf = d.data; }
  if (!pdf) pdf = await generarPdf(paginas(A, L, r), 0.85);
  return crearBorrador(L, asunto, cuerpo, de, pdf);
}

/** Marca como enviada la valoración (o el mensaje de "empresa muy pequeña"). */
export async function marcarEnviado(L: Lead, tipo: 'flash' | 'fuera') {
  const d = hoy();
  if (tipo === 'fuera') {
    await must(supabase.from('vendedores').update({ etapa: 'perdido', motivo_perdida: 'muy_pequena', ultimo_contacto: d }).eq('id', L.id));
    await supabase.from('actividades').insert({ vendedor_id: L.id, tipo: L.canal === 'Correo' ? 'correo' : 'whatsapp', resumen: 'Se envió el mensaje de empresa muy pequeña (ventas bajo el piso).' });
    return;
  }
  await must(supabase.from('vendedores').update({ etapa: 'en_reserva', valoracion_tipo: 'flash', flash_enviado_en: d, ultimo_contacto: d }).eq('id', L.id));
  await supabase.from('documentos').update({ estado: 'enviado', completado_en: d }).eq('vendedor_id', L.id).eq('tipo', 'valoracion_preliminar').eq('estado', 'pendiente');
  await supabase.from('actividades').insert({ vendedor_id: L.id, tipo: L.canal === 'Correo' ? 'correo' : 'whatsapp', resumen: 'Se envió la valoración flash. Queda en reserva para cruzar con compradores.' });
}
