# Flujos de UI, rutas y permisos

## 1. Rutas

La app usa hash routes:

- Home: `#/` (o sin hash)
- Torneo publico: `#/t/<publicId>`
- Torneo admin: `#/a/<adminToken>`

Se mantienen rutas legacy por pathname, pero el modo principal es hash para GitHub Pages.

## 2. Home

Secciones:

1. `Mis torneos` (solo visible si hay entradas en localStorage)
2. `Nuevo torneo`

### `Mis torneos`

- Fuente: `localStorage` clave `corquet_league_known_tournaments_v1`.
- Datos guardados por torneo:
  - `publicId`
  - `adminToken?`
  - `title`
  - `subtitle?`
  - `lastVisitedAt`
- Si existe `adminToken`, se muestra acceso Administrador.

## 3. Cabecera global

- Marca `Corquet League` es enlace a Home.
- Badge de modo:
  - admin: `Modo administrador`
  - publico: `Modo publico (solo lectura)`

## 4. Pestañas de torneo

- Resultados
- Clasificacion
- Jugadores
- Compartir
- Configuracion (solo admin)

## 5. Permisos por modo

### Publico

- lectura completa de resultados, clasificacion y jugadores
- puede copiar enlace publico
- puede descargar Excel

### Admin

- todo lo del modo publico
- edicion de resultados y fecha
- edicion/alta/baja de jugadores (con restricciones)
- edicion de cabecera (titulo/subtitulo)
- edicion de reglas de handicap
- copia de enlace admin

## 6. Mensajeria UX

- Errores de validacion y RPC se muestran como mensajes amigables en cada contexto.
- Errores criticos de carga muestran pantalla simple de error.

## 7. Export Excel

- Trigger: boton `Descargar Excel` en pestaña Compartir.
- Hoja `campeonato` incluye metadatos y enlaces segun modo.
