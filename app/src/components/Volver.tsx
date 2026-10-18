import { useLocation, useNavigate } from 'react-router-dom';
import { CaretLeft } from '@phosphor-icons/react';

const NOMBRES: [RegExp, string][] = [[/^\/mis-clientes/, 'Mis clientes'], [/^\/vendedores\/?$/, 'Vendedores'], [/^\/compradores\/?$/, 'Compradores'], [/^\/bandeja/, 'Bandeja'], [/^\/flash/, 'Valoración flash'], [/^\/calendario/, 'Calendario'], [/^\/$/, 'Inicio']];

/** Flecha de volver: regresa a la vista desde donde se abrió (Mis clientes, Inicio, Bandeja...). Si se entró directo por enlace, va a la lista. */
export function Volver({ lista, nombre }: { lista: string; nombre: string }) {
  const nav = useNavigate();
  const loc = useLocation();
  const desde = (loc.state as { desde?: string } | null)?.desde;
  const etiqueta = desde ? NOMBRES.find(([r]) => r.test(desde.split('?')[0]))?.[1] ?? 'Volver' : loc.key !== 'default' ? 'Volver' : nombre;
  const volver = () => (desde || loc.key !== 'default' ? nav(-1) : nav(lista));
  return <button type="button" onClick={volver} className="btn ghost" style={{ marginBottom: 12, paddingLeft: 4 }}><CaretLeft className="ic" />{etiqueta}</button>;
}
