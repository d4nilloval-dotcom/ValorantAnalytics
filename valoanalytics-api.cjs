/**
 * valoanalytics-api.cjs
 * ValoAnalytics — API propia que agrega:
 *   • Henrik API v2  → historial de partidos, kills, rondas, economía
 *   • valorant-api.com → mapas, transforms exactos, imágenes minimap, agentes, armas
 *
 * Puerto: 3001  (mismo que el proxy anterior, retrocompatible)
 *
 * ── Rutas nuevas ─────────────────────────────────────────────────────────────
 *  GET  /api/maps                              → todos los mapas con coords
 *  GET  /api/maps/:mapName/image               → imagen minimap (proxy CORS-safe)
 *  GET  /api/agents                            → todos los agentes con assets
 *  GET  /api/weapons                           → todas las armas con assets
 *  GET  /api/player/:region/:name/:tag/matches → historial de partidos (Henrik)
 *  GET  /api/match/:matchId                    → partido completo normalizado
 *  GET  /api/match/:matchId/heatmap            → kills con coords [0,1] por mapa
 *  GET  /api/match/:matchId/grid               → grid NxN kill-diff (estilo valolytics)
 *  GET  /api/match/:matchId/timeline           → datos de timeline pre-calculados
 *
 * ── Rutas heredadas (retrocompatibles) ───────────────────────────────────────
 *  GET  /health
 *  POST /riot-auth          → login Riot interno
 *  POST /riot-auth-mfa
 *  GET  /riot-session
 *  DELETE /riot-session
 *  GET  /pd/match-history
 *  GET  /pd/match-details/:matchId
 *  POST /claude             → proxy Anthropic API
 */

const http  = require('http');
const https = require('https');
const url   = require('url');

const PORT          = 3001;
const HENRIK_BASE   = 'api.henrikdev.xyz';
const VAPI_BASE     = 'valorant-api.com';   // valorant-api.com sin www

// ── Caché en memoria ──────────────────────────────────────────────────────────
const cache = {
  maps:        null,
  agents:      null,
  weapons:     null,
  mapsTs:      0,
  agentsTs:    0,
  weaponsTs:   0,
  matches:     new Map(),
  matchLists:  new Map(),
  mapImages:   new Map(),  // mapName → { contentType, body: Buffer }  (caché en memoria)
  MATCH_TTL:   30 * 60 * 1000,
  ASSET_TTL:   6  * 60 * 60 * 1000,
};

async function preloadMapImages() {
  try {
    const maps = await loadMaps();
    let loaded = 0;
    for (const [key, meta] of maps.entries()) {
      if (!meta.minimap || !meta.displayName || key !== meta.displayName.toLowerCase()) continue;
      if (cache.mapImages.has(meta.displayName)) continue;
      try {
        const img = await httpsGetImage(meta.minimap);
        if (img.status === 200) {
          cache.mapImages.set(meta.displayName, { contentType: img.contentType, body: img.body });
          loaded++;
        }
      } catch(e) {}
    }
    console.log('[maps] ' + loaded + ' minimapas precargados');
  } catch(e) {
    console.log('[maps] Precarga omitida: ' + e.message);
  }
}

// ── Helpers HTTP ──────────────────────────────────────────────────────────────
function httpsGet(hostname, path, headers = {}) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname, path, method: 'GET',
      headers: { 'Accept': 'application/json', ...headers },
    };
    const req = https.request(opts, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve({
        status:  res.statusCode,
        headers: res.headers,
        body:    Buffer.concat(chunks),
        text:    () => Buffer.concat(chunks).toString('utf8'),
        json:    () => JSON.parse(Buffer.concat(chunks).toString('utf8')),
      }));
    });
    req.on('error', reject);
    req.end();
  });
}

// Fetch de imagen siguiendo redirects (para proxy minimap)
function httpsGetImage(url, depth = 0) {
  return new Promise((resolve, reject) => {
    if (depth > 5) return reject(new Error('Demasiados redirects'));
    const parsed = new URL(url);
    const opts = {
      hostname: parsed.hostname,
      path:     parsed.pathname + parsed.search,
      method:   'GET',
      headers:  { 'Accept': 'image/*,*/*', 'User-Agent': 'ValoAnalytics/2.0' },
    };
    const req = https.request(opts, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const next = res.headers.location.startsWith('http')
          ? res.headers.location
          : `https://${parsed.hostname}${res.headers.location}`;
        res.resume();
        return resolve(httpsGetImage(next, depth + 1));
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve({
        status:      res.statusCode,
        contentType: res.headers['content-type'] || 'image/png',
        body:        Buffer.concat(chunks),
      }));
    });
    req.on('error', reject);
    req.end();
  });
}

function httpsPost(hostname, path, bodyObj, headers = {}) {
  return new Promise((resolve, reject) => {
    const bodyBuf = Buffer.from(JSON.stringify(bodyObj), 'utf8');
    const opts = {
      hostname, path, method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': bodyBuf.length,
        'Accept': 'application/json',
        ...headers,
      },
    };
    const req = https.request(opts, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve({
        status:  res.statusCode,
        headers: res.headers,
        body:    Buffer.concat(chunks),
        text:    () => Buffer.concat(chunks).toString('utf8'),
        json:    () => JSON.parse(Buffer.concat(chunks).toString('utf8')),
      }));
    });
    req.on('error', reject);
    req.write(bodyBuf);
    req.end();
  });
}

function readBody(req) {
  return new Promise(r => { let b = ''; req.on('data', c => { b += c; }); req.on('end', () => r(b)); });
}

// ── Respuestas estándar ───────────────────────────────────────────────────────
const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-api-key, x-anthropic-key, Authorization, anthropic-version, x-henrik-key',
};

function sendJSON(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, { 'Content-Type': 'application/json', ...CORS_HEADERS });
  res.end(body);
}

function sendError(res, status, msg) {
  sendJSON(res, status, { error: msg });
}

// ═══════════════════════════════════════════════════════════════════════════════
// ── VALORANT-API.COM  (assets + map coords) ────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

async function loadMaps() {
  const now = Date.now();
  if (cache.maps && (now - cache.mapsTs) < cache.ASSET_TTL) return cache.maps;
  console.log('[assets] Cargando mapas de valorant-api.com...');
  try {
    const r = await httpsGet(VAPI_BASE, '/v1/maps');
    const json = r.json();
    const maps = new Map();
    for (const m of (json.data || [])) {
      const meta = {
        uuid:          m.uuid,
        displayName:   m.displayName,
        mapUrl:        m.mapUrl || '',
        // Transforms para convertir coordenadas mundo → [0,1]
        xMultiplier:   m.xMultiplier,
        yMultiplier:   m.yMultiplier,
        xScalarToAdd:  m.xScalarToAdd,
        yScalarToAdd:  m.yScalarToAdd,
        // Imágenes
        minimap:       m.minimap || '',
        splash:        m.splash  || '',
        listViewIcon:  m.listViewIcon || '',
        // Callouts
        callouts: (m.callouts || []).map(c => ({
          regionName:    c.regionName,
          superRegionName: c.superRegionName,
          location:      c.location,
        })),
      };
      // Indexar por displayName (ej: "Bind"), por último segmento del mapUrl (ej: "Bind")
      // y por uuid para máxima cobertura
      maps.set(m.displayName?.toLowerCase(), meta);
      if (m.mapUrl) {
        const seg = m.mapUrl.split('/').pop()?.toLowerCase();
        if (seg) maps.set(seg, meta);
      }
      maps.set(m.uuid, meta);
    }
    cache.maps   = maps;
    cache.mapsTs = now;
    console.log(`[assets] ${maps.size / 3 | 0} mapas cargados`);
    return maps;
  } catch (e) {
    console.error('[assets] Error cargando mapas:', e.message);
    return cache.maps || new Map();
  }
}

