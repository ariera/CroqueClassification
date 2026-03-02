-- CroqueClassification schema + RPC for GitHub Pages + Supabase
-- Run this file in Supabase SQL Editor.

create extension if not exists pgcrypto;

create or replace function public.gen_prefixed_id(prefix text)
returns text
language sql
volatile
as $$
  select prefix || '_' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 16);
$$;

create table if not exists public.tournaments (
  id uuid primary key default gen_random_uuid(),
  public_id text not null unique,
  admin_token text not null unique,
  title text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.players (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  name text not null,
  handicap integer not null,
  created_at timestamptz not null default now()
);

create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  p1_player_id uuid not null references public.players(id) on delete cascade,
  p2_player_id uuid not null references public.players(id) on delete cascade,
  match_date date null,
  score1 integer null,
  score2 integer null,
  points1 numeric not null default 0,
  points2 numeric not null default 0,
  played boolean not null default false,
  created_at timestamptz not null default now(),
  constraint matches_players_different check (p1_player_id <> p2_player_id),
  constraint matches_score1_range check (score1 is null or (score1 >= 0 and score1 <= 7)),
  constraint matches_score2_range check (score2 is null or (score2 >= 0 and score2 <= 7))
);

create table if not exists public.scoring_rules (
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  winner_handicap integer not null,
  loser_handicap integer not null,
  points numeric not null,
  primary key (tournament_id, winner_handicap, loser_handicap)
);

create index if not exists idx_players_tournament on public.players (tournament_id);
create index if not exists idx_matches_tournament on public.matches (tournament_id);
create index if not exists idx_matches_p1 on public.matches (p1_player_id);
create index if not exists idx_matches_p2 on public.matches (p2_player_id);
create index if not exists idx_scoring_rules_tournament on public.scoring_rules (tournament_id);

create or replace function public.recalculate_tournament(p_tournament_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  with calc as (
    select
      m.id,
      p1.handicap as h1,
      p2.handicap as h2,
      (m.score1 is not null and m.score2 is not null and m.score1 <> m.score2
        and m.score1 between 0 and 7 and m.score2 between 0 and 7) as valid,
      (m.score1 is not null and m.score2 is not null and m.score1 > m.score2
        and m.score1 between 0 and 7 and m.score2 between 0 and 7) as p1_wins,
      (m.score1 is not null and m.score2 is not null and m.score2 > m.score1
        and m.score1 between 0 and 7 and m.score2 between 0 and 7) as p2_wins
    from public.matches m
    join public.players p1 on p1.id = m.p1_player_id
    join public.players p2 on p2.id = m.p2_player_id
    where m.tournament_id = p_tournament_id
  ),
  points_calc as (
    select
      c.id,
      c.valid,
      c.p1_wins,
      c.p2_wins,
      coalesce((
        select sr.points
        from public.scoring_rules sr
        where sr.tournament_id = p_tournament_id
          and sr.winner_handicap = c.h1
          and sr.loser_handicap = c.h2
      ), 1) as p1_win_points,
      coalesce((
        select sr.points
        from public.scoring_rules sr
        where sr.tournament_id = p_tournament_id
          and sr.winner_handicap = c.h2
          and sr.loser_handicap = c.h1
      ), 1) as p2_win_points
    from calc c
  )
  update public.matches m
  set
    played = pc.valid,
    points1 = case when pc.valid and pc.p1_wins then pc.p1_win_points else 0 end,
    points2 = case when pc.valid and pc.p2_wins then pc.p2_win_points else 0 end
  from points_calc pc
  where m.id = pc.id;
end;
$$;

create or replace function public.tournament_payload(p_tournament_id uuid, p_include_admin boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  t record;
  rules_obj jsonb;
  players_arr jsonb;
  matches_arr jsonb;
  standings_arr jsonb;
begin
  select * into t
  from public.tournaments
  where id = p_tournament_id;

  if not found then
    raise exception 'Torneo no encontrado';
  end if;

  select coalesce(
    jsonb_object_agg((sr.winner_handicap::text || '|' || sr.loser_handicap::text), sr.points),
    '{}'::jsonb
  )
  into rules_obj
  from public.scoring_rules sr
  where sr.tournament_id = p_tournament_id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', p.id,
        'name', p.name,
        'handicap', p.handicap
      )
      order by p.name
    ),
    '[]'::jsonb
  )
  into players_arr
  from public.players p
  where p.tournament_id = p_tournament_id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', m.id,
        'p1Id', m.p1_player_id,
        'p2Id', m.p2_player_id,
        'matchDate', m.match_date,
        'score1', m.score1,
        'score2', m.score2,
        'points1', m.points1,
        'points2', m.points2,
        'played', m.played
      )
      order by p1.name, p2.name
    ),
    '[]'::jsonb
  )
  into matches_arr
  from public.matches m
  join public.players p1 on p1.id = m.p1_player_id
  join public.players p2 on p2.id = m.p2_player_id
  where m.tournament_id = p_tournament_id;

  with match_rows as (
    select
      m.p1_player_id as player_id,
      m.score1 as scored,
      m.score2 as conceded,
      m.points1 as points,
      m.played as played,
      case when m.points1 > 0 then 1 else 0 end as won
    from public.matches m
    where m.tournament_id = p_tournament_id

    union all

    select
      m.p2_player_id as player_id,
      m.score2 as scored,
      m.score1 as conceded,
      m.points2 as points,
      m.played as played,
      case when m.points2 > 0 then 1 else 0 end as won
    from public.matches m
    where m.tournament_id = p_tournament_id
  ),
  standings as (
    select
      p.id as player_id,
      p.name,
      p.handicap,
      coalesce(count(*) filter (where mr.played), 0)::int as played,
      coalesce(sum(mr.won), 0)::int as won,
      coalesce(sum(case when mr.scored is not null and mr.conceded is not null then mr.scored - mr.conceded else 0 end), 0)::int as "hoopDiff",
      coalesce(sum(mr.points), 0)::numeric as points
    from public.players p
    left join match_rows mr on mr.player_id = p.id
    where p.tournament_id = p_tournament_id
    group by p.id, p.name, p.handicap
    order by points desc, "hoopDiff" desc, won desc, p.name asc
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'playerId', s.player_id,
        'name', s.name,
        'handicap', s.handicap,
        'played', s.played,
        'won', s.won,
        'hoopDiff', s."hoopDiff",
        'points', s.points
      )
    ),
    '[]'::jsonb
  )
  into standings_arr
  from standings s;

  return jsonb_build_object(
    'publicId', t.public_id,
    'title', t.title,
    'players', players_arr,
    'scoringRules', rules_obj,
    'matches', matches_arr,
    'standings', standings_arr
  ) || case
    when p_include_admin then jsonb_build_object('adminToken', t.admin_token)
    else '{}'::jsonb
  end;
