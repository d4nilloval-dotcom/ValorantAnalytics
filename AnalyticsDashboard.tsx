import { useState, useMemo, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/store/appStore';
import type { Match, MatchType } from '@/types';
import { VALORANT_MAPS } from '@/types';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip,
  CartesianGrid, ResponsiveContainer, ReferenceLine, Cell,
} from 'recharts';
import {
  Target, TrendingUp, TrendingDown, Flame, Bell, AlertTriangle,
  Map, Clock, ChevronDown, Filter, X,
} from 'lucide-react';

// ── Helpers ────────────────────────────────────────────────────────────────────
const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : 0);
const isOT = (m: Match) => m.otWin > 0 || m.otLoss > 0 || (m.scoreUs + m.scoreOpp > 24);

const ALL_TYPES: { id: MatchType; label: string }[] = [
  { id: 'SCRIM', label: 'Scrim' }, { id: 'PREMIER', label: 'Premier' },
  { id: 'OFICIAL', label: 'Oficial' }, { id: 'TOURNAMENT', label: 'Torneo' },
  { id: 'CUSTOM', label: 'Custom' },
];

function pctColor(v: number, lo = 45, hi = 55) {
  return v >= hi ? '#22c55e' : v >= lo ? '#facc15' : '#ef4444';
}

function MiniBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-white/8">
        <div className="h-full rounded-full" style={{ width: `${value}%`, background: color }} />
      </div>
      <span className="text-[10px] font-mono w-8 text-right" style={{ color }}>{value}%</span>
    </div>
  );
}

