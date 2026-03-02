const state = {
  mode: 'home',
  tournament: null,
  publicId: null,
  adminToken: null
};

const els = {
  modeBadge: document.getElementById('mode-badge'),
  homeView: document.getElementById('home-view'),
  tournamentView: document.getElementById('tournament-view'),
  tournamentTitleInput: document.getElementById('tournament-title'),
  playersList: document.getElementById('players-list'),
  addPlayerBtn: document.getElementById('add-player-btn'),
  createTournamentBtn: document.getElementById('create-tournament-btn'),
  homeMessage: document.getElementById('home-message'),
  tournamentTitleView: document.getElementById('tournament-title-view'),
  sharePublic: document.getElementById('share-public'),
  shareAdmin: document.getElementById('share-admin'),
  copyPublicLink: document.getElementById('copy-public-link'),
  copyAdminLink: document.getElementById('copy-admin-link'),
  resultsBody: document.getElementById('results-body'),
  standingsBody: document.getElementById('standings-body'),
  playersBody: document.getElementById('players-body'),
  playersActionsHead: document.getElementById('players-actions-head'),
  actionsHead: document.getElementById('actions-head'),
  configTabBtn: document.getElementById('config-tab-btn'),
  editTitleInput: document.getElementById('edit-title-input'),
  saveTitleBtn: document.getElementById('save-title-btn'),
  rulesList: document.getElementById('rules-list'),
  addRuleBtn: document.getElementById('add-rule-btn'),
  saveRulesBtn: document.getElementById('save-rules-btn'),
  configMessage: document.getElementById('config-message')
};

const tabButtons = Array.from(document.querySelectorAll('.tab-btn'));
const tabPanels = {
  results: document.getElementById('results-tab'),
  standings: document.getElementById('standings-tab'),
  players: document.getElementById('players-tab'),
  share: document.getElementById('share-tab'),
  config: document.getElementById('config-tab')
};

function requireConfig() {
  const config = window.APP_CONFIG || {};
  const url = String(config.supabaseUrl || '').trim();
  const key = String(config.supabaseAnonKey || '').trim();

  if (!url || !key || url.includes('YOUR-PROJECT-REF') || key.includes('YOUR_SUPABASE_ANON_KEY')) {
    throw new Error('Falta configurar Supabase en public/config.js');
  }

  return { url, key };
}

const cfg = requireConfig();
const supabaseClient = window.supabase.createClient(cfg.url, cfg.key, {
  auth: { persistSession: false, autoRefreshToken: false }
});

async function rpc(fn, params = {}) {
  const { data, error } = await supabaseClient.rpc(fn, params);
  if (error) throw new Error(error.message || 'Error de Supabase');
  return data;
}

