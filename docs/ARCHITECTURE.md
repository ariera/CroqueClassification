# Arquitectura tecnica

## 1. Vision general

Arquitectura actual orientada a frontend estatico + backend logico en Supabase RPC.

- Cliente: React 18 (CDN, sin bundler) en `public/app.jsx`.
- DB + logica de dominio: Postgres + funciones SQL en `supabase.sql`.
- Hosting estatico: GitHub Pages.
- CI/CD de Pages: GitHub Actions (`deploy-pages.yml`).

## 2. Componentes

### 2.1 Frontend

Archivos clave:

- `public/index.html`
- `public/app.jsx`
- `public/styles.css`
- `public/config.js` (URL + anon key)

Patron:

- enrutado por `window.location.hash`
- estado principal en componente `App`
- llamadas a Supabase via helper `rpc(fn, params)`
- persistencia local de enlaces con `localStorage`

### 2.2 Supabase

`supabase.sql` define:

- tablas (`tournaments`, `players`, `matches`, `scoring_rules`)
- funciones de dominio (create/get/update/recalculate)
- RLS habilitado
- acceso anon/authenticated revocado sobre tablas
- permisos de ejecucion solo a funciones RPC necesarias

## 3. Flujo de datos

1. UI ejecuta RPC contra Supabase.
2. RPC valida permisos por token admin/public.
3. RPC muta datos y/o recalcula torneo.
4. RPC devuelve payload JSON consolidado del torneo.
5. UI reemplaza estado completo con payload.

## 4. Decisiones relevantes

- Se usa hash routing para compatibilidad total con GitHub Pages (sin rewrites servidor).
- Se usa token por enlace en lugar de autenticacion usuario/password.
- Calculo de clasificacion y puntos centralizado en DB (consistencia unica).
- Export Excel se genera en cliente para evitar infraestructura extra.

## 5. Limitaciones conocidas

- React via Babel en runtime (sin build step) es practico pero menos optimo en rendimiento que bundle precompilado.
- Modelo de seguridad basado en secreto-enlace admin (si se filtra, se pierde control de escritura).
- `localStorage` de indice es por dispositivo/navegador, no sincronizado entre dispositivos.

## 6. Evolucion recomendada

- Migrar a build moderno (Vite) manteniendo mismo contrato RPC.
- Introducir telemetria y auditoria de cambios admin.
- Considerar autenticacion opcional para admins en futuras versiones.
