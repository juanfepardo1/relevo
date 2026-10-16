import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useEffect, useState, type ReactNode } from 'react';
import { House, Tray, AddressBook, UserCircle, ChartBar, SignOut, Wallet, CaretDown, FileText, ShieldStar, CalendarBlank } from '@phosphor-icons/react';
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
  useEffect(() => { supabase.from('v_bandeja').select('id', { count: 'exact', head: true }).then(({ count }) => setNBandeja(count ?? null)); }, []);
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
          <Grupo icono={<AddressBook className="ic" />} titulo="CRM" rutas={['/vendedores', '/compradores']}>
            <NavLink to="/vendedores">Vendedores</NavLink>
            <NavLink to="/compradores">Compradores</NavLink>
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
        {miembro?.es_admin && <nav className="nav nav-admin" aria-label="Administración"><NavLink to="/admin"><ShieldStar className="ic" />Admin{nNotas ? <span className="count num">{nNotas}</span> : null}</NavLink></nav>}
        <div className="me">
          <NavLink to="/perfil" className="me-link">{yo}<span>Mi perfil</span></NavLink>
          <button className="btn ghost" style={{ justifyContent: 'flex-start', padding: 0 }} onClick={() => supabase.auth.signOut()}><SignOut className="ic" />Salir</button>
        </div>
      </aside>
      <main className="main"><Outlet /></main>
    </div>
  );
}
