import { useState, useMemo } from 'react';
import { 
  Target, 
  Users, 
  Swords,
  Zap,
  Activity,
  BarChart3,
  ArrowRightLeft
} from 'lucide-react';
import { 
  Radar, 
  RadarChart, 
  PolarGrid, 
  PolarAngleAxis, 
  PolarRadiusAxis,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip
} from 'recharts';
import { useAppStore } from '@/store/appStore';
import { type PlayerStats } from '@/types';
import { cn } from '@/lib/utils';

function calculateRadarData(player: PlayerStats, allPlayers: PlayerStats[]) {
  // Calculate per-round stats for fair comparison
  const fkPerRound = player.rounds > 0 ? player.fk / player.rounds : 0;
  const assistsPerRound = player.rounds > 0 ? player.a / player.rounds : 0;
  const objPerRound = player.rounds > 0 ? (player.plants + player.defuses) / player.rounds : 0;
  
  // Calculate percentiles for each stat
  const sortedACS = [...allPlayers].sort((a, b) => a.acsAvg - b.acsAvg);
  const sortedKD = [...allPlayers].sort((a, b) => a.kd - b.kd);
  const sortedKAST = [...allPlayers].sort((a, b) => a.kastAvg - b.kastAvg);
  const sortedEntry = [...allPlayers].sort((a, b) => {
    const aFkPr = a.rounds > 0 ? a.fk / a.rounds : 0;
    const bFkPr = b.rounds > 0 ? b.fk / b.rounds : 0;
    return aFkPr - bFkPr;
  });
  const sortedAssists = [...allPlayers].sort((a, b) => {
    const aApr = a.rounds > 0 ? a.a / a.rounds : 0;
    const bApr = b.rounds > 0 ? b.a / b.rounds : 0;
    return aApr - bApr;
  });
  const sortedObj = [...allPlayers].sort((a, b) => {
    const aObj = a.rounds > 0 ? (a.plants + a.defuses) / a.rounds : 0;
    const bObj = b.rounds > 0 ? (b.plants + b.defuses) / b.rounds : 0;
    return aObj - bObj;
  });

  const getPercentile = (sorted: PlayerStats[], value: number, getter: (p: PlayerStats) => number) => {
    const index = sorted.findIndex(p => getter(p) >= value);
    return index === -1 ? 100 : (index / sorted.length) * 100;
  };

  const acsP = getPercentile(sortedACS, player.acsAvg, p => p.acsAvg);
  const kdP = getPercentile(sortedKD, player.kd, p => p.kd);
  const kastP = getPercentile(sortedKAST, player.kastAvg, p => p.kastAvg);
  const entryP = getPercentile(sortedEntry, fkPerRound, p => p.rounds > 0 ? p.fk / p.rounds : 0);
  const assistsP = getPercentile(sortedAssists, assistsPerRound, p => p.rounds > 0 ? p.a / p.rounds : 0);
  const objP = getPercentile(sortedObj, objPerRound, p => p.rounds > 0 ? (p.plants + p.defuses) / p.rounds : 0);

  return [
    { subject: 'Firepower', A: Math.min(acsP * 0.6 + kdP * 0.4, 100), B: 0, fullMark: 100 },
    { subject: 'Entry', A: Math.min(entryP, 100), B: 0, fullMark: 100 },
    { subject: 'Consistency', A: Math.min(kastP, 100), B: 0, fullMark: 100 },
    { subject: 'Teamplay', A: Math.min(assistsP * 0.7 + kastP * 0.3, 100), B: 0, fullMark: 100 },
    { subject: 'Objective', A: Math.min(objP, 100), B: 0, fullMark: 100 },
  ];
}

function calculateComparisonData(p1: PlayerStats, p2: PlayerStats, allPlayers: PlayerStats[]) {
  const data1 = calculateRadarData(p1, allPlayers);
  const data2 = calculateRadarData(p2, allPlayers);
  
  return data1.map((d, i) => ({
    subject: d.subject,
    [p1.name]: d.A,
    [p2.name]: data2[i].A,
    fullMark: 100
  }));
}

