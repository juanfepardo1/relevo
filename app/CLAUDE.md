# App interna de Relevo (app.relevobrokers.com)

Contexto para cualquier sesión que edite esta app. Léelo completo antes de cambiar algo y actualízalo cuando cambie una decisión.

## Quiénes y cómo
- Equipo: Felipe Pardo (felipe@relevobrokers.com, admin, representante legal de Relevo Brokers S.A.S., NIT 902.117.149-4) y Alejandro González, "Alejo" (alejandro@relevobrokers.com). En la app: "Pardo" y "Alejo".
- Felipe pide todo en español, breve y sin rodeos, sin guiones largos en los textos. Toda la interfaz va en español de Colombia, tuteando.
- Flujo de trabajo: editar, `npx tsc --noEmit -p .`, `npx vite build`, commit y `git pull --rebase` antes de `git push` (otras sesiones también publican). Vercel despliega solo al hacer push a `main`.
- Nunca pedir ni escribir llaves o tokens en el chat ni en el código: viven en variables de Vercel.
- No subir al repo SQL con datos personales de leads.

## Stack
- React + Vite + TypeScript en `app/`. Proyecto de Vercel: `relevo_app` (raíz `app/`). La web pública es otro proyecto (`relevo`, raíz del repo: index.html, compradores.html, caso.html).
- Supabase (proyecto `zxjqixxpyxdyrqaweorn`): base, auth (correo y contraseña; invitación y recuperación obligan a crear contraseña) y storage (bucket `documentos`). RLS con `es_equipo()` (tabla `equipo`, `activo = true`).
- Funciones en `app/api/` (Node ESM). Archivos que empiezan con `_` son módulos compartidos, no endpoints.
  - `_google.js`: Gmail sin llave (Vercel OIDC + Workload Identity Federation + delegación de dominio). Permisos en la delegación: `gmail.compose`, `gmail.send`, `gmail.settings.basic`.
  - `gmail.js`: borrador o envío. Con `alias: valoraciones@relevobrokers.com` redacta en el buzón dueño del alias (`ALIAS_DUENO`, por defecto felipe@) y sale "From: Equipo Relevo <valoraciones@...>".
  - `_correo.js`: plantilla HTML de correo con la marca, textos del formulario y limpieza de nombres (`nombrePila`, `empresaLimpia`). Lo importa también el front (`_correo.d.ts`).
  - `seguimientos.js`: cron (lunes a viernes 14:00 UTC, `vercel.json`) con recordatorios del formulario a los 2 y 5 días. Con sesión del equipo solo lista (`?prueba=1`). Variables: `CRON_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`.
  - `calendly.js`: sincroniza reuniones.
- PDFs: pdfmake (`src/docs/pdf.ts`, fuentes en `public/docfonts`, logo y trazo en `public/docimg`). Valoración flash usa html2canvas + jsPDF (`src/flash/pdf.ts`).

## Identidad visual
Naranja #F47B3D, azul #2C5186, tinta #14243D, fondo claro #EAF1FA. App en fondo claro. Logo de dos píldoras. Correos y PDFs siguen esa línea (ver `_correo.js`, `src/docs/estados.ts`, `src/docs/nda.ts`).

## Módulos
- **Inicio** (`pages/Inicio.tsx`): personal, de quien está en la cuenta (decidido 17 oct 2026). Tus tareas (Para hoy: avisos automáticos de mis vendedores, tareas vencidas y de hoy; Sin fecha; Hechas hoy), Recordatorios (tareas con fecha futura), Hoy (reuniones Calendly propias), Esperando a otros (lo que asigné a otro), Del equipo (Bandeja, Pidieron llamada, suscripciones por renovar). Los KPIs del equipo viven en Embudo/Stats. Diseño aprobado por Felipe: niveles por color (rojo urgente, ámbar hoy, azul esta semana) con barra izquierda y cifra corta, etiqueta de etapa con color de fase, fondo blanco. No usar la clase `.aviso` (es de otro componente).
- **Avisos por etapa** (`lib/alertas.ts`, `components/Etapa.tsx`, días hábiles con festivos de Colombia en `lib/habiles.ts`), definidos con Felipe el 17 oct 2026. Le salen al responsable salvo No contactado (a todo el equipo):
  - No contactado: entran sin responsable (menos los B); contador en Inicio y alerta a los 3 días hábiles. Quien lo saca de No contactado queda de responsable (trigger `vendedores_asignar`).
  - Contactado: alerta a los 3 días hábiles sin agendar. Calendly mueve solo a Reunión agendada (cruza el correo; si no cruza, aviso "¿De quién es?" para vincular). Inicio sincroniza Calendly al cargar, máximo cada 10 min.
  - Reunión agendada: `vendedores.reunion_en`. Si pasó la hora, acción Se hizo / No asistió (vuelve a Contactado) / Se reagendó (pide fecha).
  - Reunión hecha: alerta a las 48 h. Ficha: Generar NDA, Ya los envié (pasa a NDA + docs), No quiere seguir (Perdido, motivo desistió).
  - NDA + docs: recordatorios a los 5, 10 y 15 días hábiles (tarea para el equipo, se marcan con `actividades.clave = 'recordatorio_docs'`); a los 20 con 3 recordatorios, pasar a En reserva. Subir un documento recibido pasa solo a Docs recibidos (trigger `documentos_recibidos_auto`).
  - Docs recibidos: sin aviso. Botón Valorar pasa a Valoración en curso (código `val_profunda`); el plazo de 14 días calendario corre desde ahí. Escalones día 7, 10, 13 y vencida.
  - Valoración completa (`val_completa`): alerta a los 7 días. De ahí para abajo no hay avisos todavía (decisión de Felipe).
  - "Próxima acción" sigue eliminada; no revivirla como aviso.
