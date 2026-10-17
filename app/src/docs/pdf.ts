/** Motor de PDF: carga pdfmake, las fuentes y las imágenes de marca solo cuando se va a generar un documento. */
import type { TDocumentDefinitions } from 'pdfmake/interfaces';

const FUENTES = ['LiberationSans-Regular', 'LiberationSans-Bold', 'LiberationSans-Italic', 'LiberationSans-BoldItalic', 'DejaVuSerif-Bold', 'LiberationSerif-Regular'];

const b64 = (buf: ArrayBuffer) => {
  const bytes = new Uint8Array(buf); let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
};
export async function dataUrl(url: string) {
  const r = await fetch(url); if (!r.ok) throw new Error('No se pudo cargar ' + url);
  const blob = await r.blob();
  return new Promise<string>((ok, ko) => { const fr = new FileReader(); fr.onload = () => ok(fr.result as string); fr.onerror = ko; fr.readAsDataURL(blob); });
}

let listo: Promise<any> | null = null;
function cargar() {
  if (!listo) listo = (async () => {
    const pdfMake: any = (await import('pdfmake/build/pdfmake')).default;
    const vfs: Record<string, string> = {};
    await Promise.all(FUENTES.map(async (f) => { const r = await fetch(`/docfonts/${f}.ttf`); vfs[f + '.ttf'] = b64(await r.arrayBuffer()); }));
    pdfMake.vfs = vfs;
    pdfMake.fonts = {
      Sans: { normal: 'LiberationSans-Regular.ttf', bold: 'LiberationSans-Bold.ttf', italics: 'LiberationSans-Italic.ttf', bolditalics: 'LiberationSans-BoldItalic.ttf' },
      Titulo: { normal: 'DejaVuSerif-Bold.ttf', bold: 'DejaVuSerif-Bold.ttf', italics: 'DejaVuSerif-Bold.ttf', bolditalics: 'DejaVuSerif-Bold.ttf' },
      Serif: { normal: 'LiberationSerif-Regular.ttf', bold: 'LiberationSerif-Regular.ttf', italics: 'LiberationSerif-Regular.ttf', bolditalics: 'LiberationSerif-Regular.ttf' },
    };
    const [logo, brush, ciudad] = await Promise.all([dataUrl('/docimg/logo.png'), dataUrl('/docimg/brush.png'), dataUrl('/docimg/ciudad.png')]);
    return { pdfMake, img: { logo, brush, ciudad } };
  })();
  return listo;
}

export type Marca = { logo: string; brush: string; ciudad: string };

export async function generarPdf(build: (img: Marca) => TDocumentDefinitions): Promise<Blob> {
  const { pdfMake, img } = await cargar();
  return new Promise((ok) => pdfMake.createPdf(build(img)).getBlob((b: Blob) => ok(b)));
}

/** PDF en base64 (sin encabezado data:) para adjuntarlo a un correo. */
export async function blobBase64(b: Blob) { return b64(await b.arrayBuffer()); }