export function Comparison() {
  const { getPlayerStats, filters } = useAppStore();
  const [player1Name, setPlayer1Name] = useState('');
  const [player2Name, setPlayer2Name] = useState('');

  const players = getPlayerStats(filters.matchType);
  const playerNames = players.map(p => p.name).sort();

  const player1 = players.find(p => p.name === player1Name);
  const player2 = players.find(p => p.name === player2Name);

  const radarData = useMemo(() => {
    if (!player1 || !player2) return null;
    return calculateComparisonData(player1, player2, players);
  }, [player1, player2, players]);

  const barData = useMemo(() => {
    if (!player1 || !player2) return [];
    return [
      { name: 'ACS', [player1.name]: player1.acsAvg, [player2.name]: player2.acsAvg },
      { name: 'K/D x100', [player1.name]: player1.kd * 100, [player2.name]: player2.kd * 100 },
      { name: 'KAST', [player1.name]: player1.kastAvg, [player2.name]: player2.kastAvg },
      { name: 'Rating x100', [player1.name]: player1.rating * 100, [player2.name]: player2.rating * 100 },
    ];
  }, [player1, player2]);

  const getStatComparison = (stat: keyof PlayerStats) => {
    if (!player1 || !player2) return null;
    const v1 = player1[stat] as number;
    const v2 = player2[stat] as number;
    const diff = v1 - v2;
    const winner = diff > 0 ? 1 : diff < 0 ? 2 : 0;
    return { v1, v2, diff, winner };
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Player Selectors */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="glass-card p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center">
              <span className="text-red-400 font-bold">1</span>
            </div>
            <h3 className="font-semibold">Jugador 1</h3>
          </div>
          <select
            value={player1Name}
            onChange={(e) => setPlayer1Name(e.target.value)}
            className="input-pro w-full"
          >
            <option value="">Seleccionar jugador</option>
            {playerNames.map(name => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
          
          {player1 && (
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg bg-white/5">
                <p className="text-xs text-muted-foreground">ACS</p>
                <p className="text-xl font-mono font-bold">{player1.acsAvg.toFixed(0)}</p>
              </div>
              <div className="p-3 rounded-lg bg-white/5">
                <p className="text-xs text-muted-foreground">K/D</p>
                <p className="text-xl font-mono font-bold">{player1.kd.toFixed(2)}</p>
              </div>
              <div className="p-3 rounded-lg bg-white/5">
                <p className="text-xs text-muted-foreground">KAST</p>
                <p className="text-xl font-mono font-bold">{player1.kastAvg.toFixed(0)}%</p>
              </div>
              <div className="p-3 rounded-lg bg-white/5">
                <p className="text-xs text-muted-foreground">Rating</p>
                <p className="text-xl font-mono font-bold text-red-400">{player1.rating.toFixed(3)}</p>
              </div>
            </div>
          )}
        </div>

        <div className="glass-card p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
              <span className="text-blue-400 font-bold">2</span>
            </div>
            <h3 className="font-semibold">Jugador 2</h3>
          </div>
          <select
            value={player2Name}
            onChange={(e) => setPlayer2Name(e.target.value)}
            className="input-pro w-full"
          >
            <option value="">Seleccionar jugador</option>
            {playerNames.map(name => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
          
          {player2 && (
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg bg-white/5">
                <p className="text-xs text-muted-foreground">ACS</p>
                <p className="text-xl font-mono font-bold">{player2.acsAvg.toFixed(0)}</p>
              </div>
              <div className="p-3 rounded-lg bg-white/5">
                <p className="text-xs text-muted-foreground">K/D</p>
                <p className="text-xl font-mono font-bold">{player2.kd.toFixed(2)}</p>
              </div>
              <div className="p-3 rounded-lg bg-white/5">
                <p className="text-xs text-muted-foreground">KAST</p>
                <p className="text-xl font-mono font-bold">{player2.kastAvg.toFixed(0)}%</p>
              </div>
              <div className="p-3 rounded-lg bg-white/5">
                <p className="text-xs text-muted-foreground">Rating</p>
                <p className="text-xl font-mono font-bold text-blue-400">{player2.rating.toFixed(3)}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Comparison Content */}
      {player1 && player2 && radarData && (
        <div className="space-y-6">
          {/* Radar Chart */}
          <div className="glass-card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold flex items-center gap-2">
                <Activity className="w-5 h-5 text-purple-400" />
                Comparación de Perfiles
              </h3>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                  <span className="text-sm">{player1.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-blue-500" />
                  <span className="text-sm">{player2.name}</span>
                </div>
              </div>
            </div>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData}>
                  <PolarGrid stroke="hsl(220 15% 20%)" />
                  <PolarAngleAxis 
                    dataKey="subject" 
                    tick={{ fill: 'hsl(215 15% 55%)', fontSize: 12 }}
                  />
                  <PolarRadiusAxis 
                    angle={90} 
                    domain={[0, 100]} 
                    tick={false}
                    axisLine={false}
                  />
                  <Radar
                    name={player1.name}
                    dataKey={player1.name}
                    stroke="#ef4444"
                    strokeWidth={2}
                    fill="#ef4444"
                    fillOpacity={0.2}
                  />
                  <Radar
                    name={player2.name}
                    dataKey={player2.name}
                    stroke="#3b82f6"
                    strokeWidth={2}
                    fill="#3b82f6"
                    fillOpacity={0.2}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      background: 'hsl(220 22% 8%)',
                      border: '1px solid hsl(220 15% 20%)',
                      borderRadius: '8px'
                    }}
                    formatter={(value: number) => [`${value.toFixed(0)}`, 'Percentil']}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Bar Chart */}
          <div className="glass-card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-green-400" />
                Estadísticas Principales
              </h3>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 15% 20%)" />
                  <XAxis dataKey="name" stroke="hsl(215 15% 55%)" fontSize={12} />
                  <YAxis stroke="hsl(215 15% 55%)" fontSize={12} />
                  <Tooltip 
                    contentStyle={{ 
                      background: 'hsl(220 22% 8%)',
                      border: '1px solid hsl(220 15% 20%)',
                      borderRadius: '8px'
                    }}
                  />
                  <Bar dataKey={player1.name} fill="#ef4444" radius={[4, 4, 0, 0]} />
                  <Bar dataKey={player2.name} fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Detailed Comparison */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Combat Stats */}
            <div className="glass-card p-5">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Swords className="w-5 h-5 text-red-400" />
                Estadísticas de Combate
              </h3>
              <div className="space-y-3">
                {[
                  { label: 'ACS', key: 'acsAvg', format: (v: number) => v.toFixed(0) },
                  { label: 'K/D Ratio', key: 'kd', format: (v: number) => v.toFixed(2) },
                  { label: 'Kills Promedio', key: 'avgKills', format: (v: number) => v.toFixed(1) },
                  { label: 'Deaths Promedio', key: 'avgDeaths', format: (v: number) => v.toFixed(1) },
                ].map(({ label, key, format }) => {
                  const comp = getStatComparison(key as keyof PlayerStats);
                  if (!comp) return null;
                  return (
                    <div key={key} className="flex items-center justify-between p-3 rounded-lg bg-white/5">
                      <span className="text-sm text-muted-foreground">{label}</span>
                      <div className="flex items-center gap-4">
                        <span className={cn(
                          "font-mono font-bold",
                          comp.winner === 1 ? "text-red-400" : "text-muted-foreground"
                        )}>
                          {format(comp.v1)}
                        </span>
                        <ArrowRightLeft className="w-4 h-4 text-muted-foreground" />
                        <span className={cn(
                          "font-mono font-bold",
                          comp.winner === 2 ? "text-blue-400" : "text-muted-foreground"
                        )}>
                          {format(comp.v2)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Entry Stats */}
            <div className="glass-card p-5">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Zap className="w-5 h-5 text-yellow-400" />
                Entry & Impacto
              </h3>
              <div className="space-y-3">
                {[
                  { label: 'First Kills', key: 'fk', format: (v: number) => v.toString() },
                  { label: 'First Deaths', key: 'fd', format: (v: number) => v.toString() },
                  { label: 'FK Net', key: 'fkNet', format: (v: number) => (v > 0 ? '+' : '') + v },
                  { label: 'Impact Score', key: 'impact', format: (v: number) => v.toFixed(2) },
                ].map(({ label, key, format }) => {
                  const comp = getStatComparison(key as keyof PlayerStats);
                  if (!comp) return null;
                  return (
                    <div key={key} className="flex items-center justify-between p-3 rounded-lg bg-white/5">
                      <span className="text-sm text-muted-foreground">{label}</span>
                      <div className="flex items-center gap-4">
                        <span className={cn(
                          "font-mono font-bold",
                          comp.winner === 1 ? "text-red-400" : "text-muted-foreground"
                        )}>
                          {format(comp.v1)}
                        </span>
                        <ArrowRightLeft className="w-4 h-4 text-muted-foreground" />
                        <span className={cn(
                          "font-mono font-bold",
                          comp.winner === 2 ? "text-blue-400" : "text-muted-foreground"
                        )}>
                          {format(comp.v2)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Teamplay Stats */}
            <div className="glass-card p-5">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Users className="w-5 h-5 text-cyan-400" />
                Teamplay
              </h3>
              <div className="space-y-3">
                {[
                  { label: 'KAST %', key: 'kastAvg', format: (v: number) => v.toFixed(0) + '%' },
                  { label: 'Asistencias', key: 'a', format: (v: number) => v.toString() },
                  { label: 'Asistencias/Partido', key: 'avgAssists', format: (v: number) => v.toFixed(1) },
                  { label: 'Consistencia', key: 'consistency', format: (v: number) => v.toFixed(0) + '%' },
                ].map(({ label, key, format }) => {
                  const comp = getStatComparison(key as keyof PlayerStats);
                  if (!comp) return null;
                  return (
                    <div key={key} className="flex items-center justify-between p-3 rounded-lg bg-white/5">
                      <span className="text-sm text-muted-foreground">{label}</span>
                      <div className="flex items-center gap-4">
                        <span className={cn(
                          "font-mono font-bold",
                          comp.winner === 1 ? "text-red-400" : "text-muted-foreground"
                        )}>
                          {format(comp.v1)}
                        </span>
                        <ArrowRightLeft className="w-4 h-4 text-muted-foreground" />
                        <span className={cn(
                          "font-mono font-bold",
                          comp.winner === 2 ? "text-blue-400" : "text-muted-foreground"
                        )}>
                          {format(comp.v2)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Objective Stats */}
            <div className="glass-card p-5">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Target className="w-5 h-5 text-green-400" />
                Objetivos
              </h3>
              <div className="space-y-3">
                {[
                  { label: 'Plants', key: 'plants', format: (v: number) => v.toString() },
                  { label: 'Defuses', key: 'defuses', format: (v: number) => v.toString() },
                  { label: 'Win Rate', key: 'winRate', format: (v: number) => v.toFixed(1) + '%' },
                  { label: 'Partidos', key: 'matches', format: (v: number) => v.toString() },
                ].map(({ label, key, format }) => {
                  const comp = getStatComparison(key as keyof PlayerStats);
                  if (!comp) return null;
                  return (
                    <div key={key} className="flex items-center justify-between p-3 rounded-lg bg-white/5">
                      <span className="text-sm text-muted-foreground">{label}</span>
                      <div className="flex items-center gap-4">
                        <span className={cn(
                          "font-mono font-bold",
                          comp.winner === 1 ? "text-red-400" : "text-muted-foreground"
                        )}>
                          {format(comp.v1)}
                        </span>
                        <ArrowRightLeft className="w-4 h-4 text-muted-foreground" />
                        <span className={cn(
                          "font-mono font-bold",
                          comp.winner === 2 ? "text-blue-400" : "text-muted-foreground"
                        )}>
                          {format(comp.v2)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {!player1 || !player2 && (
        <div className="glass-card p-8 text-center text-muted-foreground">
          <Users className="w-16 h-16 mx-auto mb-4 opacity-50" />
          <p className="text-lg">Selecciona dos jugadores para comparar</p>
        </div>
      )}
    </div>
  );
}
