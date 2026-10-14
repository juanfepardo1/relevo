import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { CaretLeft, WhatsappLogo, Envelope } from '@phosphor-icons/react';
import { supabase, must, type Row } from '../lib/supabase';
import { useQuery, useCatalogo, guardar } from '../lib/data';
import { SECTORES, VENTAS, HORIZONTE, MOTIVO_VENTA, MOTIVO_PERDIDA, VALORACION, CANAL } from '../lib/catalogos';
import { millones, fecha, waLink } from '../lib/format';
import { Field, Skeleton, ErrorBox, Dias, useToast } from '../components/ui';
import { Stepper, DocumentosPanel, ActividadesPanel, HistorialPanel } from '../components/paneles';

export default function VendedorFicha() {
  const { id = '' } = useParams();
  const { equipo } = useCatalogo();
  const q = useQuery<Row>(() => supabase.from('v_vendedores').select('*').eq('id', id).single(), [id]);
  const v = q.data;
  const save = (k: string) => async (val: any) => { await guardar('vendedores', id, { [k]: val }); q.reload(); };

  if (q.error) return <div className="page"><ErrorBox msg={q.error} retry={q.reload} /></div>;
  if (q.loading || !v) return <div className="page"><div className="panel"><Skeleton rows={10} /></div></div>;
  const wa = waLink(v.celular);
  const EQ = equipo.map((m) => [m.email, m.nombre] as [string, string]);

  return (
    <div className="page">
      <Link to="/vendedores" className="btn ghost" style={{ marginBottom: 12, paddingLeft: 4 }}><CaretLeft className="ic" />Vendedores</Link>
      <div className="head">
        <div>
          <h1>{v.empresa || v.nombre}</h1>
          <p>{[v.empresa ? v.nombre : null, v.ciudad, v.bucket ? `Bucket ${v.bucket}` : null, `ingresó ${fecha(v.fecha_ingreso, true)}`].filter(Boolean).join(' · ')}</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Dias d={v.dias_en_etapa} sla={v.sla_dias} />
          {wa && <a className="btn" href={wa} target="_blank" rel="noopener"><WhatsappLogo className="ic" />WhatsApp</a>}
          {v.correo && <a className="btn" href={`mailto:${v.correo}`}><Envelope className="ic" />Correo</a>}
        </div>
      </div>

      <section className="panel" style={{ marginBottom: 16 }}>
        <div className="body"><Stepper pipeline="vendedor" actual={v.etapa} onChange={save('etapa')} /></div>
      </section>

      <div className="grid-ficha">
        <div className="stack">
          <section className="panel">
            <header><h2>Próximo paso</h2></header>
            <div className="body fields">
              <Field label="Próxima acción" value={v.proxima_accion} onSave={save('proxima_accion')} placeholder="Qué sigue" />
              <Field label="Fecha" type="date" value={v.fecha_proxima_accion} display={fecha(v.fecha_proxima_accion, true)} onSave={save('fecha_proxima_accion')} />
              <Field label="Responsable" type="select" options={EQ} value={v.responsable} onSave={save('responsable')} />
              <Field label="Último contacto" type="date" value={v.ultimo_contacto} display={fecha(v.ultimo_contacto, true)} onSave={save('ultimo_contacto')} />
              {v.etapa === 'perdido' && <Field label="Motivo de pérdida" type="select" options={MOTIVO_PERDIDA} value={v.motivo_perdida} onSave={save('motivo_perdida')} />}
            </div>
          </section>
          <DocumentosPanel entidad="vendedor" id={id} />
          <ActividadesPanel entidad="vendedor" id={id} onChange={q.reload} />
          <PresentacionesPanel vendedorId={id} />
        </div>

        <div className="stack">
          <section className="panel">
            <header><h2>Empresa</h2></header>
            <div className="body fields">
              <Field label="Empresa" value={v.empresa} onSave={save('empresa')} />
              <Field label="NIT" value={v.empresa_nit} />
              <Field label="Sector" type="select" options={SECTORES} value={v.sector} onSave={save('sector')} />
              <Field label="Ventas último año" type="select" options={VENTAS} value={v.ventas_rango} onSave={save('ventas_rango')} />
              <Field label="Ciudad" value={v.ciudad} onSave={save('ciudad')} />
              <Field label="Horizonte" type="select" options={HORIZONTE} value={v.horizonte} onSave={save('horizonte')} />
              <Field label="Motivo de venta" type="select" options={MOTIVO_VENTA} value={v.motivo_venta} onSave={save('motivo_venta')} />
            </div>
          </section>
          <section className="panel">
            <header><h2>Valor</h2></header>
            <div className="body fields">
              <Field label="Tipo de valoración" type="select" options={VALORACION} value={v.valoracion_tipo} onSave={save('valoracion_tipo')} />
              <Field label="Valoración máxima" type="money" value={v.valoracion_max} display={millones(v.valoracion_max)} onSave={save('valoracion_max')} />
              <Field label="Precio que espera el dueño" type="money" value={v.precio_esperado} display={millones(v.precio_esperado)} onSave={save('precio_esperado')} />
            </div>
          </section>
          <section className="panel">
            <header><h2>Contacto</h2></header>
            <div className="body fields">
              <Field label="Nombre" value={v.nombre} onSave={save('nombre')} />
              <Field label="Rol" value={v.rol} onSave={save('rol')} />
              <Field label="Celular" type="tel" value={v.celular} onSave={save('celular')} />
              <Field label="Teléfono" type="tel" value={v.telefono} onSave={save('telefono')} />
              <Field label="Correo" type="email" value={v.correo} onSave={save('correo')} wide />
              <Field label="Canal preferido" type="select" options={CANAL} value={v.canal} onSave={save('canal')} />
            </div>
          </section>
          <section className="panel">
            <header><h2>Origen</h2></header>
            <div className="body fields">
              <Field label="Fuente" value={v.fuente} onSave={save('fuente')} />
              <Field label="Referido por" value={v.referido_por} onSave={save('referido_por')} />
              <Field label="Anuncio" value={v.anuncio} />
              <Field label="Formulario" value={v.lead_id ? 'Llegó por la landing' : 'Cargado a mano'} />
            </div>
          </section>
          <section className="panel">
            <header><h2>Notas</h2></header>
            <div className="body"><Field label="" type="textarea" value={v.notas} onSave={save('notas')} placeholder="Agregar notas" wide /></div>
          </section>
          <HistorialPanel entidad="vendedor" id={id} />
        </div>
      </div>
    </div>
  );
}