- **NDA y lista de documentos** (`pages/Paquete.tsx`, ruta `/vendedores/:id/enviar`, PDF en `src/docs/lista.ts`), decidido con Felipe el 17 oct 2026: las listas se personalizan por cliente según la reunión. Base fija de 7 documentos (estados financieros 3 años y corte, retiros y gastos del dueño, deudas, ventas por cliente, cartera, nómina) más módulos que se encienden (sedes, sociedades, inmuebles, contratos, riesgos, reorganización, operación, marcas, impuestos, proyecciones, valoraciones u ofertas) e ítems libres; todo editable. El PDF de la lista copia el diseño de las listas de Innova Express y Tolimense (portada azul con la ciudad `public/docimg/ciudad.png`) y lo firma "Equipo Relevo". Un clic genera NDA + lista, los guarda en la ficha (tabla `paquetes`, `documentos.paquete_id`), crea cada documento pedido como pendiente y deja el borrador en el Gmail de quien lo prepara con los dos PDF adjuntos (`/api/gmail` acepta `adjuntos`). No cambia la etapa: "Ya los envié" pasa a NDA + docs y marca los dos PDF como enviados.
  - Ficha: "Documentos del cliente" (recibir, con barra de cuántos de lo pedido llegaron y botón para subir el archivo de cada pendiente) separado de "Enviados por Relevo" (enviar). "Subir varios" ya no cierra todos los pendientes: cada archivo puede marcarse como uno de los pedidos.
- **Tareas** (tabla `tareas`, `components/Tareas.tsx`): título, fecha opcional (con fecha = recordatorio), asignado (se pueden asignar entre socios), creador, vendedor opcional. Panel de Tareas en la ficha del vendedor. Solo en la app, sin correo. Notion ya no se usa: no leer ni sincronizar sus to-dos.
- **CRM vendedores** (`Vendedores`, `VendedorFicha`): etapas en tabla `etapas` (pipeline vendedor). Filtro Activos/Todos (Activo = todo menos En reserva) y filtros de selección múltiple (`components/Multi.tsx`). "Próxima acción" se eliminó a propósito. La ficha tiene Otros contactos (tabla `personas`), documentos con descarga, NIT editable.
- **Bandeja**: leads de la web (`v_bandeja`). El contador del menú se actualiza al aprobar o descartar (evento `bandeja:cambio`). Alerta "Correo mal escrito" con corrección sugerida. Los de ventas < $1.000M no entran (les llega correo automático de rechazo desde hablaconrelevo.com, en `api/notify-lead.js` del proyecto web). Aprobar un B lo deja a cargo de Valoraciones.
- **Buckets**: A 5.000 a 20.000M, B 1.000 a 5.000M, C < 1.000M, D > 20.000M.
- **Valoración flash** (`pages/Flash.tsx`, `src/flash/`): solo bucket B, motor de Alejo (`motor.ts`). Alejo es dueño de la metodología: respetar lo que él decida. Los supuestos se editan en Admin → Supuestos de valoración (los socios entran a esa pestaña; el resto de Admin es solo para Felipe). Empresas con * (deducidas del correo) nunca se nombran frente al cliente: correo, PDF y formulario dicen "tu empresa".
  - Responsable de todos los B: el usuario "Valoraciones" (valoraciones@relevobrokers.com). Cuando alguien toma un caso ("Lo tomo" en Pidieron llamada) queda como responsable y el lead pasa a Contactado.
  - Etapas B: No contactado, luego "Val. flash enviada" (código `val_preliminar`), luego Contactado si toman el caso, o En reserva.
  - Los B se atienden solo por correo, desde valoraciones@, firmado "Equipo Relevo" (nunca con nombre personal).
  - Al enviar la flash va con el formulario "Cuéntanos tu caso" (relevobrokers.com/caso?c=CODIGO, `caso.html` en la raíz). Excepción: horizonte "Solo quiero saber cuánto vale" recibe solo la flash con la puerta abierta a vender, sin formulario, y queda En reserva.
  - Envíos en lote espaciados 20 a 45 s. El lote corre en el navegador: su estado vive en `src/lib/lote.ts` (aviso global en Layout, no se recarga la app ni se cierra la pestaña sin confirmar mientras corre). Selector "Al valorar": solo valorar / borrador / enviar de una vez. Listas cerradas por defecto.
  - Correos: `revisarCorreo` (en `_correo.js`) detecta errores típicos (gmial.com, .con, .com.com) y sugiere la corrección; `/api/gmail` además verifica que el dominio reciba correo (MX) y bloquea el envío si no. Un rebote se registra con el botón "El correo rebotó" (actividad "Rebotó el correo a X"): el lead vuelve a por enviar y no recibe recordatorios hasta corregirlo.
