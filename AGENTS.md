# AGENTS.md - Project context for AI contributors

Este archivo complementa la documentacion de `docs/` y da una guia rapida para empezar.

## Leer primero

1. `docs/README.md`
2. `docs/SPEC.md`
3. `docs/ARCHITECTURE.md`
4. `docs/rules/AI_CONTRIBUTION_RULES.md`

## Estado actual del proyecto

- Frontend React (CDN + Babel) en `public/app.jsx`.
- Deploy estatico en GitHub Pages.
- Persistencia y logica de negocio en Supabase RPC (`supabase.sql`).
- Export Excel activo desde pestaña Compartir.

## Reglas de contribucion

- Mantener hash routes para compartir enlaces.
- No usar claves secretas en cliente.
- Si cambias RPC o schema, actualiza `supabase.sql` y documentacion.
- Si cambias UI, preservar experiencia movil.
- Si cambias export, preservar hojas existentes salvo solicitud explicita.

## Entregables esperados en cada cambio relevante

- Codigo actualizado.
- Nota de validacion ejecutada (que se comprobo).
- Documentacion actualizada en `docs/` y/o `README.md`.
