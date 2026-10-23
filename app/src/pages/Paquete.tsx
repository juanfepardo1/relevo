import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Plus, X, FilePdf, EnvelopeSimple, CheckCircle, WarningCircle, Eye, ShieldCheck, ListChecks } from '@phosphor-icons/react';
import { supabase, must, type Row } from '../lib/supabase';
import { useQuery, useCatalogo } from '../lib/data';
import { hoy } from '../lib/format';
import { useToast, Skeleton } from '../components/ui';
import { RELEVO_SAS, nda, faltantesNda, nombreArchivoNda, type DatosNda, type Modo } from '../docs/nda';
import { BLOQUES, base, modulos, listaDocumentos, archivoLista, type Item, type Bloque } from '../docs/lista';
import { nombrePila, FIRMA_TEXTO } from '../../api/_correo.js';

/** Prepara en un solo lugar el NDA y la lista de documentos de un vendedor, los guarda en su ficha y deja el borrador en Gmail. */

type Campos = { modo: Modo; nombre: string; cedula: string; cedula_expedida: string; email: string; razon_social: string; nombre_corto: string; nit: string };
type Resultado = { nda?: { url: string; nombre: string }; lista: { url: string; nombre: string }; borrador?: string | null; error?: string; adjuntos: { base64: string; nombre: string }[] };

let seq = 0;
const nuevoId = () => `i${Date.now().toString(36)}${seq++}`;
const conId = (d: Omit<Item, 'id' | 'origen'>, origen: string): Item => ({ ...d, id: nuevoId(), origen });

function tipoDoc(titulo: string) {
  const n = titulo.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (/renta/.test(n)) return 'declaracion_renta';
  if (/camara de comercio/.test(n)) return 'camara_comercio';
  if (/estados financieros|flujo de caja|presupuesto|proyeccion|utilidad/.test(n)) return 'estados_financieros';
  if (/contrato|acuerdo/.test(n)) return 'contrato';
  return 'otro';
}

/** Correo sencillo, como uno escrito a mano en Gmail: solo párrafos, sin plantilla ni imágenes. La firma la pone Gmail. */
const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const htmlSimple = (t: string) => t.trim().split(/\n{2,}/).map((p) => `<div>${esc(p).replace(/\n/g, '<br>')}</div>`).join('<div><br></div>') + '<div><br></div><!--FIRMA-->';

async function token() { const { data } = await supabase.auth.getSession(); return data.session?.access_token ?? ''; }

