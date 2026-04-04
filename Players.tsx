import React, { useState, useMemo } from 'react';
import type { Round } from '@/types';
import {
  ArrowLeft, Plus, Edit2, Trash2, Users, Clock,
  DollarSign, TrendingUp, TrendingDown, Target, Shield,
  Zap, Trophy, BarChart2
} from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import { cn } from '@/lib/utils';
import { MatchTimeline } from '@/components/MatchTimeline';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

// ── Tipos locales ────────────────────────────────────────────────────────────
type MatchTab = 'players' | 'timeline' | 'economy';

// ── Helpers de economía desde roundResults (formato simple del visualizador) ──
type RoundResult = {
  number:       number;
  side:         'ATK' | 'DEF';
  won:          boolean | null;
  type:         string;
  bombPlanted?: boolean;
  bombDefused?: boolean;
};

function calcEcoFromRoundResults(roundResults: RoundResult[]) {
  const played = roundResults.filter(r => r.won !== null);
  const stats = {
    pistolWins: 0, pistolTotal: 0,
    ecoWins:    0, ecoTotal:    0,
    forceWins:  0, forceTotal:  0,
    fullWins:   0, fullTotal:   0,
    atkWins:    0, atkTotal:    0,
    defWins:    0, defTotal:    0,
  };
  for (const r of played) {
    const w = r.won === true;
    if (r.type === 'pistol')     { stats.pistolTotal++; if (w) stats.pistolWins++; }
    else if (r.type === 'eco')   { stats.ecoTotal++;    if (w) stats.ecoWins++;    }
    else if (r.type === 'force') { stats.forceTotal++;  if (w) stats.forceWins++;  }
    else                         { stats.fullTotal++;   if (w) stats.fullWins++;   }
    if (r.side === 'ATK') { stats.atkTotal++;  if (w) stats.atkWins++;  }
    else                  { stats.defTotal++;  if (w) stats.defWins++;  }
  }
  return { ...stats, total: played.length };
}

function pct(n: number, d: number) { return d > 0 ? Math.round(n / d * 100) : 0; }