const ESTADO_PRES: [string, string][] = [['presentado', 'Presentado'], ['interesado', 'Interesado'], ['nda_firmado', 'NDA firmado'], ['oferta', 'Oferta'], ['descartado', 'Descartado']];

function PresentacionesPanel({ vendedorId }: { vendedorId: string }) {
  const toast = useToast();
  const q = useQuery(() => supabase.from('presentaciones').select('id,estado,fecha,notas,comprador_id,compradores(nombre)').eq('vendedor_id', vendedorId).order('fecha', { ascending: false }), [vendedorId]);
  const comps = useQuery(() => supabase.from('compradores').select('id,nombre').order('nombre'));
  const [sel, setSel] = useState('');
  const ya = new Set(((q.data || []) as Row[]).map((p) => p.comprador_id));
  const agregar = async () => {
    if (!sel) return;
    try { await must(supabase.from('presentaciones').insert({ vendedor_id: vendedorId, comprador_id: sel })); setSel(''); q.reload(); }
    catch (e: any) { toast(e.message, true); }
  };
  const cambiar = async (id: string, estado: string) => {
    try { await must(supabase.from('presentaciones').update({ estado }).eq('id', id)); q.reload(); }
    catch (e: any) { toast(e.message, true); }
  };
  return (
    <section className="panel">
      <header><h2>Compradores presentados</h2></header>
      <div className="body" style={{ display: 'flex', gap: 8 }}>
        <select className="sel" value={sel} onChange={(e) => setSel(e.target.value)} aria-label="Comprador">
          <option value="">Elegir comprador</option>
          {((comps.data || []) as Row[]).filter((c) => !ya.has(c.id)).map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
        <button className="btn" disabled={!sel} onClick={agregar}>Presentar</button>
      </div>
      <div className="list">
        {((q.data || []) as Row[]).map((p) => (
          <div className="li" key={p.id} style={{ gridTemplateColumns: 'minmax(0,1fr) auto' }}>
            <div><Link to={`/compradores/${p.comprador_id}`}><b>{p.compradores?.nombre}</b></Link><div className="meta">{fecha(p.fecha)}</div></div>
            <select className="sel" style={{ width: 'auto' }} value={p.estado} onChange={(e) => cambiar(p.id, e.target.value)} aria-label="Estado">
              {ESTADO_PRES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </div>
        ))}
      </div>
    </section>
  );
}
