import { useState, type FormEvent } from 'react';
import { useLocation } from 'react-router-dom';
import { ChatCenteredText } from '@phosphor-icons/react';
import { supabase, must } from '../lib/supabase';
import { Modal, useToast } from './ui';

export const TIPO_NOTA: [string, string][] = [['falla', 'Algo falla'], ['falta', 'Algo falta'], ['sobra', 'Algo sobra'], ['idea', 'Idea']];

/** Botón pequeño para dejar una nota de mejora de la app. Llega al panel de admin. */
export function BotonNota() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="btn" onClick={() => setOpen(true)}><ChatCenteredText className="ic" />Dejar nota</button>
      <Modal open={open} onClose={() => setOpen(false)} title="Nota sobre la app">
        <FormNota onDone={() => setOpen(false)} />
      </Modal>
    </>
  );
}

function FormNota({ onDone }: { onDone: () => void }) {
  const toast = useToast();
  const { pathname } = useLocation();
  const [tipo, setTipo] = useState('falla');
  const [texto, setTexto] = useState('');
  const [pagina, setPagina] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!texto.trim()) return;
    setBusy(true);
    try {
      await must(supabase.from('notas_app').insert({ tipo, texto: texto.trim(), pagina: pagina.trim() || pathname }));
      window.dispatchEvent(new Event('notas:cambio'));
      toast('Nota enviada. Gracias.'); onDone();
    } catch (err: any) { toast(err.message, true); }
    setBusy(false);
  };
  return (
    <form onSubmit={submit}>
      <div className="seg" role="radiogroup" aria-label="Tipo">
        {TIPO_NOTA.map(([k, l]) => <button type="button" key={k} role="radio" aria-checked={tipo === k} className={tipo === k ? 'on' : ''} onClick={() => setTipo(k)}>{l}</button>)}
      </div>
      <label>Qué pasó o qué cambiarías<textarea className="in" required autoFocus value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Ej.: en la ficha del vendedor no veo la ciudad" /></label>
      <label>En qué parte de la app (opcional)<input className="in" value={pagina} onChange={(e) => setPagina(e.target.value)} placeholder="Vendedores, Finanzas, ficha de UNICARIBE" /></label>
      <footer><button className="btn primary" disabled={busy || !texto.trim()}>{busy ? 'Enviando' : 'Enviar nota'}</button></footer>
    </form>
  );
}
