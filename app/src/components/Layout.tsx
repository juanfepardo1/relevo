import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { House, Tray, Storefront, MagnifyingGlass, ChartBar, SignOut, Wallet, CaretDown } from '@phosphor-icons/react';
import { supabase } from '../lib/supabase';
import { useCatalogo } from '../lib/data';

export default function Layout({ email }: { email: string }) {
  const { equipo } = useCatalogo();
  const enFinanzas = useLocation().pathname.startsWith('/finanzas');
  const [abierto, setAbierto] = useState(enFinanzas);
  useEffect(() => { if (enFinanzas) setAbierto(true); }, [enFinanzas]);
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
          <NavLink to="/vendedores"><Storefront className="ic" />Vendedores</NavLink>
          <NavLink to="/compradores"><MagnifyingGlass className="ic" />Compradores</NavLink>
          <NavLink to="/stats"><ChartBar className="ic" />Embudo</NavLink>
          <button type="button" className={'nav-group' + (enFinanzas ? ' here' : '')} aria-expanded={abierto} onClick={() => setAbierto(!abierto)}>
            <Wallet className="ic" />Finanzas<CaretDown className="ic caret" style={{ transform: abierto ? 'rotate(180deg)' : 'none' }} />
          </button>
          {abierto && (
            <div className="nav-sub">
              <NavLink to="/finanzas/movimientos">Movimientos</NavLink>
              <NavLink to="/finanzas/estados">Estados financieros</NavLink>
              <NavLink to="/finanzas/suscripciones">Suscripciones</NavLink>
              <NavLink to="/finanzas/socios">Cuentas socios</NavLink>
            </div>
          )}
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