- **Formulario "Cuéntanos tu caso"**: prueba la hipótesis de un mercado informal de compraventa de pymes que necesita acompañamiento (cuántos ya conversaron con un comprador, cuántos se frenan por plata). Columnas `form_codigo`, `form_enviado_en`, `form_respondido_en`; tabla `formulario_respuestas`; RPC `formulario_datos` y `formulario_responder` (anon). Sin avance automático entre preguntas (público mayor). Si responden "No" a la primera, se saltan las preguntas del comprador y la de llamada.
- **Compradores**, **Documentos** (NDA a nombre de la SAS, firmado por Felipe como representante legal), **Calendario** (Calendly, por defecto solo lo propio), **Empresa** (documentos legales de la SAS), **Embudo/Stats**, **Admin** (notas de la app).
- **Finanzas**: movimientos, estados financieros formato PUC a 4 dígitos con PDF de marca (`src/lib/estados.ts`, `src/docs/estados.ts`), cuentas entre socios 50/50, suscripciones. Capital: autorizado 50M, suscrito 5M, pagado 10.000 (en caja); suscrito no pagado como activo 1325 por defecto. Lo pagado por socios de su bolsillo es deuda 2355; transferencias a la cuenta de Relevo son aporte a capital.

## Acceso y dominio
- App en https://app.relevobrokers.com (la dirección vieja relevoapp-delta.vercel.app sigue funcionando). En Supabase, Site URL y Redirect URLs apuntan al dominio nuevo.
- Invitación o "olvidé mi contraseña" llevan a crear contraseña (`CrearClave` en `Login.tsx`); también se cambia en Mi perfil. Entrar con Google quedó como opción futura, no implementada.
- En Gmail de Felipe, valoraciones@ es un alias con "Enviar como". Lo enviado por valoraciones@ se separa con un filtro de Gmail (etiqueta "Valoraciones").

## Estrategia para los B (contexto de negocio, oct 2026)
- Felipe no quiere "ignorar a los pequeños": Relevo debe encontrar una forma tan eficiente de atenderlos que valga la pena. Relevo NO es un marketplace.
- Hipótesis principal: existe un mercado informal de compraventa de pymes donde el dueño ya tiene comprador (empleado, socio, competidor, proveedor) y vende al precio que cree, que le dice el contador o que le ofrecen; necesita acompañamiento y, a veces, financiación. Si se confirma, Relevo entra a transacciones casi hechas.
- Ideas en evaluación: probar la financiación (pago a plazos del vendedor + crédito bancario; reuniones con bancas pyme con Eduardo de Grandes Patrimonios), atención en grupo (webinar mensual como filtro de compromiso), contadores como canal. Todavía no hay pool de compradores.
- El formulario "Cuéntanos tu caso" es la herramienta para validar esto antes de invertir tiempo. Ojo: muestra pequeña y sesgada (llegaron por un anuncio de valoración); las llamadas con quien diga que tiene comprador valen más que los porcentajes.

## Estado al 17 oct 2026
- Valoraciones flash de los B y formularios: hechos (confirmado por Felipe el 17 oct 2026).
- Rebotes conocidos: Andres Valverde (gerencia@mansenlc.com, dominio sin correo; solo quería saber el valor; se sugirió mandarle el PDF por WhatsApp y marcar enviado). Claudia Pérez tiene `presinve.com.com` (corregir a presinve.com y reenviar con "El correo rebotó").
- Las empresas con * Solucash, Presinve y Frlboxcol recibieron el correo con el nombre deducido antes de la regla nueva.
- Notion dejó de usarse (confirmado por Felipe el 17 oct 2026): la app es la única fuente.

## Migraciones
SQL en `supabase/` (sin datos personales). Desde las herramientas de Claude a veces no se puede correr DDL ni borrar vendedores: en ese caso se le pasa el archivo a Felipe para que lo corra en el SQL Editor.

## Pendientes conocidos
- Borrar el vendedor de prueba "PRUEBA Felipe Pardo" desde su ficha (Claude no pudo borrarlo; está en Perdido).
- Detección automática de rebotes: Felipe eligió la opción de leer su buzón (no crear cuenta propia para valoraciones@). Falta que agregue `https://www.googleapis.com/auth/gmail.readonly` a la delegación de dominio; luego construir la revisión (buscar from:mailer-daemon, marcar rebote) y, si se quiere, mostrar respuestas de clientes en la ficha.
- Etapas "En pausa" y "No asistió" de Notion no existen en la app (Fabián Echeverri, Jorge Granados quedaron en etapas aproximadas).
- Estados financieros: la línea de firma del contador sale en blanco hasta que haya contador.
- Revisar respuestas del formulario y decidir el modelo para B según los resultados.
