import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, X } from '@phosphor-icons/react';
import { supabase, must, type Row } from '../lib/supabase';
import { useQuery } from '../lib/data';
import { VENTAS, HORIZONTE, label } from '../lib/catalogos';
import { fechaHora } from '../lib/format';
import { Skeleton, ErrorBox, useToast } from '../components/ui';
import { tonoBucket } from '../lib/colores';

const HORIZ: Record<string, string> = { 'En los próximos 6 meses': '6m', 'Entre 6 y 24 meses': '6_24m', 'Solo quiero saber cuánto vale': 'solo_valor' };
const BUCKET: Record<string, string> = { '5000_10000': 'A', '10000_20000': 'A', '1000_2000': 'B', '2000_5000': 'B', '2000_3000': 'B', '3000_5000': 'B', lt1000: 'C', gt20000: 'D' };

export default function Bandeja() {
  const nav = useNavigate();
  const toast = useToast();
  const q = useQuery(() => supabase.from('v_bandeja').select('*').order('created_at', { ascending: false }));
  const [busy, setBusy] = useState<string | null>(null);

  const aprobar = async (l: Row) => {
    setBusy(l.id);
    try { const id = await must(supabase.rpc('aprobar_lead', { p_lead: l.id })) as string; toast('Pasó a vendedores'); nav(`/vendedores/${id}`); }
    catch (e: any) { toast(e.message, true); setBusy(null); }
  };
  const descartar = async (l: Row) => {
    setBusy(l.id);
    try { await must(supabase.from('leads').update({ status: 'descartado' }).eq('id', l.id)); toast('Descartado'); q.reload(); }
    catch (e: any) { toast(e.message, true); }
    setBusy(null);
  };

  const rows = (q.data || []) as Row[];
  return (
    <div className="page">
      <div className="head">
        <div><h1>Bandeja</h1><p>Leads nuevos de la landing. Aprueba los que valen la pena; el resto se descarta.</p></div>
      </div>
      {q.error ? <ErrorBox msg={q.error} retry={q.reload} /> : q.loading ? <div className="panel"><Skeleton rows={5} /></div> : (
        <div className="tablewrap">
          <table className="t">
            <thead><tr><th>Llegó</th><th>Contacto</th><th>Bucket</th><th>Ventas</th><th>Sector</th><th>Ciudad</th><th>Horizonte</th><th>Alertas</th><th className="r">Decisión</th></tr></thead>
            <tbody>
              {!rows.length ? <tr><td colSpan={9}><p className="empty-state">Bandeja vacía. Los leads nuevos aparecen aquí.</p></td></tr> : rows.map((l) => {
                const b = BUCKET[l.sales_range];
                return (
                  <tr key={l.id} style={{ cursor: 'default' }}>
                    <td className="num soft">{fechaHora(l.created_at)}</td>
                    <td><span className="primary-cell">{l.company || l.name}</span><span className="sub">{[l.company ? l.name : null, l.role, l.phone, l.email].filter(Boolean).join(' · ')}</span></td>
                    <td>{b ? <span className={'tag plain ' + tonoBucket(b)}>{b}</span> : <span className="muted">·</span>}</td>
                    <td>{label(VENTAS, l.sales_range) || l.sales_range}</td>
                    <td>{l.sector}</td>
                    <td>{l.city}</td>
                    <td>{label(HORIZONTE, HORIZ[l.timing]) || l.timing}</td>
                    <td style={{ whiteSpace: 'normal' }}>
                      {l.posible_duplicado && <span className="b warn" style={{ marginRight: 4 }}>Ya existe</span>}
                      {l.otros_envios > 0 && <span className="b warn" style={{ marginRight: 4 }}>Envió {l.otros_envios + 1} veces</span>}
                      {l.sales_range === 'lt1000' && <span className="b err">Muy pequeña</span>}
                    </td>
                    <td className="r"><div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                      <button className="btn" disabled={busy === l.id} onClick={() => descartar(l)}><X className="ic" />Descartar</button>
                      <button className="btn primary" disabled={busy === l.id} onClick={() => aprobar(l)}><Check className="ic" />Aprobar</button>
                    </div></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
