const { useEffect, useMemo, useState } = React;

const STORAGE_KEY = 'corquet_league_known_tournaments_v1';

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

function parseRoute() {
  const hash = window.location.hash.replace(/^#/, '');
  const hashParts = hash.split('/').filter(Boolean);
  if (hashParts[0] === 't' && hashParts[1]) return { mode: 'public', id: hashParts[1] };
  if (hashParts[0] === 'a' && hashParts[1]) return { mode: 'admin', id: hashParts[1] };
  if (hashParts[0] === 'nuevo') return { mode: 'create-championship', id: null };

  const parts = window.location.pathname.split('/').filter(Boolean);
  if (parts[0] === 't' && parts[1]) return { mode: 'public', id: parts[1] };
  if (parts[0] === 'a' && parts[1]) return { mode: 'admin', id: parts[1] };

  return { mode: 'landing', id: null };
}

function readKnownTournaments() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_err) {
    return [];
  }
}

function writeKnownTournaments(items) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

function rememberTournament(entry) {
  const current = readKnownTournaments();
  const idx = current.findIndex((x) => x.publicId === entry.publicId);
  const nowIso = new Date().toISOString();

  if (idx === -1) {
    current.push({
      publicId: entry.publicId,
      adminToken: entry.adminToken || null,
      title: entry.title || 'Torneo',
      subtitle: entry.subtitle || null,
      lastVisitedAt: nowIso
    });
  } else {
    const prev = current[idx];
    current[idx] = {
      ...prev,
      title: entry.title || prev.title,
      subtitle: entry.subtitle ?? prev.subtitle ?? null,
      adminToken: entry.adminToken || prev.adminToken || null,
      lastVisitedAt: nowIso
    };
  }

  current.sort((a, b) => new Date(b.lastVisitedAt).getTime() - new Date(a.lastVisitedAt).getTime());
  writeKnownTournaments(current);
  return current;
}

function rulesObjToRows(rulesObj) {
  const rules = rulesObj || {};
  return Object.entries(rules).map(([key, points]) => {
    const [winnerHandicap, loserHandicap] = key.split('|');
    return {
      winnerHandicap: String(winnerHandicap),
      loserHandicap: String(loserHandicap),
      points: String(points)
    };
  });
}

function buildRuleMatrix(rows) {
  const ruleMap = new Map(
    rows.map((row) => [
      `${row.winnerHandicap}|${row.loserHandicap}`,
      row.points
    ])
  );

  const levels = Array.from(
    new Set(
      rows.flatMap((row) => [Number(row.winnerHandicap), Number(row.loserHandicap)]).filter((value) => Number.isFinite(value))
    )
  ).sort((a, b) => a - b);

  return {
    levels,
    ruleMap
  };
}

function rebuildRuleRows(levels, ruleMap) {
  const orderedLevels = [...levels].sort((a, b) => a - b);
  const nextRows = [];

  orderedLevels.forEach((winner) => {
    orderedLevels.forEach((loser) => {
      nextRows.push({
        winnerHandicap: String(winner),
        loserHandicap: String(loser),
        points: String(ruleMap.get(`${winner}|${loser}`) ?? '')
      });
    });
  });

  return nextRows;
}

function parseNullableInt(raw) {
  if (raw === '' || raw == null) return null;
  const n = Number(raw);
  return Number.isInteger(n) ? n : null;
}