// ── Componente tab Economía ──────────────────────────────────────────────────
function EconomyTab({ matchId }: { matchId: string }) {
  const { matches } = useAppStore();
  const match = matches[matchId] as any;

  // Leer rondas: primero rounds (Round[]), luego roundResults (RoundResult[])
  const rounds: Round[] = match?.rounds || [];
  const roundResults: RoundResult[] = match?.roundResults || [];

  // Calcular eco desde la fuente disponible
  const eco = useMemo(() => {
    if (rounds.length > 0) {
      // Desde Round[] (MatchTimeline)
      const played = rounds.filter((r: any) => r.outcome !== 'DRAW');
      const s = {
        pistolWins: 0, pistolTotal: 0,
        ecoWins:    0, ecoTotal:    0,
        forceWins:  0, forceTotal:  0,
        fullWins:   0, fullTotal:   0,
        atkWins:    0, atkTotal:    0,
        defWins:    0, defTotal:    0,
        total:      played.length,
      };
      for (const r of played) {
        const w = (r as any).outcome === 'WIN';
        const bt = (r as any).buyType;
        if (bt === 'ECO' && (r as any).roundNumber <= 1 || (r as any).roundNumber === 13) {
          s.pistolTotal++; if (w) s.pistolWins++;
        } else if (bt === 'ECO')   { s.ecoTotal++;   if (w) s.ecoWins++;   }
        else if (bt === 'FORCE')   { s.forceTotal++; if (w) s.forceWins++; }
        else                       { s.fullTotal++;  if (w) s.fullWins++;  }
        if ((r as any).side === 'ATK') { s.atkTotal++;  if (w) s.atkWins++;  }
        else                           { s.defTotal++;  if (w) s.defWins++;  }
      }
      return s;
    }
    if (roundResults.length > 0) {
      return calcEcoFromRoundResults(roundResults);
    }
    return null;
  }, [rounds, roundResults]);

  if (!eco || eco.total === 0) {
    return (
      <div className="glass-card p-12 text-center text-muted-foreground space-y-3">
        <DollarSign className="w-12 h-12 mx-auto opacity-20"/>
        <p className="text-base">No hay datos de rondas</p>
        <p className="text-sm">
          Añade rondas en el visualizador del partido (editar partido → visualizador de rondas)
          para ver el análisis de economía.
        </p>
      </div>
    );
  }

  const rows = [
    { label: '🔫 Pistola', wins: eco.pistolWins, total: eco.pistolTotal, color: '#f59e0b' },
    { label: '💸 Eco',     wins: eco.ecoWins,    total: eco.ecoTotal,    color: '#ef4444' },
    { label: '⚡ Force',   wins: eco.forceWins,  total: eco.forceTotal,  color: '#8b5cf6' },
    { label: '✅ Full Buy',wins: eco.fullWins,   total: eco.fullTotal,   color: '#22c55e' },
  ].filter(r => r.total > 0);

  return (
    <div className="space-y-5">
      {/* KPIs ATK / DEF */}
      <div className="grid grid-cols-3 gap-4">
        <div className="glass-card p-4 text-center">
          <p className="text-xs text-muted-foreground mb-1">Total rondas</p>
          <p className="text-3xl font-black">{eco.total}</p>
        </div>
        <div className="glass-card p-4 text-center">
          <p className="text-xs text-yellow-400 mb-1">⚔ ATK</p>
          <p className="text-3xl font-black text-yellow-400">{pct(eco.atkWins, eco.atkTotal)}%</p>
          <p className="text-xs text-muted-foreground">{eco.atkWins}/{eco.atkTotal}</p>
        </div>
        <div className="glass-card p-4 text-center">
          <p className="text-xs text-blue-400 mb-1">🛡 DEF</p>
          <p className="text-3xl font-black text-blue-400">{pct(eco.defWins, eco.defTotal)}%</p>
          <p className="text-xs text-muted-foreground">{eco.defWins}/{eco.defTotal}</p>
        </div>
      </div>

      {/* Barras por tipo de compra */}
      <div className="glass-card p-5 space-y-4">
        <h3 className="text-sm font-bold flex items-center gap-2">
          <BarChart2 className="w-4 h-4 text-muted-foreground"/>
          Win Rate por tipo de ronda
        </h3>
        {rows.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Marca los tipos de ronda (pistola/eco/force) en el visualizador para ver este análisis.
          </p>
        ) : rows.map(({ label, wins, total, color }) => {
          const p = pct(wins, total);
          return (
            <div key={label} className="space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <span style={{ color }} className="font-medium">{label}</span>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground">{wins}/{total} rondas</span>
                  <span className="font-black font-mono text-base" style={{ color }}>{p}%</span>
                </div>
              </div>
              <div className="h-3 rounded-full overflow-hidden" style={{ background: 'hsl(220 15% 14%)' }}>
                <div className="h-full rounded-full transition-all duration-500"
                  style={{ width: p + '%', background: color }}/>
              </div>
            </div>
          );
        })}
      </div>

      {/* Racha info */}
      <div className="glass-card p-5 space-y-3">
        <h3 className="text-sm font-bold flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-muted-foreground"/>
          Resumen global
        </h3>
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'WR global', val: pct(eco.atkWins + eco.defWins, eco.total) + '%', color: '#22c55e' },
            { label: 'Rondas totales', val: eco.total, color: '#94a3b8' },
            { label: 'Victorias', val: eco.atkWins + eco.defWins, color: '#22c55e' },
            { label: 'Derrotas', val: eco.total - (eco.atkWins + eco.defWins), color: '#ef4444' },
          ].map(({ label, val, color }) => (
            <div key={label} className="rounded-xl p-3" style={{ background: 'hsl(220 20% 9%)' }}>
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="text-2xl font-black" style={{ color }}>{val}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Componente principal Players ─────────────────────────────────────────────
export function Players() {
  const {
    activeMatchId, setActiveTab,
    matches, players, getPlayersForMatch,
    addPlayer, updatePlayer, removePlayer,
  } = useAppStore();

  const [activeMatchTab, setActiveMatchTab] = useState<MatchTab>('players');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<any>(null);
  const [sortBy, setSortBy] = useState<'rating' | 'acs' | 'kd'>('rating');

  const match = activeMatchId ? matches[activeMatchId] : null;
  const matchPlayers = activeMatchId ? getPlayersForMatch(activeMatchId) : [];

  // Rating VLR simplificado
  const calcRating = (p: any) => {
    if (!p.k && !p.acs) return 0;
    const kd = p.d > 0 ? p.k / p.d : p.k;
    return Math.round(((p.acs || 0) / 200 * 0.5 + kd * 0.3 + ((p.kast || 0) / 100) * 0.2) * 100) / 100;
  };

  const sortedPlayers = useMemo(() => {
    return [...matchPlayers].sort((a, b) => {
      if (sortBy === 'acs') return (b.acs || 0) - (a.acs || 0);
      if (sortBy === 'kd')  return ((b.k||0)/(b.d||1)) - ((a.k||0)/(a.d||1));
      return calcRating(b) - calcRating(a);
    });
  }, [matchPlayers, sortBy]);

  if (!match) {
    return (
      <div className="p-8 text-center text-muted-foreground space-y-3">
        <Users className="w-16 h-16 mx-auto opacity-20"/>
        <p className="text-base">Selecciona un partido para ver sus estadísticas</p>
        <Button variant="outline" onClick={() => setActiveTab('matches')} className="gap-2">
          <ArrowLeft className="w-4 h-4"/> Ir a Partidos
        </Button>
      </div>
    );
  }

  const anyMatch = match as any;

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => setActiveTab('matches')}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors">
            <ArrowLeft className="w-5 h-5"/>
          </button>
          <div>
            <h2 className="text-xl font-black">{match.map}</h2>
            <p className="text-xs text-muted-foreground">
              {match.id} · {match.type} · {match.date}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <select value={sortBy} onChange={e => setSortBy(e.target.value as any)}
            className="input-pro text-xs">
            <option value="rating">Ordenar por: Rating VLR</option>
            <option value="acs">Ordenar por: ACS</option>
            <option value="kd">Ordenar por: K/D</option>
          </select>
          <Button onClick={() => { setEditingPlayer(null); setIsAddDialogOpen(true); }}
            className="btn-primary gap-1 text-sm">
            <Plus className="w-4 h-4"/> Añadir Jugador
          </Button>
        </div>
      </div>

      {/* KPIs del partido */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="glass-card p-3 text-center">
          <p className="text-xs text-muted-foreground mb-1">Resultado</p>
          <p className={cn('text-lg font-black', match.won ? 'text-green-400' : 'text-red-400')}>
            {match.won ? 'VICTORIA' : 'DERROTA'}
          </p>
        </div>
        <div className="glass-card p-3 text-center">
          <p className="text-xs text-muted-foreground mb-1">Score</p>
          <p className="text-lg font-black font-mono">
            <span className={match.won ? 'text-green-400' : 'text-red-400'}>{match.scoreUs}</span>
            <span className="text-muted-foreground mx-1">-</span>
            <span className={!match.won ? 'text-green-400' : 'text-red-400'}>{match.scoreOpp}</span>
          </p>
        </div>
        <div className="glass-card p-3 text-center">
          <p className="text-xs text-muted-foreground mb-1">Rondas ATK/DEF</p>
          <p className="text-lg font-black">
            <span className="text-yellow-400">{match.atk}</span>
            <span className="text-muted-foreground mx-1">/</span>
            <span className="text-blue-400">{match.def}</span>
          </p>
        </div>
        <div className="glass-card p-3 text-center">
          <p className="text-xs text-muted-foreground mb-1">Pistolas</p>
          <p className="text-sm font-bold">
            <span className={match.pistolAtkWin ? 'text-green-400' : 'text-red-400'}>
              ATK {match.pistolAtkWin ? '✓' : '✗'}
            </span>
            <span className="text-muted-foreground mx-1">·</span>
            <span className={match.pistolDefWin ? 'text-green-400' : 'text-red-400'}>
              DEF {match.pistolDefWin ? '✓' : '✗'}
            </span>
          </p>
        </div>
        <div className="glass-card p-3 text-center">
          <p className="text-xs text-muted-foreground mb-1">Post/Retake</p>
          <p className="text-sm font-bold font-mono">
            <span className="text-green-400">{match.postWin}</span>/<span className="text-red-400">{match.postLoss}</span>
            <span className="text-muted-foreground mx-1">·</span>
            <span className="text-blue-400">{match.retakeWin}</span>/<span className="text-red-400">{match.retakeLoss}</span>
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-white/10 pb-px">
        {([
          ['players',  <Users className="w-4 h-4"/>,     'Jugadores'],
          ['timeline', <Clock className="w-4 h-4"/>,     'Timeline'],
          ['economy',  <DollarSign className="w-4 h-4"/>,'Economía'],
        ] as [MatchTab, React.ReactNode, string][]).map(([id, icon, label]) => (
          <button key={id} onClick={() => setActiveMatchTab(id)}
            className={cn(
              'flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-t-lg transition-all',
              activeMatchTab === id
                ? 'bg-red-500/15 border border-red-500/30 border-b-transparent text-white'
                : 'text-muted-foreground hover:text-white hover:bg-white/5'
            )}>
            {icon}{label}
          </button>
        ))}
      </div>

      {/* ── TAB JUGADORES ── */}
      {activeMatchTab === 'players' && (
        <div className="space-y-3">
          {sortedPlayers.length === 0 ? (
            <div className="glass-card p-10 text-center text-muted-foreground space-y-3">
              <Users className="w-12 h-12 mx-auto opacity-20"/>
              <p>No hay jugadores registrados en este partido</p>
              <Button onClick={() => { setEditingPlayer(null); setIsAddDialogOpen(true); }}
                className="btn-primary gap-1">
                <Plus className="w-4 h-4"/> Añadir Jugador
              </Button>
            </div>
          ) : (
            <>
              {/* Header tabla */}
              <div className="grid grid-cols-[1fr_60px_60px_60px_60px_60px_60px_60px_32px] gap-2 px-4 text-xs text-muted-foreground uppercase tracking-wider">
                <span>Jugador</span>
                <span className="text-center">Rating</span>
                <span className="text-center">ACS</span>
                <span className="text-center">K/D</span>
                <span className="text-center">KAST</span>
                <span className="text-center">FK</span>
                <span className="text-center">Plants</span>
                <span className="text-center">Defuse</span>
                <span/>
              </div>
              {sortedPlayers.map(player => {
                const rating = calcRating(player);
                const kd = player.d > 0 ? (player.k / player.d).toFixed(2) : player.k.toFixed(2);
                return (
                  <div key={player.id}
                    className="glass-card grid grid-cols-[1fr_60px_60px_60px_60px_60px_60px_60px_32px] gap-2 items-center px-4 py-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                        style={{ background: 'hsl(220 20% 12%)', border: '1px solid hsl(220 15% 22%)' }}>
                        {player.name.slice(0,2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-sm truncate">{player.name}</p>
                        <p className="text-xs text-muted-foreground">{player.agent || '—'}</p>
                      </div>
                    </div>
                    <div className="text-center">
                      <span className={cn('text-sm font-bold font-mono',
                        rating >= 1.2 ? 'text-green-400' : rating >= 0.9 ? 'text-yellow-400' : 'text-red-400')}>
                        {rating.toFixed(2)}
                      </span>
                    </div>
                    <div className="text-center text-sm font-mono">{player.acs || 0}</div>
                    <div className="text-center text-sm font-mono">
                      <span className={+kd >= 1 ? 'text-green-400' : 'text-red-400'}>{kd}</span>
                    </div>
                    <div className="text-center text-sm font-mono">{player.kast || 0}%</div>
                    <div className="text-center text-sm font-mono text-yellow-400">{player.fk || 0}</div>
                    <div className="text-center text-sm font-mono text-orange-400">{player.plants || 0}</div>
                    <div className="text-center text-sm font-mono text-blue-400">{player.defuses || 0}</div>
                    <div className="flex gap-0.5">
                      <button onClick={() => { setEditingPlayer(player); setIsAddDialogOpen(true); }}
                        className="p-1 rounded hover:bg-white/10 transition-colors">
                        <Edit2 className="w-3 h-3"/>
                      </button>
                      <button onClick={() => removePlayer(player.id)}
                        className="p-1 rounded hover:bg-red-500/20 text-red-400 transition-colors">
                        <Trash2 className="w-3 h-3"/>
                      </button>
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>
      )}

      {/* ── TAB TIMELINE ── */}
      {activeMatchTab === 'timeline' && activeMatchId && (
        <MatchTimeline matchId={activeMatchId}/>
      )}

      {/* ── TAB ECONOMÍA ── */}
      {activeMatchTab === 'economy' && activeMatchId && (
        <EconomyTab matchId={activeMatchId}/>
      )}

      {/* Dialog añadir/editar jugador */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="max-w-md"
          style={{ background: 'hsl(220 22% 8%)', border: '1px solid hsl(220 15% 20%)' }}>
          <DialogHeader>
            <DialogTitle>{editingPlayer ? 'Editar Jugador' : 'Añadir Jugador'}</DialogTitle>
          </DialogHeader>
          <PlayerForm
            matchId={activeMatchId!}
            player={editingPlayer}
            onSave={() => { setIsAddDialogOpen(false); setEditingPlayer(null); }}
            onCancel={() => { setIsAddDialogOpen(false); setEditingPlayer(null); }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Formulario de jugador ────────────────────────────────────────────────────
function PlayerForm({
  matchId, player, onSave, onCancel,
}: {
  matchId: string;
  player: any;
  onSave: () => void;
  onCancel: () => void;
}) {
  const { addPlayer, updatePlayer } = useAppStore();
  const [form, setForm] = useState({
    name:    player?.name    || '',
    agent:   player?.agent   || '',
    k:       player?.k       || 0,
    d:       player?.d       || 0,
    a:       player?.a       || 0,
    acs:     player?.acs     || 0,
    kast:    player?.kast    || 0,
    fk:      player?.fk      || 0,
    fd:      player?.fd      || 0,
    plants:  player?.plants  || 0,
    defuses: player?.defuses || 0,
  });

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = () => {
    if (!form.name.trim()) return;
    if (player) {
      updatePlayer(player.id, form);
    } else {
      addPlayer(matchId, {
        ...form,
        id:   crypto.randomUUID(),
        role: 'Unknown' as const,
      });
    }
    onSave();
  };

  return (
    <div className="space-y-4 mt-2">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">IGN *</label>
          <input value={form.name} onChange={e => set('name', e.target.value)}
            className="input-pro w-full" placeholder="NombreJugador"/>
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Agente</label>
          <input value={form.agent} onChange={e => set('agent', e.target.value)}
            className="input-pro w-full" placeholder="Jett..."/>
        </div>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {([
          ['k','K'],['d','D'],['a','A'],['acs','ACS'],
          ['kast','KAST%'],['fk','FK'],['fd','FD'],['plants','Plants'],
        ] as [string,string][]).map(([key, label]) => (
          <div key={key}>
            <label className="text-[10px] text-muted-foreground mb-1 block">{label}</label>
            <input type="number" min="0" value={(form as any)[key]}
              onChange={e => set(key, parseFloat(e.target.value) || 0)}
              className="input-pro w-full text-center p-1.5 text-sm"/>
          </div>
        ))}
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <Button variant="outline" onClick={onCancel}>Cancelar</Button>
        <Button onClick={handleSave} className="btn-primary" disabled={!form.name.trim()}>
          {player ? 'Guardar' : 'Añadir'}
        </Button>
      </div>
    </div>
  );
}
