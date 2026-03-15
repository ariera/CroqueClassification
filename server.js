const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function ensureDb() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify({ tournaments: [] }, null, 2), 'utf-8');
  }
}

function readDb() {
  ensureDb();
  const raw = fs.readFileSync(DB_FILE, 'utf-8');
  return JSON.parse(raw);
}

function writeDb(db) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
}

function id(prefix) {
  return `${prefix}_${crypto.randomBytes(8).toString('hex')}`;
}

function normalizeHandicap(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.round(n);
}

const CANONICAL_HANDICAP_LEVELS = [-6, -5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 16, 18, 20];
const CANONICAL_SCORING_MATRIX = [
  [-6, [10, 7, 4, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]],
  [-5, [13, 10, 7, 4, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]],
  [-4, [16, 13, 10, 7, 4, 3, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]],
  [-3, [18, 16, 13, 10, 7, 5, 3, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]],
  [-2, [19, 18, 16, 13, 10, 8, 6, 4, 3, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]],
  [-1, [19, 19, 17, 15, 12, 10, 8, 6, 4, 3, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]],
  [0, [19, 19, 18, 17, 14, 12, 10, 8, 6, 4, 3, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]],
  [1, [19, 19, 19, 18, 16, 14, 12, 10, 8, 6, 4, 3, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]],
  [2, [19, 19, 19, 19, 17, 16, 14, 12, 10, 8, 6, 4, 3, 2, 2, 1, 1, 1, 1, 1, 1, 1, 1]],
  [3, [19, 19, 19, 19, 18, 17, 16, 14, 12, 10, 8, 6, 4, 3, 3, 2, 1, 1, 1, 1, 1, 1, 1]],
  [4, [19, 19, 19, 19, 19, 18, 17, 16, 14, 12, 10, 8, 6, 5, 4, 3, 2, 2, 1, 1, 1, 1, 1]],
  [5, [19, 19, 19, 19, 19, 19, 18, 17, 16, 14, 12, 10, 8, 7, 6, 5, 4, 3, 3, 2, 2, 1, 1]],
  [6, [19, 19, 19, 19, 19, 19, 19, 18, 17, 16, 14, 12, 10, 9, 8, 7, 6, 5, 4, 3, 3, 2, 2]],
  [7, [19, 19, 19, 19, 19, 19, 19, 18, 17, 16, 15, 13, 11, 10, 9, 8, 7, 6, 5, 4, 3, 3, 2]],
  [8, [19, 19, 19, 19, 19, 19, 19, 19, 18, 17, 16, 14, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 3]],
  [9, [19, 19, 19, 19, 19, 19, 19, 19, 18, 17, 15, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 4, 3]],
  [10, [19, 19, 19, 19, 19, 19, 19, 19, 19, 18, 17, 15, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 4]],
  [11, [19, 19, 19, 19, 19, 19, 19, 19, 19, 18, 17, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4]],
  [12, [19, 19, 19, 19, 19, 19, 19, 19, 19, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6]],
  [14, [19, 19, 19, 19, 19, 19, 19, 19, 19, 19, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7]],
  [16, [19, 19, 19, 19, 19, 19, 19, 19, 19, 19, 19, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8]],
  [18, [19, 19, 19, 19, 19, 19, 19, 19, 19, 19, 19, 19, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9]],
  [20, [19, 19, 19, 19, 19, 19, 19, 19, 19, 19, 19, 19, 19, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10]]
];

const DEFAULT_SCORING_RULES = Object.fromEntries(
  CANONICAL_SCORING_MATRIX.flatMap(([winnerHandicap, pointsRow]) =>
    CANONICAL_HANDICAP_LEVELS.map((loserHandicap, index) => [
      `${winnerHandicap}|${loserHandicap}`,
      pointsRow[index]
    ])
  )
);

function buildRoundRobin(players) {
  const matches = [];
  for (let i = 0; i < players.length; i += 1) {
    for (let j = i + 1; j < players.length; j += 1) {
      matches.push({
        id: id('m'),
        p1Id: players[i].id,
        p2Id: players[j].id,
        matchDate: null,
        score1: null,
        score2: null,
        points1: 0,
        points2: 0,
        played: false
      });
    }
  }
  return matches;
}

function winnerAndValidation(score1, score2) {
  if (score1 == null || score2 == null) return { valid: false, winner: null };
  if (!Number.isInteger(score1) || !Number.isInteger(score2)) return { valid: false, winner: null };
  if (score1 < 0 || score1 > 7 || score2 < 0 || score2 > 7) return { valid: false, winner: null };
  if (score1 === score2) return { valid: false, winner: null };

  // Gana quien tenga más aros; no se permiten empates.
  return { valid: true, winner: score1 > score2 ? 'p1' : 'p2' };
}

function pointsFromTable(scoringRules, winnerHandicap, loserHandicap) {
  const key = `${winnerHandicap}|${loserHandicap}`;
  if (Object.prototype.hasOwnProperty.call(scoringRules, key)) {
    const value = Number(scoringRules[key]);
    return Number.isFinite(value) ? value : 1;
  }
  return 1;
}