async function loadAgents() {
  const now = Date.now();
  if (cache.agents && (now - cache.agentsTs) < cache.ASSET_TTL) return cache.agents;
  console.log('[assets] Cargando agentes...');
  try {
    const r = await httpsGet(VAPI_BASE, '/v1/agents?isPlayableCharacter=true');
    const json = r.json();
    const agents = new Map();
    for (const a of (json.data || [])) {
      const meta = {
        uuid:        a.uuid,
        displayName: a.displayName,
        role:        a.role?.displayName || '',
        description: a.description || '',
        killfeed:    a.killfeedPortrait || '',
        bust:        a.bustPortrait || '',
        full:        a.fullPortrait || '',
        icon:        a.displayIcon || '',
        abilities: (a.abilities || []).map(ab => ({
          slot:        ab.slot,
          displayName: ab.displayName,
          description: ab.description,
          icon:        ab.displayIcon,
        })),
      };
      agents.set(a.uuid, meta);
      agents.set(a.displayName?.toLowerCase(), meta);
    }
    cache.agents   = agents;
    cache.agentsTs = now;
    console.log(`[assets] ${agents.size / 2 | 0} agentes cargados`);
    return agents;
  } catch (e) {
    console.error('[assets] Error cargando agentes:', e.message);
    return cache.agents || new Map();
  }
}

async function loadWeapons() {
  const now = Date.now();
  if (cache.weapons && (now - cache.weaponsTs) < cache.ASSET_TTL) return cache.weapons;
  console.log('[assets] Cargando armas...');
  try {
    const r = await httpsGet(VAPI_BASE, '/v1/weapons');
    const json = r.json();
    const weapons = new Map();
    for (const w of (json.data || [])) {
      const meta = {
        uuid:        w.uuid,
        displayName: w.displayName,
        category:    w.category?.replace('EEquippableCategory::', '') || '',
        killFeedIcon: w.killStreamIcon || '',
        displayIcon:  w.displayIcon   || '',
        stats: w.weaponStats ? {
          fireRate:     w.weaponStats.fireRate,
          magazineSize: w.weaponStats.magazineSize,
          reloadTime:   w.weaponStats.reloadTimeSeconds,
          damage: (w.weaponStats.damageRanges || []).map(d => ({
            rangeStart:  d.rangeStartMeters,
            rangeEnd:    d.rangeEndMeters,
            head:        d.headDamage,
            body:        d.bodyDamage,
            leg:         d.legDamage,
          })),
        } : null,
      };
      weapons.set(w.displayName?.toLowerCase(), meta);
      weapons.set(w.uuid, meta);
    }
    cache.weapons   = weapons;
    cache.weaponsTs = now;
    console.log(`[assets] ${weapons.size / 2 | 0} armas cargadas`);
    return weapons;
  } catch (e) {
    console.error('[assets] Error cargando armas:', e.message);
    return cache.weapons || new Map();
  }
}

// ── Convertir coords mundo → [0,1] con la fórmula oficial de valorant-api.com
// nx = worldX * xMultiplier + xScalarToAdd  (resultado ∈ [0,1])
// ny = worldY * yMultiplier + yScalarToAdd  (yMultiplier es negativo → flip Y automático)
function worldToNorm(wx, wy, mapMeta) {
  if (!mapMeta || mapMeta.xMultiplier == null) {
    // fallback genérico
    return { nx: (wx + 100000) / 200000, ny: 1 - (wy + 100000) / 200000 };
  }
  return {
    nx: wx * mapMeta.xMultiplier + mapMeta.xScalarToAdd,
    ny: wy * mapMeta.yMultiplier + mapMeta.yScalarToAdd,
  };
}

