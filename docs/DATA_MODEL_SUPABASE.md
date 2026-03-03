# Modelo de datos y RPC (Supabase)

## 1. Tablas

### `public.tournaments`

- `id uuid PK`
- `public_id text unique`
- `admin_token text unique`
- `title text`
- `subtitle text null`
- `created_at timestamptz`

### `public.players`

- `id uuid PK`
- `tournament_id uuid FK -> tournaments.id`
- `name text`
- `handicap integer`
- `created_at timestamptz`

### `public.matches`

- `id uuid PK`
- `tournament_id uuid FK`
- `p1_player_id uuid FK -> players.id`
- `p2_player_id uuid FK -> players.id`
- `match_date date null`
- `score1 int null` (0..7)
- `score2 int null` (0..7)
- `points1 numeric`
- `points2 numeric`
- `played boolean`
- `created_at timestamptz`

### `public.scoring_rules`

- `tournament_id uuid FK`
- `winner_handicap int`
- `loser_handicap int`
- `points numeric`
- PK compuesta: `(tournament_id, winner_handicap, loser_handicap)`

## 2. Funciones principales

- `recalculate_tournament(uuid)`
- `tournament_payload(uuid, bool)`
- `create_tournament(title, players_json, subtitle?)`
- `get_tournament_public(public_id)`
- `get_tournament_admin(admin_token)`
- `update_tournament_title(admin_token, title, subtitle?)`
- `update_player(admin_token, player_id, name, handicap)`
- `add_player(admin_token, name, handicap)`
- `delete_player(admin_token, player_id)`
- `update_match(admin_token, match_id, score1, score2, match_date)`
- `update_scoring_rules(admin_token, rules_json)`

## 3. Invariantes de dominio

- No hay empates validos en partidos jugados.
- Scores validos entre 0 y 7.
- Partido jugado si scores no nulos y distintos.
- Puntos del perdedor siempre 0.
- Cambios en handicap/reglas/resultados disparan recalculo global.

## 4. Seguridad

- RLS habilitado en tablas.
- Operaciones directas en tablas no permitidas para `anon/authenticated`.
- Uso esperado: solo funciones RPC con `SECURITY DEFINER`.

## 5. Notas operativas

- Tras cambios en `supabase.sql`, re-ejecutar script completo en SQL Editor.
- Mantener compatibilidad de payload JSON para no romper frontend.
