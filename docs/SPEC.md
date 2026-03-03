# Especificacion funcional y no funcional

## 1. Objetivo del producto

Corquet League permite organizar torneos de croquet entre amigos, simplificando:

- alta de jugadores
- gestion de resultados
- clasificacion automatica
- comparticion de enlaces publico/admin

## 2. Entidades principales

- Torneo
- Jugador
- Partido
- Regla de puntuacion por handicap

## 3. Requisitos funcionales

### 3.1 Creacion de torneo

- El usuario crea torneo con:
  - titulo (obligatorio)
  - subtitulo (opcional; pensado para fechas/lugar)
  - lista de jugadores (nombre + handicap)
- Minimo de jugadores validos: 2.
- Al crear torneo se generan emparejamientos round-robin (todos contra todos, 1 partido por pareja).
- Se generan 2 identificadores de acceso:
  - `publicId` para lectura
  - `adminToken` para edicion

### 3.2 Reglas de partido y puntuacion

- Rango de aros por jugador: 0..7.
- No se permiten empates.
- Un partido se considera jugado cuando hay dos scores validos y distintos.
- Gana quien tenga mas aros (puede ganar con menos de 7).
- Puntos:
  - ganador obtiene puntos segun tabla de handicap
  - perdedor obtiene 0
- Si no hay resultado valido, partido no jugado y puntos 0/0.

### 3.3 Vistas del torneo

#### Resultados

- Columnas:
  - Jugador 1
  - Jugador 2
  - Fecha
  - Aros J1
  - Aros J2
  - Puntos J1
  - Puntos J2
- En admin:
  - fecha editable
  - aros editables
  - boton guardar por partido
- En publico:
  - solo lectura

#### Clasificacion

- Columnas:
  - Jugador
  - Jugados
  - Ganados
  - Diferencia de aros
  - Puntos
- Orden:
  1. Puntos (desc)
  2. Diferencia de aros (desc)
  3. Ganados (desc)
  4. Nombre (asc)

#### Jugadores

- Visible en publico/admin.
- En admin:
  - editar nombre/handicap
  - anadir jugador nuevo
  - borrar jugador (solo si no tiene resultados cargados)
- Al cambiar handicap o nombre se recalcula torneo completo.

#### Compartir

- Copia enlace publico.
- Copia enlace admin (solo si modo admin).
- Visualizacion opcional de enlaces completos.
- Descarga Excel del torneo.

#### Configuracion (solo admin)

- Editar titulo + subtitulo.
- Editar reglas de puntos por handicap.
- Reglas en filas con campos:
  - handicap ganador
  - handicap perdedor
  - puntos

### 3.4 Exportacion a Excel

Boton en pestana Compartir. Genera `.xlsx` con hojas:

1. `campeonato` (primera)
  - titulo
  - subtitulo
  - fecha_exportacion (ISO)
  - fecha_exportacion_local
  - enlace_publico
  - enlace_admin (solo admin)
2. `jugadores`
3. `resultados`
4. `clasificacion`
5. `reglas_handicap`

### 3.5 Indice local de torneos

- Home muestra seccion `Mis torneos` con datos de `localStorage`.
- Cada vez que se abre un enlace publico/admin se registra/actualiza entrada local.
- Si existe acceso admin para torneo, se prioriza sobre publico.
- Si no hay torneos en local, seccion `Mis torneos` se oculta.

## 4. Requisitos no funcionales

### 4.1 UX y responsive

- Debe funcionar en movil y desktop.
- Header compacto en movil para reducir espacio vertical.
- Evitar overflow horizontal por URLs largas (enlaces movidos a pestana Compartir).
- Formularios con mensajes amigables de error.

### 4.2 Seguridad

- No existe login de usuarios finales.
- Seguridad por enlaces:
  - `publicId`: lectura
  - `adminToken`: edicion
- No exponer claves secretas en frontend.
- Usar solo `supabaseAnonKey` + RPC `SECURITY DEFINER`.

### 4.3 Fiabilidad del calculo

- Recalculo del torneo debe ejecutarse tras cambios en:
  - resultados
  - jugadores (nombre/handicap/alta/baja)
  - reglas de handicap

### 4.4 Operacion

- Aplicacion desplegable como sitio estatico.
- Dependencia de Supabase para datos/transacciones.
- Compatible con GitHub Pages.

## 5. Criterios de aceptacion (alto nivel)

- Crear torneo y abrir enlace admin funciona.
- Enlace publico muestra solo lectura.
- Cambiar un resultado actualiza puntos y clasificacion.
- Cambiar handicap recalcula puntos historicos del jugador afectado.
- Excel contiene todas las hojas y metadatos esperados.
- Home lista torneos visitados y oculta bloque si vacio.
