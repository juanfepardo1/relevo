import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { FilePdf, DownloadSimple, ArrowSquareOut, WarningCircle } from '@phosphor-icons/react';
import { supabase, must, type Row } from '../lib/supabase';
import { useQuery, useCatalogo } from '../lib/data';
import { hoy } from '../lib/format';
import { useToast } from '../components/ui';
import { PLANTILLAS, type TipoPlantilla } from '../docs/plantillas';
import type { DatosNda } from '../docs/nda';

type Campos = { nombre: string; cedula: string; cedula_expedida: string; email: string; con_empresa: boolean; razon_social: string; nombre_corto: string; nit: string; fecha: string; ciudad_firma: string };
const vacio: Campos = { nombre: '', cedula: '', cedula_expedida: '', email: '', con_empresa: true, razon_social: '', nombre_corto: '', nit: '', fecha: hoy(), ciudad_firma: 'Bogotá D.C.' };

export default function Documentos({ email }: { email: string }) {
  const [params, setParams] = useSearchParams();
  const tipo = (params.get('tipo') as TipoPlantilla) || 'nda';
  const vendedorId = params.get('vendedor') || '';
  const plantilla = PLANTILLAS[tipo] ?? PLANTILLAS.nda;
  const toast = useToast();
  const { equipo } = useCatalogo();

  const vend = useQuery(() => supabase.from('v_vendedores').select('id,nombre,empresa,correo,ciudad,propietario_cedula,propietario_cedula_expedida,razon_social,nombre_corto,nit,etapa_nombre').order('empresa'));
  const yoQ = useQuery<Row>(() => supabase.from('equipo').select('*').eq('email', email.toLowerCase()).single(), [email]);
  const v = useMemo(() => ((vend.data || []) as Row[]).find((x) => x.id === vendedorId), [vend.data, vendedorId]);
  const yo = yoQ.data;

  const [c, setC] = useState<Campos>(vacio);
  const [guardarFicha, setGuardarFicha] = useState(true);
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<{ url: string; nombre: string; guardado: boolean } | null>(null);
  const [buscar, setBuscar] = useState('');

  useEffect(() => {
    if (!v) { setC(vacio); return; }
    setC({
      nombre: v.nombre ?? '', cedula: v.propietario_cedula ?? '', cedula_expedida: v.propietario_cedula_expedida ?? '', email: v.correo ?? '',
      con_empresa: !!(v.razon_social || v.empresa), razon_social: v.razon_social ?? v.empresa ?? '', nombre_corto: v.nombre_corto ?? '', nit: v.nit ?? '',
      fecha: hoy(), ciudad_firma: 'Bogotá D.C.',
    });
    setRes(null);
  }, [v?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { if (res) URL.revokeObjectURL(res.url); }, [res]);

  const datos = (firma: string | null): DatosNda => ({
    fecha: c.fecha, ciudad_firma: c.ciudad_firma.trim(),
    firmante: { nombre_legal: yo?.nombre_legal ?? '', cedula: yo?.cedula ?? '', cedula_expedida: yo?.cedula_expedida ?? '', domicilio: yo?.domicilio ?? '', email: email.toLowerCase(), firma },
    propietario: {
      nombre: c.nombre.trim(), cedula: c.cedula.replace(/[^\d]/g, ''), cedula_expedida: c.cedula_expedida.trim(), email: c.email.trim(),
      razon_social: c.con_empresa ? c.razon_social.trim() || null : null, nombre_corto: c.con_empresa ? c.nombre_corto.trim() || null : null, nit: c.con_empresa ? c.nit.trim() || null : null,
    },
  });
  const faltan = plantilla.faltantes(datos(yo?.firma_path ? 'ok' : null));

  const generar = async () => {
    if (!v || !yo) return;
    setBusy(true);
    try {
      const { generarPdf, dataUrl } = await import('../docs/pdf');
      const firmado = await supabase.storage.from('documentos').createSignedUrl(yo.firma_path, 120);
      if (firmado.error) throw new Error('No pude leer tu firma: ' + firmado.error.message);
      const firma = await dataUrl(firmado.data.signedUrl);
      const d = datos(firma);
      const blob = await generarPdf((img) => plantilla.build(d, img));
      const nombre = plantilla.archivo(d);

      if (guardarFicha) {
        await must(supabase.from('vendedores').update({
          nombre: d.propietario.nombre, correo: d.propietario.email || null, propietario_cedula: d.propietario.cedula || null, propietario_cedula_expedida: d.propietario.cedula_expedida || null,
          razon_social: d.propietario.razon_social, nombre_corto: d.propietario.nombre_corto, nit: d.propietario.nit,
        }).eq('id', v.id));
      }
      const path = `vendedor/${v.id}/${Date.now()}-${nombre.replace(/[^\w.\-]+/g, '_')}`;
      const up = await supabase.storage.from('documentos').upload(path, blob, { contentType: 'application/pdf' });
      let guardado = !up.error;
      if (!up.error) {
        const ins = await supabase.from('documentos').insert({ vendedor_id: v.id, tipo: plantilla.tipoDoc, nombre: nombre.replace(/\.pdf$/, ''), direccion: 'enviar', estado: 'pendiente', archivo_path: path, notas: `Generado por ${yo.apodo ?? yo.nombre} desde la app` });
        if (ins.error) guardado = false;
      }
      setRes({ url: URL.createObjectURL(blob), nombre, guardado });
      toast(guardado ? 'Documento generado y guardado en la ficha' : 'Documento generado, pero no se guardó en la ficha', !guardado);
      vend.reload();
    } catch (e: any) { toast(e.message, true); }
    setBusy(false);
  };

  const set = (k: keyof Campos) => (e: any) => setC({ ...c, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const elegir = (id: string) => { const p = new URLSearchParams(params); if (id) p.set('vendedor', id); else p.delete('vendedor'); setParams(p, { replace: true }); };
  const lista = ((vend.data || []) as Row[]).filter((x) => { const s = buscar.trim().toLowerCase(); return !s || [x.empresa, x.nombre, x.ciudad].some((y) => String(y || '').toLowerCase().includes(s)); });
  const firmanteListo = yo && yo.nombre_legal && yo.cedula && yo.cedula_expedida && yo.domicilio && yo.firma_path;

  return (
    <div className="page">
      <div className="head"><div><h1>Generar documento</h1><p>Escoge la plantilla y el cliente. Solo cambian los datos variables.</p></div></div>
      <div className="grid-doc">
        <div className="stack">
          <section className="panel">
            <header><h2>1. Plantilla</h2></header>
            <div className="body">
              {Object.values(PLANTILLAS).map((p) => (
                <label key={p.id} className={'opcion' + (tipo === p.id ? ' on' : '')}>
                  <input type="radio" name="tipo" checked={tipo === p.id} onChange={() => { const q = new URLSearchParams(params); q.set('tipo', p.id); setParams(q, { replace: true }); }} />
                  <span><b>{p.nombre}</b><span className="muted" style={{ display: 'block', fontSize: 12.5 }}>{p.descripcion}</span></span>
                </label>
              ))}
              <p className="muted" style={{ fontSize: 12.5, marginTop: 8 }}>Firma: {yo ? (yo.nombre_legal || yo.nombre) : '·'}. {!firmanteListo && <Link to="/perfil" className="linkish">Completa Mi perfil</Link>}</p>
            </div>
          </section>

          <section className="panel">
            <header><h2>2. Cliente</h2></header>
            <div className="body" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <input className="in" type="search" placeholder="Buscar empresa, nombre o ciudad" value={buscar} onChange={(e) => setBuscar(e.target.value)} />
              <select className="sel" value={vendedorId} onChange={(e) => elegir(e.target.value)} aria-label="Vendedor">
                <option value="">Escoge un vendedor</option>
                {lista.map((x) => <option key={x.id} value={x.id}>{x.empresa || x.nombre}{x.empresa ? ` · ${x.nombre}` : ''}{x.ciudad ? ` · ${x.ciudad}` : ''}</option>)}
              </select>
              {v && <Link to={`/vendedores/${v.id}`} className="linkish" style={{ fontSize: 12.5 }}>Abrir la ficha de {v.empresa || v.nombre}</Link>}
            </div>
          </section>

          {v && (
            <section className="panel">
              <header><h2>3. Datos del documento</h2></header>
              <div className="body doc-form">
                <label className="wide">Propietario (nombre completo)<input className="in" value={c.nombre} onChange={set('nombre')} /></label>
                <label>Cédula<input className="in num" inputMode="numeric" value={c.cedula} onChange={set('cedula')} placeholder="Sin puntos" /></label>
                <label>Expedida en<input className="in" value={c.cedula_expedida} onChange={set('cedula_expedida')} /></label>
                <label className="wide">Correo para notificaciones<input className="in" type="email" value={c.email} onChange={set('email')} /></label>
                <label className="check wide"><input type="checkbox" checked={c.con_empresa} onChange={set('con_empresa')} />Firma también frente a la empresa</label>
                {c.con_empresa && <>
                  <label className="wide">Razón social<input className="in" value={c.razon_social} onChange={set('razon_social')} placeholder="Distribuidores Unidos del Caribe S.A." /></label>
                  <label>Nombre corto<input className="in" value={c.nombre_corto} onChange={set('nombre_corto')} placeholder="Unicaribe S.A." /></label>
                  <label>NIT<input className="in num" value={c.nit} onChange={set('nit')} placeholder="802022698" /></label>
                </>}
                <label>Fecha<input className="in" type="date" value={c.fecha} onChange={set('fecha')} /></label>
                <label>Ciudad de firma<input className="in" value={c.ciudad_firma} onChange={set('ciudad_firma')} /></label>
                <label className="check wide"><input type="checkbox" checked={guardarFicha} onChange={(e) => setGuardarFicha(e.target.checked)} />Guardar estos datos en la ficha del vendedor</label>
              </div>
            </section>
          )}
        </div>

        <section className="panel doc-out">
          <header><h2>Documento</h2>
            {res && <div style={{ display: 'flex', gap: 6 }}>
              <a className="btn" href={res.url} download={res.nombre}><DownloadSimple className="ic" />Descargar</a>
              <a className="btn ghost" href={res.url} target="_blank" rel="noopener"><ArrowSquareOut className="ic" />Abrir</a>
            </div>}
          </header>
          <div className="body">
            {!v ? <p className="empty-state">Escoge un vendedor para empezar.</p> : (
              <>
                {faltan.length > 0 && (
                  <div className="aviso"><WarningCircle className="ic" /><div><b>Falta para generar</b><ul>{faltan.map((f) => <li key={f}>{f}</li>)}</ul></div></div>
                )}
                <button className="btn primary" style={{ width: '100%', justifyContent: 'center', minHeight: 42 }} disabled={busy || faltan.length > 0} onClick={generar}>
                  <FilePdf className="ic" />{busy ? 'Generando' : res ? 'Generar de nuevo' : 'Generar PDF'}
                </button>
                {res && <p className="muted" style={{ fontSize: 12.5, margin: '10px 0' }}>{res.guardado ? <>Quedó guardado en Documentos de la ficha, como pendiente. Márcalo como enviado cuando lo mandes.</> : 'No quedó guardado en la ficha. Descárgalo y súbelo a mano.'}</p>}
                {res && <iframe className="doc-prev" src={res.url + '#view=FitH'} title="Vista previa" />}
              </>
            )}
          </div>
        </section>
      </div>
      <p className="muted" style={{ fontSize: 12.5, marginTop: 12 }}>Firmas como {equipo.find((m) => m.email === email.toLowerCase())?.apodo ?? email}. Cada documento sale con los datos y la firma de quien lo genera.</p>
    </div>
  );
}
