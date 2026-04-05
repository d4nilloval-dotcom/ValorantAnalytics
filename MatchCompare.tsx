// ── MatchCompare.tsx ─────────────────────────────────────────────────────────
// Comparador de 2 partidos lado a lado

import { useState, useMemo } from 'react';
import { GitCompare, ChevronDown, ArrowRight, Trophy, Skull, Target, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/store/appStore';

function statDiff(a: number, b: number): { diff: number; better: 'a' | 'b' | 'tie' } {
  const diff = a - b;
  return { diff, better: diff > 0 ? 'a' : diff < 0 ? 'b' : 'tie' };
}

function DiffBadge({ val, invert = false }: { val: number; invert?: boolean }) {
  const positive = invert ? val < 0 : val > 0;
  if (val === 0) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <span className={cn('text-xs font-bold', positive ? 'text-green-400' : 'text-red-400')}>
      {val > 0 ? '+' : ''}{val}
    </span>
  );
}

export function MatchCompare() {
  const { matches } = useAppStore();
  const matchList = useMemo(() => Object.values(matches).sort((a: any, b: any) => b.createdAt - a.createdAt), [matches]);

  const [idA, setIdA] = useState('');
  const [idB, setIdB] = useState('');

  const matchA = matchList.find((m: any) => m.id === idA);
  const matchB = matchList.find((m: any) => m.id === idB);

  const comparison = useMemo(() => {
    if (!matchA || !matchB) return null;
    return {
      scoreUs:    statDiff(matchA.scoreUs,  matchB.scoreUs),
      scoreOpp:   statDiff(matchA.scoreOpp, matchB.scoreOpp, ),
      won:        { a: matchA.won, b: matchB.won },
    };
  }, [matchA, matchB]);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-black flex items-center gap-2">
          <GitCompare className="w-6 h-6 text-blue-400" /> Comparador de Partidos
        </h2>
        <p className="text-sm text-muted-foreground">Selecciona dos partidos para comparar estadísticas lado a lado</p>
      </div>

      {/* Selectores */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[
          { id: idA, setId: setIdA, label: 'Partido A', color: 'blue' },
          { id: idB, setId: setIdB, label: 'Partido B', color: 'red' },
        ].map(({ id, setId, label, color }) => (
          <div key={label} className="glass-card p-4">
            <p className={cn('text-xs font-bold uppercase tracking-wider mb-2', color === 'blue' ? 'text-blue-400' : 'text-red-400')}>{label}</p>
            <select value={id} onChange={e => setId(e.target.value)}
              className="w-full rounded-xl border px-3 py-2.5 text-sm"
              style={{ background: 'hsl(220 15% 10%)', borderColor: 'hsl(220 15% 20%)' }}>
              <option value="">— Seleccionar partido —</option>
              {matchList.map((m: any) => (
                <option key={m.id} value={m.id}>
                  {m.map} · {m.won ? 'W' : 'L'} {m.scoreUs}-{m.scoreOpp} · {m.date}
                </option>
              ))}
            </select>
            {id && (() => {
              const m = matchList.find((x: any) => x.id === id);
              if (!m) return null;
              return (
                <div className="mt-3 flex items-center gap-3 text-sm">
                  <span className={cn('px-2 py-1 rounded-lg text-xs font-bold', m.won ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400')}>
                    {m.won ? 'VICTORIA' : 'DERROTA'}
                  </span>
                  <span className="font-bold">{m.map}</span>
                  <span className="text-muted-foreground">{m.scoreUs}–{m.scoreOpp}</span>
                  <span className="text-xs text-muted-foreground">{m.type}</span>
                </div>
              );
            })()}
          </div>
        ))}
      </div>

      {/* Comparación */}
      {matchA && matchB && (
        <div className="glass-card p-5 space-y-4">
          <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Comparación</h3>

          <div className="grid grid-cols-3 gap-4 text-center">
            {/* Header */}
            <div className="text-blue-400 font-bold text-sm">{matchA.map}</div>
            <div className="text-muted-foreground text-xs">vs</div>
            <div className="text-red-400 font-bold text-sm">{matchB.map}</div>

            {/* Resultado */}
            <div className={cn('text-2xl font-black', matchA.won ? 'text-green-400' : 'text-red-400')}>
              {matchA.won ? 'W' : 'L'}
            </div>
            <div className="flex items-center justify-center"><Trophy className="w-4 h-4 text-yellow-400" /></div>
            <div className={cn('text-2xl font-black', matchB.won ? 'text-green-400' : 'text-red-400')}>
              {matchB.won ? 'W' : 'L'}
            </div>

            {/* Score */}
            <div className="text-xl font-bold">{matchA.scoreUs}–{matchA.scoreOpp}</div>
            <div className="flex items-center justify-center"><Target className="w-4 h-4 text-muted-foreground" /></div>
            <div className="text-xl font-bold">{matchB.scoreUs}–{matchB.scoreOpp}</div>

            {/* Diferencia de rondas */}
            <div className="text-sm">Rondas nuestras: <span className="font-bold">{matchA.scoreUs}</span></div>
            <DiffBadge val={matchA.scoreUs - matchB.scoreUs} />
            <div className="text-sm">Rondas nuestras: <span className="font-bold">{matchB.scoreUs}</span></div>

            {/* Pistol */}
            <div className="text-sm">
              Pistol ATK: <span className={matchA.pistolAtkWin ? 'text-green-400' : 'text-red-400'}>{matchA.pistolAtkWin ? '✓' : '✗'}</span>
            </div>
            <div className="flex items-center justify-center"><Zap className="w-4 h-4 text-yellow-400" /></div>
            <div className="text-sm">
              Pistol ATK: <span className={matchB.pistolAtkWin ? 'text-green-400' : 'text-red-400'}>{matchB.pistolAtkWin ? '✓' : '✗'}</span>
            </div>

            <div className="text-sm">
              Pistol DEF: <span className={matchA.pistolDefWin ? 'text-green-400' : 'text-red-400'}>{matchA.pistolDefWin ? '✓' : '✗'}</span>
            </div>
            <div />
            <div className="text-sm">
              Pistol DEF: <span className={matchB.pistolDefWin ? 'text-green-400' : 'text-red-400'}>{matchB.pistolDefWin ? '✓' : '✗'}</span>
            </div>
          </div>

          {/* Notas */}
          <div className="grid grid-cols-2 gap-4 pt-3 border-t border-white/10">
            <div>
              <p className="text-[10px] text-muted-foreground mb-1">Notas A</p>
              <p className="text-xs text-muted-foreground/70">{matchA.notes || '—'}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground mb-1">Notas B</p>
              <p className="text-xs text-muted-foreground/70">{matchB.notes || '—'}</p>
            </div>
          </div>
        </div>
      )}

      {matchList.length < 2 && (
        <div className="glass-card p-10 text-center text-muted-foreground">
          <p>Necesitas al menos 2 partidos registrados para comparar.</p>
        </div>
      )}
    </div>
  );
}
