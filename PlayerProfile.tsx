import { useState, useMemo } from 'react';
import {
  TrendingUp, TrendingDown, Minus, Target, Shield,
  Swords, Zap, Trophy, ChevronLeft, User
} from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import { cn } from '@/lib/utils';
import { VALORANT_MAPS } from '@/types';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, RadarChart, Radar, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis, AreaChart, Area
} from 'recharts';

function getWeekKey(date: string): string {
  const d = new Date(date);
  const year = d.getFullYear();
  const startOfYear = new Date(year, 0, 1);
  const week = Math.ceil(((d.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7);
  return `${year}-W${String(week).padStart(2, '0')}`;
}

const ROLE_COLORS: Record<string, string> = {
  Duelist: '#ff4655', Controller: '#6366f1', Initiator: '#f59e0b',
  Sentinel: '#22c55e', Unknown: '#6b7280'
};

export function PlayerProfile() {
  const { matches, players, getPlayerStats } = useAppStore();
  const allStats = getPlayerStats('ALL');
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);
  const [statTab, setStatTab] = useState<'evolution' | 'maps' | 'agents' | 'radar'>('evolution');

  const playerNames = useMemo(() => allStats.map(s => s.name).sort(), [allStats]);

  const playerData = useMemo(() => {
    if (!selectedPlayer) return null;

    // Collect all match appearances
    const matchAppearances: {
      matchId: string; date: string; map: string; won: boolean;
      k: number; d: number; a: number; kast: number; acs: number;
      fk: number; fd: number; plants: number; defuses: number; agent: string;
    }[] = [];

    for (const [matchId, playerList] of Object.entries(players)) {
      const match = matches[matchId];
      if (!match) continue;
      const p = playerList.find(pl => pl.name === selectedPlayer);
      if (!p) continue;
      matchAppearances.push({
        matchId, date: match.date, map: match.map, won: match.won,
        k: p.k, d: p.d, a: p.a, kast: p.kast, acs: p.acs,
        fk: p.fk, fd: p.fd, plants: p.plants, defuses: p.defuses,
        agent: p.agent,
      });
    }
    matchAppearances.sort((a, b) => a.date.localeCompare(b.date));

    // Weekly evolution
    const byWeek: Record<string, { acs: number[]; kd: number[]; kast: number[]; wins: number; total: number }> = {};
    matchAppearances.forEach(m => {
      const wk = getWeekKey(m.date);
      if (!byWeek[wk]) byWeek[wk] = { acs: [], kd: [], kast: [], wins: 0, total: 0 };
      byWeek[wk].acs.push(m.acs);
      byWeek[wk].kd.push(m.d > 0 ? m.k / m.d : m.k);
      byWeek[wk].kast.push(m.kast);
      byWeek[wk].total++;
      if (m.won) byWeek[wk].wins++;
    });
    const weeklyData = Object.entries(byWeek).sort(([a], [b]) => a.localeCompare(b)).map(([week, w]) => ({
      week: week.replace(/\d{4}-/, ''),
      acs: Math.round(w.acs.reduce((s, v) => s + v, 0) / w.acs.length),
      kd: parseFloat((w.kd.reduce((s, v) => s + v, 0) / w.kd.length).toFixed(2)),
      kast: Math.round(w.kast.reduce((s, v) => s + v, 0) / w.kast.length),
      wr: Math.round(w.wins / w.total * 100),
    }));

    // Map performance
    const byMap: Record<string, { acs: number[]; wins: number; total: number }> = {};
    matchAppearances.forEach(m => {
      if (!byMap[m.map]) byMap[m.map] = { acs: [], wins: 0, total: 0 };
      byMap[m.map].acs.push(m.acs);
      byMap[m.map].total++;
      if (m.won) byMap[m.map].wins++;
    });
    const mapData = Object.entries(byMap)
      .map(([map, d]) => ({
        map, total: d.total,
        acs: Math.round(d.acs.reduce((s, v) => s + v, 0) / d.acs.length),
        wr: Math.round(d.wins / d.total * 100),
      }))
      .sort((a, b) => b.total - a.total);

    // Agent pool
    const byAgent: Record<string, { count: number; wins: number; acs: number[] }> = {};
    matchAppearances.forEach(m => {
      if (!m.agent) return;
      if (!byAgent[m.agent]) byAgent[m.agent] = { count: 0, wins: 0, acs: [] };
      byAgent[m.agent].count++;
      byAgent[m.agent].acs.push(m.acs);
      if (m.won) byAgent[m.agent].wins++;
    });
    const agentData = Object.entries(byAgent)
      .map(([agent, d]) => ({
        agent, count: d.count,
        acs: Math.round(d.acs.reduce((s, v) => s + v, 0) / d.acs.length),
        wr: Math.round(d.wins / d.count * 100),
      }))
      .sort((a, b) => b.count - a.count);

    // Global stats
    const stats = allStats.find(s => s.name === selectedPlayer)!;

    // ── Radar normalizado correctamente (todos los valores 0-100) ──────────────
    const m = Math.max(stats.matches, 1);
    const r = Math.max(stats.rounds,  1);

    // AIM: ACS promedio. 250+ ACS es élite. Usamos 240 como techo natural.
    const aimVal = Math.min(Math.round((stats.acsAvg / 240) * 100), 100);

    // ENTRY: FK neto POR PARTIDO (no acumulado). ±1/partido es bastante.
    // -1/partido → ~17%   0/partido → 50%   +1/partido → 83%   +2/partido → 100%
    const fkNetPerMatch = stats.fkNet / m;
    const entryVal = Math.min(Math.max(Math.round(50 + fkNetPerMatch * 33), 0), 100);

    // KAST: ya es %, usarlo directo (clamp por si acaso)
    const kastVal = Math.min(Math.round(stats.kastAvg), 100);

    // WINRATE: ya es % (0-100)
    const wrVal = Math.min(Math.round(stats.winRate), 100);

    // IMPACTO: compuesto KD + ACS + FK/ronda
    const kdN   = Math.min(stats.kd / 1.8, 1.0);
    const acsN  = Math.min(stats.acsAvg / 220, 1.0);
    const fkRnd = stats.rounds > 0 ? stats.fk / r : 0;
    const fkN   = Math.min(fkRnd / 0.22, 1.0);
    const hasFk = stats.fk > 0 || stats.fd > 0;

    // Si no hay datos K/D/ACS (match manual sin stats), usar WR como base mínima
    const hasKdData = stats.k > 0 || stats.d > 0;
    let impactoVal: number;
    if (!hasKdData) {
      // Sin kills/deaths: usar WR normalizado (50% WR → 50 puntos)
      impactoVal = Math.min(Math.round(stats.winRate), 100);
    } else if (hasFk) {
      impactoVal = Math.min(Math.round((kdN * 0.35 + acsN * 0.35 + fkN * 0.30) * 100), 100);
    } else {
      impactoVal = Math.min(Math.round((kdN * 0.50 + acsN * 0.50) * 100), 100);
    }

    // OBJETIVOS: plantas+defuses POR PARTIDO. 1/partido es sólido, 2+ es mucho.
    const objPerM = (stats.plants + stats.defuses) / m;
    const objVal  = Math.min(Math.round(objPerM * 50), 100);

    const radarData = [
      { axis: 'Aim',       value: aimVal,     desc: `ACS ${Math.round(stats.acsAvg)}` },
      { axis: 'Entry',     value: entryVal,   desc: `FK net ${fkNetPerMatch >= 0 ? '+' : ''}${fkNetPerMatch.toFixed(2)}/p` },
      { axis: 'KAST',      value: kastVal,    desc: `${Math.round(stats.kastAvg)}%` },
      { axis: 'Win Rate',  value: wrVal,      desc: `${Math.round(stats.winRate)}%` },
      { axis: 'Impacto',   value: impactoVal, desc: `KD ${stats.kd.toFixed(2)}` },
      { axis: 'Objetivos', value: objVal,     desc: `${objPerM.toFixed(2)}/partido` },
    ];

    // Form (last 5 matches)
    const last5 = matchAppearances.slice(-5).reverse();

    return { matchAppearances, weeklyData, mapData, agentData, stats, radarData, last5 };
  }, [selectedPlayer, matches, players, allStats]);

  const trend = useMemo(() => {
    if (!playerData || playerData.weeklyData.length < 2) return null;
    const last = playerData.weeklyData[playerData.weeklyData.length - 1];
    const prev = playerData.weeklyData[playerData.weeklyData.length - 2];
    return {
      acs: last.acs - prev.acs,
      kd: parseFloat((last.kd - prev.kd).toFixed(2)),
      kast: last.kast - prev.kast,
    };
  }, [playerData]);

  const TrendIcon = ({ val }: { val: number }) =>
    val > 0 ? <TrendingUp className="w-3 h-3 text-green-400" /> :
    val < 0 ? <TrendingDown className="w-3 h-3 text-red-400" /> :
    <Minus className="w-3 h-3 text-muted-foreground" />;

  if (!selectedPlayer || !playerData) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="glass-card p-6">
          <h2 className="text-xl font-bold mb-2 flex items-center gap-2">
            <User className="w-5 h-5 text-red-400" /> Perfiles de Jugador
          </h2>
          <p className="text-sm text-muted-foreground mb-6">Selecciona un jugador para ver su evolución detallada.</p>
          {playerNames.length === 0 ? (
            <p className="text-muted-foreground text-sm italic">No hay jugadores registrados. Añade partidos con jugadores primero.</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {playerNames.map(name => {
                const s = allStats.find(x => x.name === name)!;
                return (
                  <button key={name} onClick={() => setSelectedPlayer(name)}
                    className="glass-card p-4 text-left hover:border-red-500/40 transition-all group">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center mb-3 text-lg font-bold"
                      style={{ background: ROLE_COLORS[s?.dominantRole || 'Unknown'] + '30', color: ROLE_COLORS[s?.dominantRole || 'Unknown'] }}>
                      {name[0].toUpperCase()}
                    </div>
                    <p className="font-bold text-sm truncate group-hover:text-white transition-colors">{name}</p>
                    <p className="text-xs text-muted-foreground">{s?.dominantAgent || '—'}</p>
                    <div className="mt-2 flex gap-2 text-xs">
                      <span className="text-yellow-400 font-mono">{s?.acsAvg?.toFixed(0) || '0'} ACS</span>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">{s?.matches || 0} partidos</div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  const { stats, weeklyData, mapData, agentData, radarData, last5 } = playerData;

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="glass-card p-5">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <button onClick={() => setSelectedPlayer(null)}
              className="p-2 rounded-lg hover:bg-white/10 transition-colors text-muted-foreground hover:text-white">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="w-14 h-14 rounded-xl flex items-center justify-center text-2xl font-black"
              style={{ background: ROLE_COLORS[stats?.dominantRole || 'Unknown'] + '25', color: ROLE_COLORS[stats?.dominantRole || 'Unknown'] }}>
              {selectedPlayer[0].toUpperCase()}
            </div>
            <div>
              <h2 className="text-2xl font-black text-white">{selectedPlayer}</h2>
              <p className="text-sm text-muted-foreground">{stats?.dominantRole} · {stats?.dominantAgent}</p>
            </div>
          </div>
          {/* Form last 5 */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground mr-1">Últimos 5:</span>
            {last5.map((m, i) => (
              <div key={i} title={`${m.map} · ACS ${m.acs} · ${m.k}/${m.d}/${m.a}`}
                className={cn("w-7 h-7 rounded flex items-center justify-center text-xs font-bold border",
                  m.won ? 'bg-green-500/20 border-green-500/40 text-green-400' : 'bg-red-500/20 border-red-500/40 text-red-400')}>
                {m.won ? 'W' : 'L'}
              </div>
            ))}
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mt-5">
          {[
            { label: 'Partidos', value: stats?.matches, color: 'text-white' },
            { label: 'ACS', value: stats?.acsAvg?.toFixed(0), color: 'text-yellow-400', trend: trend?.acs },
            { label: 'K/D', value: stats?.kd?.toFixed(2), color: stats?.kd >= 1 ? 'text-green-400' : 'text-red-400', trend: trend?.kd },
            { label: 'KAST', value: `${stats?.kastAvg?.toFixed(0)}%`, color: 'text-blue-400', trend: trend?.kast },
            { label: 'Win Rate', value: `${stats?.winRate?.toFixed(0)}%`, color: stats?.winRate >= 50 ? 'text-green-400' : 'text-red-400' },
            { label: 'Rating', value: stats?.rating?.toFixed(2), color: stats?.rating >= 1.0 ? 'text-green-400' : 'text-yellow-400' },
            { label: 'FK Net', value: stats?.fkNet >= 0 ? `+${stats?.fkNet}` : String(stats?.fkNet), color: stats?.fkNet >= 0 ? 'text-green-400' : 'text-red-400' },
          ].map(({ label, value, color, trend: t }) => (
            <div key={label} className="rounded-xl p-3 text-center" style={{ background: 'hsl(220 15% 10%)' }}>
              <p className="text-xs text-muted-foreground mb-1">{label}</p>
              <div className="flex items-center justify-center gap-1">
                <p className={cn("text-lg font-black", color)}>{value ?? '—'}</p>
                {t !== undefined && <TrendIcon val={Number(t)} />}
              </div>
              {t !== undefined && <p className={cn("text-[10px]", Number(t) > 0 ? 'text-green-400' : 'text-red-400')}>{Number(t) > 0 ? '+' : ''}{t}</p>}
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'hsl(220 15% 12%)' }}>
        {([
          { id: 'evolution', label: '📈 Evolución' },
          { id: 'maps', label: '🗺 Por Mapa' },
          { id: 'agents', label: '🎭 Agentes' },
          { id: 'radar', label: '🕸 Radar' },
        ] as const).map(t => (
          <button key={t.id} onClick={() => setStatTab(t.id)}
            className={cn("flex-1 py-2 rounded-lg text-sm font-medium transition-all",
              statTab === t.id ? 'bg-red-500/15 border border-red-500/30 text-white' : 'text-muted-foreground hover:text-foreground')}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Evolution */}
      {statTab === 'evolution' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="glass-card p-5">
            <h3 className="font-semibold mb-4 text-yellow-400 flex items-center gap-2"><TrendingUp className="w-4 h-4" />ACS Semanal</h3>
            {weeklyData.length < 2 ? <p className="text-sm text-muted-foreground">Necesitas más semanas de datos.</p> : (
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={weeklyData}>
                    <defs>
                      <linearGradient id="acsGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#eab308" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#eab308" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 15% 20%)" />
                    <XAxis dataKey="week" stroke="hsl(215 15% 55%)" fontSize={11} />
                    <YAxis stroke="hsl(215 15% 55%)" fontSize={11} domain={['auto', 'auto']} />
                    <Tooltip contentStyle={{ background: 'hsl(220 22% 8%)', border: '1px solid hsl(220 15% 20%)', borderRadius: 8 }} />
                    <Area type="monotone" dataKey="acs" stroke="#eab308" strokeWidth={2} fill="url(#acsGrad)" dot={{ fill: '#eab308', strokeWidth: 0, r: 3 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
          <div className="glass-card p-5">
            <h3 className="font-semibold mb-4 text-blue-400 flex items-center gap-2"><Target className="w-4 h-4" />K/D y KAST Semanal</h3>
            {weeklyData.length < 2 ? <p className="text-sm text-muted-foreground">Necesitas más semanas de datos.</p> : (
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={weeklyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 15% 20%)" />
                    <XAxis dataKey="week" stroke="hsl(215 15% 55%)" fontSize={11} />
                    <YAxis yAxisId="kd" stroke="hsl(215 15% 55%)" fontSize={11} domain={['auto', 'auto']} />
                    <YAxis yAxisId="kast" orientation="right" stroke="hsl(215 15% 55%)" fontSize={11} domain={[0, 100]} />
                    <Tooltip contentStyle={{ background: 'hsl(220 22% 8%)', border: '1px solid hsl(220 15% 20%)', borderRadius: 8 }} />
                    <Line yAxisId="kd" type="monotone" dataKey="kd" stroke="#22c55e" strokeWidth={2} dot={{ fill: '#22c55e', strokeWidth: 0, r: 3 }} name="K/D" />
                    <Line yAxisId="kast" type="monotone" dataKey="kast" stroke="#6366f1" strokeWidth={2} dot={{ fill: '#6366f1', strokeWidth: 0, r: 3 }} name="KAST%" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
          {/* Match history table */}
          <div className="glass-card p-5 lg:col-span-2">
            <h3 className="font-semibold mb-4">Historial de Partidos</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-xs text-muted-foreground uppercase border-b border-white/10">
                  <th className="py-2 px-2">Fecha</th><th className="py-2 px-2">Mapa</th><th className="py-2 px-2">Agente</th>
                  <th className="py-2 px-2">Res.</th><th className="py-2 px-2">ACS</th><th className="py-2 px-2">K/D/A</th><th className="py-2 px-2">KAST</th>
                </tr></thead>
                <tbody>
                  {[...playerData.matchAppearances].reverse().slice(0, 20).map((m, i) => (
                    <tr key={i} className="border-t border-white/5 hover:bg-white/5">
                      <td className="py-2 px-2 text-muted-foreground">{m.date}</td>
                      <td className="py-2 px-2 font-medium">{m.map}</td>
                      <td className="py-2 px-2 text-muted-foreground">{m.agent || '—'}</td>
                      <td className="py-2 px-2">
                        <span className={cn("px-1.5 py-0.5 rounded text-xs font-bold", m.won ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400')}>{m.won ? 'W' : 'L'}</span>
                      </td>
                      <td className="py-2 px-2 font-mono text-yellow-400 font-bold">{m.acs}</td>
                      <td className="py-2 px-2 font-mono">{m.k}/{m.d}/{m.a}</td>
                      <td className="py-2 px-2 font-mono text-blue-400">{m.kast}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Maps */}
      {statTab === 'maps' && (
        <div className="glass-card p-5">
          <h3 className="font-semibold mb-4">Rendimiento por Mapa</h3>
          {mapData.length === 0 ? <p className="text-sm text-muted-foreground">Sin datos de mapa.</p> : (
            <div className="space-y-3">
              {mapData.map(m => (
                <div key={m.map} className="flex items-center gap-4 p-3 rounded-lg" style={{ background: 'hsl(220 15% 10%)' }}>
                  <div className="w-28 font-bold text-sm">{m.map}</div>
                  <div className="text-xs text-muted-foreground w-16">{m.total} partidos</div>
                  <div className="flex-1 relative h-6 rounded overflow-hidden" style={{ background: 'hsl(220 15% 15%)' }}>
                    <div className="absolute top-0 left-0 h-full rounded transition-all"
                      style={{ width: `${m.wr}%`, background: m.wr >= 60 ? '#22c55e' : m.wr >= 45 ? '#eab308' : '#ef4444', opacity: 0.7 }} />
                    <span className="absolute inset-0 flex items-center justify-center text-xs font-bold">{m.wr}% WR</span>
                  </div>
                  <div className="text-yellow-400 font-mono text-sm w-20 text-right">{m.acs} ACS</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Agents */}
      {statTab === 'agents' && (
        <div className="glass-card p-5">
          <h3 className="font-semibold mb-4">Pool de Agentes</h3>
          {agentData.length === 0 ? <p className="text-sm text-muted-foreground">Sin datos de agentes.</p> : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {agentData.map(a => (
                <div key={a.agent} className="rounded-xl p-4 border border-white/10" style={{ background: 'hsl(220 15% 10%)' }}>
                  <div className="text-2xl mb-2 text-center">
                    {a.agent === 'Jett' ? '💨' : a.agent === 'Raze' ? '💥' : a.agent === 'Reyna' ? '👁' :
                     a.agent === 'Sova' ? '🏹' : a.agent === 'Killjoy' ? '⚙️' : a.agent === 'Cypher' ? '🕵️' :
                     a.agent === 'Sage' ? '💚' : a.agent === 'Brimstone' ? '🔥' : a.agent === 'Viper' ? '☠️' :
                     a.agent === 'Omen' ? '👻' : '🎭'}
                  </div>
                  <p className="text-center font-bold text-sm">{a.agent}</p>
                  <p className="text-center text-xs text-muted-foreground">{a.count} partidos</p>
                  <div className="mt-2 flex justify-between text-xs">
                    <span className={cn("font-bold", a.wr >= 50 ? 'text-green-400' : 'text-red-400')}>{a.wr}% WR</span>
                    <span className="text-yellow-400 font-mono">{a.acs} ACS</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Radar */}
      {statTab === 'radar' && (
        <div className="glass-card p-5">
          <h3 className="font-semibold mb-4">Perfil de Habilidades</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData}>
                <PolarGrid stroke="hsl(220 15% 25%)" />
                <PolarAngleAxis dataKey="axis" tick={{ fill: 'hsl(215 15% 65%)', fontSize: 12 }} />
                <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                <Radar dataKey="value" stroke="#ff4655" fill="#ff4655" fillOpacity={0.25} strokeWidth={2} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-3 gap-3 mt-2">
            {radarData.map(r => (
              <div key={r.axis} className="text-center">
                <p className="text-xs text-muted-foreground">{r.axis}</p>
                <p className={cn("text-lg font-bold", r.value >= 70 ? 'text-green-400' : r.value >= 45 ? 'text-yellow-400' : 'text-red-400')}>{r.value}</p>
                <p className="text-[10px] text-muted-foreground/60">{(r as any).desc}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
