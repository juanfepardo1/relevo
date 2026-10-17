import { Copy, EnvelopeSimple, ArrowSquareOut } from '@phosphor-icons/react';
import { useState } from 'react';
import { enviarFormulario } from '../flash/acciones';
import { supabase, type Row } from '../lib/supabase';
import { useQuery } from '../lib/data';
import { fecha } from '../lib/format';
import { LINK_FORM, PREGUNTAS, etiqueta, senal } from '../lib/formulario';
import { Skeleton, useToast } from './ui';

const TONO = { caliente: ['tone-ganado', 'Negocio en conversación'], tibio: ['tone-mercado', 'Tuvo un acercamiento'], frio: ['tone-nuevo', 'Sin comprador a la vista'] } as const;

/** Formulario "Cuéntanos tu caso": link personal, mensaje de WhatsApp listo y respuestas. */
export function FormularioPanel({ v, onCambio }: { v: Row; onCambio: () => void }) {
  const toast = useToast();
  const [enviando, setEnviando] = useState(false);
  const q = useQuery(() => supabase.from('vendedores').select('form_codigo, form_enviado_en, form_respondido_en, etapa').eq('id', v.id).single(), [v.id]);
  const rq = useQuery(() => supabase.from('formulario_respuestas').select('respuestas, created_at').eq('vendedor_id', v.id).order('created_at', { ascending: false }).limit(1), [v.id]);
  const f = q.data as Row | null;
  if (q.error) return <section className="panel"><header><h2>Cuéntanos tu caso</h2></header><p className="empty-state">Falta correr formulario_b.sql en Supabase.</p></section>;
  if (q.loading || !f) return <section className="panel"><header><h2>Cuéntanos tu caso</h2></header><div className="body"><Skeleton rows={2} /></div></section>;

  const link = LINK_FORM(f.form_codigo);
  const r = ((rq.data || []) as Row[])[0];
  // Los B se atienden solo por correo: el formulario sale desde valoraciones@, firmado Equipo Relevo
  const enviar = async () => {
    if (!window.confirm(`¿Enviar el formulario a ${v.correo} desde valoraciones@relevobrokers.com?`)) return;
    setEnviando(true);
    try { await enviarFormulario({ ...v, form_codigo: f.form_codigo }); toast('Formulario enviado'); q.reload(); onCambio(); } catch (e: any) { toast(e.message, true); }
    setEnviando(false);
  };
  const copiar = async (t: string, msg: string) => { try { await navigator.clipboard.writeText(t); toast(msg); } catch { toast('No se pudo copiar', true); } };

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
          {!f.form_respondido_en && v.correo && <button className="btn" disabled={enviando} onClick={enviar}><EnvelopeSimple className="ic" />{enviando ? 'Enviando…' : f.form_enviado_en ? 'Reenviar por correo' : 'Enviar por correo'}</button>}
          {!v.correo && <span className="muted" style={{ fontSize: 12.5, alignSelf: 'center' }}>Sin correo: los B se atienden solo por correo.</span>}
          <button className="btn ghost" onClick={() => copiar(link, 'Link copiado')}><Copy className="ic" />Copiar link</button>
          <a className="btn ghost" href={link} target="_blank" rel="noopener"><ArrowSquareOut className="ic" />Ver formulario</a>
        </div>
      </div>
    </section>
  );
}