function normalizeMatchDate(value) {
  if (value == null || value === '') return null;
  const text = String(value).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  const date = new Date(`${text}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10) === text ? text : null;
}

function recalculateTournament(tournament) {
  const playerMap = new Map(tournament.players.map((p) => [p.id, p]));

  tournament.matches = tournament.matches.map((match) => {
    const score1 = match.score1;
    const score2 = match.score2;
    const verdict = winnerAndValidation(score1, score2);

    if (!verdict.valid) {
      return {
        ...match,
        played: false,
        points1: 0,
        points2: 0
      };
    }

    const p1 = playerMap.get(match.p1Id);
    const p2 = playerMap.get(match.p2Id);
    const h1 = normalizeHandicap(p1?.handicap);
    const h2 = normalizeHandicap(p2?.handicap);

    if (verdict.winner === 'p1') {
      const winPoints = pointsFromTable(tournament.scoringRules || {}, h1, h2);
      return {
        ...match,
        played: true,
        points1: winPoints,
        points2: 0
      };
    }

    const winPoints = pointsFromTable(tournament.scoringRules || {}, h2, h1);
    return {
      ...match,
      played: true,
      points1: 0,
      points2: winPoints
    };
  });
}

function standings(tournament) {
  const board = tournament.players.map((p) => ({
    playerId: p.id,
    name: p.name,
    handicap: p.handicap,
    played: 0,
    won: 0,
    hoopDiff: 0,
    points: 0
  }));

  const idx = new Map(board.map((r, i) => [r.playerId, i]));

  tournament.matches.forEach((m) => {
    const i1 = idx.get(m.p1Id);
    const i2 = idx.get(m.p2Id);
    if (i1 == null || i2 == null) return;

    const r1 = board[i1];
    const r2 = board[i2];

    if (m.score1 != null && m.score2 != null) {
      r1.hoopDiff += m.score1 - m.score2;
      r2.hoopDiff += m.score2 - m.score1;
    }

    if (m.played) {
      r1.played += 1;
      r2.played += 1;
      r1.points += Number(m.points1) || 0;
      r2.points += Number(m.points2) || 0;
      if ((Number(m.points1) || 0) > 0) r1.won += 1;
      if ((Number(m.points2) || 0) > 0) r2.won += 1;
    }
  });

  board.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.hoopDiff !== a.hoopDiff) return b.hoopDiff - a.hoopDiff;
    if (b.won !== a.won) return b.won - a.won;
    return a.name.localeCompare(b.name, 'es');
  });

  return board;
}

function sanitizePlayers(players) {
  if (!Array.isArray(players)) return [];
  return players
    .map((p) => ({
      id: id('p'),
      name: String(p.name || '').trim(),
      handicap: normalizeHandicap(p.handicap)
    }))
    .filter((p) => p.name.length > 0 && p.handicap != null);
}

app.post('/api/tournaments', (req, res) => {
  const title = String(req.body?.title || '').trim() || 'Torneo sin título';
  const players = sanitizePlayers(req.body?.players);
  if (players.length < 2) {
    return res.status(400).json({ error: 'Debes añadir al menos 2 jugadores válidos.' });
  }

  const tournament = {
    publicId: id('t'),
    adminToken: id('admin'),
    title,
    createdAt: new Date().toISOString(),
    players,
    scoringRules: { ...DEFAULT_SCORING_RULES },
    matches: buildRoundRobin(players)
  };

  const db = readDb();
  db.tournaments.push(tournament);
  writeDb(db);

  return res.json({
    publicId: tournament.publicId,
    adminToken: tournament.adminToken,
    publicUrl: `/t/${tournament.publicId}`,
    adminUrl: `/a/${tournament.adminToken}`
  });
});

app.get('/api/tournaments/public/:publicId', (req, res) => {
  const db = readDb();
  const tournament = db.tournaments.find((t) => t.publicId === req.params.publicId);
  if (!tournament) return res.status(404).json({ error: 'Torneo no encontrado.' });

  recalculateTournament(tournament);
  return res.json({
    mode: 'public',
    tournament: {
      publicId: tournament.publicId,
      title: tournament.title,
      players: tournament.players,
      matches: tournament.matches,
      standings: standings(tournament)
    }
  });
});

app.get('/api/tournaments/admin/:adminToken', (req, res) => {
  const db = readDb();
  const tournament = db.tournaments.find((t) => t.adminToken === req.params.adminToken);
  if (!tournament) return res.status(404).json({ error: 'Torneo no encontrado.' });

  recalculateTournament(tournament);
  writeDb(db);

  return res.json({
    mode: 'admin',
    tournament: {
      publicId: tournament.publicId,
      adminToken: tournament.adminToken,
      title: tournament.title,
      players: tournament.players,
      scoringRules: tournament.scoringRules,
      matches: tournament.matches,
      standings: standings(tournament)
    }
  });
});

app.patch('/api/tournaments/admin/:adminToken/title', (req, res) => {
  const db = readDb();
  const tournament = db.tournaments.find((t) => t.adminToken === req.params.adminToken);
  if (!tournament) return res.status(404).json({ error: 'Torneo no encontrado.' });

  const title = String(req.body?.title || '').trim();
  if (!title) return res.status(400).json({ error: 'El título no puede estar vacío.' });

  tournament.title = title;
  writeDb(db);
  return res.json({ ok: true });
});

app.patch('/api/tournaments/admin/:adminToken/players/:playerId', (req, res) => {
  const db = readDb();
  const tournament = db.tournaments.find((t) => t.adminToken === req.params.adminToken);
  if (!tournament) return res.status(404).json({ error: 'Torneo no encontrado.' });

  const player = tournament.players.find((p) => p.id === req.params.playerId);
  if (!player) return res.status(404).json({ error: 'Jugador no encontrado.' });

  const name = String(req.body?.name || '').trim();
  const handicap = normalizeHandicap(req.body?.handicap);

  if (!name) return res.status(400).json({ error: 'El nombre no puede estar vacío.' });
  if (handicap == null) return res.status(400).json({ error: 'Hándicap inválido.' });

  player.name = name;
  player.handicap = handicap;

  recalculateTournament(tournament);
  writeDb(db);

  return res.json({
    ok: true,
    player,
    players: tournament.players,
    matches: tournament.matches,
    standings: standings(tournament)
  });
});

app.patch('/api/tournaments/admin/:adminToken/matches/:matchId', (req, res) => {
  const db = readDb();
  const tournament = db.tournaments.find((t) => t.adminToken === req.params.adminToken);
  if (!tournament) return res.status(404).json({ error: 'Torneo no encontrado.' });

  const match = tournament.matches.find((m) => m.id === req.params.matchId);
  if (!match) return res.status(404).json({ error: 'Partido no encontrado.' });

  const raw1 = req.body?.score1;
  const raw2 = req.body?.score2;
  const rawMatchDate = req.body?.matchDate;

  const score1 = raw1 === '' || raw1 == null ? null : Number(raw1);
  const score2 = raw2 === '' || raw2 == null ? null : Number(raw2);
  const matchDate = rawMatchDate === '' || rawMatchDate == null ? null : normalizeMatchDate(rawMatchDate);

  if (score1 != null && (!Number.isInteger(score1) || score1 < 0 || score1 > 7)) {
    return res.status(400).json({ error: 'Aros jugador 1 inválidos (0-7).' });
  }
  if (score2 != null && (!Number.isInteger(score2) || score2 < 0 || score2 > 7)) {
    return res.status(400).json({ error: 'Aros jugador 2 inválidos (0-7).' });
  }
  if (rawMatchDate != null && rawMatchDate !== '' && matchDate == null) {
    return res.status(400).json({ error: 'Fecha inválida. Usa formato YYYY-MM-DD.' });
  }

  match.score1 = score1;
  match.score2 = score2;
  match.matchDate = matchDate;

  recalculateTournament(tournament);
  writeDb(db);

  return res.json({
    ok: true,
    standings: standings(tournament),
    match: tournament.matches.find((m) => m.id === match.id)
  });
});

app.patch('/api/tournaments/admin/:adminToken/scoring-rules', (req, res) => {
  const db = readDb();
  const tournament = db.tournaments.find((t) => t.adminToken === req.params.adminToken);
  if (!tournament) return res.status(404).json({ error: 'Torneo no encontrado.' });

  const rules = req.body?.rules;
  if (!Array.isArray(rules)) {
    return res.status(400).json({ error: 'Formato inválido de reglas.' });
  }

  const nextRules = {};
  for (const r of rules) {
    const winnerHandicap = normalizeHandicap(r?.winnerHandicap);
    const loserHandicap = normalizeHandicap(r?.loserHandicap);
    const points = Number(r?.points);

    if (winnerHandicap == null || loserHandicap == null || !Number.isFinite(points)) {
      continue;
    }

    nextRules[`${winnerHandicap}|${loserHandicap}`] = Math.max(0, points);
  }

  tournament.scoringRules = nextRules;
  recalculateTournament(tournament);
  writeDb(db);

  return res.json({ ok: true, standings: standings(tournament) });
});

app.get('/api/tournaments/public/:publicId/export', (req, res) => {
  const db = readDb();
  const tournament = db.tournaments.find((t) => t.publicId === req.params.publicId);
  if (!tournament) return res.status(404).json({ error: 'Torneo no encontrado.' });

  recalculateTournament(tournament);
  const payload = {
    title: tournament.title,
    players: tournament.players,
    matches: tournament.matches,
    standings: standings(tournament)
  };

  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  return res.send(JSON.stringify(payload, null, 2));
});

app.get(['/t/:publicId', '/a/:adminToken'], (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  ensureDb();
  // eslint-disable-next-line no-console
  console.log(`Corquet League disponible en http://localhost:${PORT}`);
});