// ── Encontrar mapa por nombre (ej: "Bind", "bind", mapUrl path)
function findMap(maps, rawName) {
  if (!rawName) return null;
  const lc = rawName.toLowerCase();
  // Probar directamente
  if (maps.has(lc)) return maps.get(lc);
  // Probar último segmento (ej: "/Game/Maps/Triad/Triad" → "triad" = Bind)
  const seg = lc.split('/').pop();
  if (seg && maps.has(seg)) return maps.get(seg);
  // Probar parcial
  for (const [key, val] of maps.entries()) {
    if (key.includes(lc) || lc.includes(key)) return val;
  }
  return null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ── HENRIK API  (partidos) ─────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

function henrikHeaders(apiKey) {
  const h = { 'Accept': 'application/json', 'User-Agent': 'ValoAnalytics/2.0' };
  if (apiKey) h['Authorization'] = apiKey;
  return h;
}

async function henrikFetch(path, apiKey) {
  const r = await httpsGet(HENRIK_BASE, '/valorant' + path, henrikHeaders(apiKey));
  if (r.status === 401) throw new Error('Henrik API key inválida o requerida (401)');
  if (r.status === 403) throw new Error('Acceso denegado a Henrik API (403)');
  if (r.status === 404) throw new Error('Recurso no encontrado en Henrik (404)');
  if (r.status === 429) throw new Error('Rate limit de Henrik API alcanzado (429). Espera un momento.');
  const json = r.json();
  return json.data ?? json;
}

// ── Normalizar partido v2 de Henrik ──────────────────────────────────────────
// Extrae kills de rounds con índice + normaliza nombres de campos
async function normalizeMatch(raw) {
  const [maps, agents, weapons] = await Promise.all([loadMaps(), loadAgents(), loadWeapons()]);

  // Mapa puuid → player para enriquecer kills
  const playerMap = {};
  for (const p of (raw.players?.all_players || [])) {
    playerMap[p.puuid] = p;
  }

  // Nombre del mapa (v2 da "Bind" en metadata.map)
  const rawMapName = raw.metadata?.map || '';
  const mapMeta    = findMap(maps, rawMapName);

  // ── Normalizar kills: PRIORIDAD al array top-level raw.kills[] que tiene
  //    victim_death_location y player_locations_on_kill completos.
  //    Fallback a rounds[].player_stats[].kill_events[] para compatibilidad.
  const kills = [];
  const seen  = new Set();

  // Helper para procesar un kill_event (sea del top-level o de rounds)
  const processKill = (ke, round) => {
    const key = `${ke.killer_puuid}|${ke.victim_puuid}|${ke.kill_time_in_round ?? ke.kill_time_in_match}|${round}`;
    if (seen.has(key)) return;
    seen.add(key);

    // Ubicación de la víctima (campo directo, más fiable)
    const victimWorldLoc = ke.victim_death_location || null;

    // Ubicación del asesino: primero intento directo, luego player_locations_on_kill
    let killerWorldLoc = ke.killer_location || null;
    if (!killerWorldLoc) {
      const entry = (ke.player_locations_on_kill || [])
        .find(pl => (pl.player_puuid || pl.puuid) === ke.killer_puuid);
      killerWorldLoc = entry?.location || null;
    }

    const killerNorm = killerWorldLoc ? worldToNorm(killerWorldLoc.x, killerWorldLoc.y, mapMeta) : null;
    const victimNorm = victimWorldLoc ? worldToNorm(victimWorldLoc.x, victimWorldLoc.y, mapMeta) : null;

    // Validar rango [0,1] — si está fuera, usar fallback genérico
    const clampNorm = (n) => {
      if (!n) return null;
      if (n.nx < -0.1 || n.nx > 1.1 || n.ny < -0.1 || n.ny > 1.1) return null;
      return { nx: Math.max(0, Math.min(1, n.nx)), ny: Math.max(0, Math.min(1, n.ny)) };
    };

    const weaponName   = ke.damage_weapon_name || ke.weapon?.name || '';
    const weaponMeta   = weapons.get(weaponName.toLowerCase()) || null;
    const killerPlayer = playerMap[ke.killer_puuid];
    const victimPlayer = playerMap[ke.victim_puuid];

    kills.push({
      round:              round,
      timeInRound:        ke.kill_time_in_round  ?? 0,
      timeInMatch:        ke.kill_time_in_match  ?? 0,

      killerPuuid:        ke.killer_puuid         || '',
      killerName:         ke.killer_display_name  || '',
      killerTeam:         ke.killer_team          || '',
      killerAgent:        killerPlayer?.character || '',
      killerAgentIcon:    agents.get(killerPlayer?.character?.toLowerCase())?.killfeed || '',
      killerLocation:     killerWorldLoc,
      killerLocationNorm: clampNorm(killerNorm),

      victimPuuid:        ke.victim_puuid         || '',
      victimName:         ke.victim_display_name  || '',
      victimTeam:         ke.victim_team          || '',
      victimAgent:        victimPlayer?.character || '',
      victimAgentIcon:    agents.get(victimPlayer?.character?.toLowerCase())?.killfeed || '',
      victimLocation:     victimWorldLoc,
      victimLocationNorm: clampNorm(victimNorm),

      headshot:           ke.headshot ?? false,
      weaponName,
      weaponKillFeedIcon: weaponMeta?.killFeedIcon || ke.damage_weapon_assets?.killfeed_icon || '',
      weaponDisplayIcon:  weaponMeta?.displayIcon  || ke.damage_weapon_assets?.display_icon   || '',
      weaponCategory:     weaponMeta?.category     || '',

      assistants: (ke.assistants || []).map(a => ({
        puuid:       a.assistant_puuid,
        displayName: a.assistant_display_name,
        team:        a.assistant_team,
      })),

      playerLocationsOnKill: (ke.player_locations_on_kill || []).map(pl => ({
        puuid:        pl.player_puuid || pl.puuid,
        displayName:  pl.player_display_name || pl.display_name || '',
        team:         pl.player_team  || pl.team || '',
        location:     pl.location,
        locationNorm: pl.location ? clampNorm(worldToNorm(pl.location.x, pl.location.y, mapMeta)) : null,
        viewRadians:  pl.view_radians,
      })),
    });
  };

  // 1. Intentar con top-level raw.kills[] (mejor cobertura de location data)
  if (Array.isArray(raw.kills) && raw.kills.length > 0) {
    for (const ke of raw.kills) {
      processKill(ke, ke.round ?? 0);
    }
  }

  // 2. Completar con rounds[].player_stats[].kill_events[] (puede tener kills no en top-level)
  for (let ri = 0; ri < (raw.rounds || []).length; ri++) {
    const r = raw.rounds[ri];
    for (const ps of (r.player_stats || [])) {
      for (const ke of (ps.kill_events || [])) {
        processKill(ke, ri);
      }
    }
  }

  // Ordenar por ronda y por tiempo
  kills.sort((a, b) => a.round - b.round || a.timeInRound - b.timeInRound);

  // ── Normalizar rounds ───────────────────────────────────────────────────────
  const rounds = (raw.rounds || []).map((r, ri) => {
    const pe = r.plant_events;
    const de = r.defuse_events;

    // Posición de la spike en el mapa
    const plantLocNorm  = pe?.plant_location  ? worldToNorm(pe.plant_location.x,  pe.plant_location.y,  mapMeta) : null;
    const defuseLocNorm = de?.defuse_location ? worldToNorm(de.defuse_location.x, de.defuse_location.y, mapMeta) : null;

    return {
      roundIndex:   ri,
      winningTeam:  r.winning_team || '',
      endType:      r.end_type     || '',
      bombPlanted:  !!r.bomb_planted,
      bombDefused:  !!r.bomb_defused,

      plant: pe ? {
        site:           pe.plant_site || '',
        timeInRound:    pe.plant_time_in_round ?? 0,
        location:       pe.plant_location,
        locationNorm:   plantLocNorm,
        plantedBy:      pe.planted_by || null,
        playerLocations: (pe.player_locations_on_plant || []).map(pl => ({
          puuid:       pl.player_puuid,
          displayName: pl.player_display_name,
          team:        pl.player_team,
          location:    pl.location,
          locationNorm: pl.location ? worldToNorm(pl.location.x, pl.location.y, mapMeta) : null,
          viewRadians: pl.view_radians,
        })),
      } : null,

      defuse: de?.defused_by ? {
        timeInRound:    de.defuse_time_in_round ?? 0,
        location:       de.defuse_location,
        locationNorm:   defuseLocNorm,
        defusedBy:      de.defused_by || null,
      } : null,

      // Stats por jugador en la ronda
      playerStats: (r.player_stats || []).map(ps => ({
        puuid:       ps.player_puuid,
        displayName: ps.player_display_name,
        team:        ps.player_team,
        kills:       ps.kills     || 0,
        deaths:      0,           // Henrik v2 no da deaths por ronda
        damage:      ps.damage    || 0,
        headshots:   ps.headshots || 0,
        bodyshots:   ps.bodyshots || 0,
        legshots:    ps.legshots  || 0,
        score:       ps.score     || 0,
        economy: ps.economy ? {
          loadoutValue: ps.economy.loadout_value || 0,
          remaining:    ps.economy.remaining     || 0,
          spent:        ps.economy.spent         || 0,
          weapon:       ps.economy.weapon?.name  || '',
          armor:        ps.economy.armor?.name   || '',
        } : null,
        abilityCasts: ps.ability_casts ? {
          c: ps.ability_casts.c_casts || 0,
          q: ps.ability_casts.q_casts || 0,
          e: ps.ability_casts.e_casts || 0,
          x: ps.ability_casts.x_casts || 0,
        } : null,
      })),
    };
  });

  // ── Enriquecer jugadores con info de agente ─────────────────────────────────
  const enrichPlayer = (p) => {
    const ag = agents.get(p.character?.toLowerCase()) || null;
    return {
      puuid:      p.puuid,
      name:       p.name,
      tag:        p.tag,
      team:       p.team,
      level:      p.level || 0,
      agent:      p.character || '',
      agentRole:  ag?.role || '',
      agentIcon:  ag?.icon || '',
      agentBust:  ag?.bust || '',
      agentKillfeed: ag?.killfeed || p.assets?.agent?.killfeed || '',
      tier:       p.currenttier_patched || '',
      tierId:     p.currenttier || 0,
      cardSmall:  p.assets?.card?.small || '',
      stats: {
        score:     p.stats?.score    || 0,
        kills:     p.stats?.kills    || 0,
        deaths:    p.stats?.deaths   || 0,
        assists:   p.stats?.assists  || 0,
        headshots: p.stats?.headshots || 0,
        bodyshots: p.stats?.bodyshots || 0,
        legshots:  p.stats?.legshots  || 0,
      },
      economy: {
        spentOverall:   p.economy?.spent?.overall        || 0,
        spentAvg:       p.economy?.spent?.average        || 0,
        loadoutOverall: p.economy?.loadout_value?.overall || 0,
        loadoutAvg:     p.economy?.loadout_value?.average || 0,
      },
      damageMade:     p.damage_made     || 0,
      damageReceived: p.damage_received || 0,
      abilityCasts: {
        c: p.ability_casts?.c_cast || 0,
        q: p.ability_casts?.q_cast || 0,
        e: p.ability_casts?.e_cast || 0,
        x: p.ability_casts?.x_cast || 0,
      },
    };
  };

  return {
    matchId:  raw.metadata?.matchid || '',
    metadata: {
      map:              rawMapName,
      mapUuid:          mapMeta?.uuid || '',
      mapMinimapUrl:    mapMeta?.minimap || '',
      mapSplashUrl:     mapMeta?.splash  || '',
      mapTransform: mapMeta ? {
        xMultiplier:  mapMeta.xMultiplier,
        yMultiplier:  mapMeta.yMultiplier,
        xScalarToAdd: mapMeta.xScalarToAdd,
        yScalarToAdd: mapMeta.yScalarToAdd,
      } : null,
      mapCallouts:      mapMeta?.callouts || [],
      gameVersion:      raw.metadata?.game_version || '',
      gameStart:        raw.metadata?.game_start   || 0,
      gameStartPatched: raw.metadata?.game_start_patched || '',
      gameLength:       raw.metadata?.game_length  || 0,
      roundsPlayed:     raw.metadata?.rounds_played || rounds.length,
      mode:             raw.metadata?.mode   || '',
      modeId:           raw.metadata?.mode_id || '',
      region:           raw.metadata?.region  || '',
      cluster:          raw.metadata?.cluster || '',
    },
    teams: {
      blue: {
        hasWon:     raw.teams?.blue?.has_won    ?? false,
        roundsWon:  raw.teams?.blue?.rounds_won ?? 0,
        roundsLost: raw.teams?.blue?.rounds_lost ?? 0,
      },
      red: {
        hasWon:     raw.teams?.red?.has_won    ?? false,
        roundsWon:  raw.teams?.red?.rounds_won ?? 0,
        roundsLost: raw.teams?.red?.rounds_lost ?? 0,
      },
    },
    players: {
      all:  (raw.players?.all_players || []).map(enrichPlayer),
      blue: (raw.players?.blue        || []).map(enrichPlayer),
      red:  (raw.players?.red         || []).map(enrichPlayer),
    },
    rounds,
    kills,
    // Flags de conveniencia
    _normalized: true,
    _normalizedAt: Date.now(),
  };
}

// ── Calcular heatmap de kills en grid NxN ───────────────────────────────────
// Devuelve una matriz [gridSize][gridSize] con { kills, deaths, diff, engagements }
function buildHeatmapGrid(normalizedMatch, opts = {}) {
  const {
    gridSize    = 16,
    team        = 'all',   // 'all' | 'Blue' | 'Red'
    side        = 'all',   // 'all' | 'killer' | 'victim'
    playerPuuid = null,
    roundRange  = null,    // null | [start, end] (inclusive)
  } = opts;

  const grid = Array.from({ length: gridSize }, () =>
    Array.from({ length: gridSize }, () => ({ kills: 0, deaths: 0, diff: 0, engagements: 0 }))
  );

  let kills = normalizedMatch.kills;

  if (roundRange) kills = kills.filter(k => k.round >= roundRange[0] && k.round <= roundRange[1]);

  for (const k of kills) {
    // Filtro equipo
    if (team !== 'all') {
      if (k.killerTeam !== team && k.victimTeam !== team) continue;
    }
    // Filtro jugador
    if (playerPuuid) {
      if (k.killerPuuid !== playerPuuid && k.victimPuuid !== playerPuuid) continue;
    }

    // Posición víctima → "muerte"
    if (k.victimLocationNorm) {
      const { nx, ny } = k.victimLocationNorm;
      if (nx >= 0 && nx <= 1 && ny >= 0 && ny <= 1) {
        const col = Math.min(gridSize - 1, Math.floor(nx * gridSize));
        const row = Math.min(gridSize - 1, Math.floor(ny * gridSize));
        const cell = grid[row][col];
        cell.deaths++;
        cell.engagements++;
      }
    }

    // Posición asesino → "kill"
    if (k.killerLocationNorm) {
      const { nx, ny } = k.killerLocationNorm;
      if (nx >= 0 && nx <= 1 && ny >= 0 && ny <= 1) {
        const col = Math.min(gridSize - 1, Math.floor(nx * gridSize));
        const row = Math.min(gridSize - 1, Math.floor(ny * gridSize));
        const cell = grid[row][col];
        cell.kills++;
        cell.engagements++;
      }
    }
  }

  // Calcular diff y normalizar
  let maxEng = 1;
  for (const row of grid) {
    for (const cell of row) {
      cell.diff = cell.kills - cell.deaths;
      if (cell.engagements > maxEng) maxEng = cell.engagements;
    }
  }
  for (const row of grid) {
    for (const cell of row) {
      cell.normalizedEngagements = cell.engagements / maxEng;
    }
  }

  // También devolver kills como lista de puntos [0,1] para pintar exacto
  const killPoints = normalizedMatch.kills
    .filter(k => {
      if (roundRange && (k.round < roundRange[0] || k.round > roundRange[1])) return false;
      if (playerPuuid && k.killerPuuid !== playerPuuid && k.victimPuuid !== playerPuuid) return false;
      return true;
    })
    .map(k => ({
      round:     k.round,
      time:      k.timeInRound,
      killer: {
        puuid:   k.killerPuuid,
        name:    k.killerName,
        team:    k.killerTeam,
        agent:   k.killerAgent,
        icon:    k.killerAgentIcon,
        norm:    k.killerLocationNorm,
      },
      victim: {
        puuid:   k.victimPuuid,
        name:    k.victimName,
        team:    k.victimTeam,
        agent:   k.victimAgent,
        icon:    k.victimAgentIcon,
        norm:    k.victimLocationNorm,
      },
      weapon:   k.weaponName,
      weaponIcon: k.weaponKillFeedIcon,
    }));

  return {
    gridSize,
    grid,
    killPoints,
    totalKills:  normalizedMatch.kills.length,
    mapTransform: normalizedMatch.metadata.mapTransform,
    mapMinimapUrl: normalizedMatch.metadata.mapMinimapUrl,
  };
}

// ── Calcular datos de timeline pre-procesados ───────────────────────────────
function buildTimeline(normalizedMatch) {
  const rounds = normalizedMatch.rounds;
  const kills  = normalizedMatch.kills;

  // Acumulados por ronda
  let bAcc = 0, rAcc = 0;
  const roundData = rounds.map((r, i) => {
    const roundKills = kills.filter(k => k.round === i);
    const bKills = roundKills.filter(k => k.killerTeam === 'Blue').length;
    const rKills = roundKills.filter(k => k.killerTeam === 'Red').length;
    bAcc += bKills; rAcc += rKills;

    const mvp = r.playerStats.reduce(
      (best, ps) => (ps.kills > (best?.kills || 0) ? ps : best), null
    );

    return {
      round:        i,
      winningTeam:  r.winningTeam,
      endType:      r.endType,
      bombPlanted:  r.bombPlanted,
      bombDefused:  r.bombDefused,
      plantSite:    r.plant?.site || null,
      blueKills:    bKills,
      redKills:     rKills,
      blueAccKills: bAcc,
      redAccKills:  rAcc,
      totalKills:   bKills + rKills,
      mvp:          mvp ? { name: mvp.displayName, team: mvp.team, kills: mvp.kills, damage: mvp.damage } : null,
    };
  });

  // Economía por ronda (loadout value promedio por equipo)
  const ecoData = rounds.map((r, i) => {
    const bluePlayers = r.playerStats.filter(p => p.team === 'Blue');
    const redPlayers  = r.playerStats.filter(p => p.team === 'Red');
    const avg = (arr, field) =>
      arr.length ? arr.reduce((s, p) => s + (p.economy?.[field] || 0), 0) / arr.length : 0;
    return {
      round:         i,
      blueLoadout:   avg(bluePlayers, 'loadoutValue'),
      redLoadout:    avg(redPlayers,  'loadoutValue'),
      blueRemaining: avg(bluePlayers, 'remaining'),
      redRemaining:  avg(redPlayers,  'remaining'),
    };
  });

  // Momentos clave
  const keyMoments = [];
  for (const rd of roundData) {
    if (rd.totalKills >= 8) keyMoments.push({ round: rd.round, type: 'chaos', desc: `Ronda caótica (${rd.totalKills} kills)` });
    if (rd.bombDefused) keyMoments.push({ round: rd.round, type: 'defuse', desc: `💣 Spike defusada` });
    if (rd.bombPlanted && rd.winningTeam === 'Blue') keyMoments.push({ round: rd.round, type: 'explode', desc: `💥 Blue planta y gana` });
    if (rd.mvp && rd.mvp.kills >= 4) keyMoments.push({ round: rd.round, type: 'ace', desc: `⭐ ${rd.mvp.name} (${rd.mvp.kills}k)` });
  }

  return { roundData, ecoData, keyMoments };
}

// ═══════════════════════════════════════════════════════════════════════════════
// ── SESIÓN RIOT INTERNA (heredado del proxy anterior) ─────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

let session = null;
const CLIENT_PLATFORM = 'ew0KCSJwbGF0Zm9ybVR5cGUiOiAiUEMiLA0KCSJwbGF0Zm9ybU9TIjogIldpbmRvd3MiLA0KCSJwbGF0Zm9ybU9TVmVyc2lvbiI6ICIxMC4wLjE5MDQyLjEuMjU2LjY0Yml0IiwNCgkicGxhdGZvcm1DaGlwc2V0IjogIlVua25vd24iDQp9';
// Mantener actualizado con el cliente de Riot más reciente
const RIOT_UA         = 'RiotClient/75.0.3.2382.4445 rso-auth (Windows;10;;Professional, x64)';
const REGION_TO_SHARD = { eu:'eu', na:'na', latam:'na', br:'na', ap:'ap', kr:'kr' };

function riotRequest(method, hostname, path, body, extraHeaders) {
  return new Promise((resolve, reject) => {
    const bodyBuf = body ? Buffer.from(typeof body === 'string' ? body : JSON.stringify(body), 'utf8') : null;
    const opts = {
      hostname, path, method,
      headers: {
        'User-Agent': RIOT_UA, 'Accept': 'application/json',
        ...(bodyBuf ? { 'Content-Type':'application/json', 'Content-Length': bodyBuf.length } : {}),
        ...(extraHeaders || {}),
      },
    };
    const req = https.request(opts, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString('utf8'), setCookies: res.headers['set-cookie'] || [] }));
    });
    req.on('error', reject);
    if (bodyBuf) req.write(bodyBuf);
    req.end();
  });
}

