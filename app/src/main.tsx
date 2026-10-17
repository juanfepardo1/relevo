import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import type { Session } from '@supabase/supabase-js';
import { supabase, enlaceTipo } from './lib/supabase';
import { loteActual } from './lib/lote';
import { CatalogoProvider } from './lib/data';
import { ToastProvider } from './components/ui';
import Layout from './components/Layout';
import Login, { CrearClave } from './pages/Login';
import Inicio from './pages/Inicio';
import Vendedores from './pages/Vendedores';
import VendedorFicha from './pages/VendedorFicha';
import Compradores from './pages/Compradores';
import CompradorFicha from './pages/CompradorFicha';
import Stats from './pages/Stats';
import Bandeja from './pages/Bandeja';
import Finanzas from './pages/Finanzas';
import Suscripciones from './pages/Suscripciones';
import Documentos from './pages/Documentos';
import Perfil from './pages/Perfil';
import Admin from './pages/Admin';
import Flash from './pages/Flash';
import Empresa from './pages/Empresa';
import Calendario from './pages/Calendario';
import './styles.css';

function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [permitido, setPermitido] = useState<boolean | null>(null);
  // Llegó por invitación o "olvidé mi contraseña": primero crea su contraseña.
  const [crearClave, setCrearClave] = useState(() => ['invite', 'recovery', 'signup'].includes(enlaceTipo ?? ''));

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((e, s) => { if (e === 'PASSWORD_RECOVERY') setCrearClave(true); setSession(s); });
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) { setPermitido(null); return; }
    supabase.rpc('es_equipo').then(({ data }) => setPermitido(!!data));
  }, [session]);

  if (session === undefined || (session && permitido === null)) return <div className="login"><div className="skel" style={{ width: 160 }} /></div>;
  if (!session) return <Login />;
  if (!permitido) return <Login noAutorizado={session.user.email ?? ''} />;
  if (crearClave) return <div className="login"><CrearClave email={session.user.email ?? ''} onDone={() => { setCrearClave(false); history.replaceState(null, '', '/'); }} /></div>;

  return (
    <CatalogoProvider email={session.user.email ?? ''}>
      <Routes>
        <Route element={<Layout email={session.user.email ?? ''} />}>
          <Route index element={<Inicio />} />
          <Route path="vendedores" element={<Vendedores key="todos" />} />
          <Route path="mis-clientes" element={<Vendedores key="mios" mios />} />
          <Route path="vendedores/:id" element={<VendedorFicha />} />
          <Route path="compradores" element={<Compradores />} />
          <Route path="compradores/:id" element={<CompradorFicha />} />
          <Route path="stats" element={<Stats />} />
          <Route path="bandeja" element={<Bandeja />} />
          <Route path="documentos" element={<Documentos email={session.user.email ?? ''} />} />
          <Route path="flash" element={<Flash />} />
          <Route path="empresa" element={<Empresa />} />
          <Route path="admin" element={<Admin />} />
          <Route path="calendario" element={<Calendario />} />
          <Route path="perfil" element={<Perfil email={session.user.email ?? ''} />} />
          <Route path="finanzas" element={<Navigate to="/finanzas/movimientos" replace />} />
          <Route path="finanzas/movimientos" element={<Finanzas key="m" seccion="movimientos" />} />
          <Route path="finanzas/estados" element={<Finanzas key="e" seccion="estados" />} />
          <Route path="finanzas/suscripciones" element={<Suscripciones />} />
          <Route path="finanzas/socios" element={<Finanzas key="s" seccion="socios" />} />
          <Route path="suscripciones" element={<Navigate to="/finanzas/suscripciones" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </CatalogoProvider>
  );
}

// Si se publicó una versión nueva mientras la pestaña estaba abierta, los archivos viejos ya no existen: recarga una vez.
window.addEventListener('vite:preloadError', (e) => {
  if (loteActual().corriendo) return; // nunca recargar en medio de un lote de valoraciones
  try { if (sessionStorage.getItem('recargado-por-version') === '1') return; sessionStorage.setItem('recargado-por-version', '1'); } catch { /* sin almacenamiento */ }
  e.preventDefault(); location.reload();
});
try { setTimeout(() => sessionStorage.removeItem('recargado-por-version'), 30000); } catch { /* sin almacenamiento */ }

createRoot(document.getElementById('root')!).render(
  <StrictMode><BrowserRouter><ToastProvider><App /></ToastProvider></BrowserRouter></StrictMode>,
);
