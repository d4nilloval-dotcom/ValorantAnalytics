import { useMemo, useState } from 'react';
import { useAppStore } from '@/store/appStore';
import { cn } from '@/lib/utils';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, RadarChart, Radar, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis
} from 'recharts';
import { DollarSign, TrendingUp, CheckSquare, Square, ChevronDown, ChevronUp, Filter } from 'lucide-react';

const BUY_CONFIG = {
  ECO:      { label: 'ECO',        color: '#ef4444', bg: 'bg-red-500/15',    border: 'border-red-500/30',    desc: 'Sin compra / pistola' },
  FORCE:    { label: 'Force Buy',  color: '#f59e0b', bg: 'bg-yellow-500/15', border: 'border-yellow-500/30', desc: 'Compra parcial forzada' },
  FULL:     { label: 'Full Buy',   color: '#22c55e', bg: 'bg-green-500/15',  border: 'border-green-500/30',  desc: 'Compra completa' },
  OVERTIME: { label: 'Overtime',   color: '#a855f7', bg: 'bg-purple-500/15', border: 'border-purple-500/30', desc: 'Prórroga' },
};

function WrBar({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-bold" style={{ color }}>{value.toFixed(0)}%</span>
      </div>
      <div className="h-3 rounded-full overflow-hidden" style={{ background: 'hsl(220 15% 15%)' }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(value, 100)}%`, background: color }} />
      </div>
    </div>
  );
}

export function EcoPatterns() {
  const { matches } = useAppStore();

  const allMatchesList = useMemo(() => Object.values(matches), [matches]);
  const matchesWithRoundsAll = useMemo(
    () => allMatchesList.filter(m => m.rounds && m.rounds.length >= 3),
    [allMatchesList]
  );

  // ── Selector de partidos ──────────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showSelector, setShowSelector] = useState(false);

  const toggleId = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const selectAll   = () => setSelectedIds(new Set(matchesWithRoundsAll.map(m => m.id)));
  const selectNone  = () => setSelectedIds(new Set());

  // Si no hay selección activa → usar todos
  const allMatches = useMemo(() => {
    if (selectedIds.size === 0) return matchesWithRoundsAll;
    return matchesWithRoundsAll.filter(m => selectedIds.has(m.id));
  }, [matchesWithRoundsAll, selectedIds]);

  // Aggregate round data across all matches that have rounds
  const roundStats = useMemo(() => {
    const stats: Record<string, {
      total: number; wins: number;
      atkTotal: number; atkWins: number;
      defTotal: number; defWins: number;
      afterWin: number; afterWinTotal: number;    // win rate de la ronda siguiente tras ganar esta
      afterLoss: number; afterLossTotal: number;  // win rate de la ronda siguiente tras perder esta
    }> = {
      ECO: { total:0, wins:0, atkTotal:0, atkWins:0, defTotal:0, defWins:0, afterWin:0, afterWinTotal:0, afterLoss:0, afterLossTotal:0 },
      FORCE: { total:0, wins:0, atkTotal:0, atkWins:0, defTotal:0, defWins:0, afterWin:0, afterWinTotal:0, afterLoss:0, afterLossTotal:0 },
      FULL: { total:0, wins:0, atkTotal:0, atkWins:0, defTotal:0, defWins:0, afterWin:0, afterWinTotal:0, afterLoss:0, afterLossTotal:0 },
      OVERTIME: { total:0, wins:0, atkTotal:0, atkWins:0, defTotal:0, defWins:0, afterWin:0, afterWinTotal:0, afterLoss:0, afterLossTotal:0 },
    };

    let totalRoundsAnalyzed = 0;

    for (const match of allMatches) {
      if (!match.rounds || match.rounds.length < 3) continue;
      const rounds = [...match.rounds].sort((a, b) => a.roundNumber - b.roundNumber);

      for (let i = 0; i < rounds.length; i++) {
        const r = rounds[i];
        const bt = r.buyType;
        if (!stats[bt]) continue;

        stats[bt].total++;
        totalRoundsAnalyzed++;
        if (r.outcome === 'WIN') stats[bt].wins++;
        if (r.side === 'ATK') {
          stats[bt].atkTotal++;
          if (r.outcome === 'WIN') stats[bt].atkWins++;
        } else {
          stats[bt].defTotal++;
          if (r.outcome === 'WIN') stats[bt].defWins++;
        }

        // Next round momentum
        if (i + 1 < rounds.length) {
          const next = rounds[i + 1];
          if (r.outcome === 'WIN') {
            stats[bt].afterWinTotal++;
            if (next.outcome === 'WIN') stats[bt].afterWin++;
          } else {
            stats[bt].afterLossTotal++;
            if (next.outcome === 'WIN') stats[bt].afterLoss++;
          }
        }
      }
    }

    return { stats, totalRoundsAnalyzed };
  }, [allMatches]);

  const matchesWithRounds = allMatches.length;

  // Sequence analysis: most common winning buy sequences
  const sequenceAnalysis = useMemo(() => {
    const sequences: Record<string, { wins: number; total: number }> = {};

    for (const match of allMatches) {
      if (!match.rounds || match.rounds.length < 4) continue;
      const rounds = [...match.rounds].sort((a, b) => a.roundNumber - b.roundNumber);

      for (let i = 0; i < rounds.length - 2; i++) {
        const seq = `${rounds[i].buyType}→${rounds[i+1].buyType}→${rounds[i+2].buyType}`;
        if (!sequences[seq]) sequences[seq] = { wins: 0, total: 0 };
        sequences[seq].total++;
        if (rounds[i+2].outcome === 'WIN') sequences[seq].wins++;
      }
    }

    return Object.entries(sequences)
      .filter(([, v]) => v.total >= 3)
      .map(([seq, v]) => ({ seq, wr: v.wins / v.total * 100, total: v.total }))
      .sort((a, b) => b.wr - a.wr)
      .slice(0, 8);
  }, [allMatches]);

  // Economy break analysis: winning rounds while having less economy
  const econBreaks = useMemo(() => {
    let breaks = 0, breakAttempts = 0;
    let brokeAgainst = 0, brokeAgainstAttempts = 0;

    for (const match of allMatches) {
      if (!match.rounds || match.rounds.length < 3) continue;
      for (const r of match.rounds) {
        if (r.economyUs !== undefined && r.economyOpp !== undefined) {
          if (r.economyUs < r.economyOpp) {
            breakAttempts++;
            if (r.outcome === 'WIN') breaks++;
          } else if (r.economyUs > r.economyOpp) {
            brokeAgainstAttempts++;
            if (r.outcome === 'LOSS') brokeAgainst++;
          }
        }
      }
    }

    return {
      breakRate: breakAttempts > 0 ? breaks / breakAttempts * 100 : 0,
      breakAttempts,
      gotBrokenRate: brokeAgainstAttempts > 0 ? brokeAgainst / brokeAgainstAttempts * 100 : 0,
      brokeAgainstAttempts,
    };
  }, [allMatches]);

  const { stats } = roundStats;

  const chartData = Object.entries(stats)
    .filter(([, v]) => v.total > 0)
    .map(([bt, v]) => ({
      name: BUY_CONFIG[bt as keyof typeof BUY_CONFIG]?.label || bt,
      key: bt,
      wr: v.total > 0 ? Math.round(v.wins / v.total * 100) : 0,
      atkWr: v.atkTotal > 0 ? Math.round(v.atkWins / v.atkTotal * 100) : 0,
      defWr: v.defTotal > 0 ? Math.round(v.defWins / v.defTotal * 100) : 0,
      total: v.total,
    }));

  const radarData = chartData.map(d => ({ axis: d.name, ATK: d.atkWr, DEF: d.defWr }));

  if (matchesWithRounds === 0) {
    return (
      <div className="glass-card p-10 text-center text-muted-foreground space-y-2">
        <DollarSign className="w-12 h-12 mx-auto opacity-30" />
        <p className="text-base">Sin datos de rondas</p>
        <p className="text-sm">Para ver eco patterns necesitas registrar rondas en el Timeline de al menos un partido.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* ── Selector de partidos ───────────────────────────────────────────── */}
      <div className="glass-card overflow-hidden">
        <button
          onClick={() => setShowSelector(v => !v)}
          className="w-full flex items-center justify-between px-5 py-3 hover:bg-white/3 transition-colors">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground"/>
            <span className="text-sm font-semibold">Partidos analizados</span>
            {selectedIds.size > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 border border-red-500/30">
                {selectedIds.size} seleccionados
              </span>
            )}
            {selectedIds.size === 0 && (
              <span className="text-xs text-muted-foreground">todos ({matchesWithRoundsAll.length})</span>
            )}
          </div>
          {showSelector ? <ChevronUp className="w-4 h-4 text-muted-foreground"/> : <ChevronDown className="w-4 h-4 text-muted-foreground"/>}
        </button>

        {showSelector && (
          <div className="border-t border-white/8 p-4 space-y-3">
            <div className="flex gap-2">
              <button onClick={selectAll} className="text-xs px-3 py-1.5 rounded-lg border border-white/15 text-muted-foreground hover:text-white transition-colors">
                Seleccionar todos
              </button>
              <button onClick={selectNone} className="text-xs px-3 py-1.5 rounded-lg border border-white/15 text-muted-foreground hover:text-white transition-colors">
                Limpiar selección
              </button>
            </div>
            <div className="max-h-52 overflow-y-auto space-y-1 pr-1">
              {matchesWithRoundsAll.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">Sin partidos con rondas registradas.</p>
              )}
              {matchesWithRoundsAll.map(m => {
                const checked = selectedIds.has(m.id) || selectedIds.size === 0;
                const active  = selectedIds.has(m.id);
                const won     = (m as any).won;
                const anyM    = m as any;
                const label   = anyM.opponent
                  ? `vs ${anyM.opponent}`
                  : anyM.notes?.slice(0, 25) || m.id.slice(0, 10);
                return (
                  <div key={m.id}
                    onClick={() => toggleId(m.id)}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-all',
                      active
                        ? 'bg-red-500/10 border border-red-500/25'
                        : 'hover:bg-white/5 border border-transparent'
                    )}>
                    {active
                      ? <CheckSquare className="w-4 h-4 text-red-400 shrink-0"/>
                      : <Square className="w-4 h-4 text-muted-foreground/40 shrink-0"/>}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-white truncate">{label}</p>
                      <p className="text-[10px] text-muted-foreground">{m.date} · {m.map} · {m.type} · {m.rounds?.length || 0} rondas</p>
                    </div>
                    <span className={cn('text-xs font-bold shrink-0', won ? 'text-green-400' : 'text-red-400')}>
                      {m.scoreUs}–{m.scoreOpp}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="glass-card p-5">
        <h2 className="text-xl font-bold flex items-center gap-2 mb-1">
          <DollarSign className="w-5 h-5 text-green-400" /> Eco Patterns
        </h2>
        <p className="text-sm text-muted-foreground">
          Análisis de winrate por tipo de compra — {roundStats.totalRoundsAnalyzed} rondas de {matchesWithRounds} partidos.
        </p>
      </div>

      {/* Main buy type cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Object.entries(stats).filter(([, v]) => v.total > 0).map(([bt, v]) => {
          const cfg = BUY_CONFIG[bt as keyof typeof BUY_CONFIG];
          const wr = v.total > 0 ? v.wins / v.total * 100 : 0;
          const atkWr = v.atkTotal > 0 ? v.atkWins / v.atkTotal * 100 : 0;
          const defWr = v.defTotal > 0 ? v.defWins / v.defTotal * 100 : 0;
          const momentum = v.afterWinTotal > 0 ? v.afterWin / v.afterWinTotal * 100 : 0;

          return (
            <div key={bt} className={cn("rounded-xl p-4 border space-y-3", cfg.bg, cfg.border)}>
              <div className="flex items-center justify-between">
                <p className="font-bold text-sm">{cfg.label}</p>
                <span className="text-xs text-muted-foreground">{v.total} rondas</span>
              </div>
              <div className="text-center">
                <p className="text-3xl font-black" style={{ color: cfg.color }}>{wr.toFixed(0)}%</p>
                <p className="text-xs text-muted-foreground">Win Rate</p>
              </div>
              <div className="space-y-1.5">
                <WrBar value={atkWr} label="🗡 ATK" color={cfg.color} />
                <WrBar value={defWr} label="🛡 DEF" color={cfg.color} />
              </div>
              {v.afterWinTotal >= 3 && (
                <div className="pt-2 border-t border-white/10">
                  <p className="text-xs text-muted-foreground">Momentum tras ganar</p>
                  <p className="text-sm font-bold" style={{ color: cfg.color }}>{momentum.toFixed(0)}%</p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Chart comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="glass-card p-5">
          <h3 className="font-semibold mb-4">WR por Tipo de Compra y Lado</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} barCategoryGap="30%">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 15% 20%)" />
                <XAxis dataKey="name" stroke="hsl(215 15% 55%)" fontSize={11} />
                <YAxis stroke="hsl(215 15% 55%)" fontSize={11} domain={[0, 100]} />
                <Tooltip contentStyle={{ background: 'hsl(220 22% 8%)', border: '1px solid hsl(220 15% 20%)', borderRadius: 8 }}
                  formatter={(v: number) => `${v}%`} />
                <Bar dataKey="atkWr" name="ATK WR" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                <Bar dataKey="defWr" name="DEF WR" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass-card p-5">
          <h3 className="font-semibold mb-4">Radar ATK vs DEF por Compra</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData}>
                <PolarGrid stroke="hsl(220 15% 25%)" />
                <PolarAngleAxis dataKey="axis" tick={{ fill: 'hsl(215 15% 65%)', fontSize: 11 }} />
                <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                <Radar dataKey="ATK" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.2} name="ATK" />
                <Radar dataKey="DEF" stroke="#6366f1" fill="#6366f1" fillOpacity={0.2} name="DEF" />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Economy breaks */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="glass-card p-5">
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-green-400" /> Economy Breaks
          </h3>
          <p className="text-xs text-muted-foreground mb-3">Veces que ganáis siendo el equipo con menos economía.</p>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>Nuestros breaks</span>
                <span className="font-bold text-green-400">{econBreaks.breakRate.toFixed(0)}%</span>
              </div>
              <div className="h-3 rounded-full" style={{ background: 'hsl(220 15% 15%)' }}>
                <div className="h-full rounded-full bg-green-500" style={{ width: `${Math.min(econBreaks.breakRate, 100)}%` }} />
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">{econBreaks.breakAttempts} intentos</p>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>Nos rompen la eco</span>
                <span className="font-bold text-red-400">{econBreaks.gotBrokenRate.toFixed(0)}%</span>
              </div>
              <div className="h-3 rounded-full" style={{ background: 'hsl(220 15% 15%)' }}>
                <div className="h-full rounded-full bg-red-500" style={{ width: `${Math.min(econBreaks.gotBrokenRate, 100)}%` }} />
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">{econBreaks.brokeAgainstAttempts} intentos</p>
            </div>
          </div>
        </div>

        {/* Sequences */}
        {sequenceAnalysis.length > 0 && (
          <div className="glass-card p-5">
            <h3 className="font-semibold mb-3">Secuencias de Compra más Exitosas</h3>
            <p className="text-xs text-muted-foreground mb-3">Secuencias de 3 rondas consecutivas con mayor WR.</p>
            <div className="space-y-2">
              {sequenceAnalysis.slice(0, 5).map((s, i) => (
                <div key={i} className="flex items-center gap-3 p-2 rounded-lg" style={{ background: 'hsl(220 15% 10%)' }}>
                  <span className="text-xs font-mono text-muted-foreground w-5">{i + 1}.</span>
                  <div className="flex items-center gap-1 flex-1 flex-wrap">
                    {s.seq.split('→').map((bt, j) => {
                      const cfg = BUY_CONFIG[bt as keyof typeof BUY_CONFIG];
                      return (
                        <span key={j} className={cn("text-[10px] px-1.5 py-0.5 rounded font-bold", cfg?.bg, cfg?.border, 'border')}
                          style={{ color: cfg?.color }}>{cfg?.label || bt}</span>
                      );
                    })}
                  </div>
                  <span className={cn("text-sm font-bold", s.wr >= 60 ? 'text-green-400' : 'text-yellow-400')}>{s.wr.toFixed(0)}%</span>
                  <span className="text-xs text-muted-foreground">{s.total}x</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