function parseCookies(arr) {
  const m = {};
  for (const c of (arr || [])) { const p = c.split(';')[0], eq = p.indexOf('='); if (eq > 0) m[p.slice(0,eq).trim()] = p.slice(eq+1).trim(); }
  return m;
}
const mergeCookies = (a, b) => ({ ...a, ...b });
const cookieStr    = (m)    => Object.entries(m).map(([k,v])=>`${k}=${v}`).join('; ');

async function getClientVersion() {
  try { const r = await riotRequest('GET','valorant-api.com','/v1/version',null); return JSON.parse(r.body).data?.riotClientVersion||'release-09.08-shipping-14-2686319'; }
  catch { return 'release-09.08-shipping-14-2686319'; }
}

async function finishAuth(loginData, cookies) {
  const uri = loginData?.response?.parameters?.uri || '';
  const fragment = uri.includes('#') ? uri.split('#')[1] : (uri.split('?')[1]||'');
  const params = new URLSearchParams(fragment);
  const accessToken = params.get('access_token');
  if (!accessToken) throw new Error('access_token no encontrado');
  const entR = await riotRequest('POST','entitlements.auth.riotgames.com','/api/token/v1','{}',{'Authorization':`Bearer ${accessToken}`});
  const entitlementToken = JSON.parse(entR.body).entitlements_token;
  if (!entitlementToken) throw new Error('entitlements_token vacío');
  const userR = await riotRequest('GET','auth.riotgames.com','/userinfo',null,{'Authorization':`Bearer ${accessToken}`});
  const puuid = JSON.parse(userR.body).sub;
  if (!puuid) throw new Error('PUUID vacío');
  const clientVersion = await getClientVersion();
  return { accessToken, entitlementToken, puuid, clientVersion, _cookies: cookies };
}

