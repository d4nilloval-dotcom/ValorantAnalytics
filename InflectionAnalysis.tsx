import { useState, useMemo } from 'react';
import { Plus, Trash2, TrendingUp, TrendingDown, Minus, Zap } from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import { cn } from '@/lib/utils';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, AreaChart, Area
} from 'recharts';

const INFLECTION_KEY = 'valoanalytics_inflections_v1';

interface InflectionPoint {
  id: string;
  date: string;
  label: string;
  type: 'roster' | 'strategy' | 'coach' | 'meta' | 'other';
  description: string;
  color: string;
}

const TYPE_CONFIG = {
  roster:   { label: 'Cambio de Roster',    color: '#ff4655', emoji: '👥' },
  strategy: { label: 'Cambio de Estrategia', color: '#6366f1', emoji: '🧠' },
  coach:    { label: 'Cambio de Coach',      color: '#f59e0b', emoji: '🎯' },
  meta:     { label: 'Cambio de Meta',       color: '#22c55e', emoji: '🔄' },
  other:    { label: 'Otro',                 color: '#6b7280', emoji: '📌' },
};

function loadInflections(): InflectionPoint[] {
  try { return JSON.parse(localStorage.getItem(INFLECTION_KEY) || '[]'); } catch { return []; }
}
function saveInflections(data: InflectionPoint[]) {
  localStorage.setItem(INFLECTION_KEY, JSON.stringify(data));
}

function MetricDelta({ label, before, after, unit = '', higherIsBetter = true }: {
  label: string; before: number; after: number; unit?: string; higherIsBetter?: boolean;
}) {
  const delta = after - before;
  const improved = higherIsBetter ? delta > 0 : delta < 0;
  const pct = before > 0 ? Math.abs(delta / before * 100) : 0;

  return (
    <div className="rounded-lg p-3" style={{ background: 'hsl(220 15% 10%)' }}>
      <p className="text-xs text-muted-foreground mb-2">{label}</p>
      <div className="flex items-end gap-2">
        <div className="text-center flex-1">
          <p className="text-[10px] text-muted-foreground">Antes</p>
          <p className="text-base font-bold text-white">{before.toFixed(1)}{unit}</p>
        </div>
        <div className="text-center">
          {delta === 0 ? <Minus className="w-4 h-4 text-muted-foreground" /> :
           improved ? <TrendingUp className="w-4 h-4 text-green-400" /> :
                     <TrendingDown className="w-4 h-4 text-red-400" />}
          <p className={cn("text-xs font-bold", improved ? 'text-green-400' : delta !== 0 ? 'text-red-400' : 'text-muted-foreground')}>
            {delta > 0 ? '+' : ''}{delta.toFixed(1)}{unit}
          </p>
          <p className="text-[10px] text-muted-foreground">{pct.toFixed(0)}%</p>
        </div>
        <div className="text-center flex-1">
          <p className="text-[10px] text-muted-foreground">Después</p>
          <p className={cn("text-base font-bold", improved ? 'text-green-400' : delta !== 0 ? 'text-red-400' : 'text-white')}>{after.toFixed(1)}{unit}</p>
        </div>
      </div>
    </div>
  );
}

