import { Copy, WhatsappLogo, ArrowSquareOut } from '@phosphor-icons/react';
import { supabase, type Row } from '../lib/supabase';
import { useQuery } from '../lib/data';
import { fecha, hoy, waLink } from '../lib/format';
import { LINK_FORM, PREGUNTAS, etiqueta, senal, nombrePila, empresaLimpia } from '../lib/formulario';
import { Skeleton, useToast } from './ui';

const TONO = { caliente: ['tone-ganado', 'Negocio en conversación'], tibio: ['tone-mercado', 'Tuvo un acercamiento'], frio: ['tone-nuevo', 'Sin comprador a la vista'] } as const;

/** Formulario "Cuéntanos tu caso": link personal, mensaje de WhatsApp listo y respuestas. */
export function FormularioPanel({ v, onCambio }: { v: Row; onCambio: () => void }) {
  const toast = useToast();
  const q = useQuery(() => supabase.from('vendedores').select('form_codigo, form_enviado_en, form_respondido_en, etapa').eq('id', v.id).single(), [v.id]);
  const rq = useQuery(() => supabase.from('formulario_respuestas').select('respuestas, created_at').eq('vendedor_id', v.id).order('created_at', { ascending: false }).limit(1), [v.id]);
  const f = q.data as Row | null;
  if (q.error) return <section className="panel"><header><h2>Cuéntanos tu caso</h2></header><p className="empty-state">Falta correr formulario_b.sql en Supabase.</p></section>;
  if (q.loading || !f) return <section className="panel"><header><h2>Cuéntanos tu caso</h2></header><div className="body"><Skeleton rows={2} /></div></section>;

  const link = LINK_FORM(f.form_codigo);
  const nombre = nombrePila(v.nombre);
  const emp = empresaLimpia(v.nombre_corto || v.empresa);
  const texto = `Hola${nombre ? ' ' + nombre : ''}, soy Felipe de Relevo. Queremos acompañarte en la venta${emp ? ' de ' + emp : ' de tu empresa'}. Para atenderte bien necesito entender tu caso: son unas preguntas de 4 minutos, sin documentos.\n${link}\nCon tus respuestas lo reviso personalmente y te escribo.`;
  const wa = waLink(v.celular);
  const r = ((rq.data || []) as Row[])[0];

  const marcarEnviado = async () => {
    if (f.form_enviado_en) return;
    const cambios: Row = { form_enviado_en: hoy() };
    if (f.etapa === 'en_reserva' || f.etapa === 'no_contactado') cambios.etapa = 'val_preliminar';
    await supabase.from('vendedores').update(cambios).eq('id', v.id);
    await supabase.from('actividades').insert({ vendedor_id: v.id, tipo: 'whatsapp', resumen: 'Se envió el formulario "Cuéntanos tu caso".' });
    q.reload(); onCambio();
  };
  const copiar = async (t: string, msg: string, enviar = false) => {
    try { await navigator.clipboard.writeText(t); toast(msg); if (enviar) await marcarEnviado(); } catch { toast('No se pudo copiar', true); }
  };

  const estado = f.form_respondido_en ? ['tone-ganado', `Respondió el ${fecha(f.form_respondido_en)}`] : f.form_enviado_en ? ['tone-mercado', `Enviado el ${fecha(f.form_enviado_en)}`] : ['tone-nuevo', 'Sin enviar'];

  return (
    <section className="panel">
      <header>
        <h2>Cuéntanos tu caso</h2>
        <span className={'tag ' + estado[0]}>{estado[1]}</span>
      </header>
      <div className="body">
        {r ? (
          <>
            <p style={{ marginBottom: 10 }}><span className={'tag ' + TONO[senal(r.respuestas)][0]}>{TONO[senal(r.respuestas)][1]}</span></p>
            <dl className="form-resp">
              {PREGUNTAS.filter((p) => r.respuestas[p.k] != null && !(Array.isArray(r.respuestas[p.k]) && !r.respuestas[p.k].length)).map((p) => (
                <div key={p.k}><dt>{p.t}</dt><dd>{etiqueta(p.k, r.respuestas[p.k])}</dd></div>
              ))}
            </dl>
          </>
        ) : (
          <p className="muted" style={{ fontSize: 13.5, marginBottom: 12 }}>Link personal de este vendedor. Sus respuestas llegan aquí solas.</p>
        )}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: r ? 14 : 0 }}>
          {wa && <a className="btn" href={`${wa}?text=${encodeURIComponent(texto)}`} target="_blank" rel="noopener" onClick={() => marcarEnviado()}><WhatsappLogo className="ic" />Enviar por WhatsApp</a>}
          <button className="btn ghost" onClick={() => copiar(texto, 'Mensaje copiado', true)}><Copy className="ic" />Copiar mensaje</button>
          <button className="btn ghost" onClick={() => copiar(link, 'Link copiado')}><Copy className="ic" />Copiar link</button>
          <a className="btn ghost" href={link} target="_blank" rel="noopener"><ArrowSquareOut className="ic" />Ver formulario</a>
        </div>
      </div>
    </section>
  );
}
