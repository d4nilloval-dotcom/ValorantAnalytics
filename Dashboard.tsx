import { useMemo } from 'react';
import {
  TrendingUp, TrendingDown, Target, Shield, Swords, Trophy,
  Calendar, Map as MapIcon, Activity, AlertTriangle,
  Flame, Bell, Check, ChevronRight, Zap, Users,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Cell,
} from 'recharts';
import { useAppStore } from '@/store/appStore';
import { VALORANT_MAPS } from '@/types';
import { cn } from '@/lib/utils';

/* ─── helpers ────────────────────────────────────────────────────── */
function getWeekKey(d: Date) {
  const c = new Date(d); c.setHours(0,0,0,0);
  c.setDate(c.getDate() - c.getDay() + 1);
  return c.toISOString().split('T')[0];
}
function loadGoals() {
  try { return JSON.parse(localStorage.getItem('valoanalytics_goals_v1') || '[]'); } catch { return []; }
}
function loadNotifs() {
  try {
    const all = JSON.parse(localStorage.getItem('valoanalytics_notifications_v1') || '[]');
    return all.filter((n: any) => !n.read);
  } catch { return []; }
}

/* ─── sub-componentes ────────────────────────────────────────────── */
function Stat({ label, value, sub, color = 'white' }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="glass-card p-4 rounded-2xl flex flex-col gap-1">
      <p className="text-[11px] uppercase tracking-widest text-muted-foreground font-medium">{label}</p>
      <p className={cn('text-2xl font-black tabular-nums', `text-${color}`)}>{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

function MatchPill({ won, map, score, date }: { won: boolean; map: string; score: string; date: string }) {
  return (
    <div className={cn(
      'flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all',
      won
        ? 'border-green-500/20 bg-green-500/5'
        : 'border-red-500/20 bg-red-500/5'
    )}>
      <div className={cn('w-2 h-2 rounded-full shrink-0', won ? 'bg-green-400' : 'bg-red-400')} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate">{map}</p>
        <p className="text-[10px] text-muted-foreground">{date}</p>
      </div>
      <span className={cn('font-mono text-sm font-black', won ? 'text-green-400' : 'text-red-400')}>{score}</span>
    </div>
  );
}

/* ─── Dashboard principal ────────────────────────────────────────── */
export function Dashboard() {
  const { getFilteredMatches, getMapStats, getPlayerStats, filters, setFilters } = useAppStore();

  const matches     = getFilteredMatches();
  const mapStats    = getMapStats(filters.matchType);
  const playerStats = getPlayerStats(filters.matchType);
  const goals       = loadGoals();
  const unreadNotifs = loadNotifs();

  /* ── KPIs globales ── */
  const kpis = useMemo(() => {
    const total  = matches.length;
    const wins   = matches.filter(m => m.won).length;
    const losses = total - wins;
    const wr     = total > 0 ? (wins / total) * 100 : 0;

    // Esta semana
    const thisWeek = getWeekKey(new Date());
    const weekMatches = matches.filter(m => getWeekKey(new Date(m.date)) === thisWeek);
    const weekWins    = weekMatches.filter(m => m.won).length;
    const weekWR      = weekMatches.length > 0 ? Math.round(weekWins / weekMatches.length * 100) : null;

    // Últimas 5 vs anteriores 5
    const last5     = matches.slice(-5);
    const prev5     = matches.slice(-10, -5);
    const last5WR   = last5.length  > 0 ? Math.round(last5.filter(m=>m.won).length  / last5.length  * 100) : 0;
    const prev5WR   = prev5.length  > 0 ? Math.round(prev5.filter(m=>m.won).length  / prev5.length  * 100) : 0;
    const trend     = last5WR - prev5WR;

    // Racha actual
    let streak = 0;
    const sorted = [...matches].sort((a,b)=>new Date(a.date).getTime()-new Date(b.date).getTime());
    for (let i = sorted.length - 1; i >= 0; i--) {
      if (i === sorted.length - 1) { streak = sorted[i].won ? 1 : -1; continue; }
      if (sorted[i].won && streak > 0) streak++;
      else if (!sorted[i].won && streak < 0) streak--;
      else break;
    }

    return { total, wins, losses, wr, weekWR, weekMatches: weekMatches.length, trend, streak, last5WR };
  }, [matches]);

  /* ── Jugador más en forma (últimos 5 partidos disponibles) ── */
  const hotPlayer = useMemo(() => {
    if (playerStats.length === 0) return null;
    // Usar rating como proxy de "forma"
    return [...playerStats].sort((a, b) => b.rating - a.rating)[0];
  }, [playerStats]);

  /* ── Mapa más problemático ── */
  const worstMap = useMemo(() => {
    return [...mapStats]
      .filter(m => m.matches >= 2)
      .sort((a, b) => a.winPct - b.winPct)[0] || null;
  }, [mapStats]);

  /* ── Mapa más ganado ── */
  const bestMap = useMemo(() => {
    return [...mapStats]
      .filter(m => m.matches >= 2)
      .sort((a, b) => b.winPct - a.winPct)[0] || null;
  }, [mapStats]);

  /* ── Últimos 5 partidos ── */
  const last5Matches = useMemo(() => {
    return [...matches]
      .sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 5);
  }, [matches]);

  /* ── Gráfico de rendimiento (últimos 15) ── */
  const perfChart = useMemo(() => {
    const sorted = [...matches]
      .sort((a,b) => new Date(a.date).getTime()-new Date(b.date).getTime())
      .slice(-15);
    let cumWins = 0;
    return sorted.map((m, i) => {
      cumWins += m.won ? 1 : 0;
      return {
        idx: i + 1,
        nosotros: m.scoreUs,
        rival: m.scoreOpp,
        wr: Math.round(cumWins / (i + 1) * 100),
        map: m.map,
        result: m.won ? 'V' : 'D',
      };
    });
  }, [matches]);

  /* ── Mapa win-rate chart ── */
  const mapChart = useMemo(() =>
    [...mapStats].sort((a,b) => b.matches - a.matches).slice(0, 7).map(m => ({
      name: m.map.length > 8 ? m.map.slice(0,7)+'…' : m.map,
      fullName: m.map,
      wr: Math.round(m.winPct),
      wins: m.wins,
      losses: m.losses,
    }))
  , [mapStats]);

  /* ── Objetivos activos con current ── */
  const activeGoals = useMemo(() => {
    const ms = getMapStats('ALL');
    const ps = getPlayerStats('ALL');
    const allM = getFilteredMatches();
    return goals.filter((g: any) => !g.completed).slice(0, 4).map((g: any) => {
      let current = 0;
      if (g.type === 'TEAM_WR') current = allM.length > 0 ? Math.round(allM.filter((m:any)=>m.won).length/allM.length*100) : 0;
      else if (g.type === 'MAP_WR') { const m = ms.find((x:any)=>x.map===g.target); current = m ? Math.round(m.winPct) : 0; }
      else if (g.type === 'PLAYER_ACS') { const p = ps.find((x:any)=>x.name===g.target); current = p ? Math.round(p.acsAvg) : 0; }
      else if (g.type === 'PLAYER_KD')  { const p = ps.find((x:any)=>x.name===g.target); current = p ? p.kd : 0; }
      else if (g.type === 'KAST')       { const p = ps.find((x:any)=>x.name===g.target); current = p ? Math.round(p.kastAvg) : 0; }
      else if (g.type === 'WIN_COUNT')  current = allM.filter((m:any)=>m.won).length;
      const pct = Math.min(Math.round((current / g.goal) * 100), 100);
      return { ...g, current, pct };
    });
  }, [goals, matches]);

  /* ── Top jugadores tabla ── */
  const topPlayers = useMemo(() =>
    [...playerStats].sort((a,b) => b.rating - a.rating).slice(0, 5)
  , [playerStats]);

  const tooltipStyle = {
    contentStyle: {
      background: 'hsl(220 22% 8%)',
      border: '1px solid hsl(220 15% 20%)',
      borderRadius: '12px',
      fontSize: 12,
    }
  };

  if (matches.length === 0) return (
    <div className="space-y-6 animate-fade-in">
      <div className="glass-card p-10 flex flex-col items-center justify-center text-center gap-4 rounded-3xl">
        <div className="w-16 h-16 rounded-2xl bg-red-500/15 flex items-center justify-center">
          <Activity className="w-8 h-8 text-red-400" />
        </div>
        <div>
          <h2 className="text-xl font-black mb-1">Sin datos todavía</h2>
          <p className="text-muted-foreground text-sm max-w-sm">
            Añade tu primer partido desde la sección <strong>Partidos</strong> para ver el dashboard completo.
          </p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-5 animate-fade-in">

      {/* ── Filtro tipo ── */}
      <div className="flex items-center gap-3 flex-wrap">
        <select value={filters.matchType} onChange={e => setFilters({ matchType: e.target.value as any })} className="input-pro">
          <option value="ALL">Todos los tipos</option>
          <option value="SCRIM">SCRIM</option>
          <option value="PREMIER">PREMIER</option>
          <option value="OFICIAL">OFICIAL</option>
          <option value="TOURNAMENT">Torneo</option>
        </select>
        <select value={filters.map} onChange={e => setFilters({ map: e.target.value })} className="input-pro">
          <option value="ALL">Todos los mapas</option>
          {VALORANT_MAPS.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        {unreadNotifs.length > 0 && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-xs font-medium ml-auto">
            <Bell className="w-3.5 h-3.5" />
            {unreadNotifs.length} alerta{unreadNotifs.length > 1 ? 's' : ''} sin leer
          </div>
        )}
      </div>

      {/* ── KPIs fila principal ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <Stat label="Partidos" value={kpis.total} sub={`${kpis.wins}V ${kpis.losses}D`} />
        <Stat
          label="Win Rate"
          value={`${kpis.wr.toFixed(1)}%`}
          sub={kpis.trend !== 0 ? `${kpis.trend > 0 ? '↑' : '↓'} ${Math.abs(kpis.trend)}% vs últimos 5` : 'Sin cambio'}
          color={kpis.wr >= 50 ? 'green-400' : 'red-400'}
        />
        <Stat
          label="Esta semana"
          value={kpis.weekWR !== null ? `${kpis.weekWR}%` : '—'}
          sub={kpis.weekMatches > 0 ? `${kpis.weekMatches} partidos` : 'Sin partidos'}
          color={kpis.weekWR !== null ? kpis.weekWR >= 50 ? 'green-400' : 'red-400' : 'white'}
        />
        <Stat
          label="Últimos 5"
          value={`${kpis.last5WR}%`}
          sub="WR reciente"
          color={kpis.last5WR >= 60 ? 'green-400' : kpis.last5WR >= 40 ? 'yellow-400' : 'red-400'}
        />
        <Stat
          label="Racha actual"
          value={kpis.streak === 0 ? '—' : `${kpis.streak > 0 ? '+' : ''}${kpis.streak}`}
          sub={kpis.streak > 1 ? '🔥 victorias' : kpis.streak < -1 ? '❄️ derrotas' : ''}
          color={kpis.streak > 0 ? 'green-400' : kpis.streak < 0 ? 'red-400' : 'white'}
        />
        <Stat
          label="Top Jugador"
          value={hotPlayer?.name?.split(' ')[0] || '—'}
          sub={hotPlayer ? `Rating ${hotPlayer.rating.toFixed(2)}` : ''}
          color="yellow-400"
        />
      </div>

      {/* ── Fila media: últimos partidos + mapa bueno/malo + objetivos ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Últimos 5 partidos */}
        <div className="glass-card p-5 rounded-2xl">
          <h3 className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-3 flex items-center gap-2">
            <Calendar className="w-3.5 h-3.5" /> Últimos partidos
          </h3>
          <div className="space-y-2">
            {last5Matches.length === 0 && <p className="text-muted-foreground text-sm text-center py-4">Sin partidos</p>}
            {last5Matches.map(m => (
              <MatchPill
                key={m.id}
                won={m.won}
                map={m.map}
                score={`${m.scoreUs}-${m.scoreOpp}`}
                date={new Date(m.date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
              />
            ))}
          </div>
        </div>

        {/* Mejor / Peor mapa + player en forma */}
        <div className="flex flex-col gap-3">
          {/* Mejor mapa */}
          {bestMap && (
            <div className="glass-card p-4 rounded-2xl border border-green-500/15 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-green-500/15 flex items-center justify-center shrink-0">
                <Trophy className="w-5 h-5 text-green-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] uppercase tracking-widest text-green-400/70 font-medium">Mejor mapa</p>
                <p className="font-bold truncate">{bestMap.map}</p>
                <p className="text-xs text-muted-foreground">{bestMap.wins}V {bestMap.losses}D · {bestMap.winPct.toFixed(0)}% WR</p>
              </div>
              <span className="text-2xl font-black text-green-400">{bestMap.winPct.toFixed(0)}%</span>
            </div>
          )}
          {/* Peor mapa */}
          {worstMap && (
            <div className="glass-card p-4 rounded-2xl border border-red-500/15 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-500/15 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] uppercase tracking-widest text-red-400/70 font-medium">Mapa problemático</p>
                <p className="font-bold truncate">{worstMap.map}</p>
                <p className="text-xs text-muted-foreground">{worstMap.wins}V {worstMap.losses}D · {worstMap.winPct.toFixed(0)}% WR</p>
              </div>
              <span className="text-2xl font-black text-red-400">{worstMap.winPct.toFixed(0)}%</span>
            </div>
          )}
          {/* Jugador en forma */}
          {hotPlayer && (
            <div className="glass-card p-4 rounded-2xl border border-yellow-500/15 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-yellow-500/15 flex items-center justify-center shrink-0">
                <Flame className="w-5 h-5 text-yellow-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] uppercase tracking-widest text-yellow-400/70 font-medium">Jugador en forma</p>
                <p className="font-bold truncate">{hotPlayer.name}</p>
                <p className="text-xs text-muted-foreground">ACS {hotPlayer.acsAvg.toFixed(0)} · KD {hotPlayer.kd.toFixed(2)} · {hotPlayer.matches}p</p>
              </div>
              <span className="text-lg font-black text-yellow-400">{hotPlayer.rating.toFixed(2)}</span>
            </div>
          )}
        </div>

        {/* Objetivos activos */}
        <div className="glass-card p-5 rounded-2xl">
          <h3 className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-3 flex items-center gap-2">
            <Target className="w-3.5 h-3.5" /> Objetivos activos
          </h3>
          {activeGoals.length === 0 && (
            <p className="text-muted-foreground text-sm text-center py-4">Sin objetivos. Créalos en la sección Objetivos.</p>
          )}
          <div className="space-y-3">
            {activeGoals.map((g: any) => (
              <div key={g.id}>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-medium truncate flex-1 pr-2">{g.title}</p>
                  <span className={cn('text-xs font-bold tabular-nums',
                    g.pct >= 80 ? 'text-green-400' : g.pct >= 50 ? 'text-yellow-400' : 'text-red-400')}>
                    {g.pct}%
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-white/8">
                  <div className="h-full rounded-full transition-all"
                    style={{ width: `${g.pct}%`, background: g.pct >= 80 ? '#22c55e' : g.pct >= 50 ? '#f59e0b' : '#ef4444' }} />
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {typeof g.current === 'number' ? g.current.toFixed(g.type === 'PLAYER_KD' ? 2 : 0) : '—'} / {g.goal}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Gráficos ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Rendimiento últimos 15 */}
        <div className="glass-card p-5 rounded-2xl">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <Activity className="w-4 h-4 text-red-400" /> Rendimiento reciente
            </h3>
            <span className="text-xs text-muted-foreground">Últimos {perfChart.length} partidos</span>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={perfChart} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="gNos" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="gRiv" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 15% 15%)" />
              <XAxis dataKey="idx" tick={{ fontSize: 10, fill: 'hsl(215 15% 50%)' }} />
              <YAxis tick={{ fontSize: 10, fill: 'hsl(215 15% 50%)' }} />
              <Tooltip {...tooltipStyle}
                labelFormatter={(i: number) => `Partido #${i} · ${perfChart[i-1]?.map || ''}`}
                formatter={(v: number, n: string) => [v, n === 'nosotros' ? 'Nosotros' : 'Rival']}
              />
              <Area type="monotone" dataKey="nosotros" stroke="#ef4444" fill="url(#gNos)" strokeWidth={2} dot={false} name="nosotros" />
              <Area type="monotone" dataKey="rival"    stroke="#3b82f6" fill="url(#gRiv)" strokeWidth={2} dot={false} name="rival" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Win rate por mapa */}
        <div className="glass-card p-5 rounded-2xl">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <MapIcon className="w-4 h-4 text-blue-400" /> Win Rate por mapa
            </h3>
            <span className="text-xs text-muted-foreground">Top {mapChart.length} mapas</span>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={mapChart} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 15% 15%)" />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'hsl(215 15% 50%)' }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: 'hsl(215 15% 50%)' }} tickFormatter={v => `${v}%`} />
              <Tooltip {...tooltipStyle}
                formatter={(v: number) => [`${v}%`, 'Win Rate']}
                labelFormatter={(_: any, p: any) => p[0]?.payload?.fullName || ''}
              />
              <Bar dataKey="wr" radius={[6, 6, 0, 0]}>
                {mapChart.map((entry, i) => (
                  <Cell key={i} fill={entry.wr >= 60 ? '#22c55e' : entry.wr >= 50 ? '#f59e0b' : entry.wr >= 40 ? '#ef4444' : '#7f1d1d'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Top jugadores ── */}
      {topPlayers.length > 0 && (
        <div className="glass-card p-5 rounded-2xl">
          <h3 className="font-semibold text-sm flex items-center gap-2 mb-4">
            <Users className="w-4 h-4 text-purple-400" /> Ranking de jugadores
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground border-b" style={{ borderColor: 'hsl(220 15% 15%)' }}>
                  <th className="pb-2 pr-3">#</th>
                  <th className="pb-2 pr-3">Jugador</th>
                  <th className="pb-2 pr-3">Partidos</th>
                  <th className="pb-2 pr-3">ACS</th>
                  <th className="pb-2 pr-3">K/D</th>
                  <th className="pb-2 pr-3">KAST</th>
                  <th className="pb-2 pr-3">WR%</th>
                  <th className="pb-2">Rating</th>
                </tr>
              </thead>
              <tbody>
                {topPlayers.map((p, i) => (
                  <tr key={p.name} className="border-b hover:bg-white/3 transition-all" style={{ borderColor: 'hsl(220 15% 11%)' }}>
                    <td className="py-2.5 pr-3">
                      <span className={cn('w-6 h-6 rounded-lg flex items-center justify-center text-xs font-black',
                        i === 0 ? 'bg-yellow-500/20 text-yellow-400' :
                        i === 1 ? 'bg-zinc-400/20 text-zinc-400' :
                        i === 2 ? 'bg-amber-700/20 text-amber-600' : 'text-muted-foreground/50')}>
                        {i + 1}
                      </span>
                    </td>
                    <td className="py-2.5 pr-3 font-semibold">{p.name}</td>
                    <td className="py-2.5 pr-3 text-muted-foreground">{p.matches}</td>
                    <td className="py-2.5 pr-3 font-mono">{p.acsAvg.toFixed(0)}</td>
                    <td className={cn('py-2.5 pr-3 font-mono', p.kd >= 1.2 ? 'text-green-400' : p.kd >= 1.0 ? 'text-yellow-400' : 'text-red-400')}>
                      {p.kd.toFixed(2)}
                    </td>
                    <td className="py-2.5 pr-3 font-mono">{p.kastAvg.toFixed(0)}%</td>
                    <td className={cn('py-2.5 pr-3 font-mono', p.winRate >= 50 ? 'text-green-400' : 'text-red-400')}>
                      {p.winRate.toFixed(0)}%
                    </td>
                    <td className="py-2.5">
                      <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-red-500/10 text-red-300">
                        {p.rating.toFixed(3)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
