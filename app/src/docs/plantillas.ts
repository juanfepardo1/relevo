/** Registro de plantillas de documentos. Para agregar una nueva: crear su archivo en docs/ y sumarla aquí. */
import { nda, faltantesNda, nombreArchivoNda, type DatosNda } from './nda';
import type { Marca } from './pdf';
import type { TDocumentDefinitions } from 'pdfmake/interfaces';

export type Plantilla<T> = {
  id: string;
  nombre: string;
  descripcion: string;
  tipoDoc: string; // tipo en la tabla documentos
  build: (d: T, img: Marca) => TDocumentDefinitions;
  faltantes: (d: T) => string[];
  archivo: (d: T) => string;
};

export const PLANTILLAS = {
  nda: {
    id: 'nda',
    nombre: 'Compromiso de confidencialidad (NDA)',
    descripcion: 'RELEVO se obliga a guardar reserva frente al propietario. Firma a título personal bajo la marca Relevo.',
    tipoDoc: 'nda',
    build: nda,
    faltantes: faltantesNda,
    archivo: (d: DatosNda) => nombreArchivoNda(d.propietario),
  } satisfies Plantilla<DatosNda>,
};
export type TipoPlantilla = keyof typeof PLANTILLAS;
