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
- **CRM vendedores** (`Vendedores`, `VendedorFicha`): etapas en tabla `etapas` (pipeline vendedor). Filtro Activos/Todos (Activo = todo menos En reserva) y filtros de selección múltiple (`components/Multi.tsx`). "Próxima acción" se eliminó a propósito. La ficha tiene Otros contactos (tabla `personas`), documentos con descarga, NIT editable.
- **Bandeja**: leads de la web (`v_bandeja`). Los de ventas < $1.000M no entran (les llega correo automático de rechazo desde hablaconrelevo.com, en `api/notify-lead.js` del proyecto web). Aprobar un B lo deja a cargo de Valoraciones.
- **Buckets**: A 5.000 a 20.000M, B 1.000 a 5.000M, C < 1.000M, D > 20.000M.
- **Valoración flash** (`pages/Flash.tsx`, `src/flash/`): solo bucket B, motor de Alejo (`motor.ts`). Alejo es dueño de la metodología: respetar lo que él decida.
  - Responsable de todos los B: el usuario "Valoraciones" (valoraciones@relevobrokers.com). Cuando alguien toma un caso ("Lo tomo" en Pidieron llamada) queda como responsable y el lead pasa a Contactado.
  - Etapas B: No contactado, luego "Val. flash enviada" (código `val_preliminar`), luego Contactado si toman el caso, o En reserva.
  - Los B se atienden solo por correo, desde valoraciones@, firmado "Equipo Relevo" (nunca con nombre personal).
  - Al enviar la flash va con el formulario "Cuéntanos tu caso" (relevobrokers.com/caso?c=CODIGO, `caso.html` en la raíz). Excepción: horizonte "Solo quiero saber cuánto vale" recibe solo la flash con la puerta abierta a vender, sin formulario, y queda En reserva.
  - Envíos en lote espaciados 20 a 45 s.
  - Correos: `revisarCorreo` (en `_correo.js`) detecta errores típicos (gmial.com, .con, .com.com) y sugiere la corrección; `/api/gmail` además verifica que el dominio reciba correo (MX) y bloquea el envío si no. Un rebote se registra con el botón "El correo rebotó" (actividad "Rebotó el correo a X"): el lead vuelve a por enviar y no recibe recordatorios hasta corregirlo.
- **Formulario "Cuéntanos tu caso"**: prueba la hipótesis de un mercado informal de compraventa de pymes que necesita acompañamiento (cuántos ya conversaron con un comprador, cuántos se frenan por plata). Columnas `form_codigo`, `form_enviado_en`, `form_respondido_en`; tabla `formulario_respuestas`; RPC `formulario_datos` y `formulario_responder` (anon). Sin avance automático entre preguntas (público mayor). Si responden "No" a la primera, se saltan las preguntas del comprador y la de llamada.
- **Compradores**, **Documentos** (NDA a nombre de la SAS, firmado por Felipe como representante legal), **Calendario** (Calendly, por defecto solo lo propio), **Empresa** (documentos legales de la SAS), **Embudo/Stats**, **Admin** (notas de la app).
- **Finanzas**: movimientos, estados financieros formato PUC a 4 dígitos con PDF de marca (`src/lib/estados.ts`, `src/docs/estados.ts`), cuentas entre socios 50/50, suscripciones. Capital: autorizado 50M, suscrito 5M, pagado 10.000 (en caja); suscrito no pagado como activo 1325 por defecto. Lo pagado por socios de su bolsillo es deuda 2355; transferencias a la cuenta de Relevo son aporte a capital.

## Migraciones
SQL en `supabase/` (sin datos personales). Desde las herramientas de Claude a veces no se puede correr DDL ni borrar vendedores: en ese caso se le pasa el archivo a Felipe para que lo corra en el SQL Editor.

## Pendientes conocidos
- Borrar el vendedor de prueba "PRUEBA Felipe Pardo" desde su ficha.
- Enviar los B valorados repartidos en varios días (dominio nuevo, cuidar reputación).
- Revisar respuestas del formulario y decidir el modelo para B según los resultados.
