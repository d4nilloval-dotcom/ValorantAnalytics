import { useState, useMemo } from 'react';
import { 
  Users, 
  Plus, 
  Search, 
  BarChart3,
  Calendar,
  Map as MapIcon,
  Edit2,
  Trash2,
  Eye
} from 'lucide-react';
import { useRivalStore } from '@/store/rivalStore';
import { VALORANT_MAPS, VALORANT_AGENTS } from '@/types';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer
} from 'recharts';
import type { RivalTeam, RivalMatch, RivalPlayer } from '@/types/rivals';

const TIERS = [
  { value: 'T1', label: 'Tier 1 (Pro)', color: '#ef4444' },
  { value: 'T2', label: 'Tier 2 (Semi-Pro)', color: '#f97316' },
  { value: 'T3', label: 'Tier 3 (Amateur)', color: '#eab308' },
  { value: 'AMATEUR', label: 'Amateur', color: '#22c55e' },
];

export function Rivals() {
  const { 
    getRivalTeamsList, 
    addRivalTeam, 
    updateRivalTeam, 
    deleteRivalTeam,
    getRivalTeamStats 
  } = useRivalStore();
  
  const [search, setSearch] = useState('');
  const [filterTier, setFilterTier] = useState<string>('ALL');
  const [selectedTeam, setSelectedTeam] = useState<RivalTeam | null>(null);
  const [showTeamDialog, setShowTeamDialog] = useState(false);
  const [editingTeam, setEditingTeam] = useState<RivalTeam | null>(null);
  
  const teams = getRivalTeamsList();
  
  const filteredTeams = useMemo(() => {
    return teams.filter(team => {
      const matchesSearch = team.name.toLowerCase().includes(search.toLowerCase()) ||
                           team.tag?.toLowerCase().includes(search.toLowerCase());
      const matchesTier = filterTier === 'ALL' || team.tier === filterTier;
      return matchesSearch && matchesTier;
    }).sort((a, b) => b.totalMatches - a.totalMatches);
  }, [teams, search, filterTier]);

  const totalStats = useMemo(() => {
    const allMatches = teams.flatMap(t => t.matches);
    const wins = allMatches.filter(m => m.won).length;
    return {
      totalTeams: teams.length,
      totalMatches: allMatches.length,
      wins,
      losses: allMatches.length - wins,
      winRate: allMatches.length > 0 ? (wins / allMatches.length) * 100 : 0
    };
  }, [teams]);

  const handleSaveTeam = (teamData: Partial<RivalTeam>) => {
    if (editingTeam) {
      updateRivalTeam(editingTeam.id, teamData);
    } else {
      const newTeam: RivalTeam = {
        id: crypto.randomUUID(),
        name: teamData.name || 'Equipo sin nombre',
        tag: teamData.tag,
        region: teamData.region,
        tier: teamData.tier || 'AMATEUR',
        players: [],
        matches: [],
        notes: teamData.notes,
        winRateAgainstUs: 0,
        totalMatches: 0,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      addRivalTeam(newTeam);
    }
    setShowTeamDialog(false);
    setEditingTeam(null);
  };

  const handleDeleteTeam = (id: string) => {
    if (confirm('¿Eliminar este equipo rival? Se perderán todos los partidos registrados.')) {
      deleteRivalTeam(id);
      if (selectedTeam?.id === id) setSelectedTeam(null);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass-card p-4">
          <p className="text-xs text-muted-foreground mb-1">Equipos Rivales</p>
          <p className="text-2xl font-bold">{totalStats.totalTeams}</p>
        </div>
        <div className="glass-card p-4">
          <p className="text-xs text-muted-foreground mb-1">Partidos Totales</p>
          <p className="text-2xl font-bold">{totalStats.totalMatches}</p>
        </div>
        <div className="glass-card p-4">
          <p className="text-xs text-muted-foreground mb-1">Victorias</p>
          <p className="text-2xl font-bold text-green-400">{totalStats.wins}</p>
        </div>
        <div className="glass-card p-4">
          <p className="text-xs text-muted-foreground mb-1">Win Rate Global</p>
          <p className={cn(
            "text-2xl font-bold",
            totalStats.winRate >= 60 ? "text-green-400" :
            totalStats.winRate >= 45 ? "text-yellow-400" :
            "text-red-400"
          )}>
            {totalStats.winRate.toFixed(1)}%
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar equipo..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-pro pl-10 w-64"
            />
          </div>
          <select
            value={filterTier}
            onChange={(e) => setFilterTier(e.target.value)}
            className="input-pro"
          >
            <option value="ALL">Todos los tiers</option>
            {TIERS.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
        
        <Button onClick={() => { setEditingTeam(null); setShowTeamDialog(true); }} className="btn-primary">
          <Plus className="w-4 h-4 mr-2" />
          Añadir Equipo Rival
        </Button>
      </div>

      {/* Teams Grid */}
      {filteredTeams.length === 0 ? (
        <div className="glass-card p-12 text-center text-muted-foreground">
          <Users className="w-16 h-16 mx-auto mb-4 opacity-50" />
          <p className="text-lg">No hay equipos rivales registrados</p>
          <p className="text-sm mt-1">Añade equipos para empezar a analizar tus rivales</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTeams.map(team => {
            const stats = getRivalTeamStats(team.id);
            const tierInfo = TIERS.find(t => t.value === team.tier);
            
            return (
              <div 
                key={team.id} 
                className="glass-card p-5 hover:border-red-500/30 transition-all cursor-pointer group"
                onClick={() => setSelectedTeam(team)}
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-lg">{team.name}</h3>
                      {team.tag && (
                        <span className="px-2 py-0.5 rounded text-xs bg-white/10 text-muted-foreground">
                          [{team.tag}]
                        </span>
                      )}
                    </div>
                    {team.region && (
                      <p className="text-xs text-muted-foreground mt-1">{team.region}</p>
                    )}
                  </div>
                  <span 
                    className="px-2 py-1 rounded text-xs font-medium"
                    style={{ background: `${tierInfo?.color}30`, color: tierInfo?.color }}
                  >
                    {tierInfo?.label.split('(')[0].trim()}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">Partidos</p>
                    <p className="text-xl font-bold">{team.totalMatches}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">Nuestro WR</p>
                    <p className={cn(
                      "text-xl font-bold",
                      (stats?.winRate || 0) >= 60 ? "text-green-400" :
                      (stats?.winRate || 0) >= 45 ? "text-yellow-400" :
                      "text-red-400"
                    )}>
                      {(stats?.winRate || 0).toFixed(0)}%
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">Jugadores</p>
                    <p className="text-xl font-bold">{team.players.length}</p>
                  </div>
                </div>

                {/* Recent Form */}
                {stats?.recentForm && stats.recentForm.length > 0 && (
                  <div className="flex items-center gap-1 mb-3">
                    <span className="text-xs text-muted-foreground mr-2">Forma:</span>
                    {stats.recentForm.map((result, i) => (
                      <span 
                        key={i}
                        className={cn(
                          "w-6 h-6 rounded flex items-center justify-center text-xs font-bold",
                          result === 'W' ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
                        )}
                      >
                        {result}
                      </span>
                    ))}
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button 
                    onClick={(e) => { e.stopPropagation(); setEditingTeam(team); setShowTeamDialog(true); }}
                    variant="outline" 
                    size="sm"
                  >
                    <Edit2 className="w-4 h-4" />
                  </Button>
                  <Button 
                    onClick={(e) => { e.stopPropagation(); handleDeleteTeam(team.id); }}
                    variant="outline" 
                    size="sm"
                    className="text-red-400 hover:bg-red-500/10"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Team Detail Dialog */}
      {selectedTeam && (
        <RivalTeamDetail 
          team={selectedTeam} 
          onClose={() => setSelectedTeam(null)} 
        />
      )}

      {/* Add/Edit Team Dialog */}
      <TeamDialog 
        isOpen={showTeamDialog}
        onClose={() => { setShowTeamDialog(false); setEditingTeam(null); }}
        onSave={handleSaveTeam}
        initialData={editingTeam}
      />
    </div>
  );
}

// Team Detail Component
function RivalTeamDetail({ team, onClose }: { team: RivalTeam; onClose: () => void }) {
  const { getRivalTeamStats, addMatch } = useRivalStore();
  const [showAddMatch, setShowAddMatch] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'matches' | 'players'>('overview');
  
  const stats = getRivalTeamStats(team.id);

  const mapWinData = useMemo(() => {
    return stats?.mapStats.map(m => ({
      name: m.map,
      wins: m.wins,
      losses: m.losses
    })) || [];
  }, [stats]);

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto"
        style={{ background: 'hsl(220 22% 8%)', border: '1px solid hsl(220 15% 20%)' }}
      >
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-2xl flex items-center gap-3">
                {team.name}
                {team.tag && (
                  <span className="text-lg text-muted-foreground">[{team.tag}]</span>
                )}
              </DialogTitle>
              {team.region && (
                <p className="text-sm text-muted-foreground mt-1">{team.region}</p>
              )}
            </div>
            <Button onClick={() => setShowAddMatch(true)} className="btn-primary">
              <Plus className="w-4 h-4 mr-2" />
              Añadir Partido
            </Button>
          </div>
        </DialogHeader>

        {/* Tabs */}
        <div className="flex gap-2 border-b pb-2 mt-4" style={{ borderColor: 'hsl(220 15% 20%)' }}>
          {[
            { id: 'overview', label: 'Resumen', icon: BarChart3 },
            { id: 'matches', label: 'Partidos', icon: Calendar },
            { id: 'players', label: 'Jugadores', icon: Users },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id as any)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
                activeTab === id
                  ? "bg-red-500/10 text-red-400 border border-red-500/30"
                  : "text-muted-foreground hover:text-foreground hover:bg-white/5"
              )}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="mt-4">
          {activeTab === 'overview' && stats && (
            <div className="space-y-6">
              {/* Stats Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="glass-card p-4 text-center">
                  <p className="text-xs text-muted-foreground mb-1">Partidos</p>
                  <p className="text-2xl font-bold">{stats.totalMatches}</p>
                </div>
                <div className="glass-card p-4 text-center">
                  <p className="text-xs text-muted-foreground mb-1">Victorias</p>
                  <p className="text-2xl font-bold text-green-400">{stats.wins}</p>
                </div>
                <div className="glass-card p-4 text-center">
                  <p className="text-xs text-muted-foreground mb-1">Derrotas</p>
                  <p className="text-2xl font-bold text-red-400">{stats.losses}</p>
                </div>
                <div className="glass-card p-4 text-center">
                  <p className="text-xs text-muted-foreground mb-1">Win Rate</p>
                  <p className={cn(
                    "text-2xl font-bold",
                    stats.winRate >= 60 ? "text-green-400" :
                    stats.winRate >= 45 ? "text-yellow-400" :
                    "text-red-400"
                  )}>
                    {stats.winRate.toFixed(1)}%
                  </p>
                </div>
              </div>

              {/* Map Stats Chart */}
              {mapWinData.length > 0 && (
                <div className="glass-card p-5">
                  <h4 className="font-semibold mb-4 flex items-center gap-2">
                    <MapIcon className="w-5 h-5 text-blue-400" />
                    Rendimiento por Mapa
                  </h4>
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={mapWinData}>
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
                        <Bar dataKey="wins" stackId="a" fill="#22c55e" radius={[4, 4, 0, 0]} name="Victorias" />
                        <Bar dataKey="losses" stackId="a" fill="#ef4444" radius={[4, 4, 0, 0]} name="Derrotas" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Player Stats */}
              {stats.playerStats.length > 0 && (
                <div className="glass-card p-5">
                  <h4 className="font-semibold mb-4 flex items-center gap-2">
                    <Users className="w-5 h-5 text-purple-400" />
                    Jugadores Clave
                  </h4>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="text-left text-xs text-muted-foreground uppercase">
                          <th className="py-2">Jugador</th>
                          <th className="py-2">Partidos</th>
                          <th className="py-2">ACS</th>
                          <th className="py-2">K/D</th>
                          <th className="py-2">Agente Principal</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stats.playerStats
                          .sort((a, b) => b.avgACS - a.avgACS)
                          .slice(0, 5)
                          .map(player => (
                            <tr key={player.name} className="border-t border-border/50">
                              <td className="py-2 font-medium">{player.name}</td>
                              <td className="py-2">{player.matches}</td>
                              <td className="py-2 font-mono">{player.avgACS.toFixed(0)}</td>
                              <td className="py-2 font-mono">{player.avgKD.toFixed(2)}</td>
                              <td className="py-2 text-muted-foreground">{player.dominantAgent || '-'}</td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Notes */}
              {team.notes && (
                <div className="glass-card p-4">
                  <h4 className="font-semibold mb-2 flex items-center gap-2">
                    <Eye className="w-5 h-5 text-yellow-400" />
                    Notas
                  </h4>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{team.notes}</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'matches' && (
            <MatchesList teamId={team.id} matches={team.matches} />
          )}

          {activeTab === 'players' && (
            <PlayersList teamId={team.id} players={team.players} />
          )}
        </div>

        {/* Add Match Dialog */}
        {showAddMatch && (
          <AddMatchDialog
            teamId={team.id}
            onClose={() => setShowAddMatch(false)}
            onSave={(match) => {
              addMatch(team.id, match);
              setShowAddMatch(false);
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

// Sub-components
function TeamDialog({ isOpen, onClose, onSave, initialData }: { 
  isOpen: boolean; 
  onClose: () => void; 
  onSave: (data: Partial<RivalTeam>) => void;
  initialData: RivalTeam | null;
}) {
  const [formData, setFormData] = useState({
    name: initialData?.name || '',
    tag: initialData?.tag || '',
    region: initialData?.region || '',
    tier: initialData?.tier || 'AMATEUR',
    notes: initialData?.notes || ''
  });

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent style={{ background: 'hsl(220 22% 8%)', border: '1px solid hsl(220 15% 20%)' }}>
        <DialogHeader>
          <DialogTitle>{initialData ? 'Editar Equipo' : 'Añadir Equipo Rival'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-4">
          <div>
            <label className="text-sm text-muted-foreground mb-1 block">Nombre del equipo *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="input-pro w-full"
              placeholder="ej: Team Liquid"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Tag</label>
              <input
                type="text"
                value={formData.tag}
                onChange={(e) => setFormData({ ...formData, tag: e.target.value })}
                className="input-pro w-full"
                placeholder="ej: TL"
              />
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Región</label>
              <input
                type="text"
                value={formData.region}
                onChange={(e) => setFormData({ ...formData, region: e.target.value })}
                className="input-pro w-full"
                placeholder="ej: EMEA"
              />
            </div>
          </div>
          <div>
            <label className="text-sm text-muted-foreground mb-1 block">Tier</label>
            <select
              value={formData.tier}
              onChange={(e) => setFormData({ ...formData, tier: e.target.value as any })}
              className="input-pro w-full"
            >
              {TIERS.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm text-muted-foreground mb-1 block">Notas</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="input-pro w-full h-24 resize-none"
              placeholder="Información relevante sobre el equipo..."
            />
          </div>
          <div className="flex gap-3">
            <Button onClick={onClose} variant="outline" className="flex-1">Cancelar</Button>
            <Button 
              onClick={() => onSave(formData)} 
              className="btn-primary flex-1"
              disabled={!formData.name.trim()}
            >
              {initialData ? 'Guardar Cambios' : 'Añadir Equipo'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function MatchesList({ teamId, matches }: { teamId: string; matches: RivalMatch[] }) {
  const { deleteMatch } = useRivalStore();
  const sortedMatches = [...matches].sort((a, b) => 
    new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  return (
    <div className="space-y-3">
      {sortedMatches.length === 0 ? (
        <p className="text-center text-muted-foreground py-8">No hay partidos registrados</p>
      ) : (
        sortedMatches.map(match => (
          <div key={match.id} className="glass-card p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={cn(
                  "w-10 h-10 rounded-lg flex items-center justify-center font-bold",
                  match.won ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
                )}>
                  {match.won ? 'W' : 'L'}
                </div>
                <div>
                  <p className="font-medium">{match.map}</p>
                  <p className="text-sm text-muted-foreground">{match.date}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-center">
                  <p className="text-lg font-mono font-bold">
                    <span className={match.won ? 'text-green-400' : 'text-red-400'}>{match.scoreUs}</span>
                    <span className="text-muted-foreground mx-2">-</span>
                    <span className={!match.won ? 'text-green-400' : 'text-red-400'}>{match.scoreThem}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">{match.type}</p>
                </div>
                <Button 
                  onClick={() => {
                    if (confirm('¿Eliminar este partido?')) {
                      deleteMatch(teamId, match.id);
                    }
                  }}
                  variant="outline"
                  size="sm"
                  className="text-red-400"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function PlayersList({ teamId, players }: { teamId: string; players: RivalPlayer[] }) {
  const { addPlayerToTeam, deletePlayer } = useRivalStore();
  const [showAddPlayer, setShowAddPlayer] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setShowAddPlayer(true)} variant="outline" size="sm">
          <Plus className="w-4 h-4 mr-2" />
          Añadir Jugador
        </Button>
      </div>

      {players.length === 0 ? (
        <p className="text-center text-muted-foreground py-8">No hay jugadores registrados</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {players.map(player => (
            <div key={player.id} className="glass-card p-4 flex items-center justify-between">
              <div>
                <p className="font-medium">{player.name}</p>
                {player.agent && (
                  <p className="text-sm text-muted-foreground">{player.agent}</p>
                )}
              </div>
              <Button 
                onClick={() => deletePlayer(teamId, player.id)}
                variant="outline"
                size="sm"
                className="text-red-400"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Add Player Dialog */}
      {showAddPlayer && (
        <AddPlayerDialog
          onClose={() => setShowAddPlayer(false)}
          onSave={(player) => {
            addPlayerToTeam(teamId, player);
            setShowAddPlayer(false);
          }}
        />
      )}
    </div>
  );
}

function AddMatchDialog({ teamId, onClose, onSave }: { 
  teamId: string; 
  onClose: () => void; 
  onSave: (match: RivalMatch) => void;
}) {
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    map: 'Ascent',
    scoreUs: 13,
    scoreThem: 0,
    type: 'SCRIM' as const,
    won: true,
    notes: ''
  });

  const handleSave = () => {
    const match: RivalMatch = {
      id: crypto.randomUUID(),
      rivalTeamId: teamId,
      ...formData,
      ourPlayers: [],
      theirPlayers: [],
      createdAt: Date.now()
    };
    onSave(match);
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent style={{ background: 'hsl(220 22% 8%)', border: '1px solid hsl(220 15% 20%)' }}>
        <DialogHeader>
          <DialogTitle>Añadir Partido</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Fecha</label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="input-pro w-full"
              />
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Mapa</label>
              <select
                value={formData.map}
                onChange={(e) => setFormData({ ...formData, map: e.target.value })}
                className="input-pro w-full"
              >
                {VALORANT_MAPS.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Nuestro Score</label>
              <input
                type="number"
                min="0"
                value={formData.scoreUs}
                onChange={(e) => setFormData({ ...formData, scoreUs: parseInt(e.target.value) || 0 })}
                className="input-pro w-full"
              />
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Su Score</label>
              <input
                type="number"
                min="0"
                value={formData.scoreThem}
                onChange={(e) => setFormData({ ...formData, scoreThem: parseInt(e.target.value) || 0 })}
                className="input-pro w-full"
              />
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Tipo</label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                className="input-pro w-full"
              >
                <option value="SCRIM">SCRIM</option>
                <option value="PREMIER">PREMIER</option>
                <option value="OFICIAL">OFICIAL</option>
                <option value="TOURNAMENT">Torneo</option>
              </select>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.won}
                onChange={(e) => setFormData({ ...formData, won: e.target.checked })}
                className="w-4 h-4 rounded"
              />
              <span className="text-sm">Ganamos</span>
            </label>
          </div>
          <div>
            <label className="text-sm text-muted-foreground mb-1 block">Notas</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="input-pro w-full h-20 resize-none"
              placeholder="Observaciones del partido..."
            />
          </div>
          <div className="flex gap-3">
            <Button onClick={onClose} variant="outline" className="flex-1">Cancelar</Button>
            <Button onClick={handleSave} className="btn-primary flex-1">Guardar Partido</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AddPlayerDialog({ onClose, onSave }: { 
  onClose: () => void; 
  onSave: (player: RivalPlayer) => void;
}) {
  const [name, setName] = useState('');
  const [agent, setAgent] = useState('');

  const handleSave = () => {
    if (!name.trim()) return;
    onSave({
      id: crypto.randomUUID(),
      name: name.trim(),
      agent: agent || undefined
    });
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent style={{ background: 'hsl(220 22% 8%)', border: '1px solid hsl(220 15% 20%)' }}>
        <DialogHeader>
          <DialogTitle>Añadir Jugador</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-4">
          <div>
            <label className="text-sm text-muted-foreground mb-1 block">Nombre</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input-pro w-full"
              placeholder="Nombre del jugador"
            />
          </div>
          <div>
            <label className="text-sm text-muted-foreground mb-1 block">Agente Principal (opcional)</label>
            <select
              value={agent}
              onChange={(e) => setAgent(e.target.value)}
              className="input-pro w-full"
            >
              <option value="">-</option>
              {VALORANT_AGENTS.map(a => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-3">
            <Button onClick={onClose} variant="outline" className="flex-1">Cancelar</Button>
            <Button onClick={handleSave} className="btn-primary flex-1" disabled={!name.trim()}>
              Añadir Jugador
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
