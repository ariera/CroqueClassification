# CroqueClassification (GitHub Pages + Supabase)

Aplicación web para gestionar torneos de croquet formato round-robin (todos contra todos), lista para publicarse como frontend estático en GitHub Pages.

## Qué hace

- Alta de jugadores (nombre y hándicap)
- Creación automática de emparejamientos round-robin
- Tabla de resultados:
  - Jugador 1, Jugador 2
  - Fecha (editable solo admin)
  - Aros J1, Aros J2 (0 a 7)
  - Puntos J1, Puntos J2
- Tabla de clasificación:
  - Jugador
  - Jugados
  - Ganados
  - Diferencia de aros
  - Puntos
- Tabla de jugadores (público y admin)
- Edición de nombre/hándicap de jugadores (solo admin)
- Cálculo automático de puntos por hándicap
- Enlace público (solo lectura) y enlace admin (edición)

## Regla de ganador

Un partido cuenta como jugado cuando:

- ambos resultados están informados (0 a 7)
- no hay empate
- gana quien tenga más aros (aunque sea con menos de 7)

Si no se cumple, puntos del partido = 0 para ambos y no suma como jugado.

## Reglas de puntos por defecto

- `6|6 -> 10`
- `6|7 -> 9`
- `6|8 -> 8`
- `7|6 -> 11`
- `7|7 -> 10`
- `7|8 -> 9`
- `8|6 -> 12`
- `8|7 -> 11`
- `8|8 -> 10`

Si una combinación no existe, vale 1 punto por victoria.

## Arquitectura

- Frontend estático: `public/` (GitHub Pages)
- Persistencia + lógica: Supabase Postgres + funciones RPC (archivo `supabase.sql`)
- Sin servidor Node obligatorio en producción

## Configurar Supabase

1. Crea un proyecto en Supabase.
2. En `SQL Editor`, ejecuta completo el archivo [`supabase.sql`](/Users/mainar/Documents/CroqueClassification/supabase.sql).
3. Ve a `Project Settings -> API` y copia:
   - `Project URL`
   - `anon public key`
4. Edita [`public/config.js`](/Users/mainar/Documents/CroqueClassification/public/config.js):

```js
window.APP_CONFIG = {
  supabaseUrl: 'https://TU-PROYECTO.supabase.co',
  supabaseAnonKey: 'TU_ANON_KEY'
};
```

## Publicar en GitHub Pages

1. Sube el repositorio a GitHub.
2. En `Settings -> Pages`:
   - `Source`: `Deploy from a branch`
   - `Branch`: `main` (o la tuya)
   - `Folder`: `/public`
3. Guarda y espera la URL de Pages.
4. Abre la URL y crea torneo.

## Compartición de enlaces

La app usa rutas hash para compatibilidad con Pages:

- Público: `https://tuusuario.github.io/turepo/#/t/<publicId>`
- Admin: `https://tuusuario.github.io/turepo/#/a/<adminToken>`

## Seguridad

- El token admin permite editar.
- No compartas el enlace admin fuera de organización.
- Las tablas están con RLS activo y sin acceso directo para anon/authenticated.
- La app usa solo funciones RPC `SECURITY DEFINER`.

## Desarrollo local (frontend estático)

Puedes abrir `public/index.html` directamente o servir `public/` con cualquier servidor estático.