function parsePath() {
  const hash = window.location.hash.replace(/^#/, '');
  const hashParts = hash.split('/').filter(Boolean);
  if (hashParts[0] === 't' && hashParts[1]) return { mode: 'public', id: hashParts[1] };
  if (hashParts[0] === 'a' && hashParts[1]) return { mode: 'admin', id: hashParts[1] };

  const parts = window.location.pathname.split('/').filter(Boolean);
  if (parts[0] === 't' && parts[1]) return { mode: 'public', id: parts[1] };
  if (parts[0] === 'a' && parts[1]) return { mode: 'admin', id: parts[1] };

  return { mode: 'home', id: null };
}

function createInput(type, placeholder, value = '') {
  const input = document.createElement('input');
  input.type = type;
  input.className = 'input';
  input.placeholder = placeholder;
  input.value = value;
  return input;
}

function showMessage(element, text, isError = false) {
  element.textContent = text;
  element.style.color = isError ? 'var(--danger)' : 'var(--brand-strong)';
}

function addPlayerRow(defaults = { name: '', handicap: 0 }) {
  const row = document.createElement('div');
  row.className = 'player-row';

  const nameInput = createInput('text', 'Nombre del jugador', defaults.name);
  const handicapInput = createInput('number', 'Hándicap', String(defaults.handicap ?? 0));
  handicapInput.step = '1';

  const removeBtn = document.createElement('button');
  removeBtn.className = 'btn btn-danger';
  removeBtn.type = 'button';
  removeBtn.textContent = 'Quitar';
  removeBtn.addEventListener('click', () => row.remove());

  row.append(nameInput, handicapInput, removeBtn);
  els.playersList.appendChild(row);
}

function getPlayersFromUI() {
  const rows = Array.from(els.playersList.querySelectorAll('.player-row'));
  return rows
    .map((row) => {
      const [nameInput, handicapInput] = row.querySelectorAll('input');
      return {
        name: nameInput.value.trim(),
        handicap: Number(handicapInput.value)
      };
    })
    .filter((p) => p.name.length > 0 && Number.isFinite(p.handicap));
}

function baseShareUrl() {
  return `${window.location.origin}${window.location.pathname}`;
}

function goToAdmin(adminToken) {
  window.location.hash = `#/a/${adminToken}`;
}

async function createTournament() {
  const title = els.tournamentTitleInput.value.trim();
  const players = getPlayersFromUI();

  if (!title) {
    showMessage(els.homeMessage, 'Añade un título de torneo.', true);
    return;
  }
  if (players.length < 2) {
    showMessage(els.homeMessage, 'Necesitas al menos 2 jugadores válidos.', true);
    return;
  }

  try {
    const data = await rpc('create_tournament', {
      p_title: title,
      p_players: players
    });
    goToAdmin(data.adminToken);
  } catch (err) {
    showMessage(els.homeMessage, err.message || 'No se pudo crear el torneo.', true);
  }
}

function playerName(playerId) {
  const p = state.tournament.players.find((x) => x.id === playerId);
  return p ? p.name : 'Jugador';
}

function currentPublicUrl() {
  return `${baseShareUrl()}#/t/${state.tournament.publicId}`;
}

function currentAdminUrl() {
  if (!state.adminToken) return '';
  return `${baseShareUrl()}#/a/${state.adminToken}`;
}

function renderHeader() {
  els.tournamentTitleView.textContent = state.tournament.title;
  els.sharePublic.textContent = `Enlace público: ${currentPublicUrl()}`;

  if (state.mode === 'admin') {
    els.shareAdmin.classList.remove('hidden');
    els.shareAdmin.textContent = `Enlace admin: ${currentAdminUrl()}`;
    els.copyAdminLink.classList.remove('hidden');
  } else {
    els.shareAdmin.classList.add('hidden');
    els.copyAdminLink.classList.add('hidden');
  }
}

function renderResults() {
  const isAdmin = state.mode === 'admin';
  els.resultsBody.innerHTML = '';
  els.actionsHead.classList.toggle('hidden', !isAdmin);

  state.tournament.matches.forEach((match) => {
    const tr = document.createElement('tr');
    const p1 = playerName(match.p1Id);
    const p2 = playerName(match.p2Id);

    const tdP1 = document.createElement('td');
    tdP1.textContent = p1;

    const tdP2 = document.createElement('td');
    tdP2.textContent = p2;

    const tdDate = document.createElement('td');
    const tdS1 = document.createElement('td');
    const tdS2 = document.createElement('td');

    if (isAdmin) {
      const dateInput = createInput('date', 'Fecha', match.matchDate ?? '');
      dateInput.dataset.matchId = match.id;
      dateInput.dataset.field = 'matchDate';

      const s1Input = createInput('number', '0-7', match.score1 ?? '');
      s1Input.min = '0';
      s1Input.max = '7';
      s1Input.step = '1';
      s1Input.dataset.matchId = match.id;
      s1Input.dataset.field = 'score1';

      const s2Input = createInput('number', '0-7', match.score2 ?? '');
      s2Input.min = '0';
      s2Input.max = '7';
      s2Input.step = '1';
      s2Input.dataset.matchId = match.id;
      s2Input.dataset.field = 'score2';

      tdDate.appendChild(dateInput);
      tdS1.appendChild(s1Input);
      tdS2.appendChild(s2Input);
    } else {
      tdDate.textContent = match.matchDate || '-';
      tdS1.textContent = match.score1 == null ? '-' : String(match.score1);
      tdS2.textContent = match.score2 == null ? '-' : String(match.score2);
    }

    const tdPuntos1 = document.createElement('td');
    tdPuntos1.textContent = String(match.points1 || 0);

    const tdPuntos2 = document.createElement('td');
    tdPuntos2.textContent = String(match.points2 || 0);

    tr.append(tdP1, tdP2, tdDate, tdS1, tdS2, tdPuntos1, tdPuntos2);

    if (isAdmin) {
      const actionTd = document.createElement('td');
      const saveBtn = document.createElement('button');
      saveBtn.className = 'btn btn-primary';
      saveBtn.textContent = 'Guardar';
      saveBtn.type = 'button';
      saveBtn.addEventListener('click', () => saveMatch(match.id, tr));
      actionTd.appendChild(saveBtn);
      tr.appendChild(actionTd);
    }

    els.resultsBody.appendChild(tr);
  });
}

function renderStandings() {
  els.standingsBody.innerHTML = '';
  state.tournament.standings.forEach((row) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${row.name}</td>
      <td>${row.played}</td>
      <td>${row.won}</td>
      <td>${row.hoopDiff}</td>
      <td><strong>${row.points}</strong></td>
    `;
    els.standingsBody.appendChild(tr);
  });
}

function renderPlayers() {
  const isAdmin = state.mode === 'admin';
  els.playersBody.innerHTML = '';
  els.playersActionsHead.classList.toggle('hidden', !isAdmin);

  const list = [...state.tournament.players].sort((a, b) => a.name.localeCompare(b.name, 'es'));
  list.forEach((player) => {
    const tr = document.createElement('tr');

    const tdName = document.createElement('td');
    const tdHandicap = document.createElement('td');
    const tdAction = document.createElement('td');

    if (isAdmin) {
      const nameInput = createInput('text', 'Nombre', player.name);
      nameInput.dataset.playerId = player.id;
      nameInput.dataset.field = 'name';

      const handicapInput = createInput('number', 'Hándicap', String(player.handicap ?? ''));
      handicapInput.step = '1';
      handicapInput.dataset.playerId = player.id;
      handicapInput.dataset.field = 'handicap';

      const saveBtn = document.createElement('button');
      saveBtn.className = 'btn btn-primary';
      saveBtn.type = 'button';
      saveBtn.textContent = 'Guardar';
      saveBtn.addEventListener('click', () => savePlayer(player.id, tr));

      tdName.appendChild(nameInput);
      tdHandicap.appendChild(handicapInput);
      tdAction.appendChild(saveBtn);
    } else {
      tdName.textContent = player.name;
      tdHandicap.textContent = String(player.handicap);
    }

    tr.append(tdName, tdHandicap);
    if (isAdmin) tr.appendChild(tdAction);
    els.playersBody.appendChild(tr);
  });
}

function getRulesArrayFromState() {
  const rules = state.tournament.scoringRules || {};
  return Object.entries(rules).map(([key, points]) => {
    const [winnerHandicap, loserHandicap] = key.split('|');
    return { winnerHandicap, loserHandicap, points };
  });
}

function addRuleRow(rule = { winnerHandicap: '', loserHandicap: '', points: '' }) {
  const row = document.createElement('div');
  row.className = 'rule-row';

  const winnerH = createInput('number', 'Hándicap ganador', String(rule.winnerHandicap ?? ''));
  const loserH = createInput('number', 'Hándicap rival', String(rule.loserHandicap ?? ''));
  const points = createInput('number', 'Puntos victoria', String(rule.points ?? ''));
  points.step = '0.5';

  const removeBtn = document.createElement('button');
  removeBtn.className = 'btn btn-danger';
  removeBtn.type = 'button';
  removeBtn.textContent = 'Quitar';
  removeBtn.addEventListener('click', () => row.remove());

  row.append(winnerH, loserH, points, removeBtn);
  els.rulesList.appendChild(row);
}

function renderConfig() {
  els.editTitleInput.value = state.tournament.title;
  els.rulesList.innerHTML = '';
  const rules = getRulesArrayFromState();
  if (rules.length === 0) {
    addRuleRow();
  } else {
    rules.forEach((r) => addRuleRow(r));
  }
}

function renderTournament() {
  renderHeader();
  renderResults();
  renderStandings();
  renderPlayers();
  if (state.mode === 'admin') renderConfig();
}

function switchTab(tabName) {
  tabButtons.forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });
  Object.entries(tabPanels).forEach(([name, panel]) => {
    panel.classList.toggle('hidden', name !== tabName);
  });
}

function applyTournamentFromPayload(data) {
  state.tournament = data;
  state.publicId = data.publicId;
  if (state.mode === 'admin') state.adminToken = data.adminToken || state.adminToken;

  els.homeView.classList.add('hidden');
  els.tournamentView.classList.remove('hidden');

  if (state.mode === 'admin') {
    els.modeBadge.textContent = 'Modo administrador';
    els.modeBadge.classList.remove('hidden');
    els.configTabBtn.classList.remove('hidden');
  } else {
    els.modeBadge.textContent = 'Modo público (solo lectura)';
    els.modeBadge.classList.remove('hidden');
    els.configTabBtn.classList.add('hidden');
  }

  renderTournament();
  switchTab('results');
}

async function loadTournament() {
  const path = parsePath();
  state.mode = path.mode;
  state.publicId = null;
  state.adminToken = null;

  if (path.mode === 'home') {
    els.homeView.classList.remove('hidden');
    els.tournamentView.classList.add('hidden');
    els.modeBadge.classList.add('hidden');
    els.playersList.innerHTML = '';
    addPlayerRow({ name: '', handicap: 0 });
    addPlayerRow({ name: '', handicap: 0 });
    return;
  }

  try {
    const data = path.mode === 'admin'
      ? await rpc('get_tournament_admin', { p_admin_token: path.id })
      : await rpc('get_tournament_public', { p_public_id: path.id });

    if (path.mode === 'admin') state.adminToken = path.id;
    applyTournamentFromPayload(data);
  } catch (err) {
    document.body.innerHTML = `<main class="shell"><section class="card"><h2>Error</h2><p>${err.message}</p></section></main>`;
  }
}

function parseNullableInt(raw) {
  if (raw === '' || raw == null) return null;
  const n = Number(raw);
  return Number.isInteger(n) ? n : null;
}

async function saveMatch(matchId, rowEl) {
  if (state.mode !== 'admin') return;

  const score1 = parseNullableInt(rowEl.querySelector('input[data-match-id][data-field="score1"]').value);
  const score2 = parseNullableInt(rowEl.querySelector('input[data-match-id][data-field="score2"]').value);
  const matchDateValue = rowEl.querySelector('input[data-match-id][data-field="matchDate"]').value;
  const matchDate = matchDateValue === '' ? null : matchDateValue;

  try {
    const payload = await rpc('update_match', {
      p_admin_token: state.adminToken,
      p_match_id: matchId,
      p_score1: score1,
      p_score2: score2,
      p_match_date: matchDate
    });
    applyTournamentFromPayload(payload);
  } catch (err) {
    window.alert(err.message || 'No se pudo guardar el partido.');
  }
}

async function savePlayer(playerId, rowEl) {
  if (state.mode !== 'admin') return;
  const name = rowEl.querySelector('input[data-player-id][data-field="name"]').value.trim();
  const handicap = parseNullableInt(rowEl.querySelector('input[data-player-id][data-field="handicap"]').value);

  try {
    const payload = await rpc('update_player', {
      p_admin_token: state.adminToken,
      p_player_id: playerId,
      p_name: name,
      p_handicap: handicap
    });
    applyTournamentFromPayload(payload);
    switchTab('players');
  } catch (err) {
    window.alert(err.message || 'No se pudo actualizar el jugador.');
  }
}

async function saveTitle() {
  const title = els.editTitleInput.value.trim();
  if (!title) {
    showMessage(els.configMessage, 'El título no puede estar vacío.', true);
    return;
  }

  try {
    const payload = await rpc('update_tournament_title', {
      p_admin_token: state.adminToken,
      p_title: title
    });
    applyTournamentFromPayload(payload);
    switchTab('config');
    showMessage(els.configMessage, 'Título guardado.');
  } catch (err) {
    showMessage(els.configMessage, err.message || 'No se pudo guardar el título.', true);
  }
}

function collectRules() {
  const rows = Array.from(els.rulesList.querySelectorAll('.rule-row'));
  return rows
    .map((row) => {
      const [winnerH, loserH, points] = row.querySelectorAll('input');
      return {
        winnerHandicap: winnerH.value,
        loserHandicap: loserH.value,
        points: points.value
      };
    })
    .filter((r) => r.winnerHandicap !== '' && r.loserHandicap !== '' && r.points !== '');
}

async function saveRules() {
  const rules = collectRules();

  try {
    const payload = await rpc('update_scoring_rules', {
      p_admin_token: state.adminToken,
      p_rules: rules
    });
    applyTournamentFromPayload(payload);
    switchTab('config');
    showMessage(els.configMessage, 'Reglas guardadas y clasificación recalculada.');
  } catch (err) {
    showMessage(els.configMessage, err.message || 'No se pudieron guardar las reglas.', true);
  }
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch (_err) {
    window.prompt('Copia este enlace:', text);
  }
}

function attachEvents() {
  els.addPlayerBtn.addEventListener('click', () => addPlayerRow());
  els.createTournamentBtn.addEventListener('click', createTournament);

  tabButtons.forEach((btn) => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  els.copyPublicLink.addEventListener('click', () => copyText(currentPublicUrl()));
  els.copyAdminLink.addEventListener('click', () => copyText(currentAdminUrl()));

  els.saveTitleBtn.addEventListener('click', saveTitle);
  els.addRuleBtn.addEventListener('click', () => addRuleRow());
  els.saveRulesBtn.addEventListener('click', saveRules);

  window.addEventListener('hashchange', loadTournament);
}

attachEvents();
loadTournament();