async function riotLogin(username, password) {
  // Paso 1: inicializar sesión de cookies
  const initR = await riotRequest('POST','auth.riotgames.com','/api/v1/authorization',
    JSON.stringify({ client_id:'play-valorant-web-prod', nonce:'1', redirect_uri:'https://playvalorant.com/opt_in', response_type:'token id_token', scope:'account openid' }));
  let cookies = parseCookies(initR.setCookies);

  // Paso 2: enviar credenciales
  const authR = await riotRequest('PUT','auth.riotgames.com','/api/v1/authorization',
    JSON.stringify({ type:'auth', username, password, remember:true, language:'en_US' }),
    { 'Cookie': cookieStr(cookies) });
  cookies = mergeCookies(cookies, parseCookies(authR.setCookies));

  let authD;
  try { authD = JSON.parse(authR.body); } catch(e) { throw new Error('Respuesta inválida de Riot: ' + authR.body.slice(0,200)); }

  console.log('[riot-auth] response type:', authD.type, '| status:', authR.status);

  if (authD.type === 'multifactor')
    return { mfa:true, method:authD.multifactor?.method||'email', email:authD.multifactor?.email||'', _cookies:cookies };

  if (authD.type === 'error')
    throw new Error(authD.error === 'auth_failure' ? 'Usuario o contraseña incorrectos' : (authD.error || 'Error de autenticación'));

  // Riot devuelve 'auth' de nuevo cuando hay captcha o rate-limit
  if (authD.type === 'auth') {
    const hasCaptcha = !!(authD.captcha || authD.country);
    console.log('[riot-auth] Re-auth recibido. captcha:', hasCaptcha, '| respuesta completa:', JSON.stringify(authD).slice(0,300));
    if (hasCaptcha) {
      throw new Error('Riot requiere verificación captcha. Intenta iniciar sesión en https://playvalorant.com primero para desbloquear tu cuenta, luego vuelve a intentarlo.');
    }
    // A veces es rate-limit temporal — esperar y reintentar una vez
    console.log('[riot-auth] Esperando 2s y reintentando...');
    await new Promise(r => setTimeout(r, 2000));
    const retryR = await riotRequest('PUT','auth.riotgames.com','/api/v1/authorization',
      JSON.stringify({ type:'auth', username, password, remember:true, language:'en_US' }),
      { 'Cookie': cookieStr(cookies) });
    let retryD;
    try { retryD = JSON.parse(retryR.body); } catch(e) { throw new Error('Respuesta inválida en reintento'); }
    console.log('[riot-auth] reintento type:', retryD.type);
    if (retryD.type === 'multifactor') return { mfa:true, method:retryD.multifactor?.method||'email', email:retryD.multifactor?.email||'', _cookies: mergeCookies(cookies, parseCookies(retryR.setCookies)) };
    if (retryD.type === 'error') throw new Error(retryD.error === 'auth_failure' ? 'Usuario o contraseña incorrectos' : (retryD.error || 'Error de autenticación'));
    if (retryD.type !== 'response') throw new Error('Riot no permite el acceso. Abre https://playvalorant.com en tu navegador, inicia sesión ahí, y luego inténtalo de nuevo aquí. (type: ' + retryD.type + ')');
    cookies = mergeCookies(cookies, parseCookies(retryR.setCookies));
    return finishAuth(retryD, cookies);
  }

  if (authD.type !== 'response')
    throw new Error('Respuesta inesperada de Riot (type: ' + authD.type + '). Intenta de nuevo en unos segundos.');

  return finishAuth(authD, cookies);
}

