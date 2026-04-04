import { useState } from 'react';
import { Target, Plus, Trash2, X, Calendar, TrendingUp, Check } from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import { cn } from '@/lib/utils';

interface Goal {
  id: string;
  title: string;
  type: 'MAP_WR' | 'PLAYER_ACS' | 'PLAYER_KD' | 'WIN_COUNT' | 'KAST' | 'TEAM_WR';
  target: string;   // mapa / jugador / ''
  current?: number; // calculado automáticamente
  goal: number;
  deadline?: string;
  note?: string;
  createdAt: number;
  completed: boolean;
}

const GOAL_STORAGE = 'valoanalytics_goals_v1';
function loadGoals(): Goal[] { try { return JSON.parse(localStorage.getItem(GOAL_STORAGE) || '[]'); } catch { return []; } }
function saveGoals(g: Goal[]) { localStorage.setItem(GOAL_STORAGE, JSON.stringify(g)); }

const GOAL_TYPES = [
  { value: 'TEAM_WR',    label: 'Win Rate del equipo',      unit: '%',  hasTarget: false },
  { value: 'MAP_WR',     label: 'Win Rate en mapa',         unit: '%',  hasTarget: true, targetType: 'map' },
  { value: 'PLAYER_ACS', label: 'ACS medio de jugador',     unit: 'pts',hasTarget: true, targetType: 'player' },
  { value: 'PLAYER_KD',  label: 'K/D de jugador',           unit: '',   hasTarget: true, targetType: 'player' },
  { value: 'KAST',       label: 'KAST% de jugador',         unit: '%',  hasTarget: true, targetType: 'player' },
  { value: 'WIN_COUNT',  label: 'Número de victorias total', unit: 'V', hasTarget: false },
] as const;

