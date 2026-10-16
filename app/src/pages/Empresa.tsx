import { useState, type FormEvent } from 'react';
import { Plus, Eye, DownloadSimple, UploadSimple, Trash, CheckCircle, Circle } from '@phosphor-icons/react';
import { supabase, must, type Row } from '../lib/supabase';
import { useQuery, useCatalogo } from '../lib/data';
import { fecha, hoy } from '../lib/format';
import { Skeleton, ErrorBox, Modal, useToast } from '../components/ui';

const TIPOS: { k: string; l: string; d: string }[] = [
  { k: 'rut', l: 'RUT', d: 'Registro Único Tributario (DIAN)' },
  { k: 'camara', l: 'Certificado de existencia y representación legal', d: 'Cámara de Comercio' },
  { k: 'matricula', l: 'Matrícula mercantil', d: 'Cámara de Comercio' },
  { k: 'estatutos', l: 'Estatutos', d: 'Documento de constitución de la SAS' },
  { k: 'cedula_rl', l: 'Cédula del representante legal', d: 'Copia por ambas caras' },
  { k: 'cert_bancaria', l: 'Certificación bancaria', d: 'Cuenta de Relevo' },
];

const limpio = (n: string) => n.replace(/[^\w.\-]+/g, '_');

async function abrir(d: Row, descargar = false) {
  const { data, error } = await supabase.storage.from('documentos').createSignedUrl(d.path, 120, descargar ? { download: d.archivo || true } : undefined);
  if (error || !data) throw new Error('No se pudo abrir el archivo');
  window.open(data.signedUrl, '_blank', 'noopener');
}

export default function Empresa() {
  const q = useQuery(() => supabase.from('documentos_empresa').select('*').order('updated_at', { ascending: false }));
  const toast = useToast();
  const { equipo } = useCatalogo();
  const [subir, setSubir] = useState<{ tipo: string; actual?: Row } | null>(null);
  const docs = (q.data || []) as Row[];
  const porTipo = (k: string) => docs.find((d) => d.tipo === k);
  const otros = docs.filter((d) => d.tipo === 'otro');
  const n = TIPOS.filter((t) => porTipo(t.k)).length;
  const quien = (email?: string) => (email ? equipo.find((m) => m.email === email)?.apodo || equipo.find((m) => m.email === email)?.nombre || email : '');

  const accion = (fn: () => Promise<void>) => fn().catch((e: any) => toast(e.message, true));
  const borrar = (d: Row) => accion(async () => {
    if (!confirm(`¿Eliminar ${d.nombre || TIPOS.find((t) => t.k === d.tipo)?.l}?`)) return;
    await supabase.storage.from('documentos').remove([d.path]);
    await must(supabase.from('documentos_empresa').delete().eq('id', d.id));
    toast('Documento eliminado'); q.reload();
  });

  const fila = (titulo: string, sub: string, d: Row | undefined, tipo: string) => (
    <div className="emp-row" key={d?.id || tipo}>
      {d ? <CheckCircle className="ic emp-ok" weight="fill" /> : <Circle className="ic emp-falta" />}
      <div className="emp-nom"><b>{titulo}</b><span>{d?.archivo || sub}</span></div>
      <div className="emp-meta">{d ? <>{d.fecha_expedicion ? 'Expedido ' + fecha(d.fecha_expedicion) : 'Sin fecha de expedición'}<span>Subió {quien(d.subido_por)} · {fecha(String(d.updated_at).slice(0, 10))}</span></> : 'Falta'}</div>
      <div className="emp-acc">
        {d && <button className="btn ghost" onClick={() => accion(() => abrir(d))}><Eye className="ic" />Ver</button>}
        {d && <button className="btn ghost" onClick={() => accion(() => abrir(d, true))}><DownloadSimple className="ic" />Descargar</button>}
        <button className={'btn ' + (d ? 'ghost' : 'primary')} onClick={() => setSubir({ tipo, actual: d })}><UploadSimple className="ic" />{d ? 'Reemplazar' : 'Subir'}</button>
        {d && <button className="btn ghost" aria-label="Eliminar" title="Eliminar" onClick={() => borrar(d)}><Trash className="ic" /></button>}
      </div>
    </div>
  );

  const titulo = subir ? (subir.tipo === 'otro' ? (subir.actual ? 'Reemplazar ' + subir.actual.nombre : 'Agregar documento') : (subir.actual ? 'Reemplazar ' : 'Subir ') + TIPOS.find((t) => t.k === subir.tipo)?.l) : '';

  return (
    <div className="page">
      <div className="head">
        <div><h1>Empresa</h1><p>Documentos legales de Relevo para consultarlos y descargarlos cuando los pidan.</p></div>
        <button className="btn primary" onClick={() => setSubir({ tipo: 'otro' })}><Plus className="ic" />Otro documento</button>
      </div>
      {q.error ? <ErrorBox msg={q.error} retry={q.reload} /> : q.loading ? <div className="panel"><Skeleton rows={6} /></div> : (
        <>
          <div className="panel">
            <header><h2>Documentos básicos</h2><span className="muted">{n} de {TIPOS.length} cargados</span></header>
            {TIPOS.map((t) => fila(t.l, t.d, porTipo(t.k), t.k))}
          </div>
          {otros.length > 0 && (
            <div className="panel" style={{ marginTop: 16 }}>
              <header><h2>Otros documentos</h2><span className="muted">{otros.length}</span></header>
              {otros.map((d) => fila(d.nombre, '', d, 'otro'))}
            </div>
          )}
        </>
      )}
      <Modal open={!!subir} onClose={() => setSubir(null)} title={titulo}>
        {subir && <Subir tipo={subir.tipo} actual={subir.actual} onDone={() => { setSubir(null); q.reload(); }} />}
      </Modal>
    </div>
  );
}