export default function Paquete() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const { yo } = useCatalogo();
  const vq = useQuery<Row>(() => supabase.from('vendedores').select('id,nombre,empresa,correo,ciudad,propietario_cedula,propietario_cedula_expedida,razon_social,nombre_corto,nit,etapa').eq('id', id).single(), [id]);
  const repQ = useQuery<Row>(() => supabase.from('equipo').select('*').eq('email', RELEVO_SAS.rep_email).single());
  const previos = useQuery(() => supabase.from('documentos').select('tipo,created_at').eq('vendedor_id', id).eq('direccion', 'enviar').eq('tipo', 'nda'), [id]);
  const v = vq.data, rep = repQ.data;
  const MODS = useMemo(modulos, []);

  const [c, setC] = useState<Campos | null>(null);
  const [conNda, setConNda] = useState(true);
  const [items, setItems] = useState<Item[]>(() => base().map((d) => conId(d, 'base')));
  const [mods, setMods] = useState<string[]>([]);
  const [para, setPara] = useState('');
  const [asunto, setAsunto] = useState('');
  const [cuerpo, setCuerpo] = useState('');
  const [busy, setBusy] = useState('');
  const [res, setRes] = useState<Resultado | null>(null);

  useEffect(() => {
    if (!v) return;
    const empresa = v.nombre_corto || v.empresa || v.razon_social || v.nombre;
    setC({ modo: v.razon_social || v.empresa ? 'ambas' : 'persona', nombre: v.nombre ?? '', cedula: v.propietario_cedula ?? '', cedula_expedida: v.propietario_cedula_expedida ?? '', email: v.correo ?? '', razon_social: v.razon_social ?? v.empresa ?? '', nombre_corto: v.nombre_corto ?? '', nit: v.nit ?? '' });
    setPara(v.correo ?? '');
    setAsunto(`Documentos para la valoración de ${empresa}`);
    const pila = nombrePila(v.nombre);
    setCuerpo(`Hola${pila ? ' ' + pila : ''},\n\nGracias por el tiempo en la reunión. Como quedamos, te enviamos dos documentos:\n\n1. Nuestro compromiso de confidencialidad, ya firmado por Relevo. Toda la información que nos compartas queda protegida desde ahora.\n\n2. La lista de documentos que necesitamos para valorar ${empresa}. Si algo no lo tienes a la mano, envía lo que tengas y avanzamos con eso. Tu contador también nos los puede enviar directamente.\n\nPuedes responder este correo con los archivos o compartirnos una carpeta.\n\nQuedamos atentos.`);
  }, [v?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (previos.data && (previos.data as Row[]).length) setConNda(false); }, [previos.data]);

  if (vq.loading || !c) return <div className="page"><Skeleton /></div>;
  if (!v) return <div className="page"><p className="empty-state">No encontré este vendedor.</p></div>;

  const empresa = v.nombre_corto || v.empresa || v.razon_social || v.nombre;
  const datosNda = (firma: string | null): DatosNda => ({
    fecha: hoy(), ciudad_firma: 'Bogotá D.C.',
    firmante: { nombre_legal: rep?.nombre_legal ?? '', cedula: rep?.cedula ?? '', cedula_expedida: rep?.cedula_expedida ?? '', email: (yo?.email ?? '').toLowerCase(), firma },
    propietario: { modo: c.modo, nombre: c.nombre.trim(), cedula: c.cedula.replace(/[^\d]/g, ''), cedula_expedida: c.cedula_expedida.trim(), email: c.email.trim(),
      razon_social: c.modo !== 'persona' ? c.razon_social.trim() || null : null, nombre_corto: c.modo !== 'persona' ? c.nombre_corto.trim() || null : null, nit: c.modo !== 'persona' ? c.nit.trim() || null : null },
  });
  const faltan = conNda ? faltantesNda(datosNda(rep?.firma_path ? 'ok' : null)) : [];
  const validos = items.filter((i) => i.titulo.trim());
  const nBloques = new Set(validos.map((i) => i.bloque)).size;
  const correoOk = /^\S+@\S+\.\S+$/.test(para.trim());
  const set = (k: keyof Campos) => (e: any) => setC({ ...c, [k]: e.target.value });

  const toggleMod = (m: string) => {
    if (mods.includes(m)) { setMods(mods.filter((x) => x !== m)); setItems(items.filter((i) => i.origen !== m)); }
    else { setMods([...mods, m]); setItems([...items, ...MODS.find((x) => x.id === m)!.items.map((d) => conId(d, m))]); }
  };
  const editar = (iid: string, k: 'titulo' | 'detalle', val: string) => setItems(items.map((i) => (i.id === iid ? { ...i, [k]: val } : i)));
  const quitar = (iid: string) => setItems(items.filter((i) => i.id !== iid));
  const agregar = (b: Bloque) => setItems([...items, { id: nuevoId(), bloque: b, titulo: '', detalle: '', origen: 'libre' }]);

  const pdfLista = async () => {
    const { generarPdf } = await import('../docs/pdf');
    return generarPdf((img) => listaDocumentos({ empresa, contacto: c.nombre.trim() || undefined, items: validos, fecha: hoy() }, img));
  };
  const verLista = async () => {
    setBusy('vista');
    try { const b = await pdfLista(); window.open(URL.createObjectURL(b), '_blank', 'noopener'); } catch (e: any) { toast(e.message, true); }
    setBusy('');
  };

  const borrador = async (adjuntos: Resultado['adjuntos']) => {
    const r = await fetch('/api/gmail', {
      method: 'POST', headers: { Authorization: `Bearer ${await token()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ modo: 'borrador', para: para.trim(), asunto, texto: `${cuerpo}\n\n${FIRMA_TEXTO}`, html: htmlSimple(cuerpo), firmaHtml: FIRMA_TEXTO.replace(/\n/g, '<br>'), nombreDe: yo?.nombre ?? 'Equipo Relevo', adjuntos }),
    });
    const j = await r.json().catch(() => ({}));
    if (!j.ok) throw new Error(j.error || `Gmail respondió ${r.status}`);
    return (j.url as string) ?? null;
  };

  const crear = async (conBorrador: boolean) => {
    if (!validos.length) return toast('La lista no tiene documentos', true);
    if (conBorrador && !correoOk) return toast('Revisa el correo del destinatario', true);
    setBusy(conBorrador ? 'borrador' : 'generar');
    const { generarPdf, dataUrl, blobBase64 } = await import('../docs/pdf');
    let resultado: Resultado | null = null;
    try {
      // 1. Los PDF
      let ndaPdf: { blob: Blob; nombre: string } | null = null;
      if (conNda) {
        const f = await supabase.storage.from('documentos').createSignedUrl(rep!.firma_path, 120);
        if (f.error) throw new Error('No pude leer la firma del representante legal: ' + f.error.message);
        const d = datosNda(await dataUrl(f.data.signedUrl));
        ndaPdf = { blob: await generarPdf((img) => nda(d, img)), nombre: nombreArchivoNda(d.propietario) };
      }
      const listaPdf = { blob: await pdfLista(), nombre: archivoLista(empresa) };

      // 2. El paquete y los archivos en la ficha
      const paq = (await must(supabase.from('paquetes').insert({ vendedor_id: v.id, items: validos, correo_para: para.trim() || null }).select('id').single())) as Row;
      const guardar = async (p: { blob: Blob; nombre: string }, tipo: string) => {
        const path = `vendedor/${v.id}/${Date.now()}-${p.nombre.replace(/[^\w.\-]+/g, '_')}`;
        const up = await supabase.storage.from('documentos').upload(path, p.blob, { contentType: 'application/pdf' });
        if (up.error) throw new Error(up.error.message);
        await must(supabase.from('documentos').insert({ vendedor_id: v.id, tipo, nombre: p.nombre.replace(/\.pdf$/, ''), direccion: 'enviar', estado: 'pendiente', archivo_path: path, paquete_id: paq.id, notas: `Preparado por ${yo?.apodo ?? yo?.nombre ?? 'el equipo'}` }));
      };
      if (ndaPdf) await guardar(ndaPdf, 'nda');
      await guardar(listaPdf, 'lista_documentos');
      await must(supabase.from('documentos').insert(validos.map((i) => ({ vendedor_id: v.id, tipo: tipoDoc(i.titulo), nombre: i.titulo.trim(), notas: i.detalle.trim() || null, direccion: 'recibir', estado: 'solicitado', solicitado_en: hoy(), paquete_id: paq.id }))));
      if (conNda) {
        const d = datosNda(null).propietario;
        await supabase.from('vendedores').update({ ...(d.nombre ? { nombre: d.nombre } : {}), correo: d.email || v.correo, propietario_cedula: d.cedula || null, propietario_cedula_expedida: d.cedula_expedida || null,
          ...(d.modo !== 'persona' ? { razon_social: d.razon_social, nombre_corto: d.nombre_corto, nit: d.nit } : {}) }).eq('id', v.id);
      }
      const adjuntos = [...(ndaPdf ? [{ base64: await blobBase64(ndaPdf.blob), nombre: ndaPdf.nombre }] : []), { base64: await blobBase64(listaPdf.blob), nombre: listaPdf.nombre }];
      resultado = { nda: ndaPdf ? { url: URL.createObjectURL(ndaPdf.blob), nombre: ndaPdf.nombre } : undefined, lista: { url: URL.createObjectURL(listaPdf.blob), nombre: listaPdf.nombre }, adjuntos };

      // 3. El borrador
      const que = `${ndaPdf ? 'NDA y ' : ''}lista de ${validos.length} documentos`;
      if (conBorrador) {
        try {
          const url = await borrador(adjuntos);
          resultado.borrador = url;
          await supabase.from('paquetes').update({ borrador_url: url }).eq('id', paq.id);
          await supabase.from('actividades').insert({ vendedor_id: v.id, tipo: 'nota', resumen: `Borrador en Gmail con ${que} para ${para.trim()}.` });
        } catch (e: any) {
          resultado.error = e.message;
          await supabase.from('actividades').insert({ vendedor_id: v.id, tipo: 'nota', resumen: `Se prepararon ${que}. El borrador de Gmail falló.` });
        }
      } else {
        await supabase.from('actividades').insert({ vendedor_id: v.id, tipo: 'nota', resumen: `Se prepararon ${que}, sin borrador.` });
      }
      setRes(resultado);
      toast(resultado.error ? 'Documentos guardados. El borrador falló' : conBorrador ? 'Borrador listo en Gmail' : 'Documentos guardados en la ficha', !!resultado.error);
    } catch (e: any) { toast(e.message, true); }
    setBusy('');
  };

  const reintentar = async () => {
    if (!res) return; setBusy('borrador');
    try { const url = await borrador(res.adjuntos); setRes({ ...res, borrador: url, error: undefined }); toast('Borrador listo en Gmail'); }
    catch (e: any) { setRes({ ...res, error: e.message }); toast(e.message, true); }
    setBusy('');
  };

  if (res) return (
    <div className="page paquete">
      <div className="pq-listo panel">
        <CheckCircle weight="fill" className="pq-ok" />
        <h1>{res.borrador ? 'Borrador listo en Gmail' : 'Documentos guardados'}</h1>
        <p>{res.nda ? 'El NDA y la lista quedaron' : 'La lista quedó'} en la ficha de {empresa}, con los {validos.length} documentos pedidos como pendientes.{res.borrador ? ' Revisa el correo y envíalo desde Gmail.' : ''}</p>
        {res.error && <div className="pq-error"><WarningCircle className="ic" /><span>El borrador no se creó: {res.error}</span><button className="btn" disabled={!!busy} onClick={reintentar}>{busy ? 'Intentando' : 'Intentar de nuevo'}</button></div>}
        <div className="pq-acciones">
          {res.borrador && <a className="btn primary" href={res.borrador} target="_blank" rel="noopener"><EnvelopeSimple className="ic" />Abrir el borrador</a>}
          {res.nda && <a className="btn" href={res.nda.url} target="_blank" rel="noopener"><ShieldCheck className="ic" />Ver NDA</a>}
          <a className="btn" href={res.lista.url} target="_blank" rel="noopener"><ListChecks className="ic" />Ver lista</a>
        </div>
        <p className="meta">Cuando lo envíes, toca <b>Ya los envié</b> en la ficha para pasar a NDA + docs solicitados.</p>
        <Link className="linkish" to={`/vendedores/${v.id}`}><ArrowLeft className="ic" />Volver a la ficha</Link>
      </div>
    </div>
  );

  return (
    <div className="page paquete">
      <div className="head">
        <div>
          <button className="linkish" onClick={() => nav(`/vendedores/${v.id}`)}><ArrowLeft className="ic" />{empresa}</button>
          <h1>NDA y lista de documentos</h1>
          <p>Ajusta lo que quedó en la reunión. Todo queda guardado en la ficha y el correo sale como borrador.</p>
        </div>
      </div>

      <div className="grid-paquete">
        <div className="stack">
          <section className="panel">
            <header>
              <h2><ShieldCheck className="ic pq-h-ic" />Compromiso de confidencialidad</h2>
              <label className="interruptor"><input type="checkbox" checked={conNda} onChange={(e) => setConNda(e.target.checked)} /><span>Incluir</span></label>
            </header>
            {!conNda ? <p className="vacio chico">{(previos.data as Row[] | null)?.length ? 'Ya se le generó un NDA antes. Actívalo si quieres enviar uno nuevo.' : 'Sin NDA en este envío.'}</p> : (
              <div className="body doc-form">
                <div className="wide">
                  <span className="muted" style={{ fontSize: 12.5 }}>A nombre de</span>
                  <div className="seg" role="radiogroup" style={{ display: 'flex', marginTop: 4 }}>
                    {([['persona', 'Una persona'], ['empresa', 'Una empresa'], ['ambas', 'Persona y empresa']] as [Modo, string][]).map(([k, l]) => (
                      <button type="button" key={k} role="radio" aria-checked={c.modo === k} className={c.modo === k ? 'on' : ''} style={{ flex: 1 }} onClick={() => setC({ ...c, modo: k })}>{l}</button>
                    ))}
                  </div>
                </div>
                {c.modo !== 'persona' && <>
                  <label className="wide">Razón social<input className="in" value={c.razon_social} onChange={set('razon_social')} /></label>
                  <label>Nombre corto (opcional)<input className="in" value={c.nombre_corto} onChange={set('nombre_corto')} /></label>
                  <label>NIT (opcional)<input className="in num" value={c.nit} onChange={set('nit')} /></label>
                </>}
                <label className="wide">{c.modo === 'empresa' ? 'Representante (opcional)' : 'Nombre completo'}<input className="in" value={c.nombre} onChange={set('nombre')} /></label>
                <label>Cédula (opcional)<input className="in num" inputMode="numeric" value={c.cedula} onChange={set('cedula')} placeholder="Sin puntos" /></label>
                <label>Expedida en (opcional)<input className="in" value={c.cedula_expedida} onChange={set('cedula_expedida')} /></label>
                {faltan.length > 0 && <div className="wide pq-falta"><WarningCircle className="ic" />Falta: {faltan.join(', ').toLowerCase()}</div>}
              </div>
            )}
          </section>

          <section className="panel">
            <header><h2><ListChecks className="ic pq-h-ic" />Lista de documentos</h2><span className="g-n num">{validos.length}</span></header>
            <div className="body pq-mods">
              <span className="pq-label">Según lo que contó en la reunión</span>
              <div className="chips">
                {MODS.map((m) => <button type="button" key={m.id} className={'chip' + (mods.includes(m.id) ? ' on' : '')} onClick={() => toggleMod(m.id)}>{mods.includes(m.id) ? '✓ ' : '+ '}{m.nombre}</button>)}
              </div>
            </div>
            {BLOQUES.map((b) => {
              const del = items.filter((i) => i.bloque === b.id);
              if (!del.length && !['cifras', 'deudas', 'clientes', 'operacion'].includes(b.id)) return (
                <div key={b.id} className="pq-bloque vacio-b"><button type="button" className="linkish" onClick={() => agregar(b.id)}><Plus className="ic" />{b.titulo}</button></div>
              );
              return (
                <div key={b.id} className="pq-bloque">
                  <h3>{b.titulo}</h3>
                  {del.map((i) => (
                    <div key={i.id} className={'pq-item' + (i.origen === 'base' ? '' : ' extra')}>
                      <div className="pq-campos">
                        <input className="pq-tit" value={i.titulo} onChange={(e) => editar(i.id, 'titulo', e.target.value)} placeholder="Documento" aria-label="Documento" autoFocus={!i.titulo && i.origen === 'libre'} />
                        <input className="pq-det" value={i.detalle} onChange={(e) => editar(i.id, 'detalle', e.target.value)} placeholder="Detalle para el cliente (opcional)" aria-label="Detalle" />
                      </div>
                      <button type="button" className="btn ghost pq-x" onClick={() => quitar(i.id)} aria-label={`Quitar ${i.titulo}`}><X className="ic" /></button>
                    </div>
                  ))}
                  <button type="button" className="linkish pq-add" onClick={() => agregar(b.id)}><Plus className="ic" />Agregar documento</button>
                </div>
              );
            })}
          </section>

          <section className="panel">
            <header><h2><EnvelopeSimple className="ic pq-h-ic" />Correo</h2></header>
            <div className="body pq-correo">
              <label>Para<input className="in" type="email" value={para} onChange={(e) => setPara(e.target.value)} /></label>
              <label>Asunto<input className="in" value={asunto} onChange={(e) => setAsunto(e.target.value)} /></label>
              <label>Mensaje<textarea className="in" rows={11} value={cuerpo} onChange={(e) => setCuerpo(e.target.value)} /></label>
              <p className="meta">Sale como borrador en tu Gmail ({yo?.email}) como un correo normal, sin diseño, con tu firma de Gmail y los PDF adjuntos. Revísalo y envíalo desde Gmail.</p>
            </div>
          </section>
        </div>

        <aside className="panel pq-resumen">
          <header><h2>Se va a preparar</h2></header>
          <div className="body">
            <ul className="pq-que">
              <li className={conNda ? '' : 'off'}><ShieldCheck className="ic" /><span>{conNda ? 'NDA firmado por Relevo' : 'Sin NDA'}</span></li>
              <li><ListChecks className="ic" /><span>Lista de {validos.length} documentos en {nBloques} {nBloques === 1 ? 'bloque' : 'bloques'}</span></li>
              <li className={correoOk ? '' : 'off'}><EnvelopeSimple className="ic" /><span>{correoOk ? `Borrador para ${para.trim()}` : 'Falta un correo válido'}</span></li>
            </ul>
            <p className="meta">Quedan en la ficha: los PDF en "Enviados por Relevo" y cada documento pedido como pendiente en "Documentos del cliente".</p>
            <button className="btn primary pq-go" disabled={!!busy || faltan.length > 0 || !validos.length || !correoOk} onClick={() => crear(true)}>
              <EnvelopeSimple className="ic" />{busy === 'borrador' ? 'Preparando' : 'Crear borrador en Gmail'}
            </button>
            <div className="pq-sec">
              <button className="btn" disabled={!!busy || !validos.length} onClick={verLista}><Eye className="ic" />{busy === 'vista' ? 'Generando' : 'Ver la lista'}</button>
              <button className="btn" disabled={!!busy || faltan.length > 0 || !validos.length} onClick={() => crear(false)}><FilePdf className="ic" />{busy === 'generar' ? 'Generando' : 'Solo guardar PDF'}</button>
            </div>
            {res === null && busy && <p className="meta" style={{ marginTop: 10 }}>Generando los PDF y guardándolos en la ficha…</p>}
          </div>
        </aside>
      </div>
    </div>
  );
}
