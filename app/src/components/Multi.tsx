import { useEffect, useRef, useState } from 'react';
import { CaretDown, Check, X } from '@phosphor-icons/react';

/** Filtro compacto de selección múltiple: un botón que abre una lista con casillas. Vacío = sin filtrar. */
export function Multi({ label, opciones, value, onChange }: { label: string; opciones: [string, string][]; value: string[]; onChange: (v: string[]) => void }) {
  const [abierto, setAbierto] = useState(false);
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
      <button type="button" className={'multi-btn' + (value.length ? ' on' : '')} aria-haspopup="listbox" aria-expanded={abierto} onClick={() => { const r = ref.current?.getBoundingClientRect(); setDerecha(!!r && r.left + 240 > window.innerWidth); setAbierto(!abierto); }}>
        <span>{label}</span>
        {value.length > 0 && <b>{uno || value.length}</b>}
        <CaretDown className="ic" />
      </button>
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