async function riotMFA(code, savedCookies) {
  const mfaR = await riotRequest('PUT','auth.riotgames.com','/api/v1/authorization',
    JSON.stringify({ type:'multifactor', code:String(code).trim(), rememberDevice:false }),
    { 'Cookie': cookieStr(savedCookies) });
  const cookies = mergeCookies(savedCookies, parseCookies(mfaR.setCookies));
  const mfaD = JSON.parse(mfaR.body);
  if (mfaD.type === 'error') throw new Error('Código 2FA incorrecto');
  if (mfaD.type !== 'response') throw new Error('Error MFA: '+mfaD.type);
  return finishAuth(mfaD, cookies);
}

async function proxyPD(pdPath, res) {
  if (!session || session._mfaPending) { sendError(res, 401, 'Sesión no iniciada. Haz login primero.'); return; }
  try {
    const r = await riotRequest('GET', `pd.${session.shard}.a.pvp.net`, pdPath, null, {
      'Authorization': `Bearer ${session.accessToken}`,
      'X-Riot-Entitlements-JWT': session.entitlementToken,
      'X-Riot-ClientPlatform':   CLIENT_PLATFORM,
      'X-Riot-ClientVersion':    session.clientVersion,
    });
    res.writeHead(r.status, { 'Content-Type':'application/json', ...CORS_HEADERS });
    res.end(r.body);
  } catch(e) { sendError(res, 502, 'Error contactando Riot PD API: '+e.message); }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ── SERVIDOR HTTP ──────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

const server = http.createServer(async (req, res) => {
  Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  const parsed   = url.parse(req.url);
  const pathname = parsed.pathname || '/';
  const seg      = pathname.split('/').filter(Boolean);
  const qs       = new URLSearchParams(parsed.search || '');

  // Obtener henrik key del header
  const henrikKey = req.headers['x-henrik-key'] || req.headers['authorization'] || null;

  // ── /health ────────────────────────────────────────────────────────────────
  if (pathname === '/health' || pathname === '/') {
    return sendJSON(res, 200, {
      status: 'ok', port: PORT, version: '2.0',
      session: session && !session._mfaPending ? { puuid: session.puuid, shard: session.shard } : null,
      cache: {
        maps:    cache.maps    ? cache.maps.size / 3 | 0    : 0,
        agents:  cache.agents  ? cache.agents.size / 2 | 0  : 0,
        weapons: cache.weapons ? cache.weapons.size / 2 | 0 : 0,
        matches: cache.matches.size,
      },
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ── RUTAS /api ────────────────────────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════

  if (seg[0] === 'api') {

    // GET /api/maps
    if (seg[1] === 'maps' && !seg[2] && req.method === 'GET') {
      try {
        const maps = await loadMaps();
        // Devolver cada mapa UNA vez (sin duplicados de índice)
        const seen = new Set();
        const result = [];
        for (const [, v] of maps.entries()) {
          if (!seen.has(v.uuid)) { seen.add(v.uuid); result.push(v); }
        }
        return sendJSON(res, 200, { data: result });
      } catch(e) { return sendError(res, 500, e.message); }
    }

    // GET /api/maps/:mapName/base64 — devuelve imagen como data URL en JSON (sin problemas CORS canvas)
    if (seg[1] === 'maps' && seg[2] && seg[3] === 'base64' && req.method === 'GET') {
      try {
        const mapName = decodeURIComponent(seg[2]);
        // 1. Intentar desde caché en memoria (si se precargó al arrancar)
        const cachedImg = cache.mapImages.get(mapName);
        if (cachedImg) {
          const b64cached = cachedImg.body.toString('base64');
          const mimeCached = cachedImg.contentType.split(';')[0] || 'image/png';
          return sendJSON(res, 200, {
            data: `data:${mimeCached};base64,${b64cached}`,
            map: mapName,
          });
        }
        // 2. Descargar si no está en caché
        const maps = await loadMaps();
        const mapMeta = findMap(maps, mapName);
        if (!mapMeta?.minimap) return sendError(res, 404, 'Minimap no encontrado para: ' + mapName);
        const imgRes = await httpsGetImage(mapMeta.minimap);
        if (imgRes.status !== 200) return sendError(res, 502, 'Error cargando imagen: HTTP ' + imgRes.status);
        // Guardar en caché
        cache.mapImages.set(mapName, { contentType: imgRes.contentType, body: imgRes.body });
        const b64 = imgRes.body.toString('base64');
        const mime = imgRes.contentType.split(';')[0] || 'image/png';
        return sendJSON(res, 200, {
          data: `data:${mime};base64,${b64}`,
          map:  mapName,
          transform: {
            xMultiplier:  mapMeta.xMultiplier,
            yMultiplier:  mapMeta.yMultiplier,
            xScalarToAdd: mapMeta.xScalarToAdd,
            yScalarToAdd: mapMeta.yScalarToAdd,
          },
          callouts: mapMeta.callouts || [],
        });
      } catch(e) { return sendError(res, 500, e.message); }
    }


    if (seg[1] === 'maps' && seg[2] && seg[3] === 'image' && req.method === 'GET') {
      try {
        const mapName = decodeURIComponent(seg[2]);
        // 1. Caché en memoria (instantáneo si ya se precargó)
        const cached = cache.mapImages.get(mapName);
        if (cached) {
          res.writeHead(200, {
            'Content-Type':   cached.contentType,
            'Content-Length': cached.body.length,
            'Cache-Control':  'public, max-age=86400',
            ...CORS_HEADERS,
          });
          res.end(cached.body);
          return;
        }
        // 2. Descargar y cachear si no está en memoria
        const maps = await loadMaps();
        const mapMeta = findMap(maps, mapName);
        if (!mapMeta?.minimap) return sendError(res, 404, 'Minimap no encontrado para: ' + mapName);
        const imgRes = await httpsGetImage(mapMeta.minimap);
        if (imgRes.status !== 200) return sendError(res, 502, 'Error: HTTP ' + imgRes.status);
        cache.mapImages.set(mapName, { contentType: imgRes.contentType, body: imgRes.body });
        res.writeHead(200, {
          'Content-Type':   imgRes.contentType,
          'Content-Length': imgRes.body.length,
          'Cache-Control':  'public, max-age=86400',
          ...CORS_HEADERS,
        });
        res.end(imgRes.body);
        return;
      } catch(e) { return sendError(res, 500, e.message); }
    }

    // GET /api/agents
    if (seg[1] === 'agents' && req.method === 'GET') {
      try {
        const agents = await loadAgents();
        const seen = new Set();
        const result = [];
        for (const [, v] of agents.entries()) {
          if (!seen.has(v.uuid)) { seen.add(v.uuid); result.push(v); }
        }
        return sendJSON(res, 200, { data: result });
      } catch(e) { return sendError(res, 500, e.message); }
    }

    // GET /api/weapons
    if (seg[1] === 'weapons' && req.method === 'GET') {
      try {
        const weapons = await loadWeapons();
        const seen = new Set();
        const result = [];
        for (const [, v] of weapons.entries()) {
          if (!seen.has(v.uuid)) { seen.add(v.uuid); result.push(v); }
        }
        return sendJSON(res, 200, { data: result });
      } catch(e) { return sendError(res, 500, e.message); }
    }

    // GET /api/player/:region/:name/:tag/matches
    if (seg[1] === 'player' && seg[5] === 'matches' && req.method === 'GET') {
      const [, , region, name, tag] = seg;
      if (!region || !name || !tag) return sendError(res, 400, 'Faltan region, name o tag');
      const mode = qs.get('mode') || '';
      const size = Math.min(20, parseInt(qs.get('size') || '10') || 10);
      try {
        const p = new URLSearchParams({ mode, size: String(size) });
        const data = await henrikFetch(
          `/v3/matches/${encodeURIComponent(region)}/${encodeURIComponent(name)}/${encodeURIComponent(tag)}?${p}`,
          henrikKey
        );
        return sendJSON(res, 200, { data: Array.isArray(data) ? data : [data] });
      } catch(e) { return sendError(res, 500, e.message); }
    }

    // GET /api/match/:matchId — partido normalizado completo
    if (seg[1] === 'match' && seg[2] && !seg[3] && req.method === 'GET') {
      const matchId = seg[2];
      // Revisar caché
      if (cache.matches.has(matchId)) {
        const cached = cache.matches.get(matchId);
        if (Date.now() - cached._normalizedAt < cache.MATCH_TTL) {
          return sendJSON(res, 200, { data: cached, cached: true });
        }
      }
      try {
        const raw = await henrikFetch(`/v2/match/${encodeURIComponent(matchId)}`, henrikKey);
        const normalized = await normalizeMatch(raw);
        // Guardar en caché (máx 50)
        if (cache.matches.size >= 50) {
          const oldest = [...cache.matches.entries()].sort((a,b) => a[1]._normalizedAt - b[1]._normalizedAt)[0];
          cache.matches.delete(oldest[0]);
        }
        cache.matches.set(matchId, normalized);
        return sendJSON(res, 200, { data: normalized, cached: false });
      } catch(e) { return sendError(res, 500, e.message); }
    }


    // GET /api/match/:matchId/heatmap-render
    // Devuelve JSON con: imageUrl, transform, grid NxN, kills normalizados, plants, callouts
    // El frontend carga la imagen con <img> (sin canvas/CORS) y superpone <svg> con los datos
    if (seg[1] === 'match' && seg[2] && seg[3] === 'heatmap-render' && req.method === 'GET') {
      const matchId  = seg[2];
      const gridSize = Math.min(32, parseInt(qs.get('grid') || '16') || 16);
      const team     = qs.get('team')  || 'all';
      const puuid    = qs.get('puuid') || null;
      const selRound = qs.get('round') != null ? parseInt(qs.get('round')) : -1;

      try {
        // 1. Obtener partido normalizado (del cache o fetchear)
        let match = cache.matches.get(matchId);
        if (!match || Date.now() - match._normalizedAt >= cache.MATCH_TTL) {
          const henrikKey = req.headers['x-henrik-key'] || '';
          const raw = await henrikFetch(`/v2/match/${encodeURIComponent(matchId)}`, henrikKey);
          match = await normalizeMatch(raw);
          cache.matches.set(matchId, match);
        }

        const G = gridSize;
        const maps = await loadMaps();
        const mapMeta = findMap(maps, match.metadata.map);

        // 2. Filtrar kills
        const allKills = match.kills || [];
        const filtered = allKills.filter(k => {
          if (team !== 'all' && k.killerTeam !== team && k.victimTeam !== team) return false;
          if (puuid && k.killerPuuid !== puuid && k.victimPuuid !== puuid) return false;
          if (selRound >= 0 && k.round !== selRound) return false;
          return true;
        });

        // 3. Construir grid NxN
        const grid = Array.from({length:G}, () =>
          Array.from({length:G}, () => ({kills:0, deaths:0, engagements:0, diff:0})));

        const toRC = (nx, ny) => ({
          c: Math.min(G-1, Math.max(0, Math.floor(nx * G))),
          r: Math.min(G-1, Math.max(0, Math.floor(ny * G))),
        });

        for (const k of filtered) {
          if (k.killerLocationNorm) {
            const {nx,ny} = k.killerLocationNorm;
            if (nx>=0&&nx<=1&&ny>=0&&ny<=1) {
              const {r,c}=toRC(nx,ny); grid[r][c].kills++; grid[r][c].engagements++;
            }
          }
          if (k.victimLocationNorm) {
            const {nx,ny} = k.victimLocationNorm;
            if (nx>=0&&nx<=1&&ny>=0&&ny<=1) {
              const {r,c}=toRC(nx,ny); grid[r][c].deaths++; grid[r][c].engagements++;
            }
          }
        }

        let maxVal = 1;
        for (const row of grid) for (const c of row) {
          c.diff = c.kills - c.deaths;
          const v = Math.abs(c.diff);
          if (c.engagements > maxVal) maxVal = c.engagements;
          if (v > maxVal) maxVal = v;
        }
        for (const row of grid) for (const c of row) c.norm = c.engagements / maxVal;

        // 4. Plantas normalizadas
        const plants = (match.rounds || [])
          .filter(r => r.plant?.location && mapMeta)
          .map(r => {
            const loc = r.plant.location;
            return {
              site: r.plant.site || '',
              nx: Math.max(0, Math.min(1, loc.x * mapMeta.xMultiplier + mapMeta.xScalarToAdd)),
              ny: Math.max(0, Math.min(1, loc.y * mapMeta.yMultiplier + mapMeta.yScalarToAdd)),
            };
          })
          .filter(p => p.nx >= 0 && p.nx <= 1 && p.ny >= 0 && p.ny <= 1);

        // 5. Callouts normalizados
        const callouts = (mapMeta?.callouts || [])
          .filter(co => co.location && mapMeta)
          .map(co => ({
            name: co.superRegionName ? `${co.superRegionName} ${co.regionName}` : co.regionName,
            nx:   Math.max(0, Math.min(1, co.location.x * mapMeta.xMultiplier + mapMeta.xScalarToAdd)),
            ny:   Math.max(0, Math.min(1, co.location.y * mapMeta.yMultiplier + mapMeta.yScalarToAdd)),
          }))
          .filter(co => co.nx >= 0 && co.nx <= 1 && co.ny >= 0 && co.ny <= 1);

        // 6. Puntos de kill con coords normalizadas
        const killPoints = filtered
          .filter(k => k.killerLocationNorm || k.victimLocationNorm)
          .map(k => ({
            round:       k.round,
            killerTeam:  k.killerTeam,
            victimTeam:  k.victimTeam,
            killerPuuid: k.killerPuuid,
            victimPuuid: k.victimPuuid,
            killerNorm:  k.killerLocationNorm,
            victimNorm:  k.victimLocationNorm,
            weapon:      k.weaponName,
          }));

        return sendJSON(res, 200, {
          data: {
            matchId,
            mapName:      match.metadata.map,
            imageUrl:     await (async () => {
              // Intentar servir base64 desde cache
              const displayName = mapMeta?.displayName || match.metadata.map || '';
              let cached = cache.mapImages.get(displayName);

              // Si no está en cache, descargarlo ahora
              if (!cached && mapMeta?.minimap) {
                try {
                  const imgRes = await httpsGetImage(mapMeta.minimap);
                  if (imgRes.status === 200) {
                    cached = { contentType: imgRes.contentType, body: imgRes.body };
                    cache.mapImages.set(displayName, cached);
                  }
                } catch(_) {}
              }

              if (cached) {
                const b64 = cached.body.toString('base64');
                const mime = cached.contentType.split(';')[0] || 'image/png';
                return `data:${mime};base64,${b64}`;
              }
              // Fallback: URL directa del CDN
              return mapMeta?.minimap || '';
            })(),
            transform:    match.metadata.mapTransform,
            gridSize:     G,
            grid,
            killPoints,
            plants,
            callouts,
            totalKills:   allKills.length,
            coordKills:   killPoints.length,
          }
        });
      } catch(e) { return sendError(res, 500, e.message); }
    }


    // GET /api/match/:matchId/heatmap — heatmap de kills con grid y coords [0,1]
    if (seg[1] === 'match' && seg[2] && seg[3] === 'heatmap' && req.method === 'GET') {
      const matchId  = seg[2];
      const gridSize = parseInt(qs.get('grid') || '16') || 16;
      const team     = qs.get('team') || 'all';
      const puuid    = qs.get('puuid') || null;
      const roundStart = qs.get('roundStart') ? parseInt(qs.get('roundStart')) : null;
      const roundEnd   = qs.get('roundEnd')   ? parseInt(qs.get('roundEnd'))   : null;
      const roundRange = roundStart != null && roundEnd != null ? [roundStart, roundEnd] : null;

      let match = cache.matches.get(matchId);
      if (!match || Date.now() - match._normalizedAt >= cache.MATCH_TTL) {
        try {
          const hKey = req.headers['x-henrik-key'] || '';
          const raw = await henrikFetch(`/v2/match/${encodeURIComponent(matchId)}`, hKey);
          match = await normalizeMatch(raw);
          cache.matches.set(matchId, match);
        } catch(e) { return sendError(res, 500, e.message); }
      }
      const heatmap = buildHeatmapGrid(match, { gridSize, team, playerPuuid: puuid, roundRange });
      return sendJSON(res, 200, { data: heatmap, matchId, map: match.metadata.map });
    }

    // GET /api/match/:matchId/grid — alias de heatmap con grid explícito
    if (seg[1] === 'match' && seg[2] && seg[3] === 'grid' && req.method === 'GET') {
      // Redirigir internamente al handler de heatmap
      req.url = req.url.replace('/grid', '/heatmap');
      return server.emit('request', req, res);
    }

    // GET /api/match/:matchId/timeline — datos pre-calculados para el timeline
    if (seg[1] === 'match' && seg[2] && seg[3] === 'timeline' && req.method === 'GET') {
      const matchId = seg[2];
      let match = cache.matches.get(matchId);
      if (!match || Date.now() - match._normalizedAt >= cache.MATCH_TTL) {
        try {
          const raw = await henrikFetch(`/v2/match/${encodeURIComponent(matchId)}`, henrikKey);
          match = await normalizeMatch(raw);
          cache.matches.set(matchId, match);
        } catch(e) { return sendError(res, 500, e.message); }
      }
      const timeline = buildTimeline(match);
      return sendJSON(res, 200, { data: timeline, matchId, map: match.metadata.map });
    }

    // Ruta /api no encontrada
    return sendError(res, 404, 'Ruta /api no encontrada: ' + pathname);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ── RUTAS HEREDADAS (retrocompatibles con proxy-server anterior) ──────────
  // ═══════════════════════════════════════════════════════════════════════════

  if (pathname === '/riot-session' && req.method === 'GET')
    return sendJSON(res, 200, { loggedIn: !!(session && !session._mfaPending), puuid: session?.puuid||null, shard: session?.shard||null, region: session?.region||null });

  if (pathname === '/riot-session' && req.method === 'DELETE') {
    session = null; return sendJSON(res, 200, { ok: true });
  }

  if (pathname === '/riot-auth' && req.method === 'POST') {
    const b = await readBody(req);
    let d; try { d = JSON.parse(b); } catch { return sendError(res, 400, 'Body inválido'); }
    const { username, password, region = 'eu' } = d;
    if (!username || !password) return sendError(res, 400, 'Faltan username o password');
    const shard = REGION_TO_SHARD[region] || 'eu';
    try {
      const r = await riotLogin(username, password);
      if (r.mfa) { session = { _mfaPending:true, _cookies:r._cookies, shard, region }; return sendJSON(res, 200, { mfa:true, method:r.method, email:r.email }); }
      session = { ...r, shard, region };
      return sendJSON(res, 200, { ok:true, puuid:r.puuid, shard });
    } catch(e) { return sendError(res, 401, e.message); }
  }

  if (pathname === '/riot-auth-mfa' && req.method === 'POST') {
    const b = await readBody(req);
    let d; try { d = JSON.parse(b); } catch { return sendError(res, 400, 'Body inválido'); }
    if (!d.code) return sendError(res, 400, 'Falta code');
    if (!session?._mfaPending) return sendError(res, 400, 'No hay MFA pendiente');
    const { shard, region, _cookies } = session;
    try {
      const r = await riotMFA(d.code, _cookies);
      session = { ...r, shard, region };
      return sendJSON(res, 200, { ok:true, puuid:r.puuid, shard });
    } catch(e) { return sendError(res, 401, e.message); }
  }

  if (pathname === '/pd/match-history' && req.method === 'GET') {
    const start = qs.get('start')||'0', end = qs.get('end')||'10', queue = qs.get('queue')||'';
    if (!session || session._mfaPending) return sendError(res, 401, 'Sesión no iniciada');
    const qp = queue ? `&queue=${encodeURIComponent(queue)}` : '';
    return proxyPD(`/match-history/v1/history/${session.puuid}?startIndex=${start}&endIndex=${end}${qp}`, res);
  }

  if (seg[0] === 'pd' && seg[1] === 'match-details' && seg[2])
    return proxyPD(`/match-details/v1/matches/${seg[2]}`, res);

  if (pathname === '/claude' && req.method === 'POST') {
    const b = await readBody(req);
    let pb; try { pb = JSON.parse(b); } catch { return sendError(res, 400, 'Body JSON inválido'); }
    const key = req.headers['x-anthropic-key'] || req.headers['x-api-key'] || (req.headers['authorization']||'').replace('Bearer ','');
    if (!key) return sendError(res, 401, 'Falta x-anthropic-key');
    const bs = JSON.stringify(pb);
    const pr = https.request({
      hostname:'api.anthropic.com', path:'/v1/messages', method:'POST',
      headers: { 'Content-Type':'application/json', 'Content-Length':Buffer.byteLength(bs), 'x-api-key':key, 'anthropic-version':'2023-06-01' },
    }, pRes => {
      let rb=''; pRes.on('data',c=>{rb+=c;});
      pRes.on('end',()=>{ res.writeHead(pRes.statusCode,{'Content-Type':'application/json',...CORS_HEADERS}); res.end(rb); });
    });
    pr.on('error', e => sendError(res, 502, e.message));
    pr.write(bs); pr.end();
    return;
  }

  sendError(res, 404, 'Ruta no encontrada: ' + pathname);
});

server.listen(PORT, async () => {
  console.log('');
  console.log('  ╔══════════════════════════════════════════════════════════════╗');
  console.log('  ║   ValoAnalytics API  v2.0  — puerto ' + PORT + '                    ║');
  console.log('  ╠══════════════════════════════════════════════════════════════╣');
  console.log('  ║   NUEVAS RUTAS                                               ║');
  console.log('  ║   GET  /api/maps                    → todos los mapas        ║');
  console.log('  ║   GET  /api/maps/:name/image         → minimap CORS-safe     ║');
  console.log('  ║   GET  /api/agents                  → todos los agentes      ║');
  console.log('  ║   GET  /api/weapons                 → todas las armas        ║');
  console.log('  ║   GET  /api/player/:r/:n/:t/matches → historial Henrik       ║');
  console.log('  ║   GET  /api/match/:id               → partido normalizado    ║');
  console.log('  ║   GET  /api/match/:id/heatmap       → kills [0,1] + grid     ║');
  console.log('  ║   GET  /api/match/:id/timeline      → timeline pre-calculado ║');
  console.log('  ╠══════════════════════════════════════════════════════════════╣');
  console.log('  ║   RUTAS HEREDADAS (retrocompatibles)                         ║');
  console.log('  ║   POST /riot-auth  ·  GET /riot-session  ·  POST /claude     ║');
  console.log('  ║   GET  /pd/match-history  ·  GET /pd/match-details/:id       ║');
  console.log('  ╚══════════════════════════════════════════════════════════════╝');
  console.log('');
  // Pre-cargar assets de mapas y agentes al iniciar
  console.log('  Precargando assets de valorant-api.com...');
  await Promise.all([loadMaps(), loadAgents(), loadWeapons()]);
  console.log('  Assets listos. Servidor operativo.\n');
  // Pre-cargar imágenes de minimapas en background (no bloquea el arranque)
  preloadMapImages().catch(() => {});
});
