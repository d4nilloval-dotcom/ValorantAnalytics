import { useState, useMemo } from 'react';
import { BarChart2, Filter, TrendingUp, TrendingDown, Minus, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/store/appStore';
import type { Match, MatchType } from '@/types';
import { VALORANT_MAPS } from '@/types';
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, ReferenceLine } from 'recharts';

// ── Helpers ────────────────────────────────────────────────────────────────────
const pct = (num: number, den: number): number =>
  den > 0 ? Math.round((num / den) * 100) : 0;

const fmt = (n: number) => `${n}%`;

function PctBar({ value, color = '#22c55e', label }: { value: number; color?: string; label?: string }) {
  return (
    <div className="space-y-1">
      {label && <p className="text-[10px] text-muted-foreground">{label}</p>}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-2 rounded-full bg-white/8 overflow-hidden">
          <div className="h-full rounded-full transition-all duration-500"
            style={{ width: `${Math.max(2, value)}%`, background: color }} />
        </div>
        <span className="text-xs font-mono font-bold w-9 text-right" style={{ color }}>{value}%</span>
      </div>
    </div>
  );
}

function StatCard({
  title, subtitle, value, sub, color = '#22c55e', barColor,
  matches, total
}: {
  title: string; subtitle?: string; value: number;
  sub?: string; color?: string; barColor?: string;
  matches?: number; total?: number;
}) {
  const c = barColor || color;
  return (
    <div className="glass-card p-4 space-y-2">
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{title}</p>
        {subtitle && <p className="text-[10px] text-muted-foreground/60 mt-0.5">{subtitle}</p>}
      </div>
      <div className="flex items-end justify-between">
        <span className="text-3xl font-black" style={{ color }}>{value}%</span>
        {(matches !== undefined && total !== undefined) && (
          <span className="text-[10px] text-muted-foreground">{matches}/{total}</span>
        )}
      </div>
      {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
      <PctBar value={value} color={c} />
    </div>
  );
}

function SectionHeader({ title, color }: { title: string; color: string }) {
  return (
    <div className="flex items-center gap-3 mt-6 mb-3">
      <div className="h-4 w-1 rounded-full" style={{ background: color }} />
      <h3 className="text-sm font-bold uppercase tracking-wider" style={{ color }}>{title}</h3>
    </div>
  );
}

// Color por porcentaje
function pctColor(v: number, thresholds = [50, 60]) {
  if (v >= thresholds[1]) return '#22c55e';
  if (v >= thresholds[0]) return '#facc15';
  return '#ef4444';
}

// ── Tipos de match ─────────────────────────────────────────────────────────────
const ALL_TYPES: { id: MatchType; label: string }[] = [
  { id: 'SCRIM',      label: 'Scrim' },
  { id: 'PREMIER',    label: 'Premier' },
  { id: 'OFICIAL',    label: 'Oficial' },
  { id: 'TOURNAMENT', label: 'Torneo' },
  { id: 'CUSTOM',     label: 'Custom' },
];

// ── Tooltip personalizado para el LineChart ────────────────────────────────────
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border p-3 text-xs shadow-2xl space-y-1"
      style={{ background: 'hsl(220 22% 10%)', borderColor: 'hsl(220 15% 22%)' }}>
      <p className="font-bold mb-1">{label}</p>
      {payload.map((p: any) => (
        <div key={p.name} className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="font-mono font-bold" style={{ color: p.color }}>{p.value}%</span>
        </div>
      ))}
    </div>
  );
}

