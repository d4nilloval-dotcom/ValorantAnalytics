import { useState, useMemo } from 'react';
import { 
  Search, 
  ChevronDown,
  ChevronUp,
  Radar as RadarIcon
} from 'lucide-react';
import { 
  Radar, 
  RadarChart, 
  PolarGrid, 
  PolarAngleAxis, 
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip
} from 'recharts';
import { useAppStore } from '@/store/appStore';
import { type PlayerStats as PlayerStatsType, type AgentRole } from '@/types';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

const sortOptions = [
  { value: 'rating', label: 'Rating VLR' },
  { value: 'acs', label: 'ACS Promedio' },
  { value: 'kd', label: 'K/D Ratio' },
  { value: 'kast', label: 'KAST %' },
  { value: 'matches', label: 'Partidos' },
  { value: 'winRate', label: 'Win Rate' },
];

function getRoleColor(role: AgentRole): string {
  switch (role) {
    case 'Duelist': return '#ef4444';
    case 'Controller': return '#a855f7';
    case 'Initiator': return '#06b6d4';
    case 'Sentinel': return '#22c55e';
    default: return '#6b7280';
  }
}

function calculateRadarData(player: PlayerStatsType, allPlayers: PlayerStatsType[]) {
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

  const getPercentile = (sorted: PlayerStatsType[], value: number, getter: (p: PlayerStatsType) => number) => {
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
    { subject: 'Firepower', A: Math.min(acsP * 0.6 + kdP * 0.4, 100), fullMark: 100 },
    { subject: 'Entry', A: Math.min(entryP, 100), fullMark: 100 },
    { subject: 'Consistency', A: Math.min(kastP, 100), fullMark: 100 },
    { subject: 'Teamplay', A: Math.min(assistsP * 0.7 + kastP * 0.3, 100), fullMark: 100 },
    { subject: 'Objective', A: Math.min(objP, 100), fullMark: 100 },
    // Add HS and ADR axes only when tournament data is available
    ...(player.avgHsPercent !== undefined ? [{ subject: 'HS%', A: Math.min((player.avgHsPercent / 40) * 100, 100), fullMark: 100 }] : []),
    ...(player.avgAdr !== undefined ? [{ subject: 'ADR', A: Math.min((player.avgAdr / 200) * 100, 100), fullMark: 100 }] : []),
  ];
}

