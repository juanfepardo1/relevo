# Relevo (repo)

- Raíz: web pública (relevobrokers.com, proyecto Vercel `relevo`): index.html, compradores.html, caso.html (formulario "Cuéntanos tu caso"), api/notify-lead.js.
- `app/`: app interna (app.relevobrokers.com, proyecto Vercel `relevo_app`). Antes de tocarla, lee `app/CLAUDE.md`: tiene el contexto, las decisiones y los pendientes.
- `supabase/`: migraciones SQL sin datos personales.
- Siempre `git pull --rebase` antes de `git push`: varias sesiones publican en `main`.
- Felipe trabaja en español, breve, sin guiones largos. Nunca escribir llaves ni tokens en el código o el chat.
