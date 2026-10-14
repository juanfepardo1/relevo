import { NavLink, Outlet } from 'react-router-dom';
import { House, Storefront, MagnifyingGlass, ChartBar, SignOut } from '@phosphor-icons/react';
import { supabase } from '../lib/supabase';
import { useCatalogo } from '../lib/data';

export default function Layout({ email }: { email: string }) {
  const { equipo } = useCatalogo();
  const yo = equipo.find((m) => m.email === email.toLowerCase())?.nombre ?? email;
  return (
    <div className="shell">
      <aside className="side">
        <div className="brand"><span className="mark" aria-hidden="true"><i></i><i></i></span>Relevo</div>
        <nav className="nav" aria-label="Principal">
          <NavLink to="/" end><House className="ic" />Inicio</NavLink>
          <NavLink to="/vendedores"><Storefront className="ic" />Vendedores</NavLink>
          <NavLink to="/compradores"><MagnifyingGlass className="ic" />Compradores</NavLink>
          <NavLink to="/stats"><ChartBar className="ic" />Embudo</NavLink>
        </nav>
        <div className="me">
          <span>{yo}</span>
          <button className="btn ghost" style={{ justifyContent: 'flex-start', padding: 0 }} onClick={() => supabase.auth.signOut()}><SignOut className="ic" />Salir</button>
        </div>
      </aside>
      <main className="main"><Outlet /></main>
    </div>
  );
}
