import { useState, type FormEvent } from 'react';
import { supabase } from '../lib/supabase';

export default function Login({ noAutorizado }: { noAutorizado?: string }) {
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [modo, setModo] = useState<'entrar' | 'olvido'>('entrar');
  const [enviado, setEnviado] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault(); setErr(''); setBusy(true);
    if (modo === 'entrar') {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password: pass });
      if (error) setErr(error.message === 'Invalid login credentials' ? 'Correo o contraseña incorrectos.' : error.message);
    } else {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo: location.origin + '/' });
      if (error) setErr(error.message); else setEnviado(true);
    }
    setBusy(false);
  };

  if (noAutorizado) return (
    <div className="login"><form onSubmit={(e) => { e.preventDefault(); supabase.auth.signOut(); }}>
      <h1>Sin acceso</h1>
      <p className="soft">{noAutorizado} no está autorizado para usar esta herramienta.</p>
      <button className="btn">Salir</button>
    </form></div>
  );

  return (
    <div className="login">
      <form onSubmit={submit}>
        <div className="brand" style={{ padding: 0 }}><span className="mark" aria-hidden="true"><i></i><i></i></span>Relevo</div>
        <h1>{modo === 'entrar' ? 'Entrar' : 'Recuperar contraseña'}</h1>
        <label>Correo<input className="in" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
        {modo === 'entrar' && <label>Contraseña<input className="in" type="password" autoComplete="current-password" required value={pass} onChange={(e) => setPass(e.target.value)} /></label>}
        {err && <p className="err-text" role="alert">{err}</p>}
        {enviado && <p className="soft">Si el correo está autorizado, te llegó un enlace para crear una contraseña nueva.</p>}
        <button className="btn primary" disabled={busy}>{busy ? 'Un momento' : modo === 'entrar' ? 'Entrar' : 'Enviar enlace'}</button>
        <button type="button" className="linkish" onClick={() => { setModo(modo === 'entrar' ? 'olvido' : 'entrar'); setErr(''); setEnviado(false); }}>
          {modo === 'entrar' ? 'Olvidé mi contraseña' : 'Volver a entrar'}
        </button>
      </form>
    </div>
  );
}