function KPICard({ label, value, sub, color = '#fff', icon: Icon }:
  { label: string; value: string | number; sub?: string; color?: string; icon?: any }) {
  return (
    <div className="glass-card p-4 space-y-1">
      <div className="flex items-center gap-2">
        {Icon && <Icon className="w-3.5 h-3.5" style={{ color }} />}
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
      </div>
      <p className="text-2xl font-black" style={{ color }}>{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border p-3 text-xs shadow-2xl space-y-1"
      style={{ background: 'hsl(220 22% 10%)', borderColor: 'hsl(220 15% 22%)' }}>
      <p className="font-bold text-white mb-1">{label}</p>
      {payload.map((p: any) => (
        <div key={p.name} className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full shrink-0" style={{ background: p.color }} />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="font-mono font-bold" style={{ color: p.color }}>
            {typeof p.value === 'number' && p.name.includes('%') ? `${p.value}%` : p.value}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Detector de inflexión ─────────────────────────────────────────────────────
type AlertSeverity = 'warning' | 'danger' | 'ok';
interface InflexionAlert {
  metric: string;
  streak: number;
  direction: 'down' | 'up';
  severity: AlertSeverity;
  detail: string;
}

function detectInflexions(matches: Match[]): InflexionAlert[] {
  if (matches.length < 3) return [];
  const sorted = [...matches].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const recent = sorted.slice(-10);
  const alerts: InflexionAlert[] = [];

  const check = (
    metric: string,
    values: number[],
    threshold: number,
    direction: 'down' | 'up',
    detail: (streak: number) => string
  ) => {
    let streak = 0;
    for (let i = values.length - 1; i >= 0; i--) {
      if ((direction === 'down' && values[i] < threshold) ||
          (direction === 'up'   && values[i] > threshold)) streak++;
      else break;
    }
    if (streak >= 3) {
      alerts.push({
        metric, streak, direction,
        severity: streak >= 5 ? 'danger' : 'warning',
        detail: detail(streak),
      });
    }
  };

  // Win/loss streak
  const wons = recent.map(m => m.won ? 1 : 0);
  let winStreak = 0, lossStreak = 0;
  for (let i = wons.length - 1; i >= 0; i--) {
    if (wons[i] === 0) lossStreak++; else break;
  }
  for (let i = wons.length - 1; i >= 0; i--) {
    if (wons[i] === 1) winStreak++; else break;
  }
  if (lossStreak >= 3) alerts.push({ metric: 'Racha de derrotas', streak: lossStreak, direction: 'down', severity: lossStreak >= 5 ? 'danger' : 'warning', detail: `Llevas ${lossStreak} partidos perdidos seguidos.` });
  if (winStreak >= 3) alerts.push({ metric: 'Racha de victorias', streak: winStreak, direction: 'up', severity: 'ok', detail: `¡Llevas ${winStreak} partidos ganados seguidos!` });

  // ATK
  const half = (m: Match) => (m.scoreUs + m.scoreOpp) / 2;
  check('% Victoria ATK', recent.map(m => pct(m.atk || 0, half(m))), 40, 'down', s => `ATK por debajo del 40% durante ${s} partidos seguidos.`);
  // DEF
  check('% Victoria DEF', recent.map(m => pct(m.def || 0, half(m))), 40, 'down', s => `DEF por debajo del 40% durante ${s} partidos seguidos.`);
  // Pistola ATK
  const pistolAtk = recent.map(m => m.pistolAtkWin ? 1 : 0);
  let pAtkStreak = 0;
  for (let i = pistolAtk.length - 1; i >= 0; i--) { if (pistolAtk[i] === 0) pAtkStreak++; else break; }
  if (pAtkStreak >= 3) alerts.push({ metric: 'Pistola ATK', streak: pAtkStreak, direction: 'down', severity: pAtkStreak >= 5 ? 'danger' : 'warning', detail: `Llevas ${pAtkStreak} pistolas ATK perdidas seguidas.` });
  // Pistola DEF
  const pistolDef = recent.map(m => m.pistolDefWin ? 1 : 0);
  let pDefStreak = 0;
  for (let i = pistolDef.length - 1; i >= 0; i--) { if (pistolDef[i] === 0) pDefStreak++; else break; }
  if (pDefStreak >= 3) alerts.push({ metric: 'Pistola DEF', streak: pDefStreak, direction: 'down', severity: pDefStreak >= 5 ? 'danger' : 'warning', detail: `Llevas ${pDefStreak} pistolas DEF perdidas seguidas.` });
  // Post-plant
  check('% Post-plant', recent.map(m => pct(m.postWin || 0, (m.postWin || 0) + (m.postLoss || 0))), 40, 'down', s => `Post-plant por debajo del 40% durante ${s} partidos seguidos.`);
  // Retake
  check('% Retake', recent.map(m => pct(m.retakeWin || 0, (m.retakeWin || 0) + (m.retakeLoss || 0))), 35, 'down', s => `Retake por debajo del 35% durante ${s} partidos seguidos.`);

  return alerts.sort((a, b) => (b.severity === 'danger' ? 2 : b.severity === 'warning' ? 1 : 0) - (a.severity === 'danger' ? 2 : a.severity === 'warning' ? 1 : 0));
}

// ── Componente principal ───────────────────────────────────────────────────────
const TABS = [
  { id: 'pistolas',    label: '🔫 Pistolas' },
  { id: 'ot',         label: '⏱ Overtime' },
  { id: 'heatmap',    label: '🗺 Mapa de calor' },
  { id: 'progresion', label: '📈 Progresión' },
  { id: 'inflexion',  label: '🚨 Alertas' },
] as const;
type SubTab = typeof TABS[number]['id'];

export function AnalyticsDashboard() {
  const { matches: matchMap } = useAppStore();
  const all: Match[] = Object.values(matchMap);

  const [tab,           setTab]           = useState<SubTab>('pistolas');
  const [showFilters,   setShowFilters]   = useState(false);
  const [selectedMap,   setSelectedMap]   = useState('Todos');
  const [selectedTypes, setSelectedTypes] = useState<MatchType[]>([]);
  const [progDays,      setProgDays]      = useState<7 | 14 | 30 | 90>(30);
  const [dismissedAlerts, setDismissedAlerts] = useState<string[]>([]);

  const maps = useMemo(() => {
    const used = new Set(all.map(m => m.map).filter(Boolean));
    return ['Todos', ...VALORANT_MAPS.filter(m => used.has(m))];
  }, [all]);

  const filtered = useMemo(() => {
    return all.filter(m => {
      if (selectedMap !== 'Todos' && m.map !== selectedMap) return false;
      if (selectedTypes.length > 0 && !selectedTypes.includes(m.type)) return false;
      return true;
    }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [all, selectedMap, selectedTypes]);

  const toggleType = (t: MatchType) =>
    setSelectedTypes(p => p.includes(t) ? p.filter(x => x !== t) : [...p, t]);

  // ── Alertas de inflexión ────────────────────────────────────────────────────
  const alerts = useMemo(() => detectInflexions(filtered), [filtered]);
  const activeAlerts = alerts.filter(a => !dismissedAlerts.includes(a.metric + a.streak));
  const dangerCount  = activeAlerts.filter(a => a.severity === 'danger').length;
  const warnCount    = activeAlerts.filter(a => a.severity === 'warning').length;

  // ── Datos de PISTOLAS ──────────────────────────────────────────────────────
  const pistolaStats = useMemo(() => {
    const n = filtered.length;
    if (!n) return null;
    const atkW    = filtered.filter(m => m.pistolAtkWin).length;
    const defW    = filtered.filter(m => m.pistolDefWin).length;
    const bothW   = filtered.filter(m => m.pistolAtkWin && m.pistolDefWin).length;
    const noneW   = filtered.filter(m => !m.pistolAtkWin && !m.pistolDefWin).length;

    // Impacto en resultado
    const winWhenAtkPistol = filtered.filter(m => m.pistolAtkWin && m.won).length;
    const winWhenDefPistol = filtered.filter(m => m.pistolDefWin && m.won).length;
    const winWhenBoth      = filtered.filter(m => m.pistolAtkWin && m.pistolDefWin && m.won).length;
    const winWhenNone      = filtered.filter(m => !m.pistolAtkWin && !m.pistolDefWin && m.won).length;

    // Racha after pistol
    const sorted = filtered;
    const afterAtkWin: boolean[]  = [];
    const afterDefWin: boolean[]  = [];
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i - 1].pistolAtkWin) afterAtkWin.push(sorted[i].won);
      if (sorted[i - 1].pistolDefWin) afterDefWin.push(sorted[i].won);
    }

    // Historial de pistolas por partido para el gráfico
    const chart = sorted.map((m, i) => ({
      n: i + 1,
      atk: m.pistolAtkWin ? 1 : 0,
      def: m.pistolDefWin ? 1 : 0,
      won: m.won,
      map: m.map,
    }));

    return {
      n, atkW, defW, bothW, noneW,
      atkPct: pct(atkW, n),
      defPct: pct(defW, n),
      bothPct: pct(bothW, n),
      nonePct: pct(noneW, n),
      winWhenAtkPct: pct(winWhenAtkPistol, atkW),
      winWhenDefPct: pct(winWhenDefPistol, defW),
      winWhenBothPct: pct(winWhenBoth, bothW),
      winWhenNonePct: pct(winWhenNone, noneW),
      afterAtkWinPct: pct(afterAtkWin.filter(Boolean).length, afterAtkWin.length),
      afterDefWinPct: pct(afterDefWin.filter(Boolean).length, afterDefWin.length),
      chart,
    };
  }, [filtered]);

  // ── Datos de OT ───────────────────────────────────────────────────────────
  const otStats = useMemo(() => {
    const otMatches   = filtered.filter(isOT);
    const nonOT       = filtered.filter(m => !isOT(m));
    const otWins      = otMatches.filter(m => m.won).length;
    const byMap: Record<string, { ot: number; total: number; wins: number }> = {};
    for (const m of filtered) {
      if (!m.map) continue;
      if (!byMap[m.map]) byMap[m.map] = { ot: 0, total: 0, wins: 0 };
      byMap[m.map].total++;
      if (isOT(m)) byMap[m.map].ot++;
      if (m.won) byMap[m.map].wins++;
    }
    const mapData = Object.entries(byMap)
      .map(([map, s]) => ({ map, otPct: pct(s.ot, s.total), ot: s.ot, total: s.total, wr: pct(s.wins, s.total) }))
      .sort((a, b) => b.otPct - a.otPct);

    return {
      total:       filtered.length,
      otCount:     otMatches.length,
      otPct:       pct(otMatches.length, filtered.length),
      otWrPct:     pct(otWins, otMatches.length),
      nonOtWrPct:  pct(nonOT.filter(m => m.won).length, nonOT.length),
      mapData,
    };
  }, [filtered]);

  // ── Mapa de calor (mapa × modo) ────────────────────────────────────────────
  const heatmapData = useMemo(() => {
    const types   = ALL_TYPES.map(t => t.id);
    const mapList = VALORANT_MAPS.filter(map => filtered.some(m => m.map === map));
    const cells: Record<string, Record<string, { wr: number; n: number; wins: number }>> = {};
    for (const map of mapList) {
      cells[map] = {};
      for (const type of types) {
        const ms = filtered.filter(m => m.map === map && m.type === type);
        cells[map][type] = { n: ms.length, wins: ms.filter(m => m.won).length, wr: pct(ms.filter(m => m.won).length, ms.length) };
      }
    }
    return { cells, mapList, types };
  }, [filtered]);

  // ── Progresión temporal ────────────────────────────────────────────────────
  const progData = useMemo(() => {
    const cutoff = Date.now() - progDays * 86400000;
    const inRange = filtered.filter(m => new Date(m.date).getTime() >= cutoff);
    if (inRange.length < 2) return [];

    // Rolling WR últimos 5
    return inRange.map((m, i) => {
      const window = inRange.slice(Math.max(0, i - 4), i + 1);
      const wr     = pct(window.filter(x => x.won).length, window.length);
      const atkWr  = pct(window.reduce((s, x) => s + (x.atk || 0), 0),
                         window.reduce((s, x) => s + (x.scoreUs + x.scoreOpp) / 2, 0));
      const defWr  = pct(window.reduce((s, x) => s + (x.def || 0), 0),
                         window.reduce((s, x) => s + (x.scoreUs + x.scoreOpp) / 2, 0));
      const date   = new Date(m.date).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' });
      return { i: i + 1, date, wr, atkWr, defWr, won: m.won, map: m.map };
    });
  }, [filtered, progDays]);

  if (all.length === 0) {
    return (
      <div className="p-6">
        <div className="glass-card p-10 text-center">
          <TrendingUp className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3"/>
          <p className="text-muted-foreground">No hay partidos registrados todavía.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-black">Analytics Dashboard</h2>
          <p className="text-sm text-muted-foreground">Pistolas · OT · Mapa de calor · Progresión · Alertas</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Badge alertas */}
          {(dangerCount + warnCount) > 0 && (
            <button onClick={() => setTab('inflexion')}
              className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all',
                dangerCount > 0 ? 'bg-red-500/15 border-red-500/40 text-red-300 animate-pulse'
                  : 'bg-yellow-500/10 border-yellow-500/30 text-yellow-300')}>
              <Bell className="w-3.5 h-3.5"/>
              {dangerCount + warnCount} alerta{dangerCount + warnCount > 1 ? 's' : ''}
            </button>
          )}
          <button onClick={() => setShowFilters(v => !v)}
            className={cn('flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs transition-all',
              showFilters ? 'bg-red-500/15 border-red-500/40 text-white' : 'border-white/10 text-muted-foreground hover:text-white')}>
            <Filter className="w-3.5 h-3.5"/>
            Filtros
            {(selectedMap !== 'Todos' || selectedTypes.length > 0) &&
              <span className="w-1.5 h-1.5 rounded-full bg-red-400"/>}
          </button>
        </div>
      </div>

      {/* Filtros */}
      {showFilters && (
        <div className="glass-card p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Mapa</p>
              <div className="flex flex-wrap gap-1">
                {maps.map(m => (
                  <button key={m} onClick={() => setSelectedMap(m)}
                    className={cn('text-xs px-2.5 py-1 rounded-lg border transition-all',
                      selectedMap === m ? 'bg-red-500/20 border-red-500/40 text-white' : 'border-white/10 text-muted-foreground hover:text-white')}>
                    {m}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Modo (multi)</p>
              <div className="flex flex-wrap gap-1">
                {ALL_TYPES.map(({ id, label }) => (
                  <button key={id} onClick={() => toggleType(id)}
                    className={cn('text-xs px-2.5 py-1 rounded-lg border transition-all',
                      selectedTypes.includes(id) ? 'bg-blue-500/20 border-blue-500/40 text-blue-300' : 'border-white/10 text-muted-foreground hover:text-white')}>
                    {selectedTypes.includes(id) ? '✓ ' : ''}{label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground border-t border-white/8 pt-2">
            <span><span className="text-white font-bold">{filtered.length}</span> de {all.length} partidos</span>
            {(selectedMap !== 'Todos' || selectedTypes.length > 0) &&
              <button onClick={() => { setSelectedMap('Todos'); setSelectedTypes([]); }}
                className="text-red-400 hover:text-red-300">× Limpiar</button>}
          </div>
        </div>
      )}

      {/* Sub-tabs */}
      <div className="flex gap-1 flex-wrap border-b border-white/8 pb-1">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={cn('px-3 py-2 rounded-t-lg text-xs font-medium transition-all relative',
              tab === t.id ? 'bg-red-500/15 border border-red-500/30 border-b-transparent text-white' : 'text-muted-foreground hover:text-white')}>
            {t.label}
            {t.id === 'inflexion' && (dangerCount + warnCount) > 0 && (
              <span className={cn('absolute -top-1 -right-1 w-4 h-4 rounded-full text-[9px] flex items-center justify-center font-bold',
                dangerCount > 0 ? 'bg-red-500' : 'bg-yellow-500')}>
                {dangerCount + warnCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── TAB PISTOLAS ──────────────────────────────────────────────────── */}
      {tab === 'pistolas' && pistolaStats && (
        <div className="space-y-5">
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KPICard label="Pistola ATK ganada" value={`${pistolaStats.atkPct}%`}
              sub={`${pistolaStats.atkW} de ${pistolaStats.n}`}
              color={pctColor(pistolaStats.atkPct)} icon={Target}/>
            <KPICard label="Pistola DEF ganada" value={`${pistolaStats.defPct}%`}
              sub={`${pistolaStats.defW} de ${pistolaStats.n}`}
              color={pctColor(pistolaStats.defPct)} icon={Target}/>
            <KPICard label="Ambas pistolas" value={`${pistolaStats.bothPct}%`}
              sub={`${pistolaStats.bothW} partidos`}
              color={pctColor(pistolaStats.bothPct, 20, 40)} icon={Flame}/>
            <KPICard label="Ninguna pistola" value={`${pistolaStats.nonePct}%`}
              sub={`${pistolaStats.noneW} partidos`}
              color="#94a3b8" icon={Target}/>
          </div>

          {/* Impacto en resultado */}
          <div className="glass-card p-4">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-4">
              Impacto de las pistolas en el resultado del partido
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Si ganamos pistola ATK */}
              <div className="space-y-3">
                <p className="text-sm font-semibold">Si ganamos pistola <span className="text-yellow-400">ATK</span></p>
                <div className="space-y-2">
                  <div>
                    <p className="text-[10px] text-muted-foreground mb-1">% Victoria del partido</p>
                    <MiniBar value={pistolaStats.winWhenAtkPct} color={pctColor(pistolaStats.winWhenAtkPct)}/>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground mb-1">% Victoria siguiente partido</p>
                    <MiniBar value={pistolaStats.afterAtkWinPct} color={pctColor(pistolaStats.afterAtkWinPct)}/>
                  </div>
                </div>
              </div>
              {/* Si ganamos pistola DEF */}
              <div className="space-y-3">
                <p className="text-sm font-semibold">Si ganamos pistola <span className="text-blue-400">DEF</span></p>
                <div className="space-y-2">
                  <div>
                    <p className="text-[10px] text-muted-foreground mb-1">% Victoria del partido</p>
                    <MiniBar value={pistolaStats.winWhenDefPct} color={pctColor(pistolaStats.winWhenDefPct)}/>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground mb-1">% Victoria siguiente partido</p>
                    <MiniBar value={pistolaStats.afterDefWinPct} color={pctColor(pistolaStats.afterDefWinPct)}/>
                  </div>
                </div>
              </div>

              {/* Ganar ambas */}
              <div className="space-y-2">
                <p className="text-sm font-semibold">Si ganamos <span className="text-green-400">ambas pistolas</span></p>
                <p className="text-[10px] text-muted-foreground mb-1">% Victoria del partido</p>
                <MiniBar value={pistolaStats.winWhenBothPct} color="#22c55e"/>
              </div>
              {/* No ganar ninguna */}
              <div className="space-y-2">
                <p className="text-sm font-semibold">Si <span className="text-red-400">no ganamos ninguna</span></p>
                <p className="text-[10px] text-muted-foreground mb-1">% Victoria del partido</p>
                <MiniBar value={pistolaStats.winWhenNonePct} color="#ef4444"/>
              </div>
            </div>
          </div>

          {/* Historial gráfico */}
          <div className="glass-card p-4">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-4">
              Pistolas por partido (1=ganada, 0=perdida)
            </p>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={pistolaStats.chart} barSize={10} barGap={2}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)"/>
                <XAxis dataKey="n" tick={{ fontSize: 8, fill: 'rgba(255,255,255,0.3)' }}/>
                <YAxis domain={[0, 1]} ticks={[0, 1]} tick={{ fontSize: 8, fill: 'rgba(255,255,255,0.3)' }}/>
                <Tooltip content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  const d = pistolaStats.chart[Number(label) - 1];
                  return (
                    <div className="rounded-xl border p-2 text-xs" style={{ background: 'hsl(220 22% 10%)', borderColor: 'hsl(220 15% 22%)' }}>
                      <p className="font-bold mb-1">P{label} — {d?.map}</p>
                      <p className={d?.won ? 'text-green-400' : 'text-red-400'}>{d?.won ? 'Victoria' : 'Derrota'}</p>
                      <p className="text-yellow-400">ATK: {d?.atk ? '✓' : '✗'}</p>
                      <p className="text-blue-400">DEF: {d?.def ? '✓' : '✗'}</p>
                    </div>
                  );
                }}/>
                <Bar dataKey="atk" name="ATK" fill="#f59e0b" radius={[2, 2, 0, 0]}/>
                <Bar dataKey="def" name="DEF" fill="#3b82f6" radius={[2, 2, 0, 0]}/>
              </BarChart>
            </ResponsiveContainer>
            <div className="flex gap-4 mt-1 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-yellow-500 inline-block"/>ATK</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-blue-500 inline-block"/>DEF</span>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB OT ───────────────────────────────────────────────────────── */}
      {tab === 'ot' && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KPICard label="Partidos en OT" value={otStats.otCount}
              sub={`${otStats.otPct}% del total`} color="#f59e0b" icon={Clock}/>
            <KPICard label="WR en OT" value={`${otStats.otWrPct}%`}
              sub="partidos que llegan a prórroga" color={pctColor(otStats.otWrPct)} icon={TrendingUp}/>
            <KPICard label="WR sin OT" value={`${otStats.nonOtWrPct}%`}
              sub="partidos decididos antes" color={pctColor(otStats.nonOtWrPct)} icon={TrendingUp}/>
            <KPICard label="Total filtrado" value={otStats.total}
              sub={`${otStats.otCount} van a OT`} color="#94a3b8"/>
          </div>

          <div className="glass-card p-4">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-4">
              Partidos a OT por mapa — % de partidos que van a prórroga
            </p>
            {otStats.mapData.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Sin datos suficientes.</p>
            ) : (
              <div className="space-y-3">
                {otStats.mapData.map(d => (
                  <div key={d.map} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold">{d.map}</span>
                      <div className="flex gap-4 text-muted-foreground">
                        <span>{d.ot} OT de {d.total}</span>
                        <span className={cn('font-bold', d.otPct >= 30 ? 'text-yellow-400' : 'text-white/50')}>
                          {d.otPct}% OT
                        </span>
                        <span style={{ color: pctColor(d.wr) }}>{d.wr}% WR</span>
                      </div>
                    </div>
                    <div className="flex gap-1 h-2">
                      <div className="rounded-l-full" style={{ width: `${d.otPct}%`, background: '#f59e0b', minWidth: d.ot > 0 ? 4 : 0 }}/>
                      <div className="rounded-r-full flex-1 bg-white/8"/>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Tabla detalle */}
          <div className="glass-card p-4">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Partidos en OT</p>
            <div className="overflow-x-auto rounded-xl border" style={{ borderColor: 'hsl(220 15% 15%)' }}>
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left uppercase tracking-wider text-muted-foreground border-b"
                    style={{ borderColor: 'hsl(220 15% 15%)', background: 'hsl(220 20% 9%)' }}>
                    <th className="px-3 py-2">Fecha</th>
                    <th className="px-3 py-2">Mapa</th>
                    <th className="px-3 py-2">Resultado</th>
                    <th className="px-3 py-2">Marcador</th>
                    <th className="px-3 py-2">Modo</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.filter(isOT).slice().reverse().map((m, i) => (
                    <tr key={i} className="border-b hover:bg-white/3" style={{ borderColor: 'hsl(220 15% 12%)' }}>
                      <td className="px-3 py-2 text-muted-foreground">{m.date}</td>
                      <td className="px-3 py-2 font-semibold">{m.map}</td>
                      <td className={cn('px-3 py-2 font-bold', m.won ? 'text-green-400' : 'text-red-400')}>
                        {m.won ? 'Victoria' : 'Derrota'}
                      </td>
                      <td className="px-3 py-2 font-mono">{m.scoreUs}–{m.scoreOpp}</td>
                      <td className="px-3 py-2 text-muted-foreground text-[10px]">{m.type}</td>
                    </tr>
                  ))}
                  {filtered.filter(isOT).length === 0 && (
                    <tr><td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">Sin partidos en OT con los filtros actuales.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB MAPA DE CALOR ─────────────────────────────────────────────── */}
      {tab === 'heatmap' && (
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">
            WR por mapa y tipo de partido. Número = % victorias · N = partidos jugados.
            <span className="ml-2 inline-flex gap-2">
              <span className="text-green-400">■ ≥55%</span>
              <span className="text-yellow-400">■ 45–55%</span>
              <span className="text-red-400">■ &lt;45%</span>
            </span>
          </p>

          {heatmapData.mapList.length === 0 ? (
            <div className="glass-card p-8 text-center text-muted-foreground text-sm">Sin datos.</div>
          ) : (
            <div className="overflow-x-auto rounded-xl border" style={{ borderColor: 'hsl(220 15% 15%)' }}>
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left uppercase tracking-wider text-muted-foreground border-b"
                    style={{ borderColor: 'hsl(220 15% 15%)', background: 'hsl(220 20% 9%)' }}>
                    <th className="px-4 py-3">Mapa</th>
                    {ALL_TYPES.map(t => (
                      <th key={t.id} className="px-3 py-3 text-center">{t.label}</th>
                    ))}
                    <th className="px-3 py-3 text-center">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {heatmapData.mapList.map(map => {
                    const totalMs = filtered.filter(m => m.map === map);
                    const totalWr = pct(totalMs.filter(m => m.won).length, totalMs.length);
                    return (
                      <tr key={map} className="border-b hover:bg-white/3"
                        style={{ borderColor: 'hsl(220 15% 12%)' }}>
                        <td className="px-4 py-3 font-semibold">{map}</td>
                        {ALL_TYPES.map(({ id }) => {
                          const cell = heatmapData.cells[map]?.[id];
                          if (!cell || cell.n === 0) return (
                            <td key={id} className="px-3 py-3 text-center text-muted-foreground/30">—</td>
                          );
                          const c = pctColor(cell.wr);
                          return (
                            <td key={id} className="px-3 py-3 text-center">
                              <div className="inline-flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg"
                                style={{ background: `${c}18` }}>
                                <span className="font-bold text-sm" style={{ color: c }}>{cell.wr}%</span>
                                <span className="text-[9px] text-muted-foreground">{cell.n}p</span>
                              </div>
                            </td>
                          );
                        })}
                        <td className="px-3 py-3 text-center">
                          <div className="inline-flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg"
                            style={{ background: `${pctColor(totalWr)}18` }}>
                            <span className="font-bold text-sm" style={{ color: pctColor(totalWr) }}>{totalWr}%</span>
                            <span className="text-[9px] text-muted-foreground">{totalMs.length}p</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── TAB PROGRESIÓN ────────────────────────────────────────────────── */}
      {tab === 'progresion' && (
        <div className="space-y-5">
          {/* Selector días */}
          <div className="flex gap-2">
            {([7, 14, 30, 90] as const).map(d => (
              <button key={d} onClick={() => setProgDays(d)}
                className={cn('text-xs px-3 py-1.5 rounded-lg border transition-all',
                  progDays === d ? 'bg-red-500/20 border-red-500/40 text-white' : 'border-white/10 text-muted-foreground hover:text-white')}>
                Últimos {d}d
              </button>
            ))}
          </div>

          {progData.length < 2 ? (
            <div className="glass-card p-8 text-center text-muted-foreground text-sm">
              Sin suficientes partidos en los últimos {progDays} días.
            </div>
          ) : (
            <>
              {/* WR rolling */}
              <div className="glass-card p-4">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">
                  Win Rate (media móvil últimos 5 partidos)
                </p>
                <p className="text-[10px] text-muted-foreground mb-4">
                  Cada punto = WR de los 5 partidos anteriores — suaviza la volatilidad partido a partido
                </p>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={progData} margin={{ top: 4, right: 4, bottom: 4, left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)"/>
                    <XAxis dataKey="date" tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.35)' }}/>
                    <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.35)' }}
                      tickFormatter={v => `${v}%`}/>
                    <Tooltip content={<CustomTooltip/>}/>
                    <ReferenceLine y={50} stroke="rgba(255,255,255,0.18)" strokeDasharray="5 4"
                      label={{ value: '50%', position: 'right', fontSize: 9, fill: 'rgba(255,255,255,0.3)' }}/>
                    <Line type="monotone" dataKey="wr" name="WR%" stroke="#ef4444" strokeWidth={2.5}
                      dot={(p: any) => (
                        <circle cx={p.cx} cy={p.cy} r={4}
                          fill={p.payload.won ? '#22c55e' : '#ef4444'}
                          stroke={p.payload.won ? '#22c55e' : '#ef4444'}
                          strokeWidth={1}/>
                      )}/>
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* ATK/DEF rolling */}
              <div className="glass-card p-4">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-4">
                  ATK% y DEF% (media móvil)
                </p>
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart data={progData} margin={{ top: 4, right: 4, bottom: 4, left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)"/>
                    <XAxis dataKey="date" tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.35)' }}/>
                    <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.35)' }}
                      tickFormatter={v => `${v}%`}/>
                    <Tooltip content={<CustomTooltip/>}/>
                    <ReferenceLine y={50} stroke="rgba(255,255,255,0.12)" strokeDasharray="5 4"/>
                    <Line type="monotone" dataKey="atkWr" name="ATK%" stroke="#f59e0b" strokeWidth={2} dot={false}/>
                    <Line type="monotone" dataKey="defWr" name="DEF%" stroke="#3b82f6" strokeWidth={2} dot={false}/>
                  </LineChart>
                </ResponsiveContainer>
                <div className="flex gap-4 mt-1 text-[10px] text-muted-foreground">
                  <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-yellow-500 inline-block rounded"/>ATK%</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-blue-500 inline-block rounded"/>DEF%</span>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── TAB ALERTAS / INFLEXIÓN ───────────────────────────────────────── */}
      {tab === 'inflexion' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Detecta métricas que llevan <strong className="text-white">3+ partidos</strong> consecutivos por debajo
              del umbral mínimo esperado. Basado en los últimos 10 partidos del filtro actual.
            </p>
            {dismissedAlerts.length > 0 && (
              <button onClick={() => setDismissedAlerts([])}
                className="text-xs text-muted-foreground hover:text-white transition-colors">
                Mostrar todo
              </button>
            )}
          </div>

          {activeAlerts.length === 0 ? (
            <div className="glass-card p-8 text-center space-y-2">
              <div className="w-12 h-12 rounded-full bg-green-500/15 flex items-center justify-center mx-auto">
                <TrendingUp className="w-6 h-6 text-green-400"/>
              </div>
              <p className="text-white font-semibold">Sin alertas activas</p>
              <p className="text-xs text-muted-foreground">
                Todas las métricas están dentro de los umbrales normales.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {activeAlerts.map((a, i) => {
                const key = a.metric + a.streak;
                const isOkay = a.severity === 'ok';
                return (
                  <div key={i} className={cn('rounded-xl border p-4 flex items-start justify-between gap-3',
                    isOkay ? 'bg-green-500/8 border-green-500/25' :
                    a.severity === 'danger' ? 'bg-red-500/10 border-red-500/30' :
                    'bg-yellow-500/8 border-yellow-500/25')}>
                    <div className="flex items-start gap-3">
                      <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5',
                        isOkay ? 'bg-green-500/20' :
                        a.severity === 'danger' ? 'bg-red-500/20' : 'bg-yellow-500/15')}>
                        {isOkay
                          ? <TrendingUp className="w-4 h-4 text-green-400"/>
                          : a.severity === 'danger'
                            ? <AlertTriangle className="w-4 h-4 text-red-400"/>
                            : <Bell className="w-4 h-4 text-yellow-400"/>}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-0.5">
                          <p className={cn('text-sm font-bold',
                            isOkay ? 'text-green-400' :
                            a.severity === 'danger' ? 'text-red-400' : 'text-yellow-400')}>
                            {a.metric}
                          </p>
                          <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-bold',
                            isOkay ? 'bg-green-500/20 text-green-400' :
                            a.severity === 'danger' ? 'bg-red-500/20 text-red-300' : 'bg-yellow-500/15 text-yellow-300')}>
                            {a.streak} seguidos
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">{a.detail}</p>
                      </div>
                    </div>
                    <button onClick={() => setDismissedAlerts(p => [...p, key])}
                      className="text-muted-foreground/50 hover:text-muted-foreground transition-colors shrink-0 mt-1">
                      <X className="w-3.5 h-3.5"/>
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Tabla de umbrales */}
          <div className="glass-card p-4">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Umbrales de alerta</p>
            <div className="overflow-x-auto rounded-xl border" style={{ borderColor: 'hsl(220 15% 15%)' }}>
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left uppercase text-[10px] text-muted-foreground border-b"
                    style={{ borderColor: 'hsl(220 15% 15%)', background: 'hsl(220 20% 9%)' }}>
                    <th className="px-3 py-2">Métrica</th>
                    <th className="px-3 py-2">Umbral ⚠️</th>
                    <th className="px-3 py-2">Alerta 🔴 tras</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { metric: 'Racha de derrotas',   threshold: '—',   streak: '3 derrotas seguidas' },
                    { metric: '% Victoria ATK',       threshold: '<40%', streak: '3 partidos' },
                    { metric: '% Victoria DEF',       threshold: '<40%', streak: '3 partidos' },
                    { metric: 'Pistola ATK perdida',  threshold: '—',   streak: '3 seguidas' },
                    { metric: 'Pistola DEF perdida',  threshold: '—',   streak: '3 seguidas' },
                    { metric: '% Post-plant',         threshold: '<40%', streak: '3 partidos' },
                    { metric: '% Retake',             threshold: '<35%', streak: '3 partidos' },
                  ].map((row, i) => (
                    <tr key={i} className="border-b hover:bg-white/3" style={{ borderColor: 'hsl(220 15% 12%)' }}>
                      <td className="px-3 py-2 font-medium">{row.metric}</td>
                      <td className="px-3 py-2 text-yellow-400 font-mono">{row.threshold}</td>
                      <td className="px-3 py-2 text-muted-foreground">{row.streak}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
