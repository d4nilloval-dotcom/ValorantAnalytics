import { useState, useEffect, useRef, useMemo } from 'react';
import {
  Search, Loader2, ChevronDown, ChevronRight, PlayCircle, Download, CheckCircle,
  Skull, Activity, Users, BarChart3,
  Zap, Flame, MapPin
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/store/appStore';
import type { Match } from '@/types';

// ── ValoAnalytics API (proxy local que agrega Henrik + valorant-api.com) ──────
const VALO_API_BASE       = 'http://localhost:3001';
const HENRIK_KEY_STORAGE  = 'valoanalytics_henrik_key_v1';
const HENRIK_MATCH_CACHE  = 'valoanalytics_henrik_matches_v1';
const MAX_CACHED_MATCHES  = 20;

function getCachedHenrikMatches(): any[] {
  try { return JSON.parse(localStorage.getItem(HENRIK_MATCH_CACHE) || '[]'); } catch { return []; }
}
function cacheHenrikMatch(match: any) {
  try {
    const id = match.matchId || match.metadata?.matchid;
    const list = getCachedHenrikMatches().filter((m: any) => (m.matchId || m.metadata?.matchid) !== id);
    list.unshift(match);
    localStorage.setItem(HENRIK_MATCH_CACHE, JSON.stringify(list.slice(0, MAX_CACHED_MATCHES)));
  } catch {}
}
function getHenrikKey() { return localStorage.getItem(HENRIK_KEY_STORAGE) || ''; }
function setHenrikKey(k: string) { localStorage.setItem(HENRIK_KEY_STORAGE, k); }

async function apiFetch(path: string, apiKey?: string) {
  const headers: Record<string, string> = { 'Accept': 'application/json' };
  if (apiKey) headers['x-henrik-key'] = apiKey;
  const res = await fetch(VALO_API_BASE + path, { headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || 'HTTP ' + res.status);
  return data.data ?? data;
}

async function fetchMatchHistory(region: string, name: string, tag: string, mode: string, size: number, apiKey?: string) {
  const p = new URLSearchParams({ mode, size: String(size) });
  return apiFetch(`/api/player/${encodeURIComponent(region)}/${encodeURIComponent(name)}/${encodeURIComponent(tag)}/matches?${p}`, apiKey);
}

async function fetchMatchDetail(matchId: string, apiKey?: string) {
  return apiFetch(`/api/match/${encodeURIComponent(matchId)}`, apiKey);
}

async function fetchHeatmap(matchId: string, opts: { grid?: number; team?: string; puuid?: string } = {}, apiKey?: string) {
  const p = new URLSearchParams();
  if (opts.grid)  p.set('grid',  String(opts.grid));
  if (opts.team)  p.set('team',  opts.team);
  if (opts.puuid) p.set('puuid', opts.puuid);
  return apiFetch(`/api/match/${encodeURIComponent(matchId)}/heatmap?${p}`, apiKey);
}

async function fetchTimeline(matchId: string, apiKey?: string) {
  return apiFetch(`/api/match/${encodeURIComponent(matchId)}/timeline`, apiKey);
}

function timeAgo(ts: number): string {
  const diff = Date.now() / 1000 - ts;
  if (diff < 3600) return Math.floor(diff / 60) + 'm';
  if (diff < 86400) return Math.floor(diff / 3600) + 'h';
  if (diff < 604800) return Math.floor(diff / 86400) + 'd';
  return Math.floor(diff / 604800) + 'sem';
}

function hsPercent(p: any): number {
  const t = (p.stats.headshots||0)+(p.stats.bodyshots||0)+(p.stats.legshots||0);
  return t > 0 ? Math.round(p.stats.headshots/t*100) : 0;
}
function kdStr(p: any): string { return p.stats.deaths>0?(p.stats.kills/p.stats.deaths).toFixed(2):p.stats.kills.toFixed(2); }
function acsVal(p: any, rounds: number): number { return rounds>0?Math.round(p.stats.score/rounds):0; }
function formatTime(ms: number): string { const s=Math.floor(ms/1000),m=Math.floor(s/60); return m+':'+(s%60).toString().padStart(2,'0'); }

const RANK_COLORS: Record<string,string> = {
  Iron:'#8B7355',Bronze:'#CD7F32',Silver:'#C0C0C0',Gold:'#FFD700',
  Platinum:'#4FC3F7',Diamond:'#B39DDB',Ascendant:'#26A69A',Immortal:'#EF5350',Radiant:'#FFF176'
};
function rankColor(t: string) { return RANK_COLORS[t?.split(' ')[0]] || '#6b7280'; }

function PlayerRow({ p, rounds, focus, onFocus }: any) {
  const kd = parseFloat(kdStr(p));
  // Soportar esquema nuevo (agentKillfeed, tier) y legado (assets.agent.killfeed, currenttier_patched)
  const killfeedIcon = p.agentKillfeed || p.assets?.agent?.killfeed || '';
  const agentName    = p.agent || p.character || '';
  const tierLabel    = p.tier  || p.currenttier_patched || 'Unranked';
  return (
    <tr className={cn('border-t border-white/5 cursor-pointer transition-colors hover:bg-white/5', focus&&'bg-red-500/8')} onClick={onFocus}>
      <td className="py-2.5 px-3">
        <div className="flex items-center gap-2">
          {killfeedIcon && <img src={killfeedIcon} alt={agentName} className="w-7 h-7 rounded object-cover"/>}
          <div>
            <p className="font-bold text-sm">{p.name}<span className="text-muted-foreground text-xs font-normal">#{p.tag}</span></p>
            <p className="text-[10px]" style={{color:rankColor(tierLabel)}}>{tierLabel}</p>
          </div>
        </div>
      </td>
      <td className="py-2.5 px-3 text-center text-xs text-muted-foreground">{agentName}</td>
      <td className="py-2.5 px-3 text-center font-mono text-yellow-400 font-bold">{acsVal(p,rounds)}</td>
      <td className="py-2.5 px-3 text-center font-mono text-sm">
        <span className="text-green-400">{p.stats.kills}</span><span className="text-muted-foreground">/</span>
        <span className="text-red-400">{p.stats.deaths}</span><span className="text-muted-foreground">/</span>
        <span className="text-blue-400">{p.stats.assists}</span>
      </td>
      <td className="py-2.5 px-3 text-center">
        <span className={cn('font-bold text-sm', kd>=1.5?'text-green-400':kd>=1?'text-yellow-400':'text-red-400')}>{kdStr(p)}</span>
      </td>
      <td className="py-2.5 px-3 text-center text-sm">
        <span className={cn(hsPercent(p)>=25?'text-orange-400':'text-muted-foreground')}>{hsPercent(p)}%</span>
      </td>
    </tr>
  );
}

function TeamTable({ players, team, won, rounds, focusPuuid, setFocusPuuid }: any) {
  return (
    <div className="rounded-xl overflow-hidden border border-white/10">
      <div className={cn('px-4 py-2.5 flex items-center justify-between', won?'bg-green-500/15':'bg-red-500/10')}>
        <span className={cn('text-sm font-bold', won?'text-green-400':'text-red-400')}>
          {team==='Blue'?'🔵':'🔴'} {team} — {won?'VICTORIA':'DERROTA'}
        </span>
      </div>
      <table className="w-full text-sm">
        <thead><tr className="text-left text-[10px] text-muted-foreground uppercase border-b border-white/10">
          <th className="py-2 px-3">Jugador</th><th className="py-2 px-3 text-center">Agente</th>
          <th className="py-2 px-3 text-center">ACS</th><th className="py-2 px-3 text-center">K/D/A</th>
          <th className="py-2 px-3 text-center">K/D</th><th className="py-2 px-3 text-center">HS%</th>
        </tr></thead>
        <tbody>
          {[...players].sort((a:any,b:any)=>b.stats.score-a.stats.score).map((p:any)=>(
            <PlayerRow key={p.puuid} p={p} rounds={rounds} focus={p.puuid===focusPuuid}
              onFocus={()=>setFocusPuuid(p.puuid===focusPuuid?'':p.puuid)}/>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ScoreboardTab({ match, focusPuuid, setFocusPuuid }: any) {
  // Soportar nuevo esquema (roundsPlayed, players.all) y legado
  const rounds      = match?.metadata?.roundsPlayed || match?.metadata?.rounds_played || 0;
  const bluePlayers = match?.players?.blue || [];
  const redPlayers  = match?.players?.red  || [];
  const blueWon     = match?.teams?.blue?.hasWon ?? match?.teams?.blue?.has_won ?? false;
  const redWon      = match?.teams?.red?.hasWon  ?? match?.teams?.red?.has_won  ?? false;
  const allPlayers  = match?.players?.all || match?.players?.all_players || [];
  const hasTeamSplit = bluePlayers.length > 0 || redPlayers.length > 0;

  return (
    <div className="space-y-4">
      {hasTeamSplit ? (
        <>
          <TeamTable players={bluePlayers} team="Blue" won={blueWon} rounds={rounds} focusPuuid={focusPuuid} setFocusPuuid={setFocusPuuid}/>
          <TeamTable players={redPlayers}  team="Red"  won={redWon}  rounds={rounds} focusPuuid={focusPuuid} setFocusPuuid={setFocusPuuid}/>
        </>
      ) : (
        <TeamTable players={allPlayers} team="Todos" won={false} rounds={rounds} focusPuuid={focusPuuid} setFocusPuuid={setFocusPuuid}/>
      )}
      <p className="text-[10px] text-muted-foreground text-center">Haz clic en un jugador para filtrarlo en kill feed</p>
    </div>
  );
}

function RoundsTab({ match }: any) {
  const [expanded, setExpanded] = useState<number|null>(null);
  const rounds: any[] = match?.rounds || [];
  return (
    <div className="space-y-1.5">
      {rounds.map((r: any, i: number) => {
        // Soportar nuevo esquema (winningTeam, endType, bombPlanted, plant.site, playerStats)
        // y legado (winning_team, end_type, bomb_planted, plant_events.plant_site, player_stats)
        const winTeam  = r.winningTeam   || r.winning_team  || '';
        const endType  = r.endType       || r.end_type      || '';
        const planted  = r.bombPlanted   ?? r.bomb_planted  ?? false;
        const defused  = r.bombDefused   ?? r.bomb_defused  ?? false;
        const site     = r.plant?.site   || r.plant_events?.plant_site || '';
        const stats    = r.playerStats   || r.player_stats  || [];
        const blueWon  = winTeam === 'Blue';
        const top      = [...stats].sort((a: any, b: any) => b.kills - a.kills)[0];
        const topName  = top?.displayName || top?.player_display_name || '';
        return (
          <div key={i} className={cn('rounded-lg border overflow-hidden', blueWon?'border-blue-500/20':'border-red-500/20')}>
            <button className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/5 text-left"
              onClick={()=>setExpanded(expanded===i?null:i)}>
              <span className={cn('w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black',blueWon?'bg-blue-500/20 text-blue-400':'bg-red-500/20 text-red-400')}>{i+1}</span>
              <div className="flex-1">
                <span className={cn('text-xs font-bold',blueWon?'text-blue-400':'text-red-400')}>{blueWon?'🔵 Blue':'🔴 Red'} gana</span>
                <span className="text-xs text-muted-foreground ml-2">— {endType}</span>
                {planted&&<span className="text-xs text-orange-400 ml-2">💣 {site}</span>}
                {defused&&<span className="text-xs text-green-400 ml-2">🔧 Defusado</span>}
              </div>
              {top&&<span className="text-xs text-muted-foreground">MVP: <span className="text-white font-medium">{topName}</span> ({top.kills}k)</span>}
              {expanded===i?<ChevronDown className="w-4 h-4 text-muted-foreground"/>:<ChevronRight className="w-4 h-4 text-muted-foreground"/>}
            </button>
            {expanded===i&&(
              <div className="px-4 pb-3 border-t border-white/10 pt-2 grid grid-cols-2 md:grid-cols-3 gap-2">
                {[...stats].sort((a:any,b:any)=>b.kills-a.kills).map((ps:any, pi: number)=>{
                  const psName = ps.displayName || ps.player_display_name || '';
                  const psTeam = ps.team || ps.player_team || '';
                  return (
                    <div key={ps.puuid||ps.player_puuid||pi} className="rounded-lg p-2.5 text-xs flex items-center gap-2" style={{background:'hsl(220 15% 10%)'}}>
                      <div className={cn('w-2 h-2 rounded-full',psTeam==='Blue'?'bg-blue-400':'bg-red-400')}/>
                      <div>
                        <p className="font-medium truncate max-w-[100px]">{psName}</p>
                        <p className="text-muted-foreground">{ps.kills}k · {ps.damage}dmg · {ps.headshots}hs</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// Mapeo de armas a colores/emojis
const WEAPON_COLORS: Record<string,string> = {
  'Vandal':'#ef4444','Phantom':'#8b5cf6','Operator':'#f59e0b','Sheriff':'#f97316',
  'Odin':'#6b7280','Ares':'#6b7280','Guardian':'#22c55e','Spectre':'#3b82f6',
  'Stinger':'#3b82f6','Bucky':'#a16207','Judge':'#a16207','Frenzy':'#ec4899',
  'Ghost':'#ec4899','Marshal':'#84cc16','Bulldog':'#06b6d4','Outlaw':'#f59e0b',
};
const WEAPON_EMOJIS: Record<string,string> = {
  'Vandal':'🔴','Phantom':'🟣','Operator':'🟡','Sheriff':'🟠','Odin':'⚫','Ares':'⚫',
  'Guardian':'🟢','Spectre':'🔵','Stinger':'🔵','Bucky':'🟤','Judge':'🟤',
  'Frenzy':'🩷','Ghost':'🩷','Marshal':'🟡','Bulldog':'🩵','Outlaw':'🟡',
  'Knife':'🔪','Melee':'🔪',
};

function KillFeedTab({ match, focusPuuid }: any) {
  const [filterRound, setFilterRound] = useState(-1);
  const [filterType,  setFilterType]  = useState<'all'|'headshot'|'first'>('all');
  const allKills: any[] = match.kills || [];
  const rounds:   any[] = match.rounds || [];

  // Helper: extraer campos de kill soportando ambos esquemas
  const kField = (k: any, newField: string, legacyField: string) =>
    k[newField] !== undefined ? k[newField] : k[legacyField];

  let kills = focusPuuid
    ? allKills.filter((k: any) =>
        kField(k,'killerPuuid','killer_puuid') === focusPuuid ||
        kField(k,'victimPuuid','victim_puuid') === focusPuuid)
    : allKills;

  if (filterRound >= 0) kills = kills.filter((k: any) => k.round === filterRound);

  if (filterType === 'first') {
    kills = kills.filter((k: any) => {
      const roundKills = allKills
        .filter((x: any) => x.round === k.round)
        .sort((a: any, b: any) =>
          (kField(a,'timeInRound','round_time_millis') || 0) -
          (kField(b,'timeInRound','round_time_millis') || 0));
      return roundKills[0] === k;
    });
  }

  const hsRate = kills.length > 0
    ? Math.round(kills.filter((k: any) => k.headshot).length / kills.length * 100) : 0;

  return (
    <div className="space-y-3">
      {/* Filtros */}
      <div className="flex flex-wrap gap-2 items-center">
        <select value={filterRound} onChange={e => setFilterRound(+e.target.value)}
          className="text-xs rounded-lg border px-2 py-1.5"
          style={{background:'hsl(220 15% 10%)',borderColor:'hsl(220 15% 20%)'}}>
          <option value={-1}>Todas las rondas</option>
          {rounds.map((_: any, i: number) => <option key={i} value={i}>Ronda {i+1}</option>)}
        </select>
        {(['all','headshot','first'] as const).map(f => (
          <button key={f} onClick={() => setFilterType(f)}
            className={cn('text-xs px-3 py-1.5 rounded-lg border transition-all',
              filterType===f?'border-red-500/50 bg-red-500/15 text-red-300':'border-white/10 text-muted-foreground hover:text-white')}>
            {f==='all'?'Todos':f==='headshot'?`💀 Headshot (${hsRate}%)`:f==='first'?'⚡ First Kill':''}
          </button>
        ))}
        <span className="text-xs text-muted-foreground ml-auto">{kills.length} kills</span>
      </div>

      {/* Lista de kills */}
      <div className="space-y-1">
        {kills.map((k: any, i: number) => {
          // Campos normalizados (nuevo) con fallback al legado
          const killerPuuid  = kField(k,'killerPuuid','killer_puuid') || '';
          const victimPuuid  = kField(k,'victimPuuid','victim_puuid') || '';
          const killerName   = kField(k,'killerName','killer_display_name') || '';
          const victimName   = kField(k,'victimName','victim_display_name') || '';
          const killerTeam   = kField(k,'killerTeam','killer_team') || '';
          const victimTeam   = kField(k,'victimTeam','victim_team') || '';
          const killerIcon   = k.killerAgentIcon || k.killer_assets?.agent?.killfeed || '';
          const victimIcon   = k.victimAgentIcon || k.victim_assets?.agent?.killfeed || '';
          const weapon       = kField(k,'weaponName','damage_weapon_name') || kField(k,'weaponName','weapon') || '';
          const weaponIcon   = k.weaponKillFeedIcon || k.damage_weapon_assets?.killfeed_icon || '';
          const timeMs       = kField(k,'timeInRound','round_time_millis') ?? kField(k,'timeInRound','kill_time_in_round') ?? null;
          const time         = timeMs != null ? `${Math.floor(timeMs/60000)}:${String(Math.floor(timeMs/1000)%60).padStart(2,'0')}` : null;
          const isKill       = killerPuuid === focusPuuid && !!focusPuuid;
          const isDeath      = victimPuuid === focusPuuid && !!focusPuuid;
          const weapColor    = WEAPON_COLORS[weapon] || 'hsl(215 15% 55%)';

          // Distancia killer→victim usando coords normalizadas si están disponibles
          let dist: number|null = null;
          const kNorm = k.killerLocationNorm;
          const vNorm = k.victimLocationNorm;
          if (kNorm && vNorm) {
            dist = Math.round(Math.sqrt(Math.pow((kNorm.nx - vNorm.nx)*1000, 2) + Math.pow((kNorm.ny - vNorm.ny)*1000, 2)));
          }

          return (
            <div key={i} className={cn('flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm transition-all',
              isKill  ? 'bg-green-500/10 border border-green-500/20'
              : isDeath ? 'bg-red-500/10 border border-red-500/20'
              : 'hover:bg-white/4 border border-transparent')}>
              {/* Ronda y tiempo */}
              <div className="flex flex-col items-center w-10 shrink-0">
                <span className="text-[10px] font-bold text-muted-foreground">R{k.round+1}</span>
                {time && <span className="text-[9px] text-muted-foreground/60">{time}</span>}
              </div>
              {/* Agente asesino */}
              <div className="flex items-center gap-1.5 min-w-0 flex-1">
                {killerIcon
                  ? <img src={killerIcon} className="w-7 h-7 rounded object-cover shrink-0"/>
                  : <div className={cn('w-7 h-7 rounded flex items-center justify-center text-[10px] font-bold shrink-0',
                      killerTeam==='Blue'?'bg-blue-500/20 text-blue-400':'bg-red-500/20 text-red-400')}>
                      {killerName?.[0]}
                    </div>}
                <span className={cn('font-semibold truncate text-xs',killerTeam==='Blue'?'text-blue-300':'text-red-300')}>
                  {killerName}
                </span>
              </div>
              {/* Arma */}
              <div className="flex flex-col items-center gap-0.5 shrink-0 w-24">
                <div className="flex items-center gap-1">
                  {weaponIcon
                    ? <img src={weaponIcon} className="h-4 object-contain opacity-80"/>
                    : <span className="text-xs">{WEAPON_EMOJIS[weapon]||'🔫'}</span>}
                  <span className="text-xs font-mono truncate max-w-[70px]" style={{color:weapColor}}>
                    {weapon||'?'}
                  </span>
                </div>
                {dist!=null && <span className="text-[9px] text-muted-foreground">{dist}u</span>}
              </div>
              {/* Flecha */}
              <span className="text-muted-foreground/40 text-lg shrink-0">›</span>
              {/* Agente víctima */}
              <div className="flex items-center gap-1.5 min-w-0 flex-1 justify-end">
                <span className={cn('font-medium truncate text-xs',victimTeam==='Blue'?'text-blue-300/70':'text-red-300/70')}>
                  {victimName}
                </span>
                {victimIcon
                  ? <img src={victimIcon} className="w-7 h-7 rounded object-cover shrink-0 opacity-60"/>
                  : <div className={cn('w-7 h-7 rounded flex items-center justify-center text-[10px] shrink-0 opacity-60',
                      victimTeam==='Blue'?'bg-blue-500/20 text-blue-400':'bg-red-500/20 text-red-400')}>
                      {victimName?.[0]}
                    </div>}
              </div>
            </div>
          );
        })}
        {kills.length===0 && <p className="text-sm text-muted-foreground text-center py-10">Sin kills con este filtro.</p>}
      </div>
    </div>
  );
}
function EconomyTab({ match }: any) {
  const rounds:  any[] = match?.rounds  || [];
  const players: any[] = match?.players?.all || match?.players?.all_players || [];
  const [hoveredRound, setHoveredRound] = useState<number|null>(null);

  // Helper: leer economía de un player_stat, soportando esquema nuevo y legado
  const econVal = (ps: any, field: 'loadout' | 'remaining' | 'spent' | 'weapon' | 'armor') => {
    const e = ps.economy || {};
    if (field === 'loadout')   return e.loadoutValue  ?? e.loadout_value  ?? 0;
    if (field === 'remaining') return e.remaining     ?? 0;
    if (field === 'spent')     return e.spent         ?? 0;
    if (field === 'weapon')    return e.weapon        || '';
    if (field === 'armor')     return e.armor         || '';
    return 0;
  };
  const psTeam  = (ps: any) => ps.team        || ps.player_team         || '';
  const psName  = (ps: any) => ps.displayName || ps.player_display_name || '';
  const psPuuid = (ps: any) => ps.puuid       || ps.player_puuid        || '';
  const rWin    = (r: any)  => r.winningTeam  || r.winning_team         || '';
  const rStats  = (r: any): any[] => r.playerStats || r.player_stats    || [];

  // Datos por ronda
  const econData = rounds.map((r: any, i: number) => {
    const stats = rStats(r);
    const blue  = stats.filter((ps: any) => psTeam(ps) === 'Blue');
    const red   = stats.filter((ps: any) => psTeam(ps) === 'Red');
    const sum   = (arr: any[], f: 'loadout'|'remaining'|'spent') => arr.reduce((s, ps) => s + econVal(ps, f), 0);
    return {
      round:        i + 1,
      blueLoadout:  sum(blue, 'loadout'),
      redLoadout:   sum(red,  'loadout'),
      blueSpent:    sum(blue, 'spent'),
      redSpent:     sum(red,  'spent'),
      blueRemaining:sum(blue, 'remaining'),
      redRemaining: sum(red,  'remaining'),
      blueWon:      rWin(r) === 'Blue',
      players:      stats,
    };
  });

  const maxLoadout = Math.max(1, ...econData.map(d => Math.max(d.blueLoadout, d.redLoadout)));

  // Resumen por jugador
  const playerEcon = players.map((p: any) => {
    let totalLoadout = 0, totalSpent = 0, totalRemaining = 0;
    const weapons: Record<string, number> = {};
    rounds.forEach((r: any) => {
      const ps = rStats(r).find((s: any) => psPuuid(s) === p.puuid);
      if (!ps) return;
      totalLoadout   += econVal(ps, 'loadout');
      totalSpent     += econVal(ps, 'spent');
      totalRemaining += econVal(ps, 'remaining');
      const w = econVal(ps, 'weapon') as string;
      if (w) weapons[w] = (weapons[w] || 0) + 1;
    });
    const topWeapon = Object.entries(weapons).sort((a, b) => b[1] - a[1])[0]?.[0] || '—';
    const rCount = rounds.length || 1;
    return {
      puuid: p.puuid, name: p.name, tag: p.tag,
      team:  p.team  || p.teamId || '—',
      agent: p.agent || p.character || '—',
      avgLoadout:   Math.round(totalLoadout   / rCount),
      avgSpent:     Math.round(totalSpent     / rCount),
      avgRemaining: Math.round(totalRemaining / rCount),
      topWeapon,
    };
  }).sort((a, b) => b.avgLoadout - a.avgLoadout);

  const ECO_COLORS = { Eco: '#ef4444', Force: '#f59e0b', Semi: '#22c55e', Full: '#3b82f6' };
  const ecoType = (val: number) =>
    val < 4000 ? 'Eco' : val < 10000 ? 'Force' : val < 20000 ? 'Semi' : 'Full';

  return (
    <div className="space-y-5">

      {/* ── Gráfico loadout por ronda ── */}
      <div className="glass-card p-4">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Loadout total por ronda</h3>
        <div className="overflow-x-auto">
          <div className="flex items-end gap-1 min-w-max pb-1" style={{height:120}}>
            {econData.map((d, i) => {
              const bH = Math.max(2, Math.round((d.blueLoadout / maxLoadout) * 96));
              const rH = Math.max(2, Math.round((d.redLoadout  / maxLoadout) * 96));
              const bEco = ecoType(d.blueLoadout);
              const rEco = ecoType(d.redLoadout);
              return (
                <div key={i} className="relative flex flex-col items-center gap-0.5 cursor-pointer"
                  style={{width:24}}
                  onMouseEnter={() => setHoveredRound(i)}
                  onMouseLeave={() => setHoveredRound(null)}>
                  <div className="flex items-end gap-0.5" style={{height:100}}>
                    <div className="w-2.5 rounded-t-sm transition-all"
                      style={{height:bH, background: ECO_COLORS[bEco as keyof typeof ECO_COLORS], opacity: d.blueWon ? 1 : 0.45}}
                      title={`Blue R${d.round}: $${d.blueLoadout.toLocaleString()} (${bEco})`}/>
                    <div className="w-2.5 rounded-t-sm transition-all"
                      style={{height:rH, background: ECO_COLORS[rEco as keyof typeof ECO_COLORS], opacity: !d.blueWon ? 1 : 0.45}}
                      title={`Red R${d.round}: $${d.redLoadout.toLocaleString()} (${rEco})`}/>
                  </div>
                  <span className="text-[8px] text-muted-foreground">{d.round}</span>

                  {/* Tooltip */}
                  {hoveredRound === i && (
                    <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-20 w-52 rounded-xl border p-3 shadow-2xl text-xs pointer-events-none"
                      style={{background:'hsl(220 22% 10%)',borderColor:'hsl(220 15% 22%)'}}>
                      <p className="font-bold mb-1.5">Ronda {d.round}</p>
                      <div className="space-y-1">
                        <div className="flex justify-between">
                          <span className="text-blue-400">Blue loadout</span>
                          <span className="font-mono">${d.blueLoadout.toLocaleString()} <span className="text-[10px]">({bEco})</span></span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-red-400">Red loadout</span>
                          <span className="font-mono">${d.redLoadout.toLocaleString()} <span className="text-[10px]">({rEco})</span></span>
                        </div>
                        <div className="flex justify-between text-muted-foreground">
                          <span>Blue gastado</span>
                          <span className="font-mono">${d.blueSpent.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-muted-foreground">
                          <span>Red gastado</span>
                          <span className="font-mono">${d.redSpent.toLocaleString()}</span>
                        </div>
                        <div className="pt-1 border-t border-white/10 text-center">
                          <span className={d.blueWon ? 'text-blue-400' : 'text-red-400'}>
                            {d.blueWon ? '🔵 Blue gana' : '🔴 Red gana'}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
        {/* Leyenda */}
        <div className="flex flex-wrap gap-3 mt-2 text-[10px]">
          {Object.entries(ECO_COLORS).map(([label, color]) => (
            <span key={label} className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{background:color}}/>
              <span className="text-muted-foreground">{label} {label==='Eco'?'(<4k)':label==='Force'?'(<10k)':label==='Semi'?'(<20k)':'(20k+)'}</span>
            </span>
          ))}
          <span className="text-muted-foreground/50 ml-2">Más opaco = perdedor</span>
        </div>
      </div>

      {/* ── Tabla por jugador ── */}
      <div className="glass-card p-4">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Economía por jugador (promedios)</h3>
        <div className="overflow-x-auto rounded-xl border" style={{borderColor:'hsl(220 15% 15%)'}}>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left uppercase tracking-wider text-muted-foreground border-b"
                style={{borderColor:'hsl(220 15% 15%)',background:'hsl(220 20% 9%)'}}>
                <th className="px-3 py-2">Jugador</th>
                <th className="px-3 py-2">Agente</th>
                <th className="px-3 py-2 text-right">Avg Loadout</th>
                <th className="px-3 py-2 text-right">Avg Gastado</th>
                <th className="px-3 py-2 text-right">Avg Restante</th>
                <th className="px-3 py-2">Arma más usada</th>
              </tr>
            </thead>
            <tbody>
              {playerEcon.map((p, i) => (
                <tr key={p.puuid || i} className="border-b hover:bg-white/3"
                  style={{borderColor:'hsl(220 15% 12%)'}}>
                  <td className="px-3 py-2.5">
                    <span className={cn('font-semibold', p.team === 'Blue' ? 'text-blue-400' : 'text-red-400')}>{p.name}</span>
                    <span className="text-muted-foreground text-[10px]">#{p.tag}</span>
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground">{p.agent}</td>
                  <td className="px-3 py-2.5 text-right font-mono">
                    <span style={{color: ECO_COLORS[ecoType(p.avgLoadout) as keyof typeof ECO_COLORS]}}>
                      ${p.avgLoadout.toLocaleString()}
                    </span>
                    <span className="text-muted-foreground/50 text-[10px] ml-1">({ecoType(p.avgLoadout)})</span>
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-orange-400">${p.avgSpent.toLocaleString()}</td>
                  <td className="px-3 py-2.5 text-right font-mono text-green-400">${p.avgRemaining.toLocaleString()}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{p.topWeapon}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Ronda a ronda: gasto individual ── */}
      <div className="glass-card p-4">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Detalle por ronda — armas compradas</h3>
        <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
          {econData.map((d, i) => (
            <div key={i} className="rounded-lg px-3 py-2 text-xs"
              style={{background:'hsl(220 15% 10%)'}}>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="font-mono font-bold text-muted-foreground w-6">R{d.round}</span>
                <span className={d.blueWon ? 'text-blue-400 text-[10px]' : 'text-red-400 text-[10px]'}>
                  {d.blueWon ? '🔵' : '🔴'} gana
                </span>
                <span className="ml-auto text-[10px] text-muted-foreground">
                  Blue ${d.blueLoadout.toLocaleString()} · Red ${d.redLoadout.toLocaleString()}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {d.players.sort((a: any, b: any) => econVal(b, 'loadout') - econVal(a, 'loadout')).map((ps: any, pi: number) => {
                  const lv = econVal(ps, 'loadout') as number;
                  const weapon = econVal(ps, 'weapon') as string;
                  const armor  = econVal(ps, 'armor')  as string;
                  const team   = psTeam(ps);
                  const pname  = psName(ps);
                  return (
                    <div key={psPuuid(ps) || pi} className="flex items-center gap-1 rounded px-1.5 py-0.5"
                      style={{background: team==='Blue' ? 'rgba(59,130,246,0.12)' : 'rgba(239,68,68,0.12)'}}>
                      <span className={cn('font-medium text-[10px] truncate max-w-[60px]', team==='Blue'?'text-blue-300':'text-red-300')}>
                        {pname}
                      </span>
                      <span className="text-muted-foreground/60 text-[9px]">
                        {weapon ? weapon : '—'}{armor ? '+' + armor.replace('Light','L').replace('Heavy','H').replace('Combat','C') : ''}
                      </span>
                      <span className="font-mono text-[9px] text-white/60">${(lv/1000).toFixed(1)}k</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MatchCard({ match, playerName, playerTag, onClick, isLoading }: any) {
  const allPlayers = match?.players?.all_players || [];
  const me = allPlayers.find((p:any) =>
    p?.name?.toLowerCase() === playerName?.toLowerCase() &&
    p?.tag?.toLowerCase() === playerTag?.toLowerCase()
  );
  const myTeam = me?.team;
  const myTeamData = myTeam === 'Blue' ? match?.teams?.blue : match?.teams?.red;
  const won = myTeamData?.has_won ?? (me ? undefined : undefined);
  const rounds = match?.metadata?.rounds_played || 0;
  return (
    <button onClick={onClick} disabled={isLoading}
      className={cn('w-full glass-card p-4 text-left transition-all hover:border-white/20 flex items-center gap-4', isLoading&&'opacity-60 cursor-wait')}>
      <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black flex-shrink-0 border',
        won?'bg-green-500/20 text-green-400 border-green-500/30':'bg-red-500/20 text-red-400 border-red-500/30')}>
        {won?'W':'L'}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-bold text-sm">{match.metadata.map}</span>
          <span className="text-xs text-muted-foreground">{match.metadata.mode}</span>
          <span className="text-[10px] text-muted-foreground">{timeAgo(match.metadata.game_start)}</span>
        </div>
        <div className="text-xs text-muted-foreground mt-0.5">
          {match?.teams?.blue?.rounds_won ?? '?'}–{match?.teams?.red?.rounds_won ?? '?'} · {rounds} rondas
        </div>
      </div>
      {me&&(
        <div className="flex items-center gap-4 text-xs flex-shrink-0">
          <div className="text-center"><p className="text-yellow-400 font-bold text-sm">{acsVal(me,rounds)}</p><p className="text-muted-foreground">ACS</p></div>
          <div className="text-center">
            <p className="font-bold text-sm">
              <span className="text-green-400">{me.stats.kills}</span><span className="text-muted-foreground">/</span>
              <span className="text-red-400">{me.stats.deaths}</span><span className="text-muted-foreground">/</span>
              <span className="text-blue-400">{me.stats.assists}</span>
            </p><p className="text-muted-foreground">K/D/A</p>
          </div>
          <div className="text-center"><p className="font-bold text-sm text-white">{me.character||'—'}</p><p className="text-muted-foreground">Agente</p></div>
        </div>
      )}
      {isLoading&&<Loader2 className="w-4 h-4 animate-spin text-muted-foreground flex-shrink-0"/>}
    </button>
  );
}


// ─── Map data cache (loaded from valorant-api.com) ────────────────────────────
interface MapMeta { xMultiplier: number; yMultiplier: number; xScalarToAdd: number; yScalarToAdd: number; displayName: string; minimap: string; }
const mapDataCache: Record<string, MapMeta> = {};
let mapDataLoaded = false;
let mapDataPromise: Promise<void> | null = null;

async function loadMapData(): Promise<void> {
  if (mapDataLoaded) return;
  if (mapDataPromise) return mapDataPromise;
  mapDataPromise = fetch('https://valorant-api.com/v1/maps')
    .then(r => r.json())
    .then(json => {
      json.data?.forEach((m: any) => {
        const meta: MapMeta = {
          xMultiplier: m.xMultiplier,
          yMultiplier: m.yMultiplier,
          xScalarToAdd: m.xScalarToAdd,
          yScalarToAdd: m.yScalarToAdd,
          displayName: m.displayName,
          minimap: m.minimap || m.displayIcon,
        };
        // Indexar por mapUrl (path), por nombre y por uuid
        if (m.mapUrl) mapDataCache[m.mapUrl] = meta;
        if (m.displayName) mapDataCache[m.displayName] = meta;
        if (m.uuid) mapDataCache[m.uuid] = meta;
      });
      mapDataLoaded = true;
    })
    .catch(() => { mapDataLoaded = true; }); // fail silently
  return mapDataPromise;
}


// ─── Normalizar respuesta v2 de Henrik ─────────────────────────────────────
// • Extrae kills de rounds[] con índice de ronda (el array top-level no tiene 'round')
// • Normaliza kill_time_in_round → round_time_millis
// • Añade killer_location desde player_locations_on_kill
// • Añade killer_assets/victim_assets desde players.all_players
function normalizeHenrikMatch(d: any): any {
  if (!d) return d;

  // Mapa puuid → player para buscar assets
  const playerMap: Record<string, any> = {};
  (d.players?.all_players || []).forEach((p: any) => {
    playerMap[p.puuid] = p;
  });

  const normalizedKills: any[] = [];
  const seen = new Set<string>();

  (d.rounds || []).forEach((r: any, ri: number) => {
    (r.player_stats || []).forEach((ps: any) => {
      (ps.kill_events || []).forEach((ke: any) => {
        // Dedup: mismo asesino + misma víctima + mismo tiempo + misma ronda
        const key = `${ke.killer_puuid}|${ke.victim_puuid}|${ke.kill_time_in_round}|${ri}`;
        if (seen.has(key)) return;
        seen.add(key);

        // Buscar localización del asesino en player_locations_on_kill
        const killerLocEntry = (ke.player_locations_on_kill || [])
          .find((pl: any) => pl.player_puuid === ke.killer_puuid);
        const killerLoc = killerLocEntry?.location || null;

        normalizedKills.push({
          ...ke,
          round: ri,
          // Normalizar nombre de campo de tiempo
          round_time_millis: ke.kill_time_in_round ?? ke.round_time_millis ?? 0,
          killer_location: killerLoc,
          killer_assets: playerMap[ke.killer_puuid]?.assets || null,
          victim_assets: playerMap[ke.victim_puuid]?.assets || null,
        });
      });
    });
  });

  // Ordenar por ronda y por tiempo dentro de la ronda
  normalizedKills.sort((a, b) => a.round - b.round || a.round_time_millis - b.round_time_millis);

  // También normalizar plant_events: plant_time_in_round → plant_time_millis
  const normalizedRounds = (d.rounds || []).map((r: any) => ({
    ...r,
    plant_events: r.plant_events
      ? {
          ...r.plant_events,
          plant_time_millis: r.plant_events.plant_time_in_round ?? r.plant_events.plant_time_millis,
          plant_site: r.plant_events.plant_site || r.plant_events.site || '',
        }
      : null,
  }));

  return { ...d, kills: normalizedKills, rounds: normalizedRounds };
}

function worldToCanvas(x: number, y: number, mapId: string, size: number): {px: number; py: number} {
  const meta = mapDataCache[mapId];
  if (!meta) {
    // Fallback genérico mientras carga
    return { px: (x + 100000) / 200000 * size, py: (1 - (y + 100000) / 200000) * size };
  }
  return {
    px: (x * meta.xMultiplier + meta.xScalarToAdd) * size,
    py: (1 - (y * meta.yMultiplier + meta.yScalarToAdd)) * size,
  };
}

// ─── Heatmap Tab ──────────────────────────────────────────────────────────────

// ─── Heatmap Tab — Grid NxN estilo valolytics ─────────────────────────────────
// Usa el endpoint /api/match/:id/heatmap de la API propia
// que ya devuelve: grid[row][col]{kills,deaths,diff,engagements}, killPoints[]{norm{nx,ny}},


// ─── Heatmap Tab ─────────────────────────────────────────────────────────────
// Arquitectura definitiva:
// 1. Servidor: GET /api/match/:id/heatmap-render → JSON con grid, kill points, imageUrl
// 2. Frontend: <img src={imageUrl}> para el mapa + <svg> overlay para el heatmap
//    Sin canvas → Sin CORS. La imagen se carga como cualquier <img> normal.

type HeatmapMode   = 'diff' | 'engagements' | 'kills' | 'deaths';
type HeatmapFilter = 'all'  | 'Blue' | 'Red';

function HeatmapTab({ match, focusPuuid, setFocusPuuid }: any) {
  const matchId    = match?.matchId || match?.metadata?.matchid || '';
  const mapName    = match?.metadata?.map || '';
  const rounds:    any[] = match?.rounds   || [];
  const allKills:  any[] = match?.kills    || [];
  const allPlayers:any[] = match?.players?.all || match?.players?.all_players || [];
  const apiKey = getHenrikKey();

  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [mode,      setMode]      = useState<HeatmapMode>('diff');
  const [team,      setTeam]      = useState<HeatmapFilter>('all');
  const [G,         setG]         = useState(16);
  const [selRound,  setSelRound]  = useState(-1);
  const [showPts,   setShowPts]   = useState(true);
  const [showZones, setShowZones] = useState(false);
  const [heatData,  setHeatData]  = useState<any>(null);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState<string|null>(null);
  const [mapImg,    setMapImg]    = useState<HTMLImageElement|null>(null);

  // ── 1. Cargar datos del servidor ───────────────────────────────────────────
  useEffect(() => {
    if (!matchId) return;
    setLoading(true);
    setError(null);
    const p = new URLSearchParams({
      grid: String(G), team, round: String(selRound),
      ...(focusPuuid ? { puuid: focusPuuid } : {}),
    });
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (apiKey) headers['x-henrik-key'] = apiKey;
    fetch(`http://localhost:3001/api/match/${encodeURIComponent(matchId)}/heatmap-render?${p}`, { headers })
      .then(r => r.json())
      .then(json => {
        if (json.error) throw new Error(json.error);
        setHeatData(json.data);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [matchId, G, team, selRound, focusPuuid]);

  // ── 2. Cargar imagen del mapa ────────────────────────────────────────────────
  useEffect(() => {
    if (!heatData?.imageUrl) { setMapImg(null); return; }
    const url = heatData.imageUrl;
    const img = new Image();
    img.crossOrigin = 'anonymous'; // imprescindible para canvas sin taint

    const onLoaded = () => setMapImg(img);
    const onFailed = () => {
      // Si la URL externa falla, intentar con el servidor local
      if (!url.startsWith('data:') && !url.includes('localhost')) {
        const mapName = heatData.mapName || '';
        const localUrl = `http://localhost:3001/api/maps/${encodeURIComponent(mapName)}/image`;
        const img2 = new Image();
        img2.crossOrigin = 'anonymous';
        img2.onload  = () => setMapImg(img2);
        img2.onerror = () => setMapImg(null); // sin imagen — canvas mostrará fondo oscuro
        img2.src = localUrl;
      } else {
        setMapImg(null);
      }
    };

    img.onload  = onLoaded;
    img.onerror = onFailed;

    if (url.startsWith('data:')) {
      // Base64 del servidor → carga directa (no necesita fetch ni CORS)
      img.src = url;
    } else {
      // URL externa → intentar fetch para convertir a blob URL (evita taint de canvas)
      fetch(url, { mode: 'cors' })
        .then(r => {
          if (!r.ok) throw new Error('HTTP ' + r.status);
          return r.blob();
        })
        .then(blob => { img.src = URL.createObjectURL(blob); })
        .catch(() => {
          // Si fetch falla, intentar carga directa (funciona en Electron sin CORS estricto)
          img.src = url;
        });
    }
  }, [heatData?.imageUrl]);

  // ── 3. Dibujar en canvas cuando cambian datos o imagen ────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !heatData) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    // 3a. Fondo oscuro
    ctx.fillStyle = '#0a0b12';
    ctx.fillRect(0, 0, W, H);

    // 3b. Imagen del mapa — ocupa TODO el canvas (mismo espacio que los datos)
    if (mapImg) {
      ctx.globalAlpha = 0.78;
      ctx.drawImage(mapImg, 0, 0, W, H);
      ctx.globalAlpha = 1;
      // Overlay oscuro leve para mejorar contraste del heatmap
      ctx.fillStyle = 'rgba(0,0,8,0.18)';
      ctx.fillRect(0, 0, W, H);
    }

    // 3c. Grid de calor
    const g = heatData.grid || [];
    const gSize = heatData.gridSize || G;
    let maxVal = 1;
    for (const row of g) for (const c of row) {
      const v = Math.abs(mode === 'diff' ? c.diff : mode === 'kills' ? c.kills : mode === 'deaths' ? c.deaths : c.engagements);
      if (v > maxVal) maxVal = v;
    }
    const cellW = W / gSize;
    const cellH = H / gSize;

    for (let ri = 0; ri < g.length; ri++) {
      for (let ci = 0; ci < (g[ri]?.length || 0); ci++) {
        const c = g[ri][ci];
        const val = mode === 'diff' ? c.diff : mode === 'kills' ? c.kills : mode === 'deaths' ? c.deaths : c.engagements;
        if (!val) continue;
        const norm = Math.min(1, Math.abs(val) / maxVal);
        let color: string;
        if (mode === 'diff') {
          color = val > 0
            ? `rgba(34,197,94,${(norm * 0.82).toFixed(3)})`
            : `rgba(239,68,68,${(norm * 0.82).toFixed(3)})`;
        } else if (mode === 'kills') {
          color = `rgba(34,197,94,${(norm * 0.85).toFixed(3)})`;
        } else if (mode === 'deaths') {
          color = `rgba(239,68,68,${(norm * 0.85).toFixed(3)})`;
        } else {
          const gg = Math.round(255 * (1 - norm * 0.85));
          color = `rgba(255,${gg},0,${(norm * 0.85).toFixed(3)})`;
        }
        ctx.fillStyle = color;
        ctx.fillRect(ci * cellW, ri * cellH, cellW, cellH);
      }
    }

    // 3d. Puntos de kills y muertes
    if (showPts) {
      const kpts: any[] = heatData.killPoints || [];
      for (const k of kpts) {
        // Víctima → punto rojo
        if (k.victimNorm) {
          const cx = k.victimNorm.nx * W;
          const cy = k.victimNorm.ny * H;
          ctx.beginPath();
          ctx.arc(cx, cy, 3.5, 0, Math.PI * 2);
          ctx.fillStyle = k.victimTeam === 'Blue' ? 'rgba(59,130,246,0.9)' : 'rgba(239,68,68,0.9)';
          ctx.fill();
          ctx.strokeStyle = 'rgba(0,0,0,0.6)';
          ctx.lineWidth = 0.8;
          ctx.stroke();
        }
        // Killer → punto verde
        if (k.killerNorm) {
          const cx = k.killerNorm.nx * W;
          const cy = k.killerNorm.ny * H;
          ctx.beginPath();
          ctx.arc(cx, cy, 2.5, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(34,197,94,0.8)';
          ctx.fill();
          ctx.strokeStyle = 'rgba(0,0,0,0.5)';
          ctx.lineWidth = 0.6;
          ctx.stroke();
        }
      }
    }

    // 3e. Plantas de spike
    const plants: any[] = heatData.plants || [];
    for (const p of plants) {
      const cx = p.nx * W;
      const cy = p.ny * H;
      ctx.beginPath();
      ctx.arc(cx, cy, 9, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(251,191,36,0.25)';
      ctx.fill();
      ctx.strokeStyle = '#FBB724';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.font = '14px serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('💣', cx, cy);
    }

    // 3f. Callouts (zonas)
    if (showZones) {
      const callouts: any[] = heatData.callouts || [];
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (const co of callouts) {
        const cx = co.nx * W;
        const cy = co.ny * H;
        const tw = ctx.measureText(co.name).width;
        ctx.fillStyle = 'rgba(0,0,0,0.65)';
        ctx.fillRect(cx - tw / 2 - 3, cy - 7, tw + 6, 14);
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.fillText(co.name, cx, cy);
      }
    }

    // 3g. Leyenda
    ctx.fillStyle = 'rgba(6,8,18,0.92)';
    ctx.beginPath();
    ctx.roundRect(6, H - 68, 182, 62, 4);
    ctx.fill();
    const legendItems = mode === 'diff'
      ? [['#22c55e', 'Zona dominante (kills)'], ['#ef4444', 'Zona peligrosa (muertes)']]
      : mode === 'kills'  ? [['#22c55e', 'Kills']]
      : mode === 'deaths' ? [['#ef4444', 'Muertes']]
      : [['#facc15', 'Alta actividad'], ['#f97316', 'Zona caliente']];
    legendItems.forEach(([color, label], i) => {
      ctx.fillStyle = color;
      ctx.fillRect(12, H - 56 + i * 22, 10, 10);
      ctx.fillStyle = 'white';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, 28, H - 56 + i * 22 + 5);
    });

    // 3h. Contador coords
    const coordKills = heatData.coordKills || 0;
    const totalKills = heatData.totalKills || 0;
    const label = `${coordKills}/${totalKills} coords · ${mapName}`;
    ctx.font = '10px monospace';
    ctx.textAlign = 'right';
    const lw = ctx.measureText(label).width;
    ctx.fillStyle = 'rgba(6,8,18,0.88)';
    ctx.fillRect(W - lw - 14, 4, lw + 10, 18);
    ctx.fillStyle = coordKills > 0 ? '#22c55e' : '#f87171';
    ctx.fillText(label, W - 7, 13);

  }, [heatData, mapImg, mode, showPts, showZones, G]);

  // ── Métricas ───────────────────────────────────────────────────────────────
  const coordKills = heatData?.coordKills || 0;
  const gSize = heatData?.gridSize || G;

  return (
    <div className="space-y-4">

      {/* Controles */}
      <div className="glass-card p-4 space-y-3">
        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5">Modo</p>
          <div className="flex flex-wrap gap-1.5">
            {([
              ['diff',        'Kill Diff'],
              ['engagements', 'Actividad'],
              ['kills',       'Kills'],
              ['deaths',      'Muertes'],
            ] as [HeatmapMode, string][]).map(([id, label]) => (
              <button key={id} onClick={() => setMode(id)}
                className={cn('text-xs px-3 py-1.5 rounded-lg border transition-all',
                  mode === id ? 'border-white/30 bg-white/10 text-white' : 'border-white/10 text-muted-foreground hover:text-white')}>
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <p className="text-[10px] text-muted-foreground mb-1">Equipo</p>
            <div className="flex gap-1">
              {(['all', 'Blue', 'Red'] as HeatmapFilter[]).map(t => (
                <button key={t} onClick={() => setTeam(t)}
                  className={cn('text-[10px] px-2 py-1 rounded border transition-all',
                    team === t ? t === 'Blue' ? 'bg-blue-500/20 border-blue-500/50 text-blue-300'
                      : t === 'Red' ? 'bg-red-500/20 border-red-500/50 text-red-300'
                      : 'bg-white/10 border-white/30 text-white'
                    : 'border-white/10 text-muted-foreground hover:text-white')}>
                  {t === 'all' ? 'Todos' : t}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-[10px] text-muted-foreground mb-1">Resolución</p>
            <div className="flex gap-1">
              {[8, 12, 16, 24].map(g2 => (
                <button key={g2} onClick={() => setG(g2)}
                  className={cn('text-[10px] px-2 py-1 rounded border transition-all',
                    G === g2 ? 'bg-white/10 border-white/30 text-white' : 'border-white/10 text-muted-foreground hover:text-white')}>
                  {g2}×{g2}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-[10px] text-muted-foreground mb-1">Ronda</p>
            <select value={selRound} onChange={e => setSelRound(+e.target.value)}
              className="text-[10px] rounded border px-2 py-1"
              style={{ background: 'hsl(220 15% 10%)', borderColor: 'hsl(220 15% 20%)' }}>
              <option value={-1}>Todas</option>
              {rounds.map((_: any, i: number) => <option key={i} value={i}>R{i + 1}</option>)}
            </select>
          </div>

          <div className="flex gap-1.5">
            {([
              ['Puntos', showPts, setShowPts],
              ['Zonas', showZones, setShowZones],
            ] as [string, boolean, any][]).map(([l, v, s]) => (
              <button key={l} onClick={() => s(!v)}
                className={cn('text-[10px] px-2 py-1 rounded border transition-all',
                  v ? 'bg-white/10 border-white/30 text-white' : 'border-white/10 text-muted-foreground')}>
                {v ? '✓ ' : ''}{l}
              </button>
            ))}
          </div>
        </div>

        {allPlayers.length > 0 && (
          <div>
            <p className="text-[10px] text-muted-foreground mb-1">Jugador</p>
            <div className="flex flex-wrap gap-1">
              <button onClick={() => setFocusPuuid('')}
                className={cn('text-[10px] px-2 py-1 rounded border transition-all',
                  !focusPuuid ? 'bg-white/10 border-white/30 text-white' : 'border-white/10 text-muted-foreground hover:text-white')}>
                Todos
              </button>
              {allPlayers.map((p: any) => {
                const pu = p.puuid || ''; const pt = p.team || '';
                const ic = p.agentKillfeed || p.assets?.agent?.killfeed || '';
                return (
                  <button key={pu} onClick={() => setFocusPuuid(pu === focusPuuid ? '' : pu)}
                    className={cn('flex items-center gap-1 text-[10px] px-2 py-1 rounded border transition-all',
                      pu === focusPuuid
                        ? pt === 'Blue' ? 'bg-blue-500/20 border-blue-500/50 text-blue-300'
                          : 'bg-red-500/20 border-red-500/50 text-red-300'
                        : 'border-white/10 text-muted-foreground hover:text-white')}>
                    {ic && <img src={ic} className="w-4 h-4 rounded" />}
                    {p.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Avisos */}
      {!loading && heatData && coordKills === 0 && allKills.length > 0 && (
        <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/8 p-3 text-xs text-yellow-300">
          ⚠️ Este partido no tiene coordenadas de kills (típico en Custom Games sin observador).
        </div>
      )}
      {error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/8 p-3 text-xs text-red-300">
          ⚠️ {error} — Verifica que el servidor esté corriendo en localhost:3001
        </div>
      )}

      {/* ── Canvas: imagen + heatmap renderizados juntos ────────────────────── */}
      <div className="relative mx-auto rounded-xl overflow-hidden"
        style={{ aspectRatio: '1/1', maxWidth: 560, background: '#0a0b12' }}>

        {/* Canvas principal — todo se dibuja aquí */}
        <canvas
          ref={canvasRef}
          width={512}
          height={512}
          className="w-full h-full block"
        />

        {/* Spinner */}
        {loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 z-10"
            style={{ background: 'rgba(10,11,18,0.88)' }}>
            <Loader2 className="w-8 h-8 animate-spin text-red-400" />
            <p className="text-xs text-muted-foreground">Cargando {mapName}…</p>
          </div>
        )}

        {/* Sin datos */}
        {!heatData && !loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground">
            <p className="text-sm">Sin datos de heatmap</p>
            <p className="text-xs opacity-50">Necesita servidor en localhost:3001</p>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="glass-card p-4">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-3">Estadísticas</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { l: 'Total kills',  v: allKills.length },
            { l: 'Con coords',   v: `${coordKills} (${allKills.length ? Math.round(coordKills / allKills.length * 100) : 0}%)` },
            { l: 'Grid',         v: `${gSize}×${gSize}` },
            { l: 'Mapa',         v: mapName || '—' },
          ].map(({ l, v }) => (
            <div key={l} className="rounded-lg p-3 text-center" style={{ background: 'hsl(220 15% 10%)' }}>
              <p className="text-white font-bold text-sm">{v}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{l}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function TimelineTab({ match }: any) {
  const rounds: any[] = match?.rounds || [];
  const [hovered, setHovered] = useState<number|null>(null);

  // Helper: campos con fallback al esquema legado
  const rWin   = (r: any) => r.winningTeam  || r.winning_team  || '';
  const rEnd   = (r: any) => r.endType      || r.end_type      || '';
  const rPlant = (r: any) => r.bombPlanted  ?? r.bomb_planted  ?? false;
  const rDefuse= (r: any) => r.bombDefused  ?? r.bomb_defused  ?? false;
  const rSite  = (r: any) => r.plant?.site  || r.plant_events?.plant_site || '?';
  const rStats = (r: any): any[] => r.playerStats || r.player_stats || [];
  const psName = (ps: any) => ps.displayName || ps.player_display_name || '';
  const psTeam = (ps: any) => ps.team        || ps.player_team         || '';

  // Calcular acumulados para el gráfico
  let bRun = 0, rRun = 0;
  const acc = rounds.map((r: any) => {
    const stats = rStats(r);
    const bk = stats.filter((p: any) => psTeam(p) === 'Blue').reduce((s: number, p: any) => s + (p.kills || 0), 0);
    const rk = stats.filter((p: any) => psTeam(p) === 'Red' ).reduce((s: number, p: any) => s + (p.kills || 0), 0);
    bRun += bk; rRun += rk;
    return { b: bRun, r: rRun };
  });
  const maxAcc = Math.max(1, ...acc.map(a => Math.max(a.b, a.r)));

  return (
    <div className="space-y-5">

      {/* ── Barra visual por ronda ─────────────────────────────────── */}
      <div className="glass-card p-4">
        <h3 className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wider">Resultado por ronda</h3>
        <div className="flex flex-wrap gap-1">
          {rounds.map((r: any, i: number) => {
            const blue    = rWin(r) === 'Blue';
            const planted = rPlant(r);
            const defused = rDefuse(r);
            const isOT    = i >= 24;
            const kills   = rStats(r).reduce((s: number, p: any) => s + (p.kills || 0), 0);
            return (
              <div key={i} className="relative group"
                onMouseEnter={() => setHovered(i)}
                onMouseLeave={() => setHovered(null)}>
                <div className={cn(
                  'w-8 h-12 rounded-md flex flex-col items-center justify-center gap-0.5 transition-all border cursor-pointer',
                  blue ? 'bg-blue-500/20 border-blue-500/30 hover:bg-blue-500/35'
                       : 'bg-red-500/20 border-red-500/30 hover:bg-red-500/35',
                  isOT && 'border-dashed border-yellow-400/40',
                )}>
                  <span className="text-[9px] font-bold text-muted-foreground">{i + 1}</span>
                  <div className={cn('w-4 h-4 rounded-full flex items-center justify-center text-[8px]', blue ? 'bg-blue-500' : 'bg-red-500')}>
                    {defused ? '🔧' : planted ? '💣' : '✕'}
                  </div>
                  <span className={cn('text-[9px] font-bold', blue ? 'text-blue-300' : 'text-red-300')}>
                    {blue ? 'B' : 'R'}
                  </span>
                </div>

                {/* Tooltip */}
                {hovered === i && (
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-20 w-52 rounded-xl border p-3 shadow-2xl text-xs pointer-events-none"
                    style={{ background: 'hsl(220 22% 10%)', borderColor: 'hsl(220 15% 20%)' }}>
                    <p className="font-bold mb-1">Ronda {i + 1}{isOT ? ' (OT)' : ''}</p>
                    <p className={blue ? 'text-blue-400' : 'text-red-400'}>{blue ? '🔵 Blue' : '🔴 Red'} gana</p>
                    <p className="text-muted-foreground mt-0.5">{rEnd(r)}</p>
                    {planted  && <p className="text-orange-400">💣 Plantado en {rSite(r)}</p>}
                    {defused  && <p className="text-green-400">🔧 Defusado</p>}
                    <p className="text-muted-foreground mt-1">{kills} kills totales</p>
                    {[...rStats(r)].sort((a, b) => b.kills - a.kills).slice(0, 3).map((ps: any, pi: number) => (
                      <p key={pi} className="text-[10px] mt-0.5">
                        <span className={psTeam(ps) === 'Blue' ? 'text-blue-400' : 'text-red-400'}>●</span>{' '}
                        {psName(ps)}: {ps.kills}k {ps.damage}dmg
                      </p>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div className="flex gap-4 mt-3 text-[10px] text-muted-foreground">
          <span><span className="text-blue-400">■</span> Blue gana</span>
          <span><span className="text-red-400">■</span> Red gana</span>
          <span>💣 Planta · 🔧 Defuse · ✕ Elim</span>
        </div>
      </div>

      {/* ── Gráfico kills acumulados ───────────────────────────────── */}
      <div className="glass-card p-4">
        <h3 className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wider">Kills acumulados</h3>
        <div className="flex items-end gap-0.5 h-28">
          {acc.map((a, i) => {
            const bH = Math.max(2, Math.round((a.b / maxAcc) * 96));
            const rH = Math.max(2, Math.round((a.r / maxAcc) * 96));
            return (
              <div key={i} className="flex items-end gap-0.5 flex-1 min-w-0"
                title={`R${i + 1}: Blue ${a.b} | Red ${a.r}`}>
                <div className="flex-1 rounded-t-sm" style={{ height: bH, background: '#3b82f6', opacity: 0.75 }} />
                <div className="flex-1 rounded-t-sm" style={{ height: rH, background: '#ef4444', opacity: 0.75 }} />
              </div>
            );
          })}
        </div>
        <div className="flex gap-4 mt-1 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-blue-500 inline-block" />Blue acumulado</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-red-500 inline-block" />Red acumulado</span>
        </div>
      </div>

      {/* ── Momentos clave ────────────────────────────────────────── */}
      <div className="glass-card p-4">
        <h3 className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wider">Momentos clave</h3>
        <div className="space-y-2">
          {rounds.map((r: any, i: number) => {
            const events: string[] = [];
            const stats  = rStats(r);
            const kills  = stats.reduce((s: number, p: any) => s + (p.kills || 0), 0);
            const mvp    = [...stats].sort((a: any, b: any) => b.kills - a.kills)[0];
            const winT   = rWin(r);
            if (kills >= 8)        events.push(`💥 Ronda caótica (${kills} kills)`);
            if (rDefuse(r))        events.push('🔧 Defuse épico');
            if (rPlant(r) && winT === 'Blue') events.push(`💣 Blue planta y gana (${rSite(r)})`);
            if (rPlant(r) && winT === 'Red')  events.push(`💣 Red defiende el site ${rSite(r)}`);
            if (mvp && mvp.kills >= 4) events.push(`⭐ ${psName(mvp)} (${mvp.kills}k)`);
            if (events.length === 0) return null;
            return (
              <div key={i} className="flex gap-3 items-start text-xs">
                <span className="font-mono text-muted-foreground/60 shrink-0 w-8">R{i + 1}</span>
                <div className="flex flex-wrap gap-1.5">
                  {events.map((ev, j) => (
                    <span key={j} className="px-2 py-0.5 rounded-full text-[10px]"
                      style={{ background: 'hsl(220 15% 13%)', border: '1px solid hsl(220 15% 22%)' }}>
                      {ev}
                    </span>
                  ))}
                </div>
              </div>
            );
          }).filter(Boolean)}
        </div>
      </div>
    </div>
  );
}

// ─── Replay Tab ────────────────────────────────────────────────────────────────
function ReplayTab({ match }: any) {
  const rounds:   any[] = match?.rounds || [];
  const allKills: any[] = match?.kills  || [];
  const [selected, setSelected] = useState(0);

  // Helpers esquema dual
  const rWin    = (r: any) => r.winningTeam  || r.winning_team  || '';
  const rEnd    = (r: any) => r.endType      || r.end_type      || '';
  const rPlant  = (r: any) => r.bombPlanted  ?? r.bomb_planted  ?? false;
  const rDefuse = (r: any) => r.bombDefused  ?? r.bomb_defused  ?? false;
  const rSite   = (r: any) => r.plant?.site  || r.plant_events?.plant_site || '?';
  const rStats  = (r: any): any[] => r.playerStats || r.player_stats || [];
  const psName  = (ps: any) => ps.displayName || ps.player_display_name || '';
  const psTeam  = (ps: any) => ps.team        || ps.player_team         || '';
  const psPuuid = (ps: any) => ps.puuid       || ps.player_puuid        || '';

  const r = rounds[selected];
  if (!r) return <p className="text-sm text-muted-foreground p-4">Sin datos de rondas.</p>;

  const roundKills = allKills
    .filter((k: any) => k.round === selected)
    .sort((a: any, b: any) => {
      const ta = a.timeInRound ?? a.round_time_millis ?? 0;
      const tb = b.timeInRound ?? b.round_time_millis ?? 0;
      return ta - tb;
    });

  const blue = rWin(r) === 'Blue';
  const stats = rStats(r);
  const mvp   = [...stats].sort((a: any, b: any) => b.kills - a.kills)[0];

  // Narración
  const lines: string[] = [];
  lines.push(`**Ronda ${selected + 1}** — ${rEnd(r) || 'Eliminación'}`);
  if (rPlant(r)) lines.push(`💣 La spike fue plantada en el site **${rSite(r)}**.`);

  roundKills.forEach((k: any) => {
    const timeMs  = k.timeInRound ?? k.round_time_millis ?? null;
    const t       = timeMs != null
      ? `${Math.floor(timeMs / 60000)}:${String(Math.floor(timeMs / 1000) % 60).padStart(2, '0')}`
      : '';
    const kName   = k.killerName || k.killer_display_name || '?';
    const vName   = k.victimName || k.victim_display_name || '?';
    const weapon  = k.weaponName || k.damage_weapon_name  || 'arma';
    lines.push(`[${t}] **${kName}** elimina a **${vName}** con ${weapon}.`);
  });

  if (rDefuse(r)) lines.push('🔧 La spike fue **defusada**. ¡Rotación perfecta!');
  lines.push(`🏆 **${rWin(r)} gana** la ronda ${selected + 1}.`);
  if (mvp && mvp.kills > 0) lines.push(`⭐ MVP: **${psName(mvp)}** con ${mvp.kills} kills y ${mvp.damage || 0} daño.`);

  return (
    <div className="space-y-4">
      {/* Selector de ronda */}
      <div className="flex flex-wrap gap-1">
        {rounds.map((rd: any, i: number) => (
          <button key={i} onClick={() => setSelected(i)}
            className={cn(
              'w-8 h-8 rounded-lg text-xs font-bold transition-all',
              selected === i ? 'bg-red-500 text-white' : 'hover:bg-white/10 text-muted-foreground',
              rWin(rd) === 'Blue' ? 'border border-blue-500/30' : 'border border-red-500/30',
            )}>
            {i + 1}
          </button>
        ))}
      </div>

      {/* Cabecera */}
      <div className={cn('rounded-xl p-4 border', blue ? 'bg-blue-500/8 border-blue-500/20' : 'bg-red-500/8 border-red-500/20')}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-lg">Ronda {selected + 1}</h3>
            <p className={cn('text-sm', blue ? 'text-blue-400' : 'text-red-400')}>
              {blue ? '🔵 Blue' : '🔴 Red'} gana · {rEnd(r)}
            </p>
          </div>
          <div className="text-right text-sm text-muted-foreground">
            {rPlant(r)  && <p className="text-orange-400">💣 Plantado {rSite(r)}</p>}
            {rDefuse(r) && <p className="text-green-400">🔧 Defusado</p>}
            <p>{roundKills.length} kills</p>
          </div>
        </div>
      </div>

      {/* Narración */}
      <div className="glass-card p-4">
        <h3 className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wider">📖 Narración de la ronda</h3>
        <div className="space-y-1.5">
          {lines.map((line, i) => {
            const isKill  = line.startsWith('[');
            const isEvent = /^[💣🔧🏆⭐]/.test(line);
            const parsed  = line.replace(/\*\*([^*]+)\*\*/g, '$1');
            return (
              <div key={i} className={cn(
                'text-sm py-1.5 px-3 rounded-lg',
                isKill  ? 'bg-white/3 font-mono text-xs text-muted-foreground'
                : isEvent ? 'text-white font-medium'
                : 'text-muted-foreground',
              )}>
                {parsed}
              </div>
            );
          })}
        </div>
      </div>

      {/* Rendimiento individual */}
      <div className="glass-card p-4">
        <h3 className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wider">Rendimiento individual</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {[...stats].sort((a: any, b: any) => b.kills - a.kills).map((ps: any, pi: number) => {
            const maxDmg = Math.max(...stats.map((p: any) => p.damage || 0), 1);
            const isMvp  = psPuuid(ps) === psPuuid(mvp);
            return (
              <div key={psPuuid(ps) || pi} className="rounded-xl p-3 space-y-1.5" style={{ background: 'hsl(220 15% 10%)' }}>
                <div className="flex items-center gap-2">
                  <div className={cn('w-2 h-2 rounded-full shrink-0', psTeam(ps) === 'Blue' ? 'bg-blue-400' : 'bg-red-400')} />
                  <p className="font-semibold text-xs truncate">{psName(ps)}</p>
                  {isMvp && <span className="text-yellow-400 text-[10px]">★</span>}
                </div>
                <div className="grid grid-cols-3 gap-1 text-center">
                  <div><p className="text-white font-bold">{ps.kills || 0}</p><p className="text-[9px] text-muted-foreground">K</p></div>
                  <div><p className="text-white font-bold">{ps.headshots || 0}</p><p className="text-[9px] text-muted-foreground">HS</p></div>
                  <div><p className="text-white font-bold">{ps.damage || 0}</p><p className="text-[9px] text-muted-foreground">DMG</p></div>
                </div>
                <div className="h-1 rounded-full bg-white/10">
                  <div className="h-1 rounded-full transition-all"
                    style={{
                      width: `${((ps.damage || 0) / maxDmg) * 100}%`,
                      background: psTeam(ps) === 'Blue' ? '#3b82f6' : '#ef4444',
                    }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}


// ─── Asset caches (agentes + armas) ────────────────────────────────────────────
const agentCache: Record<string, { name: string; killfeed: string; small: string }> = {};
const weaponCache: Record<string, string> = {}; // uuid.lower() → display name
let assetsLoaded = false;
let assetsPromise: Promise<void> | null = null;

async function loadAssets(): Promise<void> {
  if (assetsLoaded) return;
  if (assetsPromise) return assetsPromise;
  assetsPromise = Promise.all([
    fetch('https://valorant-api.com/v1/agents?isPlayableCharacter=true')
      .then(r => r.json())
      .then(j => { j.data?.forEach((a: any) => {
        agentCache[a.uuid.toLowerCase()] = {
          name:     a.displayName,
          killfeed: a.killfeedPortrait || a.displayIcon || '',
          small:    a.displayIcon      || '',
        };
      }); }).catch(() => {}),
    fetch('https://valorant-api.com/v1/weapons')
      .then(r => r.json())
      .then(j => { j.data?.forEach((w: any) => {
        weaponCache[w.uuid.toLowerCase()] = w.displayName;
      }); }).catch(() => {}),
    loadMapData(),
  ]).then(() => { assetsLoaded = true; }).catch(() => { assetsLoaded = true; });
  return assetsPromise;
}

// ─── Queue names ───────────────────────────────────────────────────────────────
const QUEUE_NAMES: Record<string, string> = {
  custom:'Custom Game', competitive:'Competitive', unrated:'Unrated',
  spikerush:'Spike Rush', deathmatch:'Deathmatch', ggteam:'Escalation',
  onefa:'Replication', hurm:'Team Deathmatch', premier:'Premier',
  swiftplay:'Swiftplay', newmap:'New Map', '':'Standard',
};

// ─── Normalizar respuesta de la API interna de Riot → formato interno ─────────
function normalizeRiotMatch(raw: any): any {
  if (!raw) return null;
  const info  = raw.matchInfo || {};
  const mapId = info.mapId || '';
  const mapMeta = mapDataCache[mapId];
  const mapName = mapMeta?.displayName || mapId.split('/').pop() || 'Desconocido';
  const queueId = (info.queueID || '').toLowerCase();
  const mode    = QUEUE_NAMES[queueId] || info.queueID || 'Modo desconocido';
  const gameStart = info.gameStartMillis ? Math.floor(info.gameStartMillis / 1000) : 0;

  // Lookup maps
  const bySubject: Record<string, any>  = {};
  const subjectTeam: Record<string, string> = {};
  (raw.players || []).forEach((p: any) => {
    bySubject[p.subject]   = p;
    subjectTeam[p.subject] = p.teamId;
  });

  const teamsArr: any[] = raw.teams || [];
  const blueT  = teamsArr.find(t => t.teamId === 'Blue') || { won:false, roundsWon:0 };
  const redT   = teamsArr.find(t => t.teamId === 'Red')  || { won:false, roundsWon:0 };

  // Calcular daño, headshots, etc. desde roundResults
  const dmgMade:  Record<string, number> = {};
  const dmgRcvd:  Record<string, number> = {};
  const phits = { hs:{} as Record<string,number>, bs:{} as Record<string,number>, ls:{} as Record<string,number> };
  (raw.roundResults || []).forEach((r: any) => {
    (r.playerStats || []).forEach((ps: any) => {
      (ps.damage || []).forEach((d: any) => {
        const s = ps.subject;
        dmgMade[s]  = (dmgMade[s]  || 0) + (d.damage     || 0);
        phits.hs[s] = (phits.hs[s] || 0) + (d.headshots  || 0);
        phits.bs[s] = (phits.bs[s] || 0) + (d.bodyshots  || 0);
        phits.ls[s] = (phits.ls[s] || 0) + (d.legshots   || 0);
        dmgRcvd[d.receiver] = (dmgRcvd[d.receiver] || 0) + (d.damage || 0);
      });
    });
  });

  // Normalizar jugadores
  const normPlayers = (raw.players || []).map((p: any) => {
    const aId   = (p.characterId || '').toLowerCase();
    const agent = agentCache[aId] || { name: p.characterId?.slice(0,8) || 'Unknown', killfeed:'', small:'' };
    return {
      puuid:     p.subject,
      name:      p.gameName || 'Unknown',
      tag:       p.tagLine  || '',
      team:      p.teamId,
      character: agent.name,
      assets: { agent: { killfeed: agent.killfeed, small: agent.small } },
      stats: {
        score:     p.stats?.score   || 0,
        kills:     p.stats?.kills   || 0,
        deaths:    p.stats?.deaths  || 0,
        assists:   p.stats?.assists || 0,
        headshots: phits.hs[p.subject] || 0,
        bodyshots: phits.bs[p.subject] || 0,
        legshots:  phits.ls[p.subject] || 0,
      },
      economy: {
        spent:         { overall: 0, average: 0 },
        loadout_value: { overall: 0, average: 0 },
      },
      damage_made:     dmgMade[p.subject] || 0,
      damage_received: dmgRcvd[p.subject] || 0,
    };
  });

  // Normalizar rondas
  const rounds = (raw.roundResults || []).map((r: any) => {
    const hasPlant  = !!(r.bombPlanter && r.plantSite);
    const hasDefuse = r.roundResult === 'Bomb defused';
    const planterP  = r.bombPlanter ? bySubject[r.bombPlanter] : null;

    const pStats = (r.playerStats || []).map((ps: any) => {
      const player = bySubject[ps.subject];
      const dmg  = (ps.damage || []).reduce((s: number, d: any) => s + (d.damage    || 0), 0);
      const hs   = (ps.damage || []).reduce((s: number, d: any) => s + (d.headshots || 0), 0);
      const kCnt = (ps.kills  || []).length;
      const wId  = (ps.economy?.weapon || '').toLowerCase();
      return {
        player_puuid:        ps.subject,
        player_display_name: player ? `${player.gameName}#${player.tagLine}` : ps.subject.slice(0,8),
        player_team:         subjectTeam[ps.subject] || 'Blue',
        kills:               kCnt,
        damage:              dmg,
        headshots:           hs,
        economy: {
          loadout_value: ps.economy?.loadoutValue || 0,
          weapon_name:   weaponCache[wId] || ps.economy?.weapon || '',
          armor_name:    ps.economy?.armor  || '',
          remaining:     ps.economy?.remaining || 0,
          spent:         ps.economy?.spent     || 0,
        },
      };
    });

    return {
      winning_team: r.winningTeam,
      end_type:     r.roundResult || r.roundResultCode || 'Eliminated',
      bomb_planted: hasPlant,
      bomb_defused: hasDefuse,
      plant_events: hasPlant ? {
        plant_site:       r.plantSite,
        plant_location:   r.plantLocation,
        plant_time_millis: r.plantRoundTime || 0,
        planted_by: {
          puuid:        r.bombPlanter,
          display_name: planterP ? `${planterP.gameName}#${planterP.tagLine}` : r.bombPlanter?.slice(0,8),
          team:         subjectTeam[r.bombPlanter] || '',
        },
      } : null,
      player_stats: pStats,
    };
  });

  // Normalizar kills
  const normKills = (raw.kills || []).map((k: any) => {
    const killer    = bySubject[k.killer];
    const victim    = bySubject[k.victim];
    const killerLoc = (k.playerLocations || []).find((pl: any) => pl.subject === k.killer)?.location || null;
    const wUuid     = (k.finishingDamage?.damageItem || '').toLowerCase();
    let weapName    = weaponCache[wUuid] || '';
    if (!weapName) {
      const dt = k.finishingDamage?.damageType || '';
      weapName = dt === 'Bomb' ? 'Spike' : dt === 'Melee' ? 'Melee' : dt === 'Ability' ? 'Ability' : 'Unknown';
    }
    return {
      round:             k.round,
      round_time_millis: k.roundTime || 0,
      killer_puuid:      k.killer,
      killer_display_name: killer ? `${killer.gameName}#${killer.tagLine}` : k.killer?.slice(0,8) || '?',
      killer_team:       subjectTeam[k.killer] || 'Blue',
      victim_puuid:      k.victim,
      victim_display_name: victim ? `${victim.gameName}#${victim.tagLine}` : k.victim?.slice(0,8) || '?',
      victim_team:       subjectTeam[k.victim] || 'Red',
      victim_death_location: k.victimLocation,
      killer_location:   killerLoc,
      damage_weapon_name: weapName,
      killer_assets: killer ? { agent: { killfeed: agentCache[(killer.characterId||'').toLowerCase()]?.killfeed || '' } } : null,
      victim_assets: victim ? { agent: { killfeed: agentCache[(victim.characterId||'').toLowerCase()]?.killfeed || '' } } : null,
    };
  });

  const roundsPlayed = info.roundsPlayed || rounds.length;

  return {
    metadata: {
      matchid:           info.matchId || '',
      map:               mapName,
      map_id:            mapId,
      mode,
      game_start:        gameStart,
      game_start_patched: gameStart > 0 ? new Date(gameStart * 1000).toLocaleString('es-ES') : '',
      game_length:       info.gameLengthMillis || 0,
      rounds_played:     roundsPlayed,
    },
    players: {
      all_players: normPlayers,
      blue:        normPlayers.filter((p: any) => p.team === 'Blue'),
      red:         normPlayers.filter((p: any) => p.team === 'Red'),
    },
    teams: {
      blue: { has_won: blueT.won, rounds_won: blueT.roundsWon, rounds_lost: redT.roundsWon },
      red:  { has_won: redT.won,  rounds_won: redT.roundsWon,  rounds_lost: blueT.roundsWon },
    },
    rounds,
    kills: normKills,
  };
}

// ─── Proxy helpers ─────────────────────────────────────────────────────────────
const PROXY = 'http://localhost:3001';

async function proxyGet(path: string) {
  const res = await fetch(PROXY + path);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || 'HTTP ' + res.status);
  }
  return res.json();
}
async function proxyPost(path: string, body: any) {
  const res = await fetch(PROXY + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'HTTP ' + res.status);
  return data;
}
async function proxyDelete(path: string) {
  const res = await fetch(PROXY + path, { method: 'DELETE' });
  return res.json().catch(() => ({}));
}

function formatMs(ms: number): string {
  if (!ms) return '—';
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2,'0')}`;
}
function timeAgoMs(ms: number): string {
  const diff = Date.now() - ms;
  if (diff < 3600000)  return Math.floor(diff/60000)  + 'm';
  if (diff < 86400000) return Math.floor(diff/3600000) + 'h';
  return Math.floor(diff/86400000) + 'd';
}

// ─── Tipo de tab ───────────────────────────────────────────────────────────────
type Tab = 'scoreboard'|'rounds'|'killfeed'|'economy'|'heatmap'|'timeline'|'replay'|'advanced';

// ─── Componente principal ──────────────────────────────────────────────────────
// ─── Componente principal ──────────────────────────────────────────────────────
export function RiotMatchViewer() {
  // Búsqueda Henrik
  const [name,       setName]       = useState('');
  const [tag,        setTag]        = useState('');
  const [region,     setRegion]     = useState('eu');
  const [modeFilter, setModeFilter] = useState('');
  const [sizeFilter, setSizeFilter] = useState('15');

  // Match state
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [loadingMatch,   setLoadingMatch]   = useState<string|null>(null);
  const [matchHistory,   setMatchHistory]   = useState<any[]>([]);
  const [matchDetail,    setMatchDetail]    = useState<any|null>(null);
  const [activeTab,      setActiveTab]      = useState<Tab>('scoreboard');
  const [focusPuuid,     setFocusPuuid]     = useState('');
  const [error,          setError]          = useState<string|null>(null);
  const [exportedId,     setExportedId]     = useState<string|null>(null);

  const { addMatch } = useAppStore();
  const apiKey = getHenrikKey();

  // Guardar último nombre/tag/region usados
  useEffect(() => {
    const saved = localStorage.getItem('valoanalytics_mv_search');
    if (saved) {
      try {
        const { n, t, r } = JSON.parse(saved);
        if (n) setName(n);
        if (t) setTag(t);
        if (r) setRegion(r);
      } catch {}
    }
  }, []);

  // ── Cargar historial via Henrik ───────────────────────────────────────────────
  const loadHistory = async () => {
    if (!name.trim() || !tag.trim()) { setError('Introduce nombre y tag del jugador'); return; }
    setLoadingHistory(true); setError(null); setMatchDetail(null); setMatchHistory([]);
    localStorage.setItem('valoanalytics_mv_search', JSON.stringify({ n: name.trim(), t: tag.trim(), r: region }));
    try {
      const data = await fetchMatchHistory(region, name.trim(), tag.trim(), modeFilter, parseInt(sizeFilter), apiKey);
      const list = Array.isArray(data) ? data : (data?.history || data?.matches || []);
      setMatchHistory(list);
      if (list.length === 0) setError('No se encontraron partidos. Prueba con otro filtro de modo.');
    } catch(e: any) {
      setError(e.message);
    } finally { setLoadingHistory(false); }
  };

  // ── Cargar detalle de partido ─────────────────────────────────────────────────
  const loadMatch = async (matchId: string) => {
    setLoadingMatch(matchId); setError(null);
    try {
      const data = await fetchMatchDetail(matchId, apiKey);
      setMatchDetail(data);
      setActiveTab('scoreboard'); setFocusPuuid('');
      cacheHenrikMatch(data);
    } catch(e: any) {
      setError(e.message);
    } finally { setLoadingMatch(null); }
  };

  // ── Exportar partido al store ─────────────────────────────────────────────────
  const exportToMatches = () => {
    if (!matchDetail) return;
    const meta  = matchDetail.metadata || {};
    const teams = matchDetail.teams    || {};
    const blueWon   = teams.blue?.hasWon    ?? teams.blue?.has_won    ?? false;
    const blueScore = teams.blue?.roundsWon ?? teams.blue?.rounds_won ?? 0;
    const redScore  = teams.red?.roundsWon  ?? teams.red?.rounds_won  ?? 0;
    const allPlayers = matchDetail.players?.all || matchDetail.players?.all_players || [];
    const focusPlayer = allPlayers.find((p: any) => p.puuid === focusPuuid);
    const ourTeam  = focusPlayer?.team || 'Blue';
    const won      = ourTeam === 'Blue' ? blueWon : !blueWon;
    const scoreUs  = ourTeam === 'Blue' ? blueScore : redScore;
    const scoreOpp = ourTeam === 'Blue' ? redScore  : blueScore;
    const newMatch: Match = {
      id:     matchDetail.matchId || meta.matchid || Date.now().toString(),
      type:   (meta.mode?.toLowerCase().includes('comp') ? 'competitive' : 'custom') as any,
      map:    meta.map  || 'Desconocido',
      date:   meta.gameStartPatched || meta.game_start_patched || new Date().toISOString().split('T')[0],
      atk:0, def:0, scoreUs, scoreOpp, otWin:0, otLoss:0, won,
      pistolAtkWin:false, pistolDefWin:false, postWin:0, postLoss:0, retakeWin:0, retakeLoss:0,
      notes: `Importado Henrik · ${meta.mode} · ${meta.gameStartPatched || meta.game_start_patched}`,
      createdAt: Date.now(), updatedAt: Date.now(),
    };
    addMatch(newMatch);
    setExportedId(newMatch.id);
    setTimeout(() => setExportedId(null), 3000);
  };

  // Exportar JSON completo con todas las estadísticas
  const exportFullJSON = () => {
    if (!matchDetail) return;
    const meta     = matchDetail.metadata || {};
    const teams    = matchDetail.teams    || {};
    const rounds   = matchDetail.rounds   || [];
    const allKills = matchDetail.kills    || [];
    const allP: any[] = matchDetail.players?.all || matchDetail.players?.all_players || [];
    const nRounds  = meta.roundsPlayed || meta.rounds_played || rounds.length || 1;
    const psTeam   = (ps: any) => ps.team || ps.player_team || '';
    const rStats   = (r: any): any[] => r.playerStats || r.player_stats || [];
    const econVal  = (ps: any, f: string) => {
      const e = ps.economy || {};
      if (f==='loadout')   return e.loadoutValue  ?? e.loadout_value  ?? 0;
      if (f==='remaining') return e.remaining     ?? 0;
      if (f==='spent')     return e.spent         ?? 0;
      if (f==='weapon')    return e.weapon        || '';
      if (f==='armor')     return e.armor         || '';
      return 0;
    };

    // Estadísticas detalladas por jugador
    const playerStats = allP.map((p: any) => {
      const kills   = p.stats?.kills   ?? 0;
      const deaths  = p.stats?.deaths  ?? 0;
      const assists = p.stats?.assists ?? 0;
      const score   = p.stats?.score   ?? 0;
      const hs = p.stats?.headshots ?? 0;
      const bs = p.stats?.bodyshots ?? 0;
      const ls = p.stats?.legshots  ?? 0;
      const shots = hs+bs+ls;
      // FK/FD
      let fk=0, fd=0;
      const killsByRound: Record<number,any[]> = {};
      allKills.forEach((k: any) => {
        const ri = k.round ?? 0;
        if (!killsByRound[ri]) killsByRound[ri] = [];
        killsByRound[ri].push(k);
      });
      Object.values(killsByRound).forEach((rk: any[]) => {
        const sorted = [...rk].sort((a,b) => (a.timeInRound??a.round_time_millis??0)-(b.timeInRound??b.round_time_millis??0));
        if (sorted.length>0) {
          if ((sorted[0].killerPuuid||sorted[0].killer_puuid)===p.puuid) fk++;
          if ((sorted[0].victimPuuid||sorted[0].victim_puuid)===p.puuid) fd++;
        }
      });
      // Multi-kills
      const mk: Record<string,number> = {'2k':0,'3k':0,'4k':0,'5k':0};
      const kkByRound: Record<number,number> = {};
      allKills.forEach((k: any) => {
        if ((k.killerPuuid||k.killer_puuid)===p.puuid) kkByRound[k.round??0]=(kkByRound[k.round??0]||0)+1;
      });
      Object.values(kkByRound).forEach(n => {
        if (n===2) mk['2k']++; else if(n===3) mk['3k']++; else if(n===4) mk['4k']++; else if(n>=5) mk['5k']++;
      });
      // Economía
      let totalLoadout=0, totalSpent=0, totalRemaining=0;
      rounds.forEach((r: any) => {
        const ps = rStats(r).find((s: any) => (s.puuid||s.player_puuid)===p.puuid);
        if (ps) { totalLoadout+=econVal(ps,'loadout'); totalSpent+=econVal(ps,'spent'); totalRemaining+=econVal(ps,'remaining'); }
      });
      return {
        nombre: `${p.name}#${p.tag}`,
        equipo: p.team || '',
        agente: p.agent || p.character || '',
        rango:  p.tier  || p.currenttier_patched || '—',
        kills, deaths, assists,
        kd: deaths>0 ? +(kills/deaths).toFixed(2) : kills,
        acs: Math.round(score/nRounds),
        score,
        hs_pct: shots>0 ? Math.round(hs/shots*100) : 0,
        bs_pct: shots>0 ? Math.round(bs/shots*100) : 0,
        ls_pct: shots>0 ? Math.round(ls/shots*100) : 0,
        adr:    p.damage_made ? Math.round(p.damage_made/nRounds) : null,
        daño_hecho:    p.damage_made     || null,
        daño_recibido: p.damage_received || null,
        first_kills: fk, first_deaths: fd, fk_net: fk-fd,
        multikills: mk,
        economia: {
          avg_loadout:   Math.round(totalLoadout/nRounds),
          avg_gastado:   Math.round(totalSpent/nRounds),
          avg_restante:  Math.round(totalRemaining/nRounds),
          total_loadout: totalLoadout,
          total_gastado: totalSpent,
        },
        habilidades: p.abilityCasts || p.ability_casts || {},
      };
    });

    // Economía por ronda
    const econByRound = rounds.map((r: any, i: number) => {
      const stats = rStats(r);
      const blue  = stats.filter((ps: any) => psTeam(ps)==='Blue');
      const red   = stats.filter((ps: any) => psTeam(ps)==='Red');
      const sum   = (arr: any[], f: string) => arr.reduce((s,ps)=>s+econVal(ps,f),0);
      const pData = stats.map((ps: any) => ({
        nombre: ps.displayName||ps.player_display_name||'',
        equipo: psTeam(ps),
        loadout: econVal(ps,'loadout'), gastado: econVal(ps,'spent'),
        restante: econVal(ps,'remaining'), arma: econVal(ps,'weapon'), armadura: econVal(ps,'armor'),
      }));
      const winTeam = r.winningTeam||r.winning_team||'';
      return {
        ronda: i+1,
        gana: winTeam,
        tipo_fin: r.endType||r.end_type||'',
        planta: !!(r.bombPlanted??r.bomb_planted??r.plant_events),
        site:   r.plant?.site||r.plant_events?.plant_site||'',
        defuse: !!(r.bombDefused??r.bomb_defused??r.defuse_events),
        blue_loadout:   sum(blue,'loadout'),
        red_loadout:    sum(red,'loadout'),
        blue_gastado:   sum(blue,'spent'),
        red_gastado:    sum(red,'spent'),
        blue_restante:  sum(blue,'remaining'),
        red_restante:   sum(red,'remaining'),
        jugadores: pData,
      };
    });

    const output = {
      _exportado: new Date().toISOString(),
      _fuente: 'ValoAnalytics Pro — Henrik API',
      partido: {
        id:    matchDetail.matchId || meta.matchid || '',
        mapa:  meta.map || '',
        modo:  meta.mode || '',
        fecha: meta.gameStartPatched || meta.game_start_patched || '',
        duracion_ms: meta.gameLength || meta.game_length || 0,
        rondas: nRounds,
        resultado: {
          blue: { gana: teams.blue?.hasWon??teams.blue?.has_won??false, rondas: teams.blue?.roundsWon??teams.blue?.rounds_won??0 },
          red:  { gana: teams.red?.hasWon ??teams.red?.has_won ??false, rondas: teams.red?.roundsWon ??teams.red?.rounds_won ??0 },
        },
      },
      jugadores: playerStats,
      economia_por_ronda: econByRound,
      kills: allKills.map((k: any) => ({
        ronda: k.round,
        tiempo_ms: k.timeInRound??k.round_time_millis,
        asesino: k.killerName||k.killer_display_name||'',
        asesino_equipo: k.killerTeam||k.killer_team||'',
        victima: k.victimName||k.victim_display_name||'',
        victima_equipo: k.victimTeam||k.victim_team||'',
        arma: k.weaponName||k.damage_weapon_name||'',
      })),
    };

    const blob = new Blob([JSON.stringify(output, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    const mapSlug = (meta.map||'match').toLowerCase().replace(/\s+/g,'-');
    a.href = url;
    a.download = `valoanalytics_${mapSlug}_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id:'scoreboard', label:'Scoreboard', icon:<Users className="w-4 h-4"/> },
    { id:'timeline',   label:'Timeline',   icon:<Activity className="w-4 h-4"/> },
    { id:'killfeed',   label:'Kill Feed',  icon:<Skull className="w-4 h-4"/> },
    { id:'economy',    label:'Economía',   icon:<BarChart3 className="w-4 h-4"/> },
    { id:'replay',     label:'Replay',     icon:<PlayCircle className="w-4 h-4"/> },
    { id:'rounds',     label:'Rondas',     icon:<ChevronDown className="w-4 h-4"/> },
    { id:'heatmap',    label:'Heatmap',    icon:<Flame className="w-4 h-4"/> },
  ];

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 p-6">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-black">Match Viewer</h2>
          <p className="text-sm text-muted-foreground">Match Viewer vía HenrikDev API</p>
        </div>
        <div className="flex items-center gap-2">
          <div className={cn('w-2 h-2 rounded-full', apiKey ? 'bg-green-500' : 'bg-yellow-500')} />
          <span className="text-xs text-muted-foreground">{apiKey ? 'API Key configurada' : 'Sin API Key (rate-limit bajo)'}</span>
        </div>
      </div>

      {/* Panel de búsqueda */}
      {!matchDetail && (
        <div className="glass-card p-5 space-y-4">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Buscar jugador</h3>

          <div className="flex flex-wrap gap-3 items-end">
            {/* Nombre */}
            <div className="flex-1 min-w-[140px]">
              <label className="text-xs text-muted-foreground mb-1 block">Nombre</label>
              <input
                type="text" placeholder="NombreJugador"
                value={name} onChange={e => setName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && loadHistory()}
                className="w-full rounded-xl border px-3 py-2.5 text-sm"
                style={{background:'hsl(220 15% 10%)',borderColor:'hsl(220 15% 20%)'}}
              />
            </div>

            {/* Tag */}
            <div className="w-28">
              <label className="text-xs text-muted-foreground mb-1 block">Tag</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">#</span>
                <input
                  type="text" placeholder="EUW"
                  value={tag} onChange={e => setTag(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && loadHistory()}
                  className="w-full rounded-xl border pl-7 pr-3 py-2.5 text-sm"
                  style={{background:'hsl(220 15% 10%)',borderColor:'hsl(220 15% 20%)'}}
                />
              </div>
            </div>

            {/* Región */}
            <div className="w-36">
              <label className="text-xs text-muted-foreground mb-1 block">Región</label>
              <select value={region} onChange={e => setRegion(e.target.value)}
                className="w-full rounded-xl border px-3 py-2.5 text-sm"
                style={{background:'hsl(220 15% 10%)',borderColor:'hsl(220 15% 20%)'}}>
                <option value="eu">EU (Europa)</option>
                <option value="na">NA (Norteamérica)</option>
                <option value="ap">AP (Asia-Pacífico)</option>
                <option value="kr">KR (Corea)</option>
                <option value="latam">LATAM</option>
                <option value="br">BR (Brasil)</option>
              </select>
            </div>

            {/* Modo */}
            <div className="w-36">
              <label className="text-xs text-muted-foreground mb-1 block">Modo</label>
              <select value={modeFilter} onChange={e => setModeFilter(e.target.value)}
                className="w-full rounded-xl border px-3 py-2.5 text-sm"
                style={{background:'hsl(220 15% 10%)',borderColor:'hsl(220 15% 20%)'}}>
                <option value="">Todos</option>
                <option value="competitive">Competitive</option>
                <option value="unrated">Unrated</option>
                <option value="custom">Custom Game</option>
                <option value="spikerush">Spike Rush</option>
                <option value="premier">Premier</option>
                <option value="deathmatch">Deathmatch</option>
              </select>
            </div>

            {/* Cantidad */}
            <div className="w-32">
              <label className="text-xs text-muted-foreground mb-1 block">Últimos</label>
              <select value={sizeFilter} onChange={e => setSizeFilter(e.target.value)}
                className="w-full rounded-xl border px-3 py-2.5 text-sm"
                style={{background:'hsl(220 15% 10%)',borderColor:'hsl(220 15% 20%)'}}>
                <option value="5">5 partidos</option>
                <option value="10">10 partidos</option>
                <option value="15">15 partidos</option>
                <option value="20">20 partidos</option>
              </select>
            </div>

            {/* Botón buscar */}
            <button onClick={loadHistory} disabled={loadingHistory}
              className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-50 text-sm font-bold flex items-center gap-2 transition-all">
              {loadingHistory
                ? <><Loader2 className="w-4 h-4 animate-spin"/>Buscando...</>
                : <><Search className="w-4 h-4"/>Buscar</>}
            </button>
          </div>

          {error && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">⚠️ {error}</div>
          )}

          {/* Aviso si no hay API key */}
          {!apiKey && (
            <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/8 p-3 text-xs text-yellow-300">
              💡 Sin API Key de Henrik el límite es 30 req/min. Añádela en <strong>Player Lookup → Configurar API Key</strong> para mayor estabilidad.
            </div>
          )}
        </div>
      )}

      {/* Lista de partidos */}
      {matchHistory.length > 0 && !matchDetail && (
        <div className="glass-card p-4 space-y-2">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            {matchHistory.length} partidos — {name}#{tag}
          </h3>
          {matchHistory.map((m: any, idx: number) => {
            // Henrik v3 devuelve cada partido con metadata y players
            const meta     = m.metadata || {};
            const matchId  = meta.matchid || m.matchId || m.MatchID || '';
            const mapName  = meta.map     || m.map     || '—';
            const mode     = meta.mode    || m.mode    || '';
            const started  = meta.game_start_patched || meta.gameStartPatched || '';
            const gameLen  = meta.game_length         || meta.gameLength       || 0;
            const isLoading = loadingMatch === matchId;

            // Buscar al jugador buscado en este partido para mostrar resultado
            const allP: any[] = m.players?.all_players || m.players?.all || [];
            const me = allP.find((p: any) =>
              p.name?.toLowerCase() === name.toLowerCase() &&
              (p.tag?.toLowerCase() === tag.toLowerCase() || !tag));
            const myTeam  = me?.team || '';
            const blueWon = m.teams?.blue?.has_won ?? m.teams?.blue?.hasWon ?? false;
            const won     = myTeam === 'Blue' ? blueWon : (myTeam === 'Red' ? !blueWon : null);
            const blueScore = m.teams?.blue?.rounds_won ?? m.teams?.blue?.roundsWon ?? 0;
            const redScore  = m.teams?.red?.rounds_won  ?? m.teams?.red?.roundsWon  ?? 0;
            const scoreStr  = myTeam === 'Blue' ? `${blueScore}–${redScore}` : myTeam === 'Red' ? `${redScore}–${blueScore}` : `${blueScore}–${redScore}`;
            const myAcs  = me?.stats?.score && meta.rounds_played ? Math.round(me.stats.score / meta.rounds_played) : null;
            const myKda  = me ? `${me.stats?.kills||0}/${me.stats?.deaths||0}/${me.stats?.assists||0}` : null;
            const agentIcon = me?.assets?.agent?.killfeed || me?.agentKillfeed || '';

            return (
              <button key={matchId || idx}
                onClick={() => matchId && loadMatch(matchId)}
                disabled={!!loadingMatch || !matchId}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border hover:bg-white/5 disabled:opacity-50 transition-all text-left"
                style={{borderColor: won === true ? 'hsl(142 60% 30% / 0.4)' : won === false ? 'hsl(0 60% 30% / 0.4)' : 'hsl(220 15% 18%)'}}>

                {/* Agente */}
                <div className="w-9 h-9 rounded-lg overflow-hidden shrink-0 flex items-center justify-center"
                  style={{background:'hsl(220 15% 12%)'}}>
                  {isLoading
                    ? <Loader2 className="w-4 h-4 animate-spin text-red-400"/>
                    : agentIcon
                      ? <img src={agentIcon} className="w-8 h-8 object-cover" alt=""/>
                      : <Activity className="w-4 h-4 text-muted-foreground"/>}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-sm">{mapName}</p>
                    <span className="text-[10px] text-muted-foreground border border-white/10 px-1.5 py-0.5 rounded">{mode}</span>
                    {won !== null && (
                      <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded', won ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400')}>
                        {won ? 'V' : 'D'}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{started}</p>
                </div>

                {/* Stats */}
                <div className="text-right shrink-0 space-y-0.5">
                  {scoreStr !== '0–0' && <p className="text-sm font-bold">{scoreStr}</p>}
                  {myKda    && <p className="text-[10px] font-mono text-muted-foreground">{myKda}</p>}
                  {myAcs    && <p className="text-[10px] text-yellow-400">{myAcs} ACS</p>}
                </div>

                <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0"/>
              </button>
            );
          })}
        </div>
      )}

      {/* Detalle del partido */}
      {matchDetail && (() => {
        const meta   = matchDetail.metadata || {};
        const teams  = matchDetail.teams    || {};
        const blueWon   = teams.blue?.hasWon    ?? teams.blue?.has_won    ?? false;
        const blueScore = teams.blue?.roundsWon ?? teams.blue?.rounds_won ?? 0;
        const redScore  = teams.red?.roundsWon  ?? teams.red?.rounds_won  ?? 0;

        return (
          <div className="space-y-4">
            {/* Header del partido */}
            <div className="glass-card p-5">
              <div className="flex items-start justify-between flex-wrap gap-3">
                <div>
                  <button onClick={() => setMatchDetail(null)}
                    className="text-xs text-muted-foreground hover:text-white mb-2 flex items-center gap-1 transition-colors">
                    ← Volver a la lista
                  </button>
                  <h3 className="text-xl font-black">{meta.map || meta.map_id}</h3>
                  <p className="text-sm text-muted-foreground">
                    {meta.mode} · {meta.gameStartPatched || meta.game_start_patched} · {formatMs(meta.gameLength || meta.game_length)}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  {/* Marcador */}
                  <div className="text-center">
                    <div className="flex items-center gap-3">
                      <div className="text-center">
                        <p className={cn('text-3xl font-black', blueWon ? 'text-blue-400' : 'text-blue-400/50')}>{blueScore}</p>
                        <p className="text-[10px] text-blue-400/70">Blue</p>
                      </div>
                      <span className="text-xl text-muted-foreground/40">–</span>
                      <div className="text-center">
                        <p className={cn('text-3xl font-black', !blueWon ? 'text-red-400' : 'text-red-400/50')}>{redScore}</p>
                        <p className="text-[10px] text-red-400/70">Red</p>
                      </div>
                    </div>
                  </div>
                  {/* Botones exportar */}
                  <div className="flex gap-2">
                    <button onClick={exportToMatches}
                      className={cn('px-3 py-2 rounded-xl text-xs font-bold border transition-all',
                        exportedId ? 'bg-green-500/20 border-green-500/40 text-green-400'
                                   : 'bg-white/5 border-white/10 hover:bg-white/10')}>
                      {exportedId ? '✓ Guardado' : '↑ Guardar'}
                    </button>
                    <button onClick={exportFullJSON}
                      className="px-3 py-2 rounded-xl text-xs font-bold border border-white/10 bg-white/5 hover:bg-white/10 transition-all flex items-center gap-1.5">
                      ⬇ JSON
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex flex-wrap gap-1 border-b border-white/10 pb-1">
              {tabs.map(t => (
                <button key={t.id} onClick={() => setActiveTab(t.id)}
                  className={cn('flex items-center gap-1.5 px-3 py-2 rounded-t-lg text-xs font-medium transition-all',
                    activeTab === t.id
                      ? 'bg-red-500/15 border border-red-500/30 border-b-transparent text-white'
                      : 'text-muted-foreground hover:text-white hover:bg-white/5')}>
                  {t.icon}{t.label}
                </button>
              ))}
            </div>

            {/* Contenido del tab */}
            <div>
              {activeTab === 'scoreboard' && <ScoreboardTab match={matchDetail} focusPuuid={focusPuuid} setFocusPuuid={setFocusPuuid}/>}
              {activeTab === 'timeline'   && <TimelineTab   match={matchDetail}/>}
              {activeTab === 'killfeed'   && <KillFeedTab   match={matchDetail} focusPuuid={focusPuuid}/>}
              {activeTab === 'economy'    && <EconomyTab    match={matchDetail}/>}
              {activeTab === 'replay'     && <ReplayTab     match={matchDetail}/>}
              {activeTab === 'rounds'     && <RoundsTab     match={matchDetail}/>}
              {activeTab === 'heatmap'    && <HeatmapTab    match={matchDetail} focusPuuid={focusPuuid} setFocusPuuid={setFocusPuuid}/>}
            </div>
          </div>
        );
      })()}

    </div>
  );
}
