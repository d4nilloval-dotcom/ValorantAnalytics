import { useMemo } from 'react';
import { useAppStore } from '@/store/appStore';
import { cn } from '@/lib/utils';
import { VALORANT_MAPS } from '@/types';
import { Map } from 'lucide-react';

function wrColor(wr: number | null): string {
  if (wr === null) return 'hsl(220 15% 12%)';
  if (wr >= 70) return 'hsl(142 60% 25%)';
  if (wr >= 60) return 'hsl(142 50% 20%)';
  if (wr >= 50) return 'hsl(142 35% 16%)';
  if (wr >= 40) return 'hsl(38 50% 18%)';
  if (wr >= 30) return 'hsl(25 55% 20%)';
  return 'hsl(355 50% 20%)';
}
function wrTextColor(wr: number | null): string {
  if (wr === null) return 'text-muted-foreground';
  if (wr >= 60) return 'text-green-400';
  if (wr >= 45) return 'text-yellow-400';
  return 'text-red-400';
}
function wrBorderColor(wr: number | null): string {
  if (wr === null) return 'border-white/5';
  if (wr >= 60) return 'border-green-500/30';
  if (wr >= 45) return 'border-yellow-500/30';
  return 'border-red-500/30';
}

export function MapHeatmap() {
  const { matches } = useAppStore();

  const heatmapData = useMemo(() => {
    const byMap: Record<string, {
      atkWins: number; atkTotal: number;
      defWins: number; defTotal: number;
      totalWins: number; total: number;
    }> = {};

    for (const m of Object.values(matches)) {
      if (!byMap[m.map]) byMap[m.map] = { atkWins: 0, atkTotal: 0, defWins: 0, defTotal: 0, totalWins: 0, total: 0 };
      const d = byMap[m.map];
      d.total++;
      if (m.won) d.totalWins++;

      // Determine which side was dominant (more rounds won)
      // atk = rounds won in attack side, def = rounds won in defense side
      if (m.atk !== undefined && m.def !== undefined) {
        d.atkTotal += m.atk + (m.scoreUs - m.atk - m.def >= 0 ? 0 : 0); // count actual rounds
        // We use: atk field = rounds won attacking, def field = rounds won defending
        // Total attacking rounds = usually 12 or 13 minus some OT
        // Approximation: atk/(atk+def) tells us side dominance
        d.atkWins += m.atk;
        d.atkTotal++;
        d.defWins += m.def;
        d.defTotal++;
      }
    }

    // Build map rows
    return VALORANT_MAPS.map(map => {
      const d = byMap[map];
      if (!d || d.total === 0) return { map, total: 0, wr: null, atkWr: null, defWr: null };

      const avgAtk = d.atkTotal > 0 ? d.atkWins / d.atkTotal : 0;
      const avgDef = d.defTotal > 0 ? d.defWins / d.defTotal : 0;
      const totalRoundsAvg = avgAtk + avgDef;

      // WR by side: if we win more atk rounds vs typical 12, we're atk dominant
      // Use: atkWr% = avgAtkRounds/12*100, defWr% = avgDefRounds/12*100
      const atkPct = totalRoundsAvg > 0 ? (avgAtk / totalRoundsAvg) * 100 : 50;

      return {
        map,
        total: d.total,
        wr: d.total > 0 ? Math.round(d.totalWins / d.total * 100) : null,
        // For ATK/DEF: compute from the atk/def round counts
        atkWr: d.atkTotal > 0 ? Math.round((d.atkWins / d.atkTotal) / 13 * 100) : null,
        defWr: d.defTotal > 0 ? Math.round((d.defWins / d.defTotal) / 13 * 100) : null,
        atkRoundsAvg: d.atkTotal > 0 ? (d.atkWins / d.atkTotal).toFixed(1) : null,
        defRoundsAvg: d.defTotal > 0 ? (d.defWins / d.defTotal).toFixed(1) : null,
      };
    });
  }, [matches]);

  const playedMaps = heatmapData.filter(m => m.total > 0);
  const totalMatches = Object.values(matches).length;

  // Rankings
  const bestMap   = [...playedMaps].sort((a, b) => (b.wr ?? 0) - (a.wr ?? 0))[0];
  const worstMap  = [...playedMaps].sort((a, b) => (a.wr ?? 100) - (b.wr ?? 100))[0];
  const bestAtk   = [...playedMaps].filter(m => m.atkWr !== null).sort((a, b) => (b.atkWr ?? 0) - (a.atkWr ?? 0))[0];
  const bestDef   = [...playedMaps].filter(m => m.defWr !== null).sort((a, b) => (b.defWr ?? 0) - (a.defWr ?? 0))[0];

  return (
    <div className="space-y-5">
      <div className="glass-card p-5">
        <h2 className="text-xl font-bold flex items-center gap-2 mb-1">
          <Map className="w-5 h-5 text-blue-400" /> Heatmap de Mapas
        </h2>
        <p className="text-sm text-muted-foreground">
          Visión completa del rendimiento por mapa y lado. Verde = bueno, rojo = a mejorar.
        </p>
      </div>

      {totalMatches === 0 ? (
        <div className="glass-card p-10 text-center text-muted-foreground">
          <p className="text-3xl mb-3">🗺</p>
          <p>Sin partidos registrados. Añade partidos para ver el heatmap.</p>
        </div>
      ) : (
        <>
          {/* Summary cards */}
          {playedMaps.length > 0 && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { label: '🏆 Mejor mapa', value: bestMap?.map, sub: `${bestMap?.wr}% WR`, color: 'text-green-400' },
                { label: '⚠️ Peor mapa', value: worstMap?.map, sub: `${worstMap?.wr}% WR`, color: 'text-red-400' },
                { label: '🗡 Mejor ATK', value: bestAtk?.map, sub: `${bestAtk?.atkRoundsAvg} rondas avg`, color: 'text-yellow-400' },
                { label: '🛡 Mejor DEF', value: bestDef?.map, sub: `${bestDef?.defRoundsAvg} rondas avg`, color: 'text-blue-400' },
              ].map(({ label, value, sub, color }) => (
                <div key={label} className="glass-card p-4">
                  <p className="text-xs text-muted-foreground mb-1">{label}</p>
                  <p className={cn("text-lg font-black", color)}>{value || '—'}</p>
                  <p className="text-xs text-muted-foreground">{sub || ''}</p>
                </div>
              ))}
            </div>
          )}

          {/* Heatmap table */}
          <div className="glass-card p-5 overflow-x-auto">
            <h3 className="font-semibold mb-4">Mapa × Lado × Win Rate</h3>
            <table className="w-full">
              <thead>
                <tr className="text-left text-xs text-muted-foreground uppercase border-b border-white/10">
                  <th className="py-3 px-3 w-28">Mapa</th>
                  <th className="py-3 px-3 text-center">Partidos</th>
                  <th className="py-3 px-3 text-center w-36">Win Rate Global</th>
                  <th className="py-3 px-3 text-center w-36">🗡 ATK (rondas)</th>
                  <th className="py-3 px-3 text-center w-36">🛡 DEF (rondas)</th>
                  <th className="py-3 px-3 text-center">Tendencia</th>
                </tr>
              </thead>
              <tbody>
                {heatmapData.map(({ map, total, wr, atkWr, defWr, atkRoundsAvg, defRoundsAvg }) => {
                  const dominantSide = atkRoundsAvg && defRoundsAvg
                    ? parseFloat(atkRoundsAvg) >= parseFloat(defRoundsAvg) ? 'ATK' : 'DEF'
                    : null;

                  return (
                    <tr key={map} className={cn("border-t border-white/5 transition-colors", total > 0 ? 'hover:bg-white/5' : 'opacity-40')}>
                      <td className="py-3 px-3 font-bold text-sm">{map}</td>
                      <td className="py-3 px-3 text-center text-sm text-muted-foreground">{total > 0 ? total : '—'}</td>

                      {/* WR Global */}
                      <td className="py-3 px-3">
                        <div className="flex items-center justify-center">
                          {wr !== null ? (
                            <div className={cn("rounded-lg px-4 py-2 border min-w-[80px] text-center", wrBorderColor(wr))}
                              style={{ background: wrColor(wr) }}>
                              <p className={cn("text-base font-black", wrTextColor(wr))}>{wr}%</p>
                              <p className="text-[10px] text-muted-foreground">{total} partidos</p>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">—</span>
                          )}
                        </div>
                      </td>

                      {/* ATK */}
                      <td className="py-3 px-3">
                        <div className="flex items-center justify-center">
                          {atkRoundsAvg !== null ? (
                            <div className="rounded-lg px-3 py-2 border min-w-[72px] text-center bg-yellow-500/10 border-yellow-500/20">
                              <p className="text-base font-black text-yellow-400">{atkRoundsAvg}</p>
                              <p className="text-[10px] text-muted-foreground">rondas/partido</p>
                            </div>
                          ) : <span className="text-muted-foreground text-sm">—</span>}
                        </div>
                      </td>

                      {/* DEF */}
                      <td className="py-3 px-3">
                        <div className="flex items-center justify-center">
                          {defRoundsAvg !== null ? (
                            <div className="rounded-lg px-3 py-2 border min-w-[72px] text-center bg-blue-500/10 border-blue-500/20">
                              <p className="text-base font-black text-blue-400">{defRoundsAvg}</p>
                              <p className="text-[10px] text-muted-foreground">rondas/partido</p>
                            </div>
                          ) : <span className="text-muted-foreground text-sm">—</span>}
                        </div>
                      </td>

                      {/* Tendencia */}
                      <td className="py-3 px-3 text-center">
                        {total > 0 && dominantSide ? (
                          <span className={cn("text-xs px-2 py-1 rounded-full font-bold border",
                            dominantSide === 'ATK' ? 'bg-yellow-500/15 border-yellow-500/30 text-yellow-400' : 'bg-blue-500/15 border-blue-500/30 text-blue-400')}>
                            {dominantSide === 'ATK' ? '🗡 ATK dominante' : '🛡 DEF dominante'}
                          </span>
                        ) : total === 0 ? (
                          <span className="text-xs text-muted-foreground italic">Sin datos</span>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Color legend */}
          <div className="glass-card p-4">
            <p className="text-xs text-muted-foreground mb-3">Leyenda de colores (Win Rate Global)</p>
            <div className="flex gap-2 flex-wrap">
              {[
                { range: '≥70%', color: 'hsl(142 60% 25%)', text: 'text-green-400', border: 'border-green-500/30', label: 'Excelente' },
                { range: '60-69%', color: 'hsl(142 50% 20%)', text: 'text-green-400', border: 'border-green-500/20', label: 'Bueno' },
                { range: '50-59%', color: 'hsl(142 35% 16%)', text: 'text-green-400', border: 'border-green-500/15', label: 'Positivo' },
                { range: '40-49%', color: 'hsl(38 50% 18%)', text: 'text-yellow-400', border: 'border-yellow-500/30', label: 'Neutro' },
                { range: '30-39%', color: 'hsl(25 55% 20%)', text: 'text-orange-400', border: 'border-orange-500/30', label: 'Bajo' },
                { range: '<30%', color: 'hsl(355 50% 20%)', text: 'text-red-400', border: 'border-red-500/30', label: 'Crítico' },
              ].map(({ range, color, text, border, label }) => (
                <div key={range} className={cn("px-3 py-1.5 rounded-lg border text-center", border)} style={{ background: color }}>
                  <p className={cn("text-xs font-bold", text)}>{range}</p>
                  <p className="text-[10px] text-muted-foreground">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
