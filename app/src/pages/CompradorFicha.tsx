import { useState, type FormEvent } from 'react';
import { useParams, Link } from 'react-router-dom';
import { CaretLeft, Plus, PencilSimple, WhatsappLogo, Envelope } from '@phosphor-icons/react';
import { supabase, must, type Row } from '../lib/supabase';
import { useQuery, useCatalogo, guardar } from '../lib/data';
import { TIPO_COMPRADOR, SUBTIPO, ESTADO_COMPRADOR, CERTEZA, ORIGEN, SECTORES, ESTADO_ORDEN, TIPO_ORDEN, FUENTE_DINERO, ESTRUCTURAS, label, type Opt } from '../lib/catalogos';
import { rango, fecha, millones, waLink, hoy } from '../lib/format';
import { Field, Skeleton, ErrorBox, Modal, Dias, useToast } from '../components/ui';
import { Stepper, DocumentosPanel, ActividadesPanel, HistorialPanel } from '../components/paneles';

export default function CompradorFicha() {
  const { id = '' } = useParams();
  const { equipo } = useCatalogo();
  const q = useQuery<Row>(() => supabase.from('v_compradores').select('*').eq('id', id).single(), [id]);
  const personas = useQuery(() => supabase.from('personas').select('*').eq('comprador_id', id).order('created_at'), [id]);
  const ordenes = useQuery(() => supabase.from('ordenes').select('*').eq('comprador_id', id).order('created_at', { ascending: false }), [id]);
  const [orden, setOrden] = useState<Row | null>(null);
  const [persona, setPersona] = useState<Row | null>(null);
  const c = q.data;
  const save = (k: string) => async (val: any) => { await guardar('compradores', id, { [k]: val }); q.reload(); };

  if (q.error) return <div className="page"><ErrorBox msg={q.error} retry={q.reload} /></div>;
  if (q.loading || !c) return <div className="page"><div className="panel"><Skeleton rows={10} /></div></div>;
  const EQ = equipo.map((m) => [m.email, m.nombre] as Opt);
  const wa = waLink(c.contacto_telefono);

  return (
    <div className="page">
      <Link to="/compradores" className="btn ghost" style={{ marginBottom: 12, paddingLeft: 4 }}><CaretLeft className="ic" />Compradores</Link>
      <div className="head">
        <div>
          <h1>{c.nombre}</h1>
          <p>{[label(TIPO_COMPRADOR, c.tipo), label(SUBTIPO[c.tipo] || [], c.subtipo), label(ESTADO_COMPRADOR, c.estado)].filter(Boolean).join(' · ')}</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Dias d={c.dias_en_etapa} />
          {wa && <a className="btn" href={wa} target="_blank" rel="noopener"><WhatsappLogo className="ic" />WhatsApp</a>}
          {c.contacto_email && <a className="btn" href={`mailto:${c.contacto_email}`}><Envelope className="ic" />Correo</a>}
        </div>
      </div>

      <section className="panel" style={{ marginBottom: 16 }}>
        <div className="body"><Stepper pipeline="comprador" actual={c.etapa} onChange={save('etapa')} /></div>
      </section>

      <div className="grid-ficha">
        <div className="stack">
          <section className="panel">
            <header><h2>Búsquedas</h2><button className="btn" onClick={() => setOrden({})}><Plus className="ic" />Nueva búsqueda</button></header>
            {ordenes.loading ? <Skeleton rows={2} /> : !ordenes.data?.length ? <p className="empty-state">Sin búsqueda registrada. Sin búsqueda vigente no recibe fichas.</p> : (
              <div className="list">
                {ordenes.data.map((o: Row) => (
                  <div className="li click" key={o.id} style={{ gridTemplateColumns: 'minmax(0,1fr) auto' }} onClick={() => setOrden(o)}>
                    <div style={{ minWidth: 0 }}>
                      <b>{o.nombre || 'Búsqueda'}</b>
                      <p className="meta">{[(o.categorias || []).map((s: string) => label(SECTORES, s)).join(', ') || 'Cualquier sector', rango(o.ticket_min, o.ticket_max) || 'Ticket sin definir', o.regiones?.length ? `${o.regiones.length} regiones` : 'Todo el país'].join(' · ')}</p>
                      <p className="meta">{label(TIPO_ORDEN, o.tipo)} · vence {fecha(o.vigente_hasta, true)}{o.multiplo_max ? ` · múltiplo máx ${o.multiplo_max}x` : ''}</p>
                    </div>
                    <span className={'b ' + (o.estado === 'vigente' ? 'ok' : o.estado === 'borrador' ? 'warn' : '')}>{label(ESTADO_ORDEN, o.estado)}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
          <section className="panel">
            <header><h2>Próximo paso</h2></header>
            <div className="body fields">
              <Field label="Próxima acción" value={c.proxima_accion} onSave={save('proxima_accion')} placeholder="Qué sigue" />
              <Field label="Fecha" type="date" value={c.fecha_proxima_accion} display={fecha(c.fecha_proxima_accion, true)} onSave={save('fecha_proxima_accion')} />
              <Field label="Responsable" type="select" options={EQ} value={c.responsable} onSave={save('responsable')} />
              <Field label="Último contacto" type="date" value={c.ultimo_contacto} display={fecha(c.ultimo_contacto, true)} onSave={save('ultimo_contacto')} />
            </div>
          </section>
          <DocumentosPanel entidad="comprador" id={id} />
          <ActividadesPanel entidad="comprador" id={id} onChange={q.reload} />
        </div>

        <div className="stack">
          <section className="panel">
            <header><h2>Comprador</h2></header>
            <div className="body fields">
              <Field label="Nombre" value={c.nombre} onSave={save('nombre')} />
              <Field label="Tipo" type="select" options={TIPO_COMPRADOR} value={c.tipo} onSave={async (v) => { await guardar('compradores', id, { tipo: v, subtipo: null }); q.reload(); }} />
              <Field label="Subtipo" type="select" options={SUBTIPO[c.tipo] || []} value={c.subtipo} onSave={save('subtipo')} />
              <Field label="Estado" type="select" options={ESTADO_COMPRADOR} value={c.estado} onSave={save('estado')} />
              <Field label="Certeza" type="select" options={CERTEZA} value={c.certeza} onSave={save('certeza')} />
              <Field label="Verificado con" type="select" options={[['prueba_fondos', 'Prueba de fondos'], ['reunion', 'Reunión'], ['referencia', 'Referencia']]} value={c.verificacion_metodo}
                onSave={async (v) => { await guardar('compradores', id, { verificacion_metodo: v, verificacion_fecha: v ? hoy() : null }); q.reload(); }} />
              <Field label="Origen" type="select" options={ORIGEN} value={c.origen} onSave={save('origen')} />
              <Field label="Referido por" value={c.origen_referido} onSave={save('origen_referido')} />
              <Field label="País" value={c.pais} onSave={save('pais')} />
              <Field label="Ciudad" value={c.ciudad} onSave={save('ciudad')} />
              <Field label="Adquisiciones previas" type="number" value={c.adquisiciones_previas} onSave={save('adquisiciones_previas')} />
            </div>
          </section>
          <section className="panel">
            <header><h2>Contactos</h2><button className="btn" onClick={() => setPersona({})}><Plus className="ic" />Agregar</button></header>
            {personas.loading ? <Skeleton rows={2} /> : !personas.data?.length ? <p className="empty-state">Sin contactos.</p> : (
              <div className="list">
                {personas.data.map((p: Row) => (
                  <div className="li click" key={p.id} style={{ gridTemplateColumns: 'minmax(0,1fr) auto' }} onClick={() => setPersona(p)}>
                    <div><b>{p.nombre}</b>{p.id === c.contacto_principal_id && <span className="b or" style={{ marginLeft: 8 }}>Principal</span>}
                      <p className="meta">{[p.cargo, p.email, p.telefono].filter(Boolean).join(' · ')}</p></div>
                    <PencilSimple className="ic" />
                  </div>
                ))}
              </div>
            )}
          </section>
          <section className="panel">
            <header><h2>Notas</h2></header>
            <div className="body"><Field label="" type="textarea" value={c.notas} onSave={save('notas')} placeholder="Agregar notas" wide /></div>
          </section>
          <HistorialPanel entidad="comprador" id={id} />
        </div>
      </div>

      <Modal open={!!orden} onClose={() => setOrden(null)} title={orden?.id ? 'Editar búsqueda' : 'Nueva búsqueda'}>
        {orden && <OrdenForm compradorId={id} orden={orden} onDone={() => { setOrden(null); ordenes.reload(); q.reload(); }} />}
      </Modal>
      <Modal open={!!persona} onClose={() => setPersona(null)} title={persona?.id ? 'Editar contacto' : 'Nuevo contacto'}>
        {persona && <PersonaForm compradorId={id} persona={persona} principal={c.contacto_principal_id} onDone={() => { setPersona(null); personas.reload(); q.reload(); }} />}
      </Modal>
    </div>
  );
}

function Checks({ opts, value, onChange }: { opts: Opt[]; value: string[]; onChange: (v: string[]) => void }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {opts.map(([k, l]) => { const on = value.includes(k); return (
        <button type="button" key={k} className={'b' + (on ? ' or' : '')} style={{ cursor: 'pointer', padding: '4px 10px' }} aria-pressed={on}
          onClick={() => onChange(on ? value.filter((x) => x !== k) : [...value, k])}>{l}</button>); })}
    </div>
  );
}

function OrdenForm({ compradorId, orden, onDone }: { compradorId: string; orden: Row; onDone: () => void }) {
  const deps = useQuery(() => supabase.from('departamentos').select('codigo,nombre').order('nombre'));
  const M = (v: any) => (v == null ? '' : String(Math.round(v / 1e6)));
  const [f, setF] = useState<Row>({
    nombre: orden.nombre ?? '', tipo: orden.tipo ?? 'abierta', estado: orden.estado ?? 'vigente', vigente_hasta: orden.vigente_hasta ?? '',
    categorias: orden.categorias ?? [], regiones: orden.regiones ?? [], fuente_dinero: orden.fuente_dinero ?? [], estructuras: orden.estructuras ?? [],
    ticket_min: M(orden.ticket_min), ticket_max: M(orden.ticket_max), ventas_min: M(orden.ventas_min), ventas_max: M(orden.ventas_max), ebitda_min: M(orden.ebitda_min),
    multiplo_max: orden.multiplo_max ?? '', deuda_ebitda_max: orden.deuda_ebitda_max ?? '', plazo_meses: orden.plazo_meses ?? '',
    mandato_comision: orden.mandato_comision ?? '', mandato_fecha_firma: orden.mandato_fecha_firma ?? '',
  });
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });
  const mm = (v: string) => (v === '' ? null : Number(v) * 1e6);
  const n = (v: any) => (v === '' || v == null ? null : Number(v));

  const submit = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true);
    try {
      const { data: catRows } = await supabase.from('categorias').select('slug,divisiones').in('slug', f.categorias.length ? f.categorias : ['_']);
      const sectores = [...new Set((catRows || []).flatMap((r: Row) => r.divisiones))].sort();
      const body: Row = {
        comprador_id: compradorId, nombre: f.nombre || null, tipo: f.tipo, estado: f.estado,
        categorias: f.categorias, sectores, regiones: f.regiones, fuente_dinero: f.fuente_dinero, estructuras: f.estructuras,
        ticket_min: mm(f.ticket_min), ticket_max: mm(f.ticket_max), ventas_min: mm(f.ventas_min), ventas_max: mm(f.ventas_max), ebitda_min: mm(f.ebitda_min),
        multiplo_max: n(f.multiplo_max), deuda_ebitda_max: n(f.deuda_ebitda_max), plazo_meses: n(f.plazo_meses),
        mandato_comision: f.tipo === 'mandato' ? n(f.mandato_comision) : null, mandato_fecha_firma: f.tipo === 'mandato' ? f.mandato_fecha_firma || null : null,
        ...(f.vigente_hasta ? { vigente_hasta: f.vigente_hasta } : {}),
      };
      if (orden.id) await must(supabase.from('ordenes').update(body).eq('id', orden.id));
      else await must(supabase.from('ordenes').insert(body));
      toast('Búsqueda guardada'); onDone();
    } catch (err: any) { toast(err.message, true); }
    setBusy(false);
  };

  const DEP: Opt[] = (deps.data || []).map((d: Row) => [d.codigo, d.nombre]);
  return (
    <form onSubmit={submit} style={{ maxHeight: '70vh', overflow: 'auto' }}>
      <div className="row"><label>Nombre<input className="in" value={f.nombre} onChange={set('nombre')} placeholder="Ej. Alimentos en Antioquia" /></label>
        <label>Estado<select className="sel" value={f.estado} onChange={set('estado')}>{ESTADO_ORDEN.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label></div>
      <label>Sectores<Checks opts={SECTORES} value={f.categorias} onChange={(v) => setF({ ...f, categorias: v })} /></label>
      <label>Regiones (vacío es todo el país)<Checks opts={DEP} value={f.regiones} onChange={(v) => setF({ ...f, regiones: v })} /></label>
      <div className="row"><label>Ticket mínimo (millones)<input className="in num" type="number" value={f.ticket_min} onChange={set('ticket_min')} /></label><label>Ticket máximo (millones)<input className="in num" type="number" value={f.ticket_max} onChange={set('ticket_max')} /></label></div>
      <div className="row"><label>Ventas mínimas (millones)<input className="in num" type="number" value={f.ventas_min} onChange={set('ventas_min')} /></label><label>Ventas máximas (millones)<input className="in num" type="number" value={f.ventas_max} onChange={set('ventas_max')} /></label></div>
      <div className="row"><label>EBITDA mínimo (millones)<input className="in num" type="number" value={f.ebitda_min} onChange={set('ebitda_min')} /></label><label>Múltiplo EV/EBITDA máximo<input className="in num" type="number" step="0.1" value={f.multiplo_max} onChange={set('multiplo_max')} /></label></div>
      <div className="row"><label>Deuda neta / EBITDA máx.<input className="in num" type="number" step="0.1" value={f.deuda_ebitda_max} onChange={set('deuda_ebitda_max')} /></label><label>Plazo para comprar (meses)<input className="in num" type="number" value={f.plazo_meses} onChange={set('plazo_meses')} /></label></div>
      <label>De dónde sale el dinero<Checks opts={FUENTE_DINERO} value={f.fuente_dinero} onChange={(v) => setF({ ...f, fuente_dinero: v })} /></label>
      <label>Estructuras que acepta<Checks opts={ESTRUCTURAS} value={f.estructuras} onChange={(v) => setF({ ...f, estructuras: v })} /></label>
      <div className="row"><label>Tipo<select className="sel" value={f.tipo} onChange={set('tipo')}>{TIPO_ORDEN.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
        <label>Vence<input className="in" type="date" value={f.vigente_hasta} onChange={set('vigente_hasta')} /></label></div>
      {f.tipo === 'mandato' && <div className="row"><label>Comisión (%)<input className="in num" type="number" step="0.1" value={f.mandato_comision} onChange={set('mandato_comision')} /></label><label>Firmado el<input className="in" type="date" value={f.mandato_fecha_firma} onChange={set('mandato_fecha_firma')} /></label></div>}
      {orden.ticket_min != null && <p className="muted" style={{ fontSize: 12.5 }}>Ticket actual {millones(orden.ticket_min)} a {millones(orden.ticket_max)}.</p>}
      <footer><button className="btn primary" disabled={busy}>{busy ? 'Guardando' : 'Guardar búsqueda'}</button></footer>
    </form>
  );
}

function PersonaForm({ compradorId, persona, principal, onDone }: { compradorId: string; persona: Row; principal: string | null; onDone: () => void }) {
  const [f, setF] = useState<Row>({ nombre: persona.nombre ?? '', cargo: persona.cargo ?? '', email: persona.email ?? '', telefono: persona.telefono ?? '', rol: persona.rol ?? 'decisor', principal: persona.id ? persona.id === principal : !principal });
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true);
    try {
      const body = { nombre: f.nombre.trim(), cargo: f.cargo || null, email: f.email || null, telefono: f.telefono || null, rol: f.rol || null, comprador_id: compradorId };
      const p = persona.id ? await must(supabase.from('personas').update(body).eq('id', persona.id).select('id').single()) as Row
        : await must(supabase.from('personas').insert(body).select('id').single()) as Row;
      if (f.principal) await must(supabase.from('compradores').update({ contacto_principal_id: p.id }).eq('id', compradorId));
      toast('Contacto guardado'); onDone();
    } catch (err: any) { toast(err.message, true); }
    setBusy(false);
  };
  return (
    <form onSubmit={submit}>
      <div className="row"><label>Nombre<input className="in" required value={f.nombre} onChange={set('nombre')} /></label><label>Cargo<input className="in" value={f.cargo} onChange={set('cargo')} /></label></div>
      <div className="row"><label>Correo<input className="in" type="email" value={f.email} onChange={set('email')} /></label><label>WhatsApp<input className="in" type="tel" value={f.telefono} onChange={set('telefono')} /></label></div>
      <div className="row"><label>Rol<select className="sel" value={f.rol} onChange={set('rol')}><option value="decisor">Decide</option><option value="influenciador">Influye</option><option value="operativo">Operativo</option></select></label>
        <label style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 22 }}><input type="checkbox" checked={f.principal} onChange={(e) => setF({ ...f, principal: e.target.checked })} />Contacto principal</label></div>
      <footer><button className="btn primary" disabled={busy}>{busy ? 'Guardando' : 'Guardar contacto'}</button></footer>
    </form>
  );
}
