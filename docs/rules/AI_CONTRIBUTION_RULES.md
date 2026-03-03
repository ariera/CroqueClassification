# Reglas para agentes IA en este proyecto

## 1. Objetivo de estas reglas

Reducir cambios inconsistentes y preservar comportamiento funcional.

## 2. Reglas de oro

1. No romper contrato RPC sin actualizar `supabase.sql` y frontend a la vez.
2. No introducir secretos en frontend (nunca usar service role key).
3. Mantener rutas hash (`#/t`, `#/a`) para compatibilidad con Pages.
4. Cambios que afecten calculo de puntos/clasificacion deben validar recalculo completo.
5. No eliminar soporte movil; revisar estilos responsive al tocar layout.

## 3. Convenciones tecnicas

- Frontend principal en `public/app.jsx`.
- Estilos en `public/styles.css`.
- DB/RPC en `supabase.sql` (source of truth).
- Documentar cambios relevantes en `docs/` y `README.md`.

## 4. Cuando toques Supabase

- Preferir `create or replace function` para migraciones idempotentes.
- Mantener RLS habilitado y permisos de tablas revocados.
- Añadir `grant execute` solo a RPC necesarias.
- Reejecutar script completo en SQL Editor tras cambios.

## 5. Cuando toques frontend

- Mantener mensajes de error claros y en espanol.
- Evitar overflow horizontal en movil.
- Si agregas recursos estaticos, incrementar version querystring en `index.html` para cache busting.

## 6. Calidad minima antes de finalizar

- Revisar que no quedan referencias rotas (`rg`).
- Confirmar que rutas admin/public/home siguen navegables.
- Verificar que export Excel sigue generando todas las hojas.
