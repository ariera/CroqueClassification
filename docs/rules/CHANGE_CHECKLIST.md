# Checklist de cambios y despliegue

## Antes de modificar

- Leer `docs/SPEC.md` y `docs/ARCHITECTURE.md`.
- Identificar si el cambio afecta:
  - UI
  - RPC/DB
  - permisos
  - export Excel

## Durante el cambio

- Mantener coherencia entre frontend y RPC.
- Si hay nuevas reglas de negocio, documentarlas.
- Evitar cambios destructivos en datos existentes.

## Validacion minima

- Home carga correctamente.
- Crear torneo funciona.
- Vista publica carga.
- Vista admin carga y guarda cambios.
- Clasificacion se actualiza tras cambios de resultados/handicap.
- Export Excel contiene todas las hojas esperadas.

## Despliegue

1. Commit con mensaje claro.
2. Push a `main`.
3. Verificar workflow de GitHub Pages.
4. Hard refresh en navegador para evitar cache.
5. Si hubo cambios SQL: re-ejecutar `supabase.sql` en Supabase.

## Rollback basico

- Revertir commit problematico.
- Re-deploy en Pages.
- Si aplica, restaurar version previa de funciones SQL.