export function InflectionAnalysis() {
  const { matches } = useAppStore();
  const [inflections, setInflections] = useState<InflectionPoint[]>(loadInflections);
  const [selectedInflection, setSelectedInflection] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [form, setForm] = useState<Omit<InflectionPoint, 'id'>>({
    date: new Date().toISOString().split('T')[0],
    label: '', type: 'roster', description: '',
    color: TYPE_CONFIG.roster.color,
  });

  const persist = (data: InflectionPoint[]) => { setInflections(data); saveInflections(data); };

  const allMatches = useMemo(() =>
    Object.values(matches).sort((a, b) => a.date.localeCompare(b.date)), [matches]);

  // Build timeline data for chart
  const timelineData = useMemo(() => {
    return allMatches.map((m, i) => ({
      date: m.date,
      label: `M${i + 1}`,
      map: m.map,
      wr: allMatches.slice(0, i + 1).filter(x => x.won).length / (i + 1) * 100,
      acs: 0, // would need player data
      won: m.won ? 1 : 0,
      rolling: allMatches.slice(Math.max(0, i - 4), i + 1).filter(x => x.won).length /
               Math.min(i + 1, 5) * 100,
    }));
  }, [allMatches]);

  // Compute before/after for selected inflection
  const comparison = useMemo(() => {
    if (!selectedInflection) return null;
    const inf = inflections.find(i => i.id === selectedInflection);
    if (!inf) return null;

    const before = allMatches.filter(m => m.date < inf.date);
    const after  = allMatches.filter(m => m.date >= inf.date);

    if (before.length === 0 || after.length === 0) return null;

    const calc = (ms: typeof allMatches) => ({
      wr:        ms.filter(m => m.won).length / ms.length * 100,
      pistolAtk: ms.filter(m => m.pistolAtkWin).length / ms.length * 100,
      pistolDef: ms.filter(m => m.pistolDefWin).length / ms.length * 100,
      postWin:   ms.reduce((s, m) => s + (m.postWin || 0), 0) / ms.length,
      retakeWin: ms.reduce((s, m) => s + (m.retakeWin || 0), 0) / ms.length,
      atkRounds: ms.reduce((s, m) => s + (m.atk || 0), 0) / ms.length,
      defRounds: ms.reduce((s, m) => s + (m.def || 0), 0) / ms.length,
      total:     ms.length,
    });

    return { inf, before: calc(before), after: calc(after), beforeCount: before.length, afterCount: after.length };
  }, [selectedInflection, inflections, allMatches]);

  const saveInflection = () => {
    const newInf = { ...form, id: crypto.randomUUID(), color: TYPE_CONFIG[form.type].color };
    persist([...inflections, newInf].sort((a, b) => a.date.localeCompare(b.date)));
    setIsFormOpen(false);
    setForm({ date: new Date().toISOString().split('T')[0], label: '', type: 'roster', description: '', color: TYPE_CONFIG.roster.color });
  };

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="glass-card p-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Zap className="w-5 h-5 text-yellow-400" /> Puntos de Inflexión
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Marca cambios de roster, estrategia o meta y compara el rendimiento antes y después.
            </p>
          </div>
          <button className="btn-primary flex items-center gap-2 h-9 px-4 text-sm" onClick={() => setIsFormOpen(true)}>
            <Plus className="w-4 h-4" /> Nuevo punto
          </button>
        </div>
      </div>

      {/* Timeline Chart */}
      {timelineData.length > 0 && (
        <div className="glass-card p-5">
          <h3 className="font-semibold mb-4">Win Rate Acumulado con Puntos de Inflexión</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={timelineData}>
                <defs>
                  <linearGradient id="wrGrad2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 15% 20%)" />
                <XAxis dataKey="label" stroke="hsl(215 15% 55%)" fontSize={11} />
                <YAxis stroke="hsl(215 15% 55%)" fontSize={11} domain={[0, 100]} />
                <Tooltip
                  contentStyle={{ background: 'hsl(220 22% 8%)', border: '1px solid hsl(220 15% 20%)', borderRadius: 8 }}
                  formatter={(v: number, name: string) => [
                    name === 'rolling' ? `${v.toFixed(0)}% (rolling 5)` : `${v.toFixed(0)}%`,
                    name === 'rolling' ? 'Rolling WR' : 'WR Acumulado'
                  ]}
                />
                <ReferenceLine y={50} stroke="#666" strokeDasharray="3 3" />
                {inflections.map(inf => (
                  <ReferenceLine
                    key={inf.id}
                    x={timelineData.find(d => d.date >= inf.date)?.label}
                    stroke={inf.color}
                    strokeWidth={2}
                    strokeDasharray="6 3"
                    label={{ value: inf.label.slice(0, 8), fill: inf.color, fontSize: 10, position: 'top' }}
                  />
                ))}
                <Area type="monotone" dataKey="wr" stroke="#22c55e" strokeWidth={2} fill="url(#wrGrad2)" name="wr" />
                <Line type="monotone" dataKey="rolling" stroke="#6366f1" strokeWidth={1.5} dot={false} name="rolling" strokeDasharray="4 2" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <p className="text-xs text-muted-foreground mt-2">Las líneas verticales de colores son los puntos de inflexión. Haz clic en un punto abajo para ver la comparativa.</p>
        </div>
      )}

      {/* Inflection list */}
      {inflections.length === 0 ? (
        <div className="glass-card p-10 text-center text-muted-foreground text-sm">
          <p className="text-3xl mb-3">📌</p>
          <p>Sin puntos de inflexión registrados.</p>
          <p className="text-xs mt-1">Marca un cambio importante en la historia de tu equipo para empezar.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {inflections.map(inf => {
            const cfg = TYPE_CONFIG[inf.type];
            return (
              <button key={inf.id} onClick={() => setSelectedInflection(selectedInflection === inf.id ? null : inf.id)}
                className={cn("glass-card p-4 text-left transition-all hover:border-white/20",
                  selectedInflection === inf.id && 'border-yellow-500/40 bg-yellow-500/5')}>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">{cfg.emoji}</span>
                    <div>
                      <p className="font-bold text-sm">{inf.label}</p>
                      <p className="text-xs" style={{ color: inf.color }}>{cfg.label}</p>
                    </div>
                  </div>
                  <button className="text-red-400 hover:text-red-300 text-xs p-1"
                    onClick={e => { e.stopPropagation(); persist(inflections.filter(i => i.id !== inf.id)); if (selectedInflection === inf.id) setSelectedInflection(null); }}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">{inf.date}</p>
                {inf.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{inf.description}</p>}
                <p className="text-xs mt-2" style={{ color: inf.color }}>
                  {selectedInflection === inf.id ? '▲ Ver comparativa' : '▼ Comparar antes/después'}
                </p>
              </button>
            );
          })}
        </div>
      )}

      {/* Comparison panel */}
      {comparison && (
        <div className="glass-card p-5 space-y-4 border-yellow-500/20">
          <div className="flex items-center gap-3 pb-3 border-b border-white/10">
            <span className="text-xl">{TYPE_CONFIG[comparison.inf.type].emoji}</span>
            <div>
              <h3 className="font-bold text-lg">{comparison.inf.label}</h3>
              <p className="text-xs text-muted-foreground">
                {comparison.beforeCount} partidos antes · {comparison.afterCount} partidos después
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <MetricDelta label="Win Rate" before={comparison.before.wr} after={comparison.after.wr} unit="%" />
            <MetricDelta label="Pistol ATK" before={comparison.before.pistolAtk} after={comparison.after.pistolAtk} unit="%" />
            <MetricDelta label="Pistol DEF" before={comparison.before.pistolDef} after={comparison.after.pistolDef} unit="%" />
            <MetricDelta label="Post-plant ganados" before={comparison.before.postWin} after={comparison.after.postWin} />
            <MetricDelta label="Retakes ganados" before={comparison.before.retakeWin} after={comparison.after.retakeWin} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <MetricDelta label="Rondas ATK promedio" before={comparison.before.atkRounds} after={comparison.after.atkRounds} />
            <MetricDelta label="Rondas DEF promedio" before={comparison.before.defRounds} after={comparison.after.defRounds} />
          </div>
          <div className={cn("rounded-lg p-3 text-sm",
            comparison.after.wr > comparison.before.wr ? 'bg-green-500/10 border border-green-500/20' : 'bg-red-500/10 border border-red-500/20')}>
            {comparison.after.wr > comparison.before.wr
              ? `✅ El equipo mejoró ${(comparison.after.wr - comparison.before.wr).toFixed(1)}% en win rate después de este cambio.`
              : comparison.after.wr < comparison.before.wr
              ? `⚠️ El win rate bajó ${(comparison.before.wr - comparison.after.wr).toFixed(1)}% después de este cambio. Considera revisar la dirección tomada.`
              : '➡️ Sin cambio significativo en win rate. Puede necesitar más partidos para valorar el impacto.'}
          </div>
        </div>
      )}

      {/* Form modal */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-2xl border border-white/10 p-6 space-y-4" style={{ background: 'hsl(220 22% 8%)' }}>
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-lg">Nuevo Punto de Inflexión</h3>
              <button onClick={() => setIsFormOpen(false)} className="text-muted-foreground hover:text-white text-xl">✕</button>
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Nombre del evento *</label>
              <input className="input-pro w-full" value={form.label} onChange={e => setForm({ ...form, label: e.target.value })} placeholder="ej: Entra nuevo IGL..." />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Fecha</label>
                <input type="date" className="input-pro w-full" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Tipo</label>
                <select className="input-pro w-full" value={form.type}
                  onChange={e => setForm({ ...form, type: e.target.value as any, color: TYPE_CONFIG[e.target.value as keyof typeof TYPE_CONFIG].color })}>
                  {Object.entries(TYPE_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.emoji} {v.label}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Descripción (opcional)</label>
              <textarea className="input-pro w-full h-20 resize-none text-sm" value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
                placeholder="Qué cambió exactamente, por qué se tomó la decisión..." />
            </div>
            <div className="flex justify-end gap-3">
              <button className="btn-secondary" onClick={() => setIsFormOpen(false)}>Cancelar</button>
              <button className="btn-primary" onClick={saveInflection} disabled={!form.label.trim()}>Guardar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