// ── Componente principal ───────────────────────────────────────────────────────
export function RoundStats() {
  const { matches: matchMap } = useAppStore();
  const allMatches: Match[] = Object.values(matchMap);

  // ── Filtros ─────────────────────────────────────────────────────────────────
  const [selectedMap,   setSelectedMap]   = useState<string>('Todos');
  const [selectedTypes, setSelectedTypes] = useState<MatchType[]>([]);
  const [showFilters,   setShowFilters]   = useState(false);

  const maps = useMemo(() => {
    const used = new Set(allMatches.map(m => m.map).filter(Boolean));
    return ['Todos', ...VALORANT_MAPS.filter(m => used.has(m))];
  }, [allMatches]);

  const toggleType = (t: MatchType) =>
    setSelectedTypes(prev =>
      prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]
    );

  // ── Filtrar partidos ─────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return allMatches.filter(m => {
      if (selectedMap !== 'Todos' && m.map !== selectedMap) return false;
      if (selectedTypes.length > 0 && !selectedTypes.includes(m.type)) return false;
      return true;
    }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [allMatches, selectedMap, selectedTypes]);

  const wins   = filtered.filter(m => m.won);
  const losses = filtered.filter(m => !m.won);

  // ── Función de cálculo de stats de un grupo ──────────────────────────────────
  const calcStats = (group: Match[]) => {
    const n = group.length;
    if (n === 0) return null;

    // Rondas totales ATK y DEF jugadas (scoreUs + scoreOpp = rondas totales)
    // atk = rondas ganadas en ataque
    // def = rondas ganadas en defensa
    // Rondas totales ATK jugadas ≈ def_rival + atk propio — necesitamos total de rondas
    // Estimación: en un partido de 13 rondas, la mitad se juega ATK y la mitad DEF
    // Rondas ATK jugadas = scoreUs + scoreOpp - def_ganadas_nosotros - ...
    // Usamos: atkPlayed ≈ (scoreUs + scoreOpp) / 2 ... pero más preciso:
    // Cada partido tiene N rondas totales, aprox N/2 en ATK y N/2 en DEF (pre-OT)
    // Sin embargo tenemos atk=won_atk, def=won_def, scoreUs=total_won
    // Rondas DEF totales jugadas = (scoreUs + scoreOpp) - atkPlayed
    // No podemos saber exacto sin roundsTotal, así que usamos scoreUs+scoreOpp / 2

    const totalRoundsPlayed = group.reduce((s, m) => s + (m.scoreUs + m.scoreOpp), 0);
    const halfRounds        = totalRoundsPlayed / 2;  // aprox ATK y DEF jugadas

    const totalAtk  = group.reduce((s, m) => s + (m.atk || 0), 0);
    const totalDef  = group.reduce((s, m) => s + (m.def || 0), 0);
    const atkPlayed = halfRounds;
    const defPlayed = halfRounds;

    const postWin  = group.reduce((s, m) => s + (m.postWin  || 0), 0);
    const postLoss = group.reduce((s, m) => s + (m.postLoss || 0), 0);
    const postTotal = postWin + postLoss;

    const retakeWin  = group.reduce((s, m) => s + (m.retakeWin  || 0), 0);
    const retakeLoss = group.reduce((s, m) => s + (m.retakeLoss || 0), 0);
    const retakeTotal = retakeWin + retakeLoss;

    const plantsAgainst = group.reduce((s, m) => s + (m.plantsAgainst || 0), 0);

    return {
      n,
      atkWr:         pct(totalAtk,  atkPlayed),
      defWr:         pct(totalDef,  defPlayed),
      postplantWr:   pct(postWin,   postTotal),
      retakeWr:      pct(retakeWin, retakeTotal),
      plantedPct:    pct(plantsAgainst, defPlayed > 0 ? defPlayed : 1),
      totalAtk, totalDef, atkPlayed: Math.round(atkPlayed), defPlayed: Math.round(defPlayed),
      postWin, postTotal, retakeWin, retakeTotal,
      plantsAgainst, roundsPlayed: totalRoundsPlayed,
    };
  };

  const statsAll   = calcStats(filtered);
  const statsWins  = calcStats(wins);
  const statsLosses= calcStats(losses);

  // ── Datos para los gráficos por partido ────────────────────────────────────
  const chartData = useMemo(() => {
    return filtered.map((m, i) => {
      const date    = m.date ? new Date(m.date).toLocaleDateString('es-ES', { day:'2-digit', month:'2-digit' }) : `P${i+1}`;
      const label   = `${date} ${m.map}`;
      const rounds  = m.scoreUs + m.scoreOpp;
      const half    = rounds / 2;
      const atkWr   = pct(m.atk || 0, half);
      const defWr   = pct(m.def || 0, half);
      const postWr  = pct(m.postWin || 0, (m.postWin||0) + (m.postLoss||0));
      const retakeWr= pct(m.retakeWin||0, (m.retakeWin||0) + (m.retakeLoss||0));
      const plantPct= pct(m.plantsAgainst||0, half > 0 ? half : 1);
      return {
        name:   label,
        short:  `P${i+1}`,
        won:    m.won,
        map:    m.map,
        date:   date,
        atkWr, defWr, postWr, retakeWr, plantPct,
        score:  `${m.scoreUs}–${m.scoreOpp}`,
      };
    });
  }, [filtered]);

  if (allMatches.length === 0) {
    return (
      <div className="p-6 space-y-4">
        <div className="flex items-center gap-3">
          <BarChart2 className="w-6 h-6 text-red-400"/>
          <h2 className="text-2xl font-black">Análisis de Rondas</h2>
        </div>
        <div className="glass-card p-10 text-center">
          <BarChart2 className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3"/>
          <p className="text-muted-foreground">No hay partidos registrados todavía.</p>
          <p className="text-xs text-muted-foreground/50 mt-1">Añade partidos desde la sección "Partidos".</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <BarChart2 className="w-6 h-6 text-red-400"/>
          <div>
            <h2 className="text-2xl font-black">Análisis de Rondas</h2>
            <p className="text-sm text-muted-foreground">
              ATK · DEF · Post-plant · Retake · Plantas recibidas
            </p>
          </div>
        </div>
        <button onClick={() => setShowFilters(v => !v)}
          className={cn('flex items-center gap-2 px-4 py-2 rounded-xl border text-sm transition-all',
            showFilters ? 'bg-red-500/15 border-red-500/40 text-white' : 'border-white/10 text-muted-foreground hover:text-white')}>
          <Filter className="w-4 h-4"/>
          Filtros
          {(selectedMap !== 'Todos' || selectedTypes.length > 0) && (
            <span className="w-2 h-2 rounded-full bg-red-400 inline-block"/>
          )}
          <ChevronDown className={cn('w-3 h-3 transition-transform', showFilters && 'rotate-180')}/>
        </button>
      </div>

      {/* Filtros */}
      {showFilters && (
        <div className="glass-card p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Mapa */}
            <div>
              <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wider">Mapa</p>
              <div className="flex flex-wrap gap-1.5">
                {maps.map(map => (
                  <button key={map} onClick={() => setSelectedMap(map)}
                    className={cn('text-xs px-3 py-1.5 rounded-lg border transition-all',
                      selectedMap === map
                        ? 'bg-red-500/20 border-red-500/40 text-white font-medium'
                        : 'border-white/10 text-muted-foreground hover:text-white')}>
                    {map}
                  </button>
                ))}
              </div>
            </div>

            {/* Modo — selección múltiple */}
            <div>
              <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wider">
                Modo <span className="text-muted-foreground/50">(selección múltiple)</span>
              </p>
              <div className="flex flex-wrap gap-1.5">
                {ALL_TYPES.map(({ id, label }) => (
                  <button key={id} onClick={() => toggleType(id)}
                    className={cn('text-xs px-3 py-1.5 rounded-lg border transition-all',
                      selectedTypes.includes(id)
                        ? 'bg-blue-500/20 border-blue-500/40 text-blue-300 font-medium'
                        : 'border-white/10 text-muted-foreground hover:text-white')}>
                    {selectedTypes.includes(id) ? '✓ ' : ''}{label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2 border-t border-white/8">
            <span className="text-xs text-muted-foreground">
              Mostrando <span className="text-white font-bold">{filtered.length}</span> de {allMatches.length} partidos
            </span>
            {(selectedMap !== 'Todos' || selectedTypes.length > 0) && (
              <button onClick={() => { setSelectedMap('Todos'); setSelectedTypes([]); }}
                className="text-xs text-red-400 hover:text-red-300 transition-colors">
                × Limpiar filtros
              </button>
            )}
          </div>
        </div>
      )}

      {!statsAll ? (
        <div className="glass-card p-8 text-center">
          <p className="text-muted-foreground text-sm">Sin datos para los filtros aplicados.</p>
        </div>
      ) : (
        <>
          {/* ── PORCENTAJES ATK / DEF ─────────────────────────────────────── */}
          <div className="space-y-1">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-3 h-3 rounded-sm bg-red-500/80"/>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">% Victoria ATK y DEF</h3>
            </div>

            {/* TOTAL */}
            <SectionHeader title={`Total — ${statsAll.n} partidos`} color="#94a3b8"/>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <StatCard
                title="% Victoria en ATAQUE"
                subtitle={`${statsAll.totalAtk} rondas ganadas de ~${statsAll.atkPlayed} jugadas`}
                value={statsAll.atkWr}
                color={pctColor(statsAll.atkWr)}
              />
              <StatCard
                title="% Victoria en DEFENSA"
                subtitle={`${statsAll.totalDef} rondas ganadas de ~${statsAll.defPlayed} jugadas`}
                value={statsAll.defWr}
                color={pctColor(statsAll.defWr)}
              />
            </div>

            {/* VICTORIAS */}
            {statsWins && (
              <>
                <SectionHeader title={`Victorias — ${statsWins.n} partidos`} color="#22c55e"/>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <StatCard title="% Victoria en ATAQUE"
                    subtitle={`${statsWins.totalAtk} rondas ganadas de ~${statsWins.atkPlayed} jugadas`}
                    value={statsWins.atkWr} color="#22c55e"/>
                  <StatCard title="% Victoria en DEFENSA"
                    subtitle={`${statsWins.totalDef} rondas ganadas de ~${statsWins.defPlayed} jugadas`}
                    value={statsWins.defWr} color="#22c55e"/>
                </div>
              </>
            )}

            {/* DERROTAS */}
            {statsLosses && (
              <>
                <SectionHeader title={`Derrotas — ${statsLosses.n} partidos`} color="#ef4444"/>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <StatCard title="% Victoria en ATAQUE"
                    subtitle={`${statsLosses.totalAtk} rondas ganadas de ~${statsLosses.atkPlayed} jugadas`}
                    value={statsLosses.atkWr} color="#ef4444"/>
                  <StatCard title="% Victoria en DEFENSA"
                    subtitle={`${statsLosses.totalDef} rondas ganadas de ~${statsLosses.defPlayed} jugadas`}
                    value={statsLosses.defWr} color="#ef4444"/>
                </div>
              </>
            )}
          </div>

          {/* ── PLANTAS RECIBIDAS ────────────────────────────────────────── */}
          <div className="space-y-1 mt-4">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-3 h-3 rounded-sm bg-orange-500/80"/>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">% Plantas recibidas en DEF</h3>
              <span className="text-[10px] text-muted-foreground">(del total de rondas en defensa)</span>
            </div>
            {statsAll.defPlayed > 0 ? (
              <>
                <SectionHeader title="Total" color="#94a3b8"/>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <StatCard title="Total" subtitle={`${statsAll.plantsAgainst} plantas de ~${statsAll.defPlayed} rondas DEF`}
                    value={statsAll.plantedPct} color={pctColor(100-statsAll.plantedPct)} barColor="#f97316"/>
                  {statsWins && <StatCard title="En victorias"
                    subtitle={`${statsWins.plantsAgainst} plantas`}
                    value={statsWins.plantedPct} color="#22c55e" barColor="#f97316"/>}
                  {statsLosses && <StatCard title="En derrotas"
                    subtitle={`${statsLosses.plantsAgainst} plantas`}
                    value={statsLosses.plantedPct} color="#ef4444" barColor="#f97316"/>}
                </div>
                {statsAll.plantsAgainst === 0 && (
                  <p className="text-[11px] text-yellow-400/70 mt-1">
                    ⚠️ Todos los valores son 0. Añade el campo "Plantas recibidas" al registrar partidos.
                  </p>
                )}
              </>
            ) : (
              <div className="glass-card p-4 text-xs text-muted-foreground">
                Sin datos de rondas DEF disponibles.
              </div>
            )}
          </div>

          {/* ── POST-PLANT y RETAKE ──────────────────────────────────────── */}
          <div className="space-y-1 mt-4">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-3 h-3 rounded-sm bg-purple-500/80"/>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Post-plant y Retake</h3>
            </div>

            <SectionHeader title="Total" color="#94a3b8"/>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <StatCard title="% Post-plant ganado" subtitle={`${statsAll.postWin}W de ${statsAll.postTotal} intentos`}
                value={statsAll.postplantWr} color={pctColor(statsAll.postplantWr)} barColor="#a855f7"
                matches={statsAll.postWin} total={statsAll.postTotal}/>
              <StatCard title="% Retake ganado" subtitle={`${statsAll.retakeWin}W de ${statsAll.retakeTotal} intentos`}
                value={statsAll.retakeWr} color={pctColor(statsAll.retakeWr)} barColor="#3b82f6"
                matches={statsAll.retakeWin} total={statsAll.retakeTotal}/>
            </div>

            {statsWins && statsWins.postTotal + statsWins.retakeTotal > 0 && (
              <>
                <SectionHeader title="En victorias" color="#22c55e"/>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <StatCard title="% Post-plant" subtitle={`${statsWins.postWin}W de ${statsWins.postTotal}`}
                    value={statsWins.postplantWr} color="#22c55e" barColor="#a855f7"/>
                  <StatCard title="% Retake" subtitle={`${statsWins.retakeWin}W de ${statsWins.retakeTotal}`}
                    value={statsWins.retakeWr} color="#22c55e" barColor="#3b82f6"/>
                </div>
              </>
            )}

            {statsLosses && statsLosses.postTotal + statsLosses.retakeTotal > 0 && (
              <>
                <SectionHeader title="En derrotas" color="#ef4444"/>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <StatCard title="% Post-plant" subtitle={`${statsLosses.postWin}W de ${statsLosses.postTotal}`}
                    value={statsLosses.postplantWr} color="#ef4444" barColor="#a855f7"/>
                  <StatCard title="% Retake" subtitle={`${statsLosses.retakeWin}W de ${statsLosses.retakeTotal}`}
                    value={statsLosses.retakeWr} color="#ef4444" barColor="#3b82f6"/>
                </div>
              </>
            )}
          </div>

          {/* ── GRÁFICOS POR PARTIDO ─────────────────────────────────────── */}
          {chartData.length >= 2 && (
            <div className="space-y-5 mt-4">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="w-4 h-4 text-red-400"/>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">Evolución por partido</h3>
                <span className="text-[10px] text-muted-foreground">— % de cada métrica partido a partido</span>
              </div>

              {/* Gráfico ATK/DEF */}
              <div className="glass-card p-4">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-4">ATK % vs DEF %</p>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={chartData} margin={{ top: 4, right: 4, bottom: 4, left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)"/>
                    <XAxis dataKey="short" tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.4)' }}/>
                    <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.4)' }}
                      tickFormatter={v => `${v}%`}/>
                    <Tooltip content={<CustomTooltip/>}/>
                    <ReferenceLine y={50} stroke="rgba(255,255,255,0.15)" strokeDasharray="4 4"/>
                    <Line type="monotone" dataKey="atkWr" name="ATK" stroke="#f59e0b" strokeWidth={2}
                      dot={(p: any) => <circle cx={p.cx} cy={p.cy} r={3} fill={p.won ? '#22c55e' : '#ef4444'} stroke="#f59e0b" strokeWidth={1}/>}/>
                    <Line type="monotone" dataKey="defWr" name="DEF" stroke="#3b82f6" strokeWidth={2}
                      dot={(p: any) => <circle cx={p.cx} cy={p.cy} r={3} fill={p.won ? '#22c55e' : '#ef4444'} stroke="#3b82f6" strokeWidth={1}/>}/>
                  </LineChart>
                </ResponsiveContainer>
                <div className="flex gap-4 mt-2 text-[10px]">
                  <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-yellow-500 inline-block rounded"/>ATK %</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-blue-500 inline-block rounded"/>DEF %</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block"/>Victoria</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block"/>Derrota</span>
                </div>
              </div>

              {/* Gráfico Post-plant / Retake */}
              <div className="glass-card p-4">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-4">Post-plant % vs Retake %</p>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={chartData} margin={{ top: 4, right: 4, bottom: 4, left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)"/>
                    <XAxis dataKey="short" tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.4)' }}/>
                    <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.4)' }}
                      tickFormatter={v => `${v}%`}/>
                    <Tooltip content={<CustomTooltip/>}/>
                    <ReferenceLine y={50} stroke="rgba(255,255,255,0.15)" strokeDasharray="4 4"/>
                    <Line type="monotone" dataKey="postWr" name="Post-plant" stroke="#a855f7" strokeWidth={2}
                      dot={(p: any) => <circle cx={p.cx} cy={p.cy} r={3} fill="#a855f7" stroke="white" strokeWidth={0.5}/>}/>
                    <Line type="monotone" dataKey="retakeWr" name="Retake" stroke="#22c55e" strokeWidth={2}
                      dot={(p: any) => <circle cx={p.cx} cy={p.cy} r={3} fill="#22c55e" stroke="white" strokeWidth={0.5}/>}/>
                  </LineChart>
                </ResponsiveContainer>
                <div className="flex gap-4 mt-2 text-[10px]">
                  <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-purple-500 inline-block rounded"/>Post-plant %</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-green-500 inline-block rounded"/>Retake %</span>
                </div>
              </div>

              {/* Gráfico Plantas recibidas */}
              {chartData.some(d => d.plantPct > 0) && (
                <div className="glass-card p-4">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-4">% Rondas DEF donde nos plantan</p>
                  <ResponsiveContainer width="100%" height={180}>
                    <LineChart data={chartData} margin={{ top: 4, right: 4, bottom: 4, left: -20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)"/>
                      <XAxis dataKey="short" tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.4)' }}/>
                      <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.4)' }}
                        tickFormatter={v => `${v}%`}/>
                      <Tooltip content={<CustomTooltip/>}/>
                      <Line type="monotone" dataKey="plantPct" name="Plantados DEF" stroke="#f97316" strokeWidth={2}
                        dot={(p: any) => <circle cx={p.cx} cy={p.cy} r={3} fill="#f97316" stroke="white" strokeWidth={0.5}/>}/>
                    </LineChart>
                  </ResponsiveContainer>
                  <div className="flex gap-4 mt-2 text-[10px]">
                    <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-orange-500 inline-block rounded"/>% Plantados en DEF</span>
                    <span className="text-muted-foreground/50">Más bajo = mejor defensa preventiva</span>
                  </div>
                </div>
              )}

              {/* Tabla resumen por partido */}
              <div className="glass-card p-4">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">Detalle por partido</p>
                <div className="overflow-x-auto rounded-xl border" style={{ borderColor: 'hsl(220 15% 15%)' }}>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left uppercase tracking-wider text-muted-foreground border-b"
                        style={{ borderColor: 'hsl(220 15% 15%)', background: 'hsl(220 20% 9%)' }}>
                        <th className="px-3 py-2">#</th>
                        <th className="px-3 py-2">Fecha</th>
                        <th className="px-3 py-2">Mapa</th>
                        <th className="px-3 py-2">Res.</th>
                        <th className="px-3 py-2 text-yellow-400">ATK%</th>
                        <th className="px-3 py-2 text-blue-400">DEF%</th>
                        <th className="px-3 py-2 text-purple-400">PostP%</th>
                        <th className="px-3 py-2 text-green-400">Retake%</th>
                        <th className="px-3 py-2 text-orange-400">Plant%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {chartData.map((d, i) => (
                        <tr key={i} className={cn('border-b transition-colors hover:bg-white/3',
                          d.won ? 'border-green-500/10' : 'border-red-500/10')}
                          style={{ borderColor: 'hsl(220 15% 12%)' }}>
                          <td className="px-3 py-2 text-muted-foreground font-mono">{i+1}</td>
                          <td className="px-3 py-2 text-muted-foreground">{d.date}</td>
                          <td className="px-3 py-2 font-medium">{d.map}</td>
                          <td className="px-3 py-2">
                            <span className={cn('font-bold', d.won ? 'text-green-400' : 'text-red-400')}>
                              {d.won ? 'W' : 'L'} {d.score}
                            </span>
                          </td>
                          <td className="px-3 py-2 font-mono text-yellow-400">{d.atkWr}%</td>
                          <td className="px-3 py-2 font-mono text-blue-400">{d.defWr}%</td>
                          <td className="px-3 py-2 font-mono text-purple-400">{d.postWr > 0 ? `${d.postWr}%` : '—'}</td>
                          <td className="px-3 py-2 font-mono text-green-400">{d.retakeWr > 0 ? `${d.retakeWr}%` : '—'}</td>
                          <td className="px-3 py-2 font-mono text-orange-400">{d.plantPct > 0 ? `${d.plantPct}%` : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Nota informativa */}
          <div className="glass-card p-3 text-[10px] text-muted-foreground/60 border border-white/5">
            <p>ℹ️ <strong>ATK/DEF %</strong> calculado sobre la mitad de rondas totales (aproximación sin OT).
            Para máxima precisión, los valores de <strong>Rondas ATK ganadas</strong> y <strong>Rondas DEF ganadas</strong> deben estar correctamente rellenos en cada partido.
            El campo <strong>Plantas recibidas</strong> debe rellenarse manualmente al añadir el partido.</p>
          </div>
        </>
      )}
    </div>
  );
}
