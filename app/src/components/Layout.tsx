import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useEffect, useState, type ReactNode } from 'react';
import { House, Tray, AddressBook, UserCircle, ChartBar, SignOut, Wallet, CaretDown, FileText, ShieldStar, CalendarBlank, Buildings } from '@phosphor-icons/react';
import { loteActual } from '../lib/lote';
import { supabase } from '../lib/supabase';
import { useCatalogo } from '../lib/data';

function Grupo({ icono, titulo, rutas, children }: { icono: ReactNode; titulo: string; rutas: string[]; children: ReactNode }) {
  const path = useLocation().pathname;
  const aqui = rutas.some((r) => path === r || path.startsWith(r + '/'));
  const [abierto, setAbierto] = useState(aqui);
  useEffect(() => { if (aqui) setAbierto(true); }, [aqui]);
  return (
    <>
      <button type="button" className={'nav-group' + (aqui ? ' here' : '')} aria-expanded={abierto} onClick={() => setAbierto(!abierto)}>
        {icono}{titulo}<CaretDown className="ic caret" style={{ transform: abierto ? 'rotate(180deg)' : 'none' }} />
      </button>
      {abierto && <div className="nav-sub">{children}</div>}
    </>
  );
}

export default function Layout({ email }: { email: string }) {
  const { equipo, yo: miembro } = useCatalogo();
  const [nNotas, setNNotas] = useState<number | null>(null);
  useEffect(() => { if (miembro?.es_admin) supabase.from('notas_app').select('id', { count: 'exact', head: true }).eq('estado', 'nueva').then(({ count }) => setNNotas(count ?? null)); }, [miembro?.es_admin]);
  const [nBandeja, setNBandeja] = useState<number | null>(null);
  useEffect(() => {
    const contar = () => supabase.from('v_bandeja').select('id', { count: 'exact', head: true }).then(({ count }) => setNBandeja(count ?? null));
    contar();
    window.addEventListener('bandeja:cambio', contar);
    const t = setInterval(contar, 60_000); // por si entra un lead nuevo mientras la app está abierta
    return () => { window.removeEventListener('bandeja:cambio', contar); clearInterval(t); };
  }, []);
  const yo = equipo.find((m) => m.email === email.toLowerCase())?.nombre ?? email;
  return (
    <div className="shell">
      <aside className="side">
        <div className="brand"><span className="mark" aria-hidden="true"><i></i><i></i></span>Relevo</div>
        <nav className="nav" aria-label="Principal">
          <NavLink to="/" end><House className="ic" />Inicio</NavLink>
          <NavLink to="/bandeja"><Tray className="ic" />Bandeja{nBandeja ? <span className="count num">{nBandeja}</span> : null}</NavLink>
          <NavLink to="/mis-clientes"><UserCircle className="ic" />Mis clientes</NavLink>
          <NavLink to="/calendario"><CalendarBlank className="ic" />Calendario</NavLink>
          <Grupo icono={<AddressBook className="ic" />} titulo="CRM" rutas={['/vendedores', '/compradores', '/flash']}>
            <NavLink to="/vendedores">Vendedores</NavLink>
            <NavLink to="/compradores">Compradores</NavLink>
            <NavLink to="/flash">Valoración flash</NavLink>
          </Grupo>
          <NavLink to="/documentos"><FileText className="ic" />Documentos</NavLink>
          <NavLink to="/stats"><ChartBar className="ic" />Embudo</NavLink>
          <Grupo icono={<Wallet className="ic" />} titulo="Finanzas" rutas={['/finanzas']}>
            <NavLink to="/finanzas/movimientos">Movimientos</NavLink>
            <NavLink to="/finanzas/estados">Estados financieros</NavLink>
            <NavLink to="/finanzas/suscripciones">Suscripciones</NavLink>
            <NavLink to="/finanzas/socios">Cuentas socios</NavLink>
          </Grupo>
        </nav>
        <nav className="nav nav-admin" aria-label="Empresa y administración"><NavLink to="/empresa"><Buildings className="ic" />Empresa</NavLink>{miembro?.es_admin && <NavLink to="/admin"><ShieldStar className="ic" />Admin{nNotas ? <span className="count num">{nNotas}</span> : null}</NavLink>}</nav>
        <div className="me">
          <NavLink to="/perfil" className="me-link">{yo}<span>Mi perfil</span></NavLink>
          <button className="btn ghost" style={{ justifyContent: 'flex-start', padding: 0 }} onClick={() => supabase.auth.signOut()}><SignOut className="ic" />Salir</button>
        </div>
      </aside>
      <main className="main"><LoteEnCurso /><Outlet /></main>
    </div>
  );
}

/** Aviso fijo mientras corre un lote de valoraciones: se puede navegar, pero no cerrar ni recargar la pestaña. */
function LoteEnCurso() {
  const [e, setE] = useState(loteActual());
  useEffect(() => { const f = (ev: Event) => setE({ ...(ev as CustomEvent).detail }); window.addEventListener('lote:progreso', f); return () => window.removeEventListener('lote:progreso', f); }, []);
  if (!e.corriendo) return null;
  return <div className="aviso" style={{ marginBottom: 14 }}>{e.texto}: {e.i} de {e.n}. Puedes moverte por la app, pero no cierres ni recargues esta pestaña.</div>;
}
