import { CrearClave } from './Login';
import { useEffect, useState } from 'react';
import { UploadSimple } from '@phosphor-icons/react';
import { supabase, must, type Row } from '../lib/supabase';
import { useQuery } from '../lib/data';
import { Field, Skeleton, ErrorBox, useToast } from '../components/ui';
import { conPuntos } from '../docs/letras';

export default function Perfil({ email }: { email: string }) {
  const q = useQuery<Row>(() => supabase.from('equipo').select('*').eq('email', email.toLowerCase()).single(), [email]);
  const toast = useToast();
  const [firmaUrl, setFirmaUrl] = useState<string | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const p = q.data;

  useEffect(() => {
    if (!p?.firma_path) { setFirmaUrl(null); return; }
    supabase.storage.from('documentos').createSignedUrl(p.firma_path, 300).then(({ data }) => setFirmaUrl(data?.signedUrl ?? null));
  }, [p?.firma_path]);

  const save = (k: string) => async (v: any) => { await must(supabase.from('equipo').update({ [k]: v }).eq('email', email.toLowerCase())); q.reload(); };
  const subirFirma = async (file: File | undefined) => {
    if (!file) return;
    if (!/^image\/(png|jpeg)$/.test(file.type)) { toast('La firma debe ser PNG o JPG. Ideal: PNG con fondo transparente.', true); return; }
    setSubiendo(true);
    try {
      const path = `firmas/${email.toLowerCase()}-${Date.now()}.${file.type === 'image/png' ? 'png' : 'jpg'}`;
      const up = await supabase.storage.from('documentos').upload(path, file);
      if (up.error) throw new Error(up.error.message);
      const viejo = p?.firma_path;
      await save('firma_path')(path);
      if (viejo) await supabase.storage.from('documentos').remove([viejo]);
      toast('Firma actualizada');
    } catch (e: any) { toast('No se subió la firma: ' + e.message, true); }
    setSubiendo(false);
  };

  if (q.error) return <div className="page"><ErrorBox msg={q.error} retry={q.reload} /></div>;
  if (q.loading || !p) return <div className="page"><div className="panel"><Skeleton rows={6} /></div></div>;
  return (
    <div className="page" style={{ maxWidth: 880 }}>
      <div className="head"><div><h1>Mi perfil</h1><p>Estos datos salen en los documentos que firmas.</p></div></div>
      <div className="stack">
        <section className="panel">
          <header><h2>Datos para firmar</h2></header>
          <div className="body fields">
            <Field label="Nombre legal completo" value={p.nombre_legal} onSave={save('nombre_legal')} placeholder="Como aparece en la cédula" />
            <Field label="Apodo" value={p.apodo} onSave={save('apodo')} />
            <Field label="Cédula" value={p.cedula} display={p.cedula ? conPuntos(p.cedula) : undefined} onSave={(v) => save('cedula')(v ? String(v).replace(/\D/g, '') : null)} />
            <Field label="Expedida en" value={p.cedula_expedida} onSave={save('cedula_expedida')} placeholder="Ciudad" />
            <Field label="Domicilio" value={p.domicilio} onSave={save('domicilio')} placeholder="Bogotá D.C." />
            <Field label="Correo para notificaciones" value={p.email} />
          </div>
        </section>
        <section className="panel">
          <header>
            <h2>Firma</h2>
            <label className="btn" style={{ cursor: 'pointer' }}><UploadSimple className="ic" />{subiendo ? 'Subiendo' : p.firma_path ? 'Cambiar firma' : 'Subir firma'}
              <input type="file" accept="image/png,image/jpeg" hidden onChange={(e) => subirFirma(e.target.files?.[0])} /></label>
          </header>
          <div className="body">
            {firmaUrl ? <div className="firma-prev"><img src={firmaUrl} alt="Tu firma" /></div>
              : <p className="muted">Sin firma. Sube un PNG con fondo transparente para que se vea sobre la línea del documento.</p>}
          </div>
        </section>
        <section className="panel">
          <header><h2>Contraseña</h2></header>
          <div className="body"><CrearClave email={p.email ?? ''} compacto /></div>
        </section>
      </div>
    </div>
  );
}