function Subir({ tipo, actual, onDone }: { tipo: string; actual?: Row; onDone: () => void }) {
  const toast = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [nombre, setNombre] = useState(actual?.nombre ?? '');
  const [exp, setExp] = useState(actual ? '' : hoy());
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!file) { toast('Escoge el archivo', true); return; }
    if (tipo === 'otro' && !nombre.trim()) { toast('Ponle un nombre', true); return; }
    setBusy(true);
    try {
      const path = `empresa/${tipo}/${Date.now()}-${limpio(file.name)}`;
      const up = await supabase.storage.from('documentos').upload(path, file);
      if (up.error) throw new Error('No se subió el archivo: ' + up.error.message);
      const datos = { tipo, nombre: tipo === 'otro' ? nombre.trim() : null, fecha_expedicion: exp || null, path, archivo: file.name, updated_at: new Date().toISOString() };
      if (actual) {
        const { data: me } = await supabase.auth.getUser();
        await must(supabase.from('documentos_empresa').update({ ...datos, subido_por: me.user?.email }).eq('id', actual.id));
        await supabase.storage.from('documentos').remove([actual.path]);
      } else await must(supabase.from('documentos_empresa').insert(datos));
      toast(actual ? 'Documento reemplazado' : 'Documento guardado'); onDone();
    } catch (err: any) { toast(err.message, true); }
    setBusy(false);
  };
  return (
    <form onSubmit={submit}>
      {tipo === 'otro' && <label>Nombre<input className="in" required autoFocus value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej.: Acta de constitución firmada" /></label>}
      <label>Archivo<input className="in" type="file" required accept="application/pdf,image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></label>
      <label>Fecha de expedición (opcional)<input className="in" type="date" value={exp} onChange={(e) => setExp(e.target.value)} /></label>
      {actual && <p className="muted" style={{ fontSize: 12.5 }}>El archivo actual ({actual.archivo}) se borra y queda solo el nuevo.</p>}
      <footer><button className="btn primary" disabled={busy}>{busy ? 'Subiendo' : actual ? 'Reemplazar' : 'Guardar'}</button></footer>
    </form>
  );
}
