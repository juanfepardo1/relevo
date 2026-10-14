// Etiquetas legibles para los valores guardados en la base.
export type Opt = [string, string];

export const SECTORES: Opt[] = [
  ['alimentos_bebidas', 'Alimentos y bebidas'], ['agro', 'Agro y agroindustria'], ['quimicos_farma', 'Químicos, plásticos y farma'],
  ['manufactura', 'Manufactura industrial'], ['construccion', 'Construcción e inmobiliario'], ['comercio_mayorista', 'Distribución y mayorista'],
  ['comercio_minorista', 'Retail'], ['transporte_logistica', 'Transporte y logística'], ['turismo_restaurantes', 'Hoteles y restaurantes'],
  ['tecnologia', 'Tecnología'], ['medios_telecom', 'Medios y telecom'], ['salud', 'Salud'], ['educacion', 'Educación'],
  ['servicios_empresariales', 'Servicios a empresas'], ['energia_mineria', 'Energía y minería'], ['otros_servicios', 'Otros servicios'],
];

export const VENTAS: Opt[] = [
  ['lt1000', 'Menos de $1.000M'], ['1000_2000', '$1.000M a $2.000M'], ['2000_5000', '$2.000M a $5.000M'],
  ['5000_10000', '$5.000M a $10.000M'], ['10000_20000', '$10.000M a $20.000M'], ['gt20000', 'Más de $20.000M'],
];

export const HORIZONTE: Opt[] = [['6m', 'Próximos 6 meses'], ['6_24m', '6 a 24 meses'], ['solo_valor', 'Solo quiere saber el valor']];

export const MOTIVO_VENTA: Opt[] = [
  ['sin_sucesor', 'Sin sucesor'], ['retiro', 'Retiro'], ['conflicto_socios', 'Conflicto entre socios'],
  ['nuevo_proyecto', 'Nuevo proyecto'], ['necesita_capital', 'Necesita capital'], ['otro', 'Otro'],
];

export const MOTIVO_PERDIDA: Opt[] = [
  ['sin_respuesta', 'Sin respuesta'], ['solo_valoracion', 'Solo quería la valoración'], ['precio_irreal', 'Expectativa de precio irreal'],
  ['muy_pequena', 'Empresa muy pequeña'], ['otro_broker', 'Se fue con otro broker'], ['desistio', 'Desistió de vender'], ['otro', 'Otro'],
];

export const VALORACION: Opt[] = [['no_valorada', 'No valorada'], ['flash', 'Flash'], ['emis', 'EMIS'], ['profunda', 'Profunda']];
export const CANAL: Opt[] = [['whatsapp', 'WhatsApp'], ['correo', 'Correo'], ['llamada', 'Llamada']];

export const TIPO_COMPRADOR: Opt[] = [['estrategico', 'Estratégico'], ['financiero', 'Financiero'], ['individuo', 'Individuo']];
export const SUBTIPO: Record<string, Opt[]> = {
  estrategico: [['competidor', 'Competidor'], ['proveedor', 'Proveedor'], ['cliente', 'Cliente'], ['consolidador', 'Consolidador'], ['otro', 'Otro']],
  financiero: [['family_office', 'Family office'], ['search_fund', 'Search fund'], ['private_equity', 'Private equity'], ['holding', 'Holding'], ['otro', 'Otro']],
  individuo: [['ejecutivo', 'Ejecutivo'], ['emprendedor', 'Emprendedor'], ['colombiano_exterior', 'Colombiano en el exterior'], ['otro', 'Otro']],
};
export const ESTADO_COMPRADOR: Opt[] = [['prospecto', 'Prospecto'], ['contactado', 'Contactado'], ['registrado', 'Registrado'], ['inactivo', 'Inactivo']];
export const CERTEZA: Opt[] = [['A', 'A · fondos y decisor'], ['B', 'B · fondos sin probar'], ['C', 'C · solo intención'], ['sin_verificar', 'Sin verificar']];
export const ORIGEN: Opt[] = [['formulario', 'Formulario'], ['landing', 'Landing'], ['referido', 'Referido'], ['outreach', 'Outreach'], ['datos_publicos', 'Datos públicos']];

export const ESTADO_ORDEN: Opt[] = [['borrador', 'Borrador'], ['vigente', 'Vigente'], ['pausada', 'Pausada'], ['vencida', 'Vencida'], ['cumplida', 'Cumplida']];
export const TIPO_ORDEN: Opt[] = [['abierta', 'Abierta'], ['mandato', 'Mandato']];
export const FUENTE_DINERO: Opt[] = [['propio', 'Propio'], ['fondo_comprometido', 'Fondo comprometido'], ['deuda_bancaria', 'Crédito bancario'], ['necesita_financiacion', 'Necesita financiación']];
export const ESTRUCTURAS: Opt[] = [['contado', 'Contado'], ['earn_out', 'Earn out'], ['nota_vendedor', 'Nota del vendedor'], ['acciones', 'Acciones']];

export const TIPO_DOC: Opt[] = [
  ['nda', 'NDA'], ['estados_financieros', 'Estados financieros'], ['declaracion_renta', 'Declaración de renta'], ['facturacion', 'Facturación electrónica'],
  ['extractos', 'Extractos bancarios'], ['camara_comercio', 'Cámara de comercio'], ['valoracion_preliminar', 'Valoración preliminar'],
  ['valoracion_profunda', 'Valoración profunda'], ['diagnostico', 'Diagnóstico'], ['teaser', 'Teaser'], ['cim', 'Memorando (CIM)'],
  ['mandato', 'Mandato'], ['loi', 'LOI'], ['contrato', 'Contrato'], ['prueba_fondos', 'Prueba de fondos'], ['otro', 'Otro'],
];
export const ESTADO_DOC: Opt[] = [
  ['pendiente', 'Pendiente'], ['solicitado', 'Solicitado'], ['recibido', 'Recibido'], ['enviado', 'Enviado'], ['firmado', 'Firmado'], ['descartado', 'Descartado'],
];
export const TIPO_ACTIVIDAD: Opt[] = [['llamada', 'Llamada'], ['reunion', 'Reunión'], ['correo', 'Correo'], ['whatsapp', 'WhatsApp'], ['nota', 'Nota']];

export const label = (opts: Opt[], v: string | null | undefined) => (v ? opts.find((o) => o[0] === v)?.[1] ?? v : '');
