import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { X } from '@phosphor-icons/react';
import { label, type Opt } from '../lib/catalogos';

/* ---------- Toast ---------- */
type ToastFn = (msg: string, err?: boolean) => void;
const ToastCtx = createContext<ToastFn>(() => {});
export function ToastProvider({ children }: { children: ReactNode }) {
  const [t, setT] = useState<{ msg: string; err: boolean } | null>(null);
  const timer = useRef<number>();
  const show: ToastFn = (msg, err = false) => {
    setT({ msg, err });
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setT(null), err ? 6000 : 2200);
  };
  return (
    <ToastCtx.Provider value={show}>
      {children}
      {t && <div className={'toast' + (t.err ? ' err' : '')} role="status">{t.msg}</div>}
    </ToastCtx.Provider>
  );
}
export const useToast = () => useContext(ToastCtx);

/* ---------- Campo editable en línea ---------- */
type FieldProps = {
  label: string;
  value: any;
  onSave?: (v: any) => Promise<unknown>;
  type?: 'text' | 'number' | 'date' | 'select' | 'textarea' | 'email' | 'tel' | 'money';
  options?: Opt[];
  display?: ReactNode;
  wide?: boolean;
  placeholder?: string;
};
export function Field({ label: lab, value, onSave, type = 'text', options = [], display, wide, placeholder = 'Agregar' }: FieldProps) {
  const [edit, setEdit] = useState(false);
  const [v, setV] = useState<any>(value ?? '');
  const [saving, setSaving] = useState(false);
  const toast = useToast();
  useEffect(() => setV(type === 'money' && value != null ? Math.round(value / 1e6) : value ?? ''), [value, type]);

  const commit = async (nv: any) => {
    setEdit(false);
    let out: any = nv === '' ? null : nv;
    if (out != null && (type === 'number' || type === 'money')) out = Number(String(out).replace(/[^\d.-]/g, '')) * (type === 'money' ? 1e6 : 1);
    if (out === (value ?? null) || !onSave) return;
    setSaving(true);
    try { await onSave(out); toast('Guardado'); } catch (e: any) { toast('No se guardó: ' + e.message, true); setV(value ?? ''); }
    setSaving(false);
  };

  const shown = display ?? (type === 'select' ? label(options, value) : value);
  const empty = shown == null || shown === '';
  return (
    <div className={'f' + (wide ? ' wide' : '') + (onSave ? '' : ' ro') + (saving ? ' saving' : '')}>
      <span>{lab}</span>
      {edit && onSave ? (
        type === 'select' ? (
          <select className="sel" autoFocus value={v ?? ''} onChange={(e) => commit(e.target.value)} onBlur={() => setEdit(false)}>
            <option value="">Sin definir</option>
            {options.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        ) : type === 'textarea' ? (
          <textarea className="in" autoFocus value={v ?? ''} onChange={(e) => setV(e.target.value)} onBlur={() => commit(v)} />
        ) : (
          <input className="in" autoFocus type={type === 'money' ? 'number' : type} value={v ?? ''} placeholder={type === 'money' ? 'Millones de COP' : ''}
            onChange={(e) => setV(e.target.value)} onBlur={() => commit(v)}
            onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') { setV(value ?? ''); setEdit(false); } }} />
        )
      ) : (
        <div className={'val' + (empty ? ' empty' : '')} tabIndex={onSave ? 0 : -1}
          onClick={() => onSave && setEdit(true)} onKeyDown={(e) => { if (onSave && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); setEdit(true); } }}>
          {empty ? (onSave ? placeholder : 'Sin dato') : shown}
        </div>
      )}
    </div>
  );
}

/* ---------- Modal ---------- */
export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current; if (!d) return;
    if (open && !d.open) d.showModal(); if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} className="m" onClose={onClose} onClick={(e) => { if (e.target === ref.current) onClose(); }}>
      <header><h2 style={{ fontSize: 16 }}>{title}</h2><button className="btn ghost" type="button" onClick={onClose} aria-label="Cerrar"><X className="ic" /></button></header>
      {open && children}
    </dialog>
  );
}

export function Skeleton({ rows = 6 }: { rows?: number }) {
  return <div style={{ display: 'grid', gap: 12, padding: 16 }}>{Array.from({ length: rows }, (_, i) => <div key={i} className="skel" style={{ width: `${60 + ((i * 37) % 40)}%` }} />)}</div>;
}

export function ErrorBox({ msg, retry }: { msg: string; retry?: () => void }) {
  return <div className="panel"><div className="body" style={{ color: 'var(--err)' }}>No pudimos cargar los datos: {msg} {retry && <button className="linkish" onClick={retry}>Reintentar</button>}</div></div>;
}

export function Dias({ d, sla }: { d: number | null | undefined; sla?: number | null }) {
  if (d == null) return null;
  const cls = sla != null && d > sla ? 'b warn' : 'b';
  return <span className={cls + ' num'} title={sla != null ? `Meta: ${sla} días` : undefined}>{d} d</span>;
}
