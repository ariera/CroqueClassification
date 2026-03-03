# Documentacion del proyecto: Corquet League

Este directorio contiene contexto operativo para personas y agentes IA.

## Indice

- [Especificacion funcional y no funcional](./SPEC.md)
- [Arquitectura tecnica](./ARCHITECTURE.md)
- [Modelo de datos y RPC de Supabase](./DATA_MODEL_SUPABASE.md)
- [Flujos de UI, rutas y permisos](./FRONTEND_FLOWS.md)
- [Reglas para agentes IA](./rules/AI_CONTRIBUTION_RULES.md)
- [Checklist de cambios y despliegue](./rules/CHANGE_CHECKLIST.md)

## Resumen rapido

- Producto: gestor social de torneos de croquet round-robin.
- Frontend: React 18 (CDN + Babel) en `public/app.jsx`.
- Persistencia/logica: Supabase Postgres + funciones RPC en `supabase.sql`.
- Hosting: GitHub Pages via GitHub Actions (workfow en `.github/workflows/deploy-pages.yml`).
- Comparticion: hash routes (`#/t/<publicId>`, `#/a/<adminToken>`).
