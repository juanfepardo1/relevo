import { useEffect, useRef, useState } from 'react';
import { CaretDown, Check, X, Plus } from '@phosphor-icons/react';

/** Filtro compacto de selección múltiple: un botón que abre una lista con casillas. Vacío = sin filtrar. */
export function Multi({ label, opciones, value, onChange, abrir = false, onQuitar }: { label: string; opciones: [string, string][]; value: string[]; onChange: (v: string[]) => void; abrir?: boolean; onQuitar?: () => void }) {
  const [abierto, setAbierto] = useState(abrir);
  const [derecha, setDerecha] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setAbierto(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setAbierto(false); };
    document.addEventListener('mousedown', fuera); document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', fuera); document.removeEventListener('keydown', esc); };
  }, [abierto]);
  const toggle = (k: string) => onChange(value.includes(k) ? value.filter((x) => x !== k) : [...value, k]);
  const uno = value.length === 1 ? opciones.find(([k]) => k === value[0])?.[1] : '';
  return (
    <div className="multi" ref={ref}>
      <button type="button" className={'multi-btn' + (value.length ? ' on' : '') + (onQuitar ? ' chip-f' : '')} aria-haspopup="listbox" aria-expanded={abierto} onClick={() => { const r = ref.current?.getBoundingClientRect(); setDerecha(!!r && r.left + 240 > window.innerWidth); setAbierto(!abierto); }}>
        <span>{label}{onQuitar && value.length > 0 ? ':' : ''}</span>
        {value.length > 0 && <b>{uno || `${value.length} opciones`}</b>}
        <CaretDown className="ic" />
      </button>
      {onQuitar && <button type="button" className="chip-x" aria-label={`Quitar filtro ${label}`} onClick={onQuitar}><X className="ic" /></button>}
      {abierto && (
        <div className="multi-pop" style={derecha ? { left: 'auto', right: 0 } : undefined} role="listbox" aria-multiselectable>
          {opciones.map(([k, l]) => {
            const on = value.includes(k);
            return (
              <button type="button" key={k} role="option" aria-selected={on} className={on ? 'on' : ''} onClick={() => toggle(k)}>
                <span className="chk">{on && <Check weight="bold" />}</span>{l}
              </button>
            );
          })}
          {value.length > 0 && <button type="button" className="multi-clear" onClick={() => onChange([])}><X className="ic" />Quitar filtro</button>}
        </div>
      )}
    </div>
  );
}

/** true si el valor pasa el filtro. '__sin' representa "sin dato". */
export const pasa = (sel: string[], v: unknown) => !sel.length || sel.includes(v == null || v === '' ? '__sin' : String(v));

export type DefFiltro = { k: string; label: string; opciones: [string, string][] };

/** Filtros al estilo Notion: solo se ven los que están en uso, y "+ Filtro" agrega otro. */
export function Filtros({ defs, valores, onChange }: { defs: DefFiltro[]; valores: Record<string, string[]>; onChange: (v: Record<string, string[]>) => void }) {
  const [menu, setMenu] = useState(false);
  const [recien, setRecien] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menu) return;
    const fuera = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setMenu(false); };
    document.addEventListener('mousedown', fuera);
    return () => document.removeEventListener('mousedown', fuera);
  }, [menu]);
  const activos = Object.keys(valores).filter((k) => defs.some((d) => d.k === k));
  const libres = defs.filter((d) => !activos.includes(d.k));
  return (
    <>
      {activos.map((k) => {
        const d = defs.find((x) => x.k === k)!;
        return <Multi key={k} label={d.label} opciones={d.opciones} value={valores[k]} abrir={recien === k}
          onChange={(v) => onChange({ ...valores, [k]: v })}
          onQuitar={() => { const n = { ...valores }; delete n[k]; onChange(n); }} />;
      })}
      {libres.length > 0 && (
        <div className="multi" ref={ref}>
          <button type="button" className="multi-btn mas-filtro" onClick={() => setMenu(!menu)} aria-expanded={menu}><Plus className="ic" />Filtro</button>
          {menu && (
            <div className="multi-pop" role="menu">
              {libres.map((d) => <button type="button" role="menuitem" key={d.k} onClick={() => { setRecien(d.k); setMenu(false); onChange({ ...valores, [d.k]: [] }); }}>{d.label}</button>)}
            </div>
          )}
        </div>
      )}
    </>
  );
}

/** Estado que sobrevive al cambiar de vista o de página. Se borra solo con el botón de restablecer. */
export function usePersistente<T>(clave: string, inicial: T): [T, (v: T | ((x: T) => T)) => void] {
  const [v, setV] = useState<T>(() => { try { const r = localStorage.getItem(clave); return r ? (JSON.parse(r) as T) : inicial; } catch { return inicial; } });
  const set = (n: T | ((x: T) => T)) => setV((prev) => {
    const val = typeof n === 'function' ? (n as (x: T) => T)(prev) : n;
    try { localStorage.setItem(clave, JSON.stringify(val)); } catch { /* sin almacenamiento */ }
    return val;
  });
  return [v, set];
}