end;
$$;

create or replace function public.create_tournament(p_title text, p_players jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  t_id uuid;
  valid_count int;
  clean_title text;
begin
  if jsonb_typeof(p_players) <> 'array' then
    raise exception 'Formato de jugadores inválido';
  end if;

  select coalesce(nullif(trim(p_title), ''), 'Torneo sin título') into clean_title;

  with input_players as (
    select
      trim(coalesce(e.value ->> 'name', '')) as name,
      round((e.value ->> 'handicap')::numeric)::int as handicap
    from jsonb_array_elements(p_players) as e(value)
    where trim(coalesce(e.value ->> 'name', '')) <> ''
      and (e.value ->> 'handicap') is not null
      and (e.value ->> 'handicap') ~ '^-?\d+(\.\d+)?$'
  )
  select count(*) into valid_count from input_players;

  if valid_count < 2 then
    raise exception 'Debes añadir al menos 2 jugadores válidos';
  end if;

  insert into public.tournaments (public_id, admin_token, title)
  values (
    public.gen_prefixed_id('t'),
    public.gen_prefixed_id('admin'),
    clean_title
  )
  returning id into t_id;

  with input_players as (
    select
      trim(coalesce(e.value ->> 'name', '')) as name,
      round((e.value ->> 'handicap')::numeric)::int as handicap
    from jsonb_array_elements(p_players) as e(value)
    where trim(coalesce(e.value ->> 'name', '')) <> ''
      and (e.value ->> 'handicap') is not null
      and (e.value ->> 'handicap') ~ '^-?\d+(\.\d+)?$'
  )
  insert into public.players (tournament_id, name, handicap)
  select t_id, ip.name, ip.handicap
  from input_players ip;

  insert into public.matches (tournament_id, p1_player_id, p2_player_id)
  select
    t_id,
    p1.id,
    p2.id
  from public.players p1
  join public.players p2
    on p1.tournament_id = t_id
   and p2.tournament_id = t_id
   and p1.id < p2.id;

  insert into public.scoring_rules (tournament_id, winner_handicap, loser_handicap, points)
  values
    (t_id, 6, 6, 10),
    (t_id, 6, 7, 9),
    (t_id, 6, 8, 8),
    (t_id, 7, 6, 11),
    (t_id, 7, 7, 10),
    (t_id, 7, 8, 9),
    (t_id, 8, 6, 12),
    (t_id, 8, 7, 11),
    (t_id, 8, 8, 10);

  perform public.recalculate_tournament(t_id);

  return (
    select jsonb_build_object(
      'publicId', t.public_id,
      'adminToken', t.admin_token
    )
    from public.tournaments t
    where t.id = t_id
  );
end;
$$;

create or replace function public.get_tournament_public(p_public_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  t_id uuid;
begin
  select id into t_id
  from public.tournaments
  where public_id = p_public_id;

  if t_id is null then
    raise exception 'Torneo no encontrado';
  end if;

  return public.tournament_payload(t_id, false);
end;
$$;

create or replace function public.get_tournament_admin(p_admin_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  t_id uuid;
begin
  select id into t_id
  from public.tournaments
  where admin_token = p_admin_token;

  if t_id is null then
    raise exception 'Torneo no encontrado';
  end if;

  perform public.recalculate_tournament(t_id);
  return public.tournament_payload(t_id, true);
end;
$$;

create or replace function public.update_tournament_title(p_admin_token text, p_title text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  t_id uuid;
  clean_title text;
begin
  select id into t_id
  from public.tournaments
  where admin_token = p_admin_token;

  if t_id is null then
    raise exception 'Torneo no encontrado';
  end if;

  clean_title := trim(coalesce(p_title, ''));
  if clean_title = '' then
    raise exception 'El título no puede estar vacío';
  end if;

  update public.tournaments
  set title = clean_title
  where id = t_id;

  return public.tournament_payload(t_id, true);
end;
$$;

create or replace function public.update_player(p_admin_token text, p_player_id uuid, p_name text, p_handicap integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  t_id uuid;
  clean_name text;
begin
  select t.id into t_id
  from public.tournaments t
  join public.players p on p.tournament_id = t.id
  where t.admin_token = p_admin_token
    and p.id = p_player_id;

  if t_id is null then
    raise exception 'Jugador o torneo no encontrado';
  end if;

  clean_name := trim(coalesce(p_name, ''));
  if clean_name = '' then
    raise exception 'El nombre no puede estar vacío';
  end if;

  if p_handicap is null then
    raise exception 'Hándicap inválido';
  end if;

  update public.players
  set name = clean_name,
      handicap = p_handicap
  where id = p_player_id;

  perform public.recalculate_tournament(t_id);
  return public.tournament_payload(t_id, true);
end;
$$;

create or replace function public.update_match(
  p_admin_token text,
  p_match_id uuid,
  p_score1 integer,
  p_score2 integer,
  p_match_date date
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  t_id uuid;
begin
  select t.id into t_id
  from public.tournaments t
  join public.matches m on m.tournament_id = t.id
  where t.admin_token = p_admin_token
    and m.id = p_match_id;

  if t_id is null then
    raise exception 'Partido o torneo no encontrado';
  end if;

  if p_score1 is not null and (p_score1 < 0 or p_score1 > 7) then
    raise exception 'Aros jugador 1 inválidos (0-7)';
  end if;

  if p_score2 is not null and (p_score2 < 0 or p_score2 > 7) then
    raise exception 'Aros jugador 2 inválidos (0-7)';
  end if;

  update public.matches
  set score1 = p_score1,
      score2 = p_score2,
      match_date = p_match_date
  where id = p_match_id;

  perform public.recalculate_tournament(t_id);
  return public.tournament_payload(t_id, true);
end;
$$;

create or replace function public.update_scoring_rules(p_admin_token text, p_rules jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  t_id uuid;
begin
  if jsonb_typeof(p_rules) <> 'array' then
    raise exception 'Formato inválido de reglas';
  end if;

  select id into t_id
  from public.tournaments
  where admin_token = p_admin_token;

  if t_id is null then
    raise exception 'Torneo no encontrado';
  end if;

  delete from public.scoring_rules where tournament_id = t_id;

  insert into public.scoring_rules (tournament_id, winner_handicap, loser_handicap, points)
  select
    t_id,
    round((r.value ->> 'winnerHandicap')::numeric)::int,
    round((r.value ->> 'loserHandicap')::numeric)::int,
    greatest(0, (r.value ->> 'points')::numeric)
  from jsonb_array_elements(p_rules) as r(value)
  where (r.value ->> 'winnerHandicap') ~ '^-?\d+(\.\d+)?$'
    and (r.value ->> 'loserHandicap') ~ '^-?\d+(\.\d+)?$'
    and (r.value ->> 'points') ~ '^-?\d+(\.\d+)?$';

  perform public.recalculate_tournament(t_id);
  return public.tournament_payload(t_id, true);
end;
$$;

alter table public.tournaments enable row level security;
alter table public.players enable row level security;
alter table public.matches enable row level security;
alter table public.scoring_rules enable row level security;

revoke all on public.tournaments from anon, authenticated;
revoke all on public.players from anon, authenticated;
revoke all on public.matches from anon, authenticated;
revoke all on public.scoring_rules from anon, authenticated;

grant execute on function public.create_tournament(text, jsonb) to anon, authenticated;
grant execute on function public.get_tournament_public(text) to anon, authenticated;
grant execute on function public.get_tournament_admin(text) to anon, authenticated;
grant execute on function public.update_tournament_title(text, text) to anon, authenticated;
grant execute on function public.update_player(text, uuid, text, integer) to anon, authenticated;
grant execute on function public.update_match(text, uuid, integer, integer, date) to anon, authenticated;
grant execute on function public.update_scoring_rules(text, jsonb) to anon, authenticated;