function PlayerRadarModal({ player, allPlayers }: { player: PlayerStatsType; allPlayers: PlayerStatsType[] }) {
  const radarData = calculateRadarData(player, allPlayers);
  const agentEntries = Object.entries(player.agentPool).sort((a, b) => b[1] - a[1]);

  return (
    <DialogContent className="max-w-3xl"
      style={{ background: 'hsl(220 22% 8%)', border: '1px solid hsl(220 15% 20%)' }}
    >
      <DialogHeader>
        <DialogTitle className="flex items-center gap-3">
          <span className="text-xl">{player.name}</span>
          <span 
            className="px-2 py-0.5 rounded text-xs"
            style={{ 
              background: `${getRoleColor(player.dominantRole)}20`,
              color: getRoleColor(player.dominantRole)
            }}
          >
            {player.dominantRole}
          </span>
        </DialogTitle>
      </DialogHeader>
      
      <div className="grid grid-cols-2 gap-6 mt-4">
        {/* Radar Chart */}
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
                name={player.name}
                dataKey="A"
                stroke="#ef4444"
                strokeWidth={2}
                fill="#ef4444"
                fillOpacity={0.3}
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

        {/* Stats Breakdown */}
        <div className="space-y-4">
          <div className="glass-card p-4">
            <h4 className="font-medium mb-3 text-sm text-muted-foreground">Estadísticas Principales</h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-muted-foreground">ACS</p>
                <p className="text-lg font-mono font-bold">{player.acsAvg.toFixed(0)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">K/D</p>
                <p className={cn(
                  "text-lg font-mono font-bold",
                  player.kd >= 1.2 ? "text-green-400" :
                  player.kd >= 1.0 ? "text-yellow-400" :
                  "text-red-400"
                )}>
                  {player.kd.toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">KAST</p>
                <p className="text-lg font-mono font-bold">{player.kastAvg.toFixed(0)}%</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Rating</p>
                <p className="text-lg font-mono font-bold text-red-400">{player.rating.toFixed(3)}</p>
              </div>
            </div>
          </div>

          <div className="glass-card p-4">
            <h4 className="font-medium mb-3 text-sm text-muted-foreground">Pool de Agentes</h4>
            <div className="space-y-2">
              {agentEntries.slice(0, 5).map(([agent, count]) => (
                <div key={agent} className="flex items-center justify-between">
                  <span className="text-sm">{agent}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-2 rounded-full bg-white/10 overflow-hidden">
                      <div 
                        className="h-full rounded-full bg-red-500"
                        style={{ width: `${(count / player.matches) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground w-8 text-right">{count}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="glass-card p-4">
            <h4 className="font-medium mb-3 text-sm text-muted-foreground">Rendimiento</h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-muted-foreground">Partidos</p>
                <p className="text-lg font-mono">{player.matches}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Win Rate</p>
                <p className="text-lg font-mono">{player.winRate.toFixed(1)}%</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">FK - FD</p>
                <p className="text-lg font-mono">{player.fk} - {player.fd}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Objetivos</p>
                <p className="text-lg font-mono">{player.plants + player.defuses}</p>
              </div>
            </div>
          </div>

          {/* Tournament Stats */}
          {player.tournamentMatches && player.tournamentMatches > 0 && (
            <div className="glass-card p-4 border border-yellow-500/30">
              <h4 className="font-medium mb-3 text-sm text-yellow-400 flex items-center gap-2">
                🏆 Stats Torneo/Premier ({player.tournamentMatches} partidos)
              </h4>
              <div className="grid grid-cols-2 gap-3">
                {player.avgHsPercent !== undefined && (
                  <div>
                    <p className="text-xs text-muted-foreground">HS%</p>
                    <p className={cn("text-lg font-mono font-bold",
                      player.avgHsPercent >= 30 ? "text-green-400" : player.avgHsPercent >= 20 ? "text-yellow-400" : "text-red-400"
                    )}>{player.avgHsPercent.toFixed(1)}%</p>
                  </div>
                )}
                {player.avgMultiKills !== undefined && (
                  <div>
                    <p className="text-xs text-muted-foreground">Multi-Kills</p>
                    <p className="text-lg font-mono font-bold text-purple-400">{player.avgMultiKills.toFixed(1)}</p>
                  </div>
                )}
                {player.avgAdr !== undefined && (
                  <div>
                    <p className="text-xs text-muted-foreground">ADR</p>
                    <p className={cn("text-lg font-mono font-bold",
                      player.avgAdr >= 150 ? "text-green-400" : player.avgAdr >= 120 ? "text-yellow-400" : "text-red-400"
                    )}>{player.avgAdr.toFixed(0)}</p>
                  </div>
                )}
                {player.avgEconRating !== undefined && (
                  <div>
                    <p className="text-xs text-muted-foreground">Econ Rating</p>
                    <p className={cn("text-lg font-mono font-bold",
                      player.avgEconRating >= 70 ? "text-green-400" : player.avgEconRating >= 50 ? "text-yellow-400" : "text-red-400"
                    )}>{player.avgEconRating.toFixed(0)}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </DialogContent>
  );
}

export function PlayerStats() {
  const { getPlayerStats, filters, setFilters } = useAppStore();
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('rating');
  const [sortDesc, setSortDesc] = useState(true);
  const [selectedRole, setSelectedRole] = useState<AgentRole | 'ALL'>('ALL');
  const [minMatches, setMinMatches] = useState(0);

  const players = getPlayerStats(filters.matchType);

  const filteredPlayers = useMemo(() => {
    let list = [...players];
    
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(p => p.name.toLowerCase().includes(q));
    }
    
    if (selectedRole !== 'ALL') {
      list = list.filter(p => p.dominantRole === selectedRole);
    }

    if (minMatches > 0) {
      list = list.filter(p => p.matches >= minMatches);
    }
    
    list.sort((a, b) => {
      let valA: number, valB: number;
      switch (sortBy) {
        case 'acs': valA = a.acsAvg; valB = b.acsAvg; break;
        case 'kd': valA = a.kd; valB = b.kd; break;
        case 'kast': valA = a.kastAvg; valB = b.kastAvg; break;
        case 'matches': valA = a.matches; valB = b.matches; break;
        case 'winRate': valA = a.winRate; valB = b.winRate; break;
        case 'rating':
        default: valA = a.rating; valB = b.rating; break;
      }
      return sortDesc ? valB - valA : valA - valB;
    });
    
    return list;
  }, [players, search, sortBy, sortDesc, selectedRole, minMatches]);

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortDesc(!sortDesc);
    } else {
      setSortBy(field);
      setSortDesc(true);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Filters */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar jugador..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-pro pl-10 w-48"
            />
          </div>
          
          <select
            value={filters.matchType}
            onChange={(e) => setFilters({ matchType: e.target.value as any })}
            className="input-pro"
          >
            <option value="ALL">Todos los tipos</option>
            <option value="SCRIM">SCRIM</option>
            <option value="PREMIER">PREMIER</option>
            <option value="OFICIAL">OFICIAL</option>
          </select>
          
          <select
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value as AgentRole | 'ALL')}
            className="input-pro"
          >
            <option value="ALL">Todos los roles</option>
            <option value="Duelist">Duelist</option>
            <option value="Controller">Controller</option>
            <option value="Initiator">Initiator</option>
            <option value="Sentinel">Sentinel</option>
          </select>

          <select value={minMatches} onChange={e=>setMinMatches(+e.target.value)} className="input-pro">
            <option value={0}>Todos los partidos</option>
            <option value={3}>Mín. 3 partidos</option>
            <option value={5}>Mín. 5 partidos</option>
            <option value={10}>Mín. 10 partidos</option>
            <option value={20}>Mín. 20 partidos</option>
          </select>
        </div>
        
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Ordenar por:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="input-pro"
          >
            {sortOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <button
            onClick={() => setSortDesc(!sortDesc)}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
          >
            {sortDesc ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Stats Table */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-xs text-muted-foreground uppercase"
                style={{ background: 'hsl(220 20% 9%)' }}
              >
                <th className="py-3 px-3 cursor-pointer hover:text-foreground" onClick={() => handleSort('rating')}>
                  # {sortBy === 'rating' && (sortDesc ? '↓' : '↑')}
                </th>
                <th className="py-3 px-3">Jugador</th>
                <th className="py-3 px-3">Rol</th>
                <th className="py-3 px-3 cursor-pointer hover:text-foreground" onClick={() => handleSort('matches')}>
                  Partidos {sortBy === 'matches' && (sortDesc ? '↓' : '↑')}
                </th>
                <th className="py-3 px-3 cursor-pointer hover:text-foreground" onClick={() => handleSort('acs')}>
                  ACS {sortBy === 'acs' && (sortDesc ? '↓' : '↑')}
                </th>
                <th className="py-3 px-3 cursor-pointer hover:text-foreground" onClick={() => handleSort('kd')}>
                  K/D {sortBy === 'kd' && (sortDesc ? '↓' : '↑')}
                </th>
                <th className="py-3 px-3 cursor-pointer hover:text-foreground" onClick={() => handleSort('kast')}>
                  KAST {sortBy === 'kast' && (sortDesc ? '↓' : '↑')}
                </th>
                <th className="py-3 px-3">FK/FD</th>
                <th className="py-3 px-3">Win%</th>
                <th className="py-3 px-3 cursor-pointer hover:text-foreground" onClick={() => handleSort('rating')}>
                  Rating {sortBy === 'rating' && (sortDesc ? '↓' : '↑')}
                </th>
                <th className="py-3 px-3">Radar</th>
              </tr>
            </thead>
            <tbody>
              {filteredPlayers.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-8 text-center text-muted-foreground">
                    No hay jugadores registrados
                  </td>
                </tr>
              ) : (
                filteredPlayers.map((player, i) => (
                  <tr key={player.name} className="border-t border-border/50 hover:bg-white/5">
                    <td className="py-3 px-3">
                      <span className={cn(
                        "w-6 h-6 rounded flex items-center justify-center text-xs font-bold",
                        i === 0 ? "bg-yellow-500/20 text-yellow-400" :
                        i === 1 ? "bg-gray-400/20 text-gray-400" :
                        i === 2 ? "bg-orange-600/20 text-orange-400" :
                        "text-muted-foreground"
                      )}>
                        {i + 1}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-medium">{player.name}</td>
                    <td className="py-3 px-3">
                      <span 
                        className="px-2 py-0.5 rounded text-xs"
                        style={{ 
                          background: `${getRoleColor(player.dominantRole)}20`,
                          color: getRoleColor(player.dominantRole)
                        }}
                      >
                        {player.dominantRole}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-muted-foreground">{player.matches}</td>
                    <td className="py-3 px-3 font-mono">{player.acsAvg.toFixed(0)}</td>
                    <td className={cn(
                      "py-3 px-3 font-mono",
                      player.kd >= 1.2 ? "text-green-400" :
                      player.kd >= 1.0 ? "text-yellow-400" :
                      "text-red-400"
                    )}>
                      {player.kd.toFixed(2)}
                    </td>
                    <td className="py-3 px-3 font-mono">{player.kastAvg.toFixed(0)}%</td>
                    <td className="py-3 px-3 font-mono text-sm">
                      <span className={player.fkNet > 0 ? 'text-green-400' : player.fkNet < 0 ? 'text-red-400' : ''}>
                        {player.fkNet > 0 ? '+' : ''}{player.fkNet}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-mono">{player.winRate.toFixed(0)}%</td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-500/10 text-red-400">
                        {player.rating.toFixed(3)}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <Dialog>
                        <DialogTrigger asChild>
                          <button className="p-2 rounded-lg hover:bg-white/10 transition-colors">
                            <RadarIcon className="w-4 h-4" />
                          </button>
                        </DialogTrigger>
                        <PlayerRadarModal player={player} allPlayers={players} />
                      </Dialog>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