export function GoalTracker() {
  const { getMapStats, getPlayerStats, getFilteredMatches } = useAppStore();
  const [goals, setGoals]   = useState<Goal[]>(loadGoals);
  const [showAdd, setShowAdd] = useState(false);

  const mapStats    = getMapStats('ALL');
  const playerStats = getPlayerStats('ALL');
  const matches     = getFilteredMatches();

  // Calcular valor actual para cada objetivo
  const goalsWithCurrent = goals.map(g => {
    let current = 0;
    if (g.type === 'TEAM_WR') {
      const wins = matches.filter(m => m.won).length;
      current = matches.length > 0 ? Math.round(wins / matches.length * 100) : 0;
    } else if (g.type === 'MAP_WR') {
      const ms = mapStats.find(m => m.map === g.target);
      current = ms ? Math.round(ms.winPct) : 0;
    } else if (g.type === 'PLAYER_ACS') {
      const ps = playerStats.find(p => p.name === g.target);
      current = ps ? Math.round(ps.acsAvg) : 0;
    } else if (g.type === 'PLAYER_KD') {
      const ps = playerStats.find(p => p.name === g.target);
      current = ps ? ps.kd : 0;
    } else if (g.type === 'KAST') {
      const ps = playerStats.find(p => p.name === g.target);
      current = ps ? Math.round(ps.kastAvg) : 0;
    } else if (g.type === 'WIN_COUNT') {
      current = matches.filter(m => m.won).length;
    }
    const pct = Math.min(Math.round((current / g.goal) * 100), 100);
    const completed = current >= g.goal;
    return { ...g, current, pct, completed };
  });

  // Form
  const [fType, setFType]       = useState<Goal['type']>('MAP_WR');
  const [fTarget, setFTarget]   = useState('');
  const [fGoal, setFGoal]       = useState(60);
  const [fTitle, setFTitle]     = useState('');
  const [fDeadline, setFDeadline] = useState('');
  const [fNote, setFNote]       = useState('');

  const typeDef = GOAL_TYPES.find(t => t.value === fType)!;

  const addGoal = () => {
    const newGoal: Goal = {
      id: crypto.randomUUID(),
      title: fTitle || `${typeDef.label}${fTarget ? ' · ' + fTarget : ''}`,
      type: fType, target: fTarget, goal: fGoal,
      deadline: fDeadline || undefined, note: fNote || undefined,
      createdAt: Date.now(), completed: false,
    };
    const updated = [...goals, newGoal];
    setGoals(updated); saveGoals(updated);
    setShowAdd(false);
    setFTitle(''); setFTarget(''); setFGoal(60); setFDeadline(''); setFNote('');
  };

  const deleteGoal = (id: string) => {
    const updated = goals.filter(g => g.id !== id);
    setGoals(updated); saveGoals(updated);
  };

  const active    = goalsWithCurrent.filter(g => !g.completed);
  const completed = goalsWithCurrent.filter(g => g.completed);

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="glass-card p-5 flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="font-bold text-lg flex items-center gap-2 mb-1">
            <Target className="w-5 h-5 text-red-400"/> Objetivos del Equipo
          </h2>
          <p className="text-sm text-muted-foreground">{active.length} en curso · {completed.length} completados</p>
        </div>
        <button onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all"
          style={{ background: 'hsl(355 85% 58% / 0.15)', border: '1px solid hsl(355 85% 58% / 0.3)', color: 'hsl(355 85% 68%)' }}>
          <Plus className="w-4 h-4"/> Nuevo objetivo
        </button>
      </div>

      {/* Objetivos activos */}
      {active.length === 0 && (
        <div className="glass-card p-12 text-center">
          <Target className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4"/>
          <p className="text-muted-foreground">Sin objetivos activos.</p>
          <p className="text-sm text-muted-foreground/60 mt-1">Define metas como "60% WR en Ascent este mes".</p>
        </div>
      )}

      <div className="space-y-3">
        {active.map(g => {
          const def = GOAL_TYPES.find(t => t.value === g.type)!;
          const daysLeft = g.deadline
            ? Math.ceil((new Date(g.deadline).getTime() - Date.now()) / 86400000)
            : null;
          return (
            <div key={g.id} className="glass-card p-5 rounded-2xl">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <h3 className="font-semibold">{g.title}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">{def.label}{g.target && ` · ${g.target}`}</p>
                  {g.note && <p className="text-xs text-muted-foreground/70 mt-1 italic">{g.note}</p>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {daysLeft !== null && (
                    <span className={cn('text-xs px-2 py-1 rounded-full flex items-center gap-1',
                      daysLeft <= 3 ? 'bg-red-500/20 text-red-400' : daysLeft <= 7 ? 'bg-yellow-500/20 text-yellow-400' : 'bg-white/10 text-muted-foreground')}>
                      <Calendar className="w-3 h-3"/>
                      {daysLeft <= 0 ? 'Vencido' : `${daysLeft}d`}
                    </span>
                  )}
                  <button onClick={() => deleteGoal(g.id)} className="p-1 rounded hover:bg-red-500/20 transition-colors">
                    <Trash2 className="w-4 h-4 text-red-400"/>
                  </button>
                </div>
              </div>

              {/* Barra de progreso */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-mono font-bold text-xl text-white">
                    {typeof g.current === 'number' ? g.type === 'PLAYER_KD' ? g.current.toFixed(2) : Math.round(g.current) : '–'}
                    {def.unit && <span className="text-sm text-muted-foreground ml-0.5">{def.unit}</span>}
                  </span>
                  <span className="text-muted-foreground">
                    Meta: <span className="text-white font-semibold">{g.goal}{def.unit}</span>
                  </span>
                </div>
                <div className="h-3 rounded-full bg-white/8">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${g.pct}%`,
                      background: g.pct >= 80 ? '#22c55e' : g.pct >= 50 ? '#f59e0b' : '#ef4444',
                    }}
                  />
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{g.pct}% completado</span>
                  <span>Faltan {Math.max(0, g.type === 'PLAYER_KD' ? +(g.goal - (g.current||0)).toFixed(2) : Math.round(g.goal - (g.current||0)))}{def.unit}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Completados */}
      {completed.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            <Check className="w-4 h-4 text-green-400"/> Completados ({completed.length})
          </h3>
          {completed.map(g => (
            <div key={g.id} className="glass-card p-4 rounded-xl flex items-center gap-3 opacity-70">
              <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center shrink-0">
                <Check className="w-4 h-4 text-green-400"/>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{g.title}</p>
                <p className="text-xs text-muted-foreground">
                  Alcanzado: {typeof g.current === 'number' && g.type === 'PLAYER_KD' ? g.current.toFixed(2) : Math.round(g.current||0)}{GOAL_TYPES.find(t=>t.value===g.type)?.unit}
                  {' · '}Meta: {g.goal}{GOAL_TYPES.find(t=>t.value===g.type)?.unit}
                </p>
              </div>
              <button onClick={() => deleteGoal(g.id)} className="p-1 rounded hover:bg-white/10 transition-colors">
                <X className="w-4 h-4 text-muted-foreground"/>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Modal añadir objetivo */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'hsl(220 22% 5% / 0.85)' }}>
          <div className="glass-card p-6 rounded-2xl w-full max-w-md space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-lg">Nuevo Objetivo</h3>
              <button onClick={() => setShowAdd(false)} className="p-1 rounded hover:bg-white/10"><X className="w-5 h-5"/></button>
            </div>

            <div>
              <label className="text-sm text-muted-foreground">Tipo de objetivo</label>
              <select value={fType} onChange={e => { setFType(e.target.value as Goal['type']); setFTarget(''); }}
                className="w-full mt-1 rounded-xl px-3 py-2 border text-sm outline-none"
                style={{ background: 'hsl(220 15% 10%)', borderColor: 'hsl(220 15% 22%)' }}>
                {GOAL_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>

            {typeDef.hasTarget && (
              <div>
                <label className="text-sm text-muted-foreground">{(typeDef as any).targetType === 'map' ? 'Mapa' : 'Jugador'}</label>
                <select value={fTarget} onChange={e => setFTarget(e.target.value)}
                  className="w-full mt-1 rounded-xl px-3 py-2 border text-sm outline-none"
                  style={{ background: 'hsl(220 15% 10%)', borderColor: 'hsl(220 15% 22%)' }}>
                  <option value="">Seleccionar...</option>
                  {((typeDef as any).targetType === 'map' ? mapStats.map(m=>m.map) : playerStats.map(p=>p.name)).map((v:string) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm text-muted-foreground">Meta ({typeDef.unit || 'valor'})</label>
                <input type="number" value={fGoal} onChange={e => setFGoal(+e.target.value)} min={0} step={typeDef.value === 'PLAYER_KD' ? 0.1 : 1}
                  className="w-full mt-1 rounded-xl px-3 py-2 border text-sm outline-none"
                  style={{ background: 'hsl(220 15% 10%)', borderColor: 'hsl(220 15% 22%)' }}/>
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Fecha límite</label>
                <input type="date" value={fDeadline} onChange={e => setFDeadline(e.target.value)}
                  className="w-full mt-1 rounded-xl px-3 py-2 border text-sm outline-none"
                  style={{ background: 'hsl(220 15% 10%)', borderColor: 'hsl(220 15% 22%)' }}/>
              </div>
            </div>

            <div>
              <label className="text-sm text-muted-foreground">Título personalizado (opcional)</label>
              <input value={fTitle} onChange={e => setFTitle(e.target.value)} placeholder="Ej: Objetivo Ascent Enero"
                className="w-full mt-1 rounded-xl px-3 py-2 border text-sm outline-none"
                style={{ background: 'hsl(220 15% 10%)', borderColor: 'hsl(220 15% 22%)' }}/>
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowAdd(false)}
                className="flex-1 py-2.5 rounded-xl text-sm border transition-colors hover:bg-white/5"
                style={{ borderColor: 'hsl(220 15% 22%)' }}>Cancelar</button>
              <button onClick={addGoal} disabled={typeDef.hasTarget && !fTarget}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-40"
                style={{ background: 'hsl(355 85% 58% / 0.25)', border: '1px solid hsl(355 85% 58% / 0.3)', color: 'hsl(355 85% 68%)' }}>
                Crear objetivo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