function wait(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function HomeIndex({ items }) {
  if (!items.length) return null;

  return (
    <section id="home-index-card" className="card">
      <div className="section-title-row">
        <h3>Mis torneos</h3>
      </div>
      <p className="muted small">Aquí verás los torneos cuyos enlaces hayas abierto desde este dispositivo (guardado local).</p>
      <div className="home-index-list">
        {items.map((item) => {
          const access = item.adminToken ? 'Administrador' : 'Solo lectura';
          const subtitle = item.subtitle ? ` · ${item.subtitle}` : '';
          return (
            <div key={item.publicId} className="home-index-row">
              <div className="home-index-info">
                <strong>{item.title || 'Torneo'}</strong>
                <p className="muted small">{access}{subtitle}</p>
              </div>
              <button
                className="btn btn-light"
                type="button"
                onClick={() => {
                  window.location.hash = item.adminToken ? `#/a/${item.adminToken}` : `#/t/${item.publicId}`;
                }}
              >
                {item.adminToken ? 'Abrir admin' : 'Abrir público'}
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function RulesMatrix({ rows, editable, onChange }) {
  const { levels, ruleMap } = buildRuleMatrix(rows);

  function updateCell(winnerHandicap, loserHandicap, value) {
    const nextMap = new Map(ruleMap);
    nextMap.set(`${winnerHandicap}|${loserHandicap}`, value);
    onChange(rebuildRuleRows(levels, nextMap));
  }

  return (
    <div className="rules-matrix-wrap">
      <table className="rules-matrix">
        <thead>
          <tr>
            <th className="rules-corner">Ganador \\ Perdedor</th>
            {levels.map((level) => (
              <th key={`col-${level}`}>{level}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {levels.map((winner) => (
            <tr key={`row-${winner}`}>
              <th>{winner}</th>
              {levels.map((loser) => {
                const key = `${winner}|${loser}`;
                const value = ruleMap.get(key) ?? '';
                return (
                  <td key={key}>
                    {editable ? (
                      <input
                        className="input rules-matrix-input"
                        type="number"
                        step="0.5"
                        value={value}
                        onChange={(e) => updateCell(winner, loser, e.target.value)}
                      />
                    ) : (
                      <span className="rules-matrix-value">{value}</span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ConfigRulesSection({ ruleRows, setRuleRows, configMessage, onSaveRules }) {
  const [editMode, setEditMode] = useState(false);
  const [newLevel, setNewLevel] = useState('');
  const { levels, ruleMap } = buildRuleMatrix(ruleRows);

  useEffect(() => {
    setEditMode(false);
  }, [ruleRows]);

  function addHandicapLevel() {
    const parsed = parseNullableInt(newLevel);
    if (parsed == null) return;
    if (levels.includes(parsed)) return;
    setRuleRows(rebuildRuleRows([...levels, parsed], ruleMap));
    setNewLevel('');
  }

  return (
    <>
      <div className="rules-mode-bar">
        <p className="muted small">
          Vista por matriz: filas = hándicap del ganador, columnas = hándicap del perdedor.
        </p>
        <div className="inline">
          <button
            className={`btn ${editMode ? 'btn-danger' : 'btn-light'}`}
            type="button"
            onClick={() => setEditMode((prev) => !prev)}
          >
            {editMode ? 'Cancelar edición' : 'Editar reglas'}
          </button>
          {editMode && <SaveActionButton text="Guardar reglas" onAction={onSaveRules} />}
        </div>
      </div>
      {editMode && (
        <div className="rules-add-level">
          <input
            className="input"
            type="number"
            step="1"
            placeholder="Añadir hándicap"
            value={newLevel}
            onChange={(e) => setNewLevel(e.target.value)}
          />
          <button className="btn btn-light" type="button" onClick={addHandicapLevel}>
            Añadir fila/columna
          </button>
        </div>
      )}
      <RulesMatrix rows={ruleRows} editable={editMode} onChange={setRuleRows} />
      <div className="message" style={{ color: configMessage.error ? 'var(--danger)' : 'var(--brand-strong)' }}>{configMessage.text}</div>
    </>
  );
}

function App() {
  const [route, setRoute] = useState(parseRoute());
  const [knownTournaments, setKnownTournaments] = useState(readKnownTournaments());

  const [homeTitle, setHomeTitle] = useState('');
  const [homeSubtitle, setHomeSubtitle] = useState('');
  const [homePlayers, setHomePlayers] = useState([
    { name: '', handicap: 0 },
    { name: '', handicap: 0 }
  ]);
  const [homeMessage, setHomeMessage] = useState({ text: '', error: false });

  const [tournament, setTournament] = useState(null);
  const [activeTab, setActiveTab] = useState('results');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [configTitle, setConfigTitle] = useState('');
  const [configSubtitle, setConfigSubtitle] = useState('');
  const [configMessage, setConfigMessage] = useState({ text: '', error: false });
  const [playersMessage, setPlayersMessage] = useState({ text: '', error: false });
  const [newPlayerName, setNewPlayerName] = useState('');
  const [newPlayerHandicap, setNewPlayerHandicap] = useState('');
  const [ruleRows, setRuleRows] = useState([]);

  const isAdmin = route.mode === 'admin';
  const isTournamentRoute = route.mode === 'admin' || route.mode === 'public';

  useEffect(() => {
    function onRouteChange() {
      setRoute(parseRoute());
    }

    window.addEventListener('hashchange', onRouteChange);
    window.addEventListener('popstate', onRouteChange);
    return () => {
      window.removeEventListener('hashchange', onRouteChange);
      window.removeEventListener('popstate', onRouteChange);
    };
  }, []);

  useEffect(() => {
    if (!isTournamentRoute) {
      setError('');
      setLoading(false);
      setTournament(null);
      setKnownTournaments(readKnownTournaments());
      return;
    }

    let cancelled = false;

    async function loadTournament() {
      setLoading(true);
      setError('');
      try {
        const payload = route.mode === 'admin'
          ? await rpc('get_tournament_admin', { p_admin_token: route.id })
          : await rpc('get_tournament_public', { p_public_id: route.id });

        if (cancelled) return;

        setTournament(payload);
        setActiveTab('results');

        const remembered = rememberTournament({
          publicId: payload.publicId,
          adminToken: route.mode === 'admin' ? route.id : null,
          title: payload.title,
          subtitle: payload.subtitle || null
        });
        setKnownTournaments(remembered);
      } catch (err) {
        if (!cancelled) setError(err.message || 'No se pudo cargar el torneo.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadTournament();

    return () => {
      cancelled = true;
    };
  }, [route.mode, route.id, isTournamentRoute]);

  useEffect(() => {
    if (!tournament) return;
    setConfigTitle(tournament.title || '');
    setConfigSubtitle(tournament.subtitle || '');
    setRuleRows(rulesObjToRows(tournament.scoringRules));
  }, [tournament]);

  const playerMap = useMemo(() => {
    if (!tournament) return new Map();
    return new Map((tournament.players || []).map((p) => [p.id, p.name]));
  }, [tournament]);

  function updateTournament(payload, keepTab = true) {
    setTournament(payload);
    if (!keepTab) setActiveTab('results');

    const remembered = rememberTournament({
      publicId: payload.publicId,
      adminToken: route.mode === 'admin' ? route.id : null,
      title: payload.title,
      subtitle: payload.subtitle || null
    });
    setKnownTournaments(remembered);
  }

  async function onCreateTournament() {
    const title = homeTitle.trim();
    const subtitle = homeSubtitle.trim();
    const players = homePlayers
      .map((p) => ({ name: p.name.trim(), handicap: Number(p.handicap) }))
      .filter((p) => p.name && Number.isFinite(p.handicap));

    if (!title) {
      setHomeMessage({ text: 'Añade un título de torneo.', error: true });
      return;
    }
    if (players.length < 2) {
      setHomeMessage({ text: 'Necesitas al menos 2 jugadores válidos.', error: true });
      return;
    }

    try {
      const data = await rpc('create_tournament', {
        p_title: title,
        p_players: players,
        p_subtitle: subtitle || null
      });
      window.location.hash = `#/a/${data.adminToken}`;
    } catch (err) {
      setHomeMessage({ text: err.message || 'No se pudo crear el torneo.', error: true });
    }
  }

  function addHomePlayerRow() {
    setHomePlayers((prev) => [...prev, { name: '', handicap: 0 }]);
  }

  function updateHomePlayer(i, key, value) {
    setHomePlayers((prev) => prev.map((p, idx) => (idx === i ? { ...p, [key]: value } : p)));
  }

  function removeHomePlayer(i) {
    setHomePlayers((prev) => prev.filter((_p, idx) => idx !== i));
  }

  async function onSaveMatch(matchId, matchState) {
    try {
      const payload = await rpc('update_match', {
        p_admin_token: route.id,
        p_match_id: matchId,
        p_score1: parseNullableInt(matchState.score1),
        p_score2: parseNullableInt(matchState.score2),
        p_match_date: matchState.matchDate || null
      });
      updateTournament(payload, true);
    } catch (err) {
      window.alert(err.message || 'No se pudo guardar el partido.');
    }
  }

  async function onSavePlayer(playerId, rowState) {
    try {
      const payload = await rpc('update_player', {
        p_admin_token: route.id,
        p_player_id: playerId,
        p_name: rowState.name.trim(),
        p_handicap: parseNullableInt(rowState.handicap)
      });
      updateTournament(payload, true);
      setPlayersMessage({ text: 'Jugador actualizado.', error: false });
    } catch (err) {
      setPlayersMessage({ text: err.message || 'No se pudo actualizar el jugador.', error: true });
    }
  }

  async function onDeletePlayer(playerId) {
    try {
      const payload = await rpc('delete_player', {
        p_admin_token: route.id,
        p_player_id: playerId
      });
      updateTournament(payload, true);
      setPlayersMessage({ text: 'Jugador borrado.', error: false });
    } catch (err) {
      setPlayersMessage({ text: err.message || 'No se pudo borrar el jugador.', error: true });
    }
  }

  async function onAddPlayer() {
    const name = newPlayerName.trim();
    const handicap = parseNullableInt(newPlayerHandicap);

    if (!name) {
      setPlayersMessage({ text: 'El nombre no puede estar vacío.', error: true });
      return;
    }
    if (handicap == null) {
      setPlayersMessage({ text: 'Hándicap inválido.', error: true });
      return;
    }

    try {
      const payload = await rpc('add_player', {
        p_admin_token: route.id,
        p_name: name,
        p_handicap: handicap
      });
      updateTournament(payload, true);
      setNewPlayerName('');
      setNewPlayerHandicap('');
      setPlayersMessage({ text: 'Jugador añadido.', error: false });
    } catch (err) {
      setPlayersMessage({ text: err.message || 'No se pudo añadir el jugador.', error: true });
    }
  }

  async function onSaveHeader() {
    if (!configTitle.trim()) {
      setConfigMessage({ text: 'El título no puede estar vacío.', error: true });
      return;
    }

    try {
      const payload = await rpc('update_tournament_title', {
        p_admin_token: route.id,
        p_title: configTitle.trim(),
        p_subtitle: configSubtitle.trim() || null
      });
      updateTournament(payload, true);
      setConfigMessage({ text: 'Cabecera guardada.', error: false });
    } catch (err) {
      setConfigMessage({ text: err.message || 'No se pudo guardar la cabecera.', error: true });
    }
  }

  async function onSaveRules() {
    const rulesPayload = ruleRows
      .filter((r) => r.winnerHandicap !== '' && r.loserHandicap !== '' && r.points !== '')
      .map((r) => ({
        winnerHandicap: r.winnerHandicap,
        loserHandicap: r.loserHandicap,
        points: r.points
      }));

    try {
      const payload = await rpc('update_scoring_rules', {
        p_admin_token: route.id,
        p_rules: rulesPayload
      });
      updateTournament(payload, true);
      setConfigMessage({ text: 'Reglas guardadas.', error: false });
    } catch (err) {
      setConfigMessage({ text: err.message || 'No se pudieron guardar las reglas.', error: true });
    }
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
    } catch (_err) {
      window.prompt('Copia este enlace:', text);
    }
  }

  function downloadTournamentExcel() {
    if (!tournament) return;
    if (!window.XLSX) {
      window.alert('No se pudo cargar la librería de Excel.');
      return;
    }

    const exportDate = new Date();
    const infoRows = [
      { campo: 'titulo', valor: tournament.title || '' },
      { campo: 'subtitulo', valor: tournament.subtitle || '' },
      { campo: 'fecha_exportacion', valor: exportDate.toISOString() },
      { campo: 'fecha_exportacion_local', valor: exportDate.toLocaleString() },
      { campo: 'enlace_publico', valor: publicUrl }
    ];
    if (isAdmin) {
      infoRows.push({ campo: 'enlace_admin', valor: adminUrl });
    }

    const playersRows = (tournament.players || []).map((p) => ({
      nombre: p.name,
      handicap: p.handicap
    }));

    const resultsRows = (tournament.matches || []).map((m) => ({
      jugador_1: playerMap.get(m.p1Id) || 'Jugador',
      jugador_2: playerMap.get(m.p2Id) || 'Jugador',
      fecha: m.matchDate || '',
      aros_j1: m.score1 ?? '',
      aros_j2: m.score2 ?? '',
      puntos_j1: m.points1 ?? 0,
      puntos_j2: m.points2 ?? 0
    }));

    const standingsRows = (tournament.standings || []).map((s) => ({
      jugador: s.name,
      jugados: s.played,
      ganados: s.won,
      diferencia_aros: s.hoopDiff,
      puntos: s.points
    }));

    const rulesRows = Object.entries(tournament.scoringRules || {}).map(([key, points]) => {
      const [winnerHandicap, loserHandicap] = key.split('|');
      return {
        handicap_ganador: Number(winnerHandicap),
        handicap_perdedor: Number(loserHandicap),
        puntos: points
      };
    });

    const wb = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(wb, window.XLSX.utils.json_to_sheet(infoRows), 'campeonato');
    window.XLSX.utils.book_append_sheet(wb, window.XLSX.utils.json_to_sheet(playersRows), 'jugadores');
    window.XLSX.utils.book_append_sheet(wb, window.XLSX.utils.json_to_sheet(resultsRows), 'resultados');
    window.XLSX.utils.book_append_sheet(wb, window.XLSX.utils.json_to_sheet(standingsRows), 'clasificacion');
    window.XLSX.utils.book_append_sheet(wb, window.XLSX.utils.json_to_sheet(rulesRows), 'reglas_handicap');

    const safeTitle = (tournament.title || 'torneo')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 40) || 'torneo';
    const y = exportDate.getFullYear();
    const m = String(exportDate.getMonth() + 1).padStart(2, '0');
    const d = String(exportDate.getDate()).padStart(2, '0');
    const hh = String(exportDate.getHours()).padStart(2, '0');
    const mm = String(exportDate.getMinutes()).padStart(2, '0');
    const ts = `${y}-${m}-${d}_${hh}${mm}`;

    window.XLSX.writeFile(wb, `${safeTitle}_${ts}.xlsx`);
  }

  const publicUrl = tournament ? `${window.location.origin}${window.location.pathname}#/t/${tournament.publicId}` : '';
  const adminUrl = tournament && route.mode === 'admin' ? `${window.location.origin}${window.location.pathname}#/a/${route.id}` : '';
  const homeUrl = `${window.location.origin}${window.location.pathname}`;

  if (isTournamentRoute && loading) {
    return (
      <main className="shell">
        <section className="card"><p>Cargando torneo...</p></section>
      </main>
    );
  }

  if (error) {
    return (
      <main className="shell">
        <section className="card"><h2>Error</h2><p>{error}</p></section>
      </main>
    );
  }

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <h1><a id="brand-home-link" className="brand-link" href="#">Corquet League</a></h1>
        </div>
        {isTournamentRoute && (
          <p className="mode-badge">{isAdmin ? 'Modo administrador' : 'Modo público (solo lectura)'}</p>
        )}
      </header>

      {route.mode === 'landing' && (
        <section className="home-stack">
          <section className="card landing-card">
            <h2>Bienvenido a Corquet League</h2>
            <p className="muted">
              Una aplicación simple y directa para organizar tus campeonatos de croquet.
            </p>
            <button className="btn btn-primary" type="button" onClick={() => { window.location.hash = '#/nuevo'; }}>
              Crear nuevo campeonato
            </button>
          </section>
          <HomeIndex items={knownTournaments} />
        </section>
      )}

      {route.mode === 'create-championship' && (
        <section id="home-view" className="home-stack">
          <section id="home-create-card" className="card">
            <h2>Nuevo campeonato</h2>
            <p className="muted">Crea un campeonato todos-contra-todos y comparte enlace público. Solo quien tenga enlace de admin puede editar.</p>

            <label className="label" htmlFor="tournament-title">Título del campeonato</label>
            <input id="tournament-title" className="input" placeholder="Ej: Liga de los domingos" value={homeTitle} onChange={(e) => setHomeTitle(e.target.value)} />

            <label className="label" htmlFor="tournament-subtitle">Subtítulo (opcional)</label>
            <input id="tournament-subtitle" className="input" placeholder="Ej: Del 12 al 14 de abril · Club de Campo" value={homeSubtitle} onChange={(e) => setHomeSubtitle(e.target.value)} />

            <div className="section-title-row">
              <h3>Jugadores</h3>
              <button id="add-player-btn" className="btn btn-light" type="button" onClick={addHomePlayerRow}>Añadir jugador</button>
            </div>

            <div className="players-list">
              {homePlayers.map((player, i) => (
                <div key={i} className="player-row">
                  <input className="input" type="text" placeholder="Nombre del jugador" value={player.name} onChange={(e) => updateHomePlayer(i, 'name', e.target.value)} />
                  <input className="input" type="number" step="1" placeholder="Hándicap" value={player.handicap} onChange={(e) => updateHomePlayer(i, 'handicap', e.target.value)} />
                  <button className="btn btn-danger" type="button" onClick={() => removeHomePlayer(i)}>Quitar</button>
                </div>
              ))}
            </div>

            <button id="create-tournament-btn" className="btn btn-primary" type="button" onClick={onCreateTournament}>Crear torneo</button>
            <div className="message" style={{ color: homeMessage.error ? 'var(--danger)' : 'var(--brand-strong)' }}>{homeMessage.text}</div>
          </section>
        </section>
      )}

      {isTournamentRoute && tournament && (
        <section id="tournament-view">
          <div className="card tournament-head">
            <h2 id="tournament-title-view">{tournament.title}</h2>
            <p id="tournament-subtitle-view" className="muted small">{tournament.subtitle || 'Puedes usar este subtítulo para indicar fechas y lugar del torneo.'}</p>
          </div>

          <div className="tabs">
            <button className={`tab-btn ${activeTab === 'results' ? 'active' : ''}`} onClick={() => setActiveTab('results')}>Resultados</button>
            <button className={`tab-btn ${activeTab === 'standings' ? 'active' : ''}`} onClick={() => setActiveTab('standings')}>Clasificación</button>
            <button className={`tab-btn ${activeTab === 'players' ? 'active' : ''}`} onClick={() => setActiveTab('players')}>Jugadores</button>
            <button className={`tab-btn ${activeTab === 'share' ? 'active' : ''}`} onClick={() => setActiveTab('share')}>Compartir</button>
            {isAdmin && (
              <button className={`tab-btn ${activeTab === 'config' ? 'active' : ''}`} onClick={() => setActiveTab('config')}>Configuración</button>
            )}
          </div>

          {activeTab === 'results' && (
            <section id="results-tab" className="card tab-panel">
              <h3>Lista de resultados</h3>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Jugador 1</th>
                      <th>Jugador 2</th>
                      <th>Fecha</th>
                      <th>Aros J1</th>
                      <th>Aros J2</th>
                      <th>Puntos J1</th>
                      <th>Puntos J2</th>
                      {isAdmin && <th>Acción</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {(tournament.matches || []).map((m) => {
                      const local = {
                        matchDate: m.matchDate || '',
                        score1: m.score1 ?? '',
                        score2: m.score2 ?? ''
                      };

                      return (
                        <ResultRow
                          key={m.id}
                          match={m}
                          initialState={local}
                          isAdmin={isAdmin}
                          p1Name={playerMap.get(m.p1Id) || 'Jugador'}
                          p2Name={playerMap.get(m.p2Id) || 'Jugador'}
                          onSave={onSaveMatch}
                        />
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {activeTab === 'standings' && (
            <section id="standings-tab" className="card tab-panel">
              <h3>Clasificación</h3>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Jugador</th>
                      <th>Jugados</th>
                      <th>Ganados</th>
                      <th>Diferencia de aros</th>
                      <th>Puntos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(tournament.standings || []).map((r) => (
                      <tr key={r.playerId}>
                        <td>{r.name}</td>
                        <td>{r.played}</td>
                        <td>{r.won}</td>
                        <td>{r.hoopDiff}</td>
                        <td><strong>{r.points}</strong></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {activeTab === 'players' && (
            <section id="players-tab" className="card tab-panel">
              <h3>Lista de jugadores</h3>

              {isAdmin && (
                <div className="add-player-admin">
                  <p className="muted small">Añadir jugador al torneo</p>
                  <div className="inline">
                    <input className="input" placeholder="Nombre del jugador" value={newPlayerName} onChange={(e) => setNewPlayerName(e.target.value)} />
                    <input className="input" type="number" step="1" placeholder="Hándicap" value={newPlayerHandicap} onChange={(e) => setNewPlayerHandicap(e.target.value)} />
                    <button className="btn btn-primary" type="button" onClick={onAddPlayer}>Añadir</button>
                  </div>
                  <div className="message" style={{ color: playersMessage.error ? 'var(--danger)' : 'var(--brand-strong)' }}>{playersMessage.text}</div>
                </div>
              )}

              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Jugador</th>
                      <th>Hándicap</th>
                      {isAdmin && <th>Acción</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {(tournament.players || []).slice().sort((a, b) => a.name.localeCompare(b.name, 'es')).map((p) => (
                      <PlayerRow
                        key={p.id}
                        player={p}
                        isAdmin={isAdmin}
                        onSave={onSavePlayer}
                        onDelete={onDeletePlayer}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {activeTab === 'share' && (
            <section id="share-tab" className="card tab-panel">
              <h3>Compartir torneo</h3>
              <p className="muted">Copia el enlace público para participantes y espectadores. El enlace admin permite editar.</p>
              <div className="share-actions">
                <button className="btn btn-light" type="button" onClick={() => copyText(publicUrl)}>Copiar enlace público</button>
                {isAdmin && <button className="btn btn-light" type="button" onClick={() => copyText(adminUrl)}>Copiar enlace admin</button>}
                <button className="btn btn-primary" type="button" onClick={downloadTournamentExcel}>Descargar Excel</button>
              </div>
              <hr className="section-divider" />
              <p className="muted">Si quieres recomendar la app, comparte también la página principal.</p>
              <div className="share-actions">
                <button className="btn btn-light" type="button" onClick={() => copyText(homeUrl)}>Copiar enlace de la app</button>
              </div>
              <details className="share-links">
                <summary>Ver enlaces completos</summary>
                <p className="muted small">Homepage: {homeUrl}</p>
                <p className="muted small">Enlace público: {publicUrl}</p>
                {isAdmin && <p className="muted small">Enlace admin: {adminUrl}</p>}
              </details>
            </section>
          )}

          {activeTab === 'config' && isAdmin && (
            <section id="config-tab" className="card tab-panel">
              <h3>Configuración del torneo</h3>

              <label className="label" htmlFor="edit-title-input">Título</label>
              <input id="edit-title-input" className="input" value={configTitle} onChange={(e) => setConfigTitle(e.target.value)} />

              <label className="label" htmlFor="edit-subtitle-input">Subtítulo (opcional)</label>
              <input id="edit-subtitle-input" className="input" placeholder="Ej: Del 12 al 14 de abril · Club de Campo" value={configSubtitle} onChange={(e) => setConfigSubtitle(e.target.value)} />

              <div className="inline config-head-actions">
                <SaveActionButton text="Guardar cabecera" onAction={onSaveHeader} />
              </div>

              <hr className="section-divider" />

              <h4>Reglas de puntos por hándicap</h4>
              <p className="muted small">Define puntos para el ganador según (hándicap ganador, hándicap rival). Si no existe una regla, se usa 1 punto por victoria.</p>

              <ConfigRulesSection
                ruleRows={ruleRows}
                setRuleRows={setRuleRows}
                configMessage={configMessage}
                onSaveRules={onSaveRules}
              />
            </section>
          )}
        </section>
      )}
    </main>
  );
}

function ResultRow({ match, initialState, isAdmin, p1Name, p2Name, onSave }) {
  const [state, setState] = useState(initialState);

  useEffect(() => {
    setState(initialState);
  }, [match.id, initialState.matchDate, initialState.score1, initialState.score2]);

  return (
    <tr>
      <td>{p1Name}</td>
      <td>{p2Name}</td>
      <td>
        {isAdmin ? (
          <input className="input" type="date" value={state.matchDate} onChange={(e) => setState((s) => ({ ...s, matchDate: e.target.value }))} />
        ) : (
          match.matchDate || '-'
        )}
      </td>
      <td>
        {isAdmin ? (
          <input className="input" type="number" min="0" max="7" step="1" value={state.score1} onChange={(e) => setState((s) => ({ ...s, score1: e.target.value }))} />
        ) : (
          match.score1 == null ? '-' : match.score1
        )}
      </td>
      <td>
        {isAdmin ? (
          <input className="input" type="number" min="0" max="7" step="1" value={state.score2} onChange={(e) => setState((s) => ({ ...s, score2: e.target.value }))} />
        ) : (
          match.score2 == null ? '-' : match.score2
        )}
      </td>
      <td>{match.points1 || 0}</td>
      <td>{match.points2 || 0}</td>
      {isAdmin && (
        <td>
          <SaveActionButton text="Guardar" onAction={() => onSave(match.id, state)} />
        </td>
      )}
    </tr>
  );
}

function PlayerRow({ player, isAdmin, onSave, onDelete }) {
  const [state, setState] = useState({ name: player.name, handicap: String(player.handicap ?? '') });

  useEffect(() => {
    setState({ name: player.name, handicap: String(player.handicap ?? '') });
  }, [player.id, player.name, player.handicap]);

  return (
    <tr>
      <td>
        {isAdmin ? (
          <input className="input" type="text" value={state.name} onChange={(e) => setState((s) => ({ ...s, name: e.target.value }))} />
        ) : (
          player.name
        )}
      </td>
      <td>
        {isAdmin ? (
          <input className="input" type="number" step="1" value={state.handicap} onChange={(e) => setState((s) => ({ ...s, handicap: e.target.value }))} />
        ) : (
          player.handicap
        )}
      </td>
      {isAdmin && (
        <td>
          <div className="inline">
            <SaveActionButton text="Guardar" onAction={() => onSave(player.id, state)} />
            <button className="btn btn-danger" type="button" onClick={() => onDelete(player.id)}>Borrar</button>
          </div>
        </td>
      )}
    </tr>
  );
}

function SaveActionButton({ text, onAction }) {
  const [saving, setSaving] = useState(false);

  async function handleClick() {
    if (saving) return;
    setSaving(true);
    const started = Date.now();
    try {
      await onAction();
    } finally {
      const elapsed = Date.now() - started;
      const remaining = Math.max(0, 400 - elapsed);
      if (remaining > 0) await wait(remaining);
      setSaving(false);
    }
  }

  return (
    <button
      className={`btn btn-primary btn-save ${saving ? 'btn-saving' : ''}`}
      type="button"
      onClick={handleClick}
      disabled={saving}
      aria-busy={saving}
      aria-live="polite"
    >
      {saving ? <span className="btn-spinner" aria-hidden="true" /> : text}
    </button>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
