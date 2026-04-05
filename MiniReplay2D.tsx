// ── MiniReplay2D.tsx ─────────────────────────────────────────────────────────
// Mini-replay 2D: anima posiciones de jugadores ronda a ronda sobre el mapa

import { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, SkipForward, SkipBack, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ReplayEvent {
  time: number;       // ms desde inicio de ronda
  type: 'kill' | 'plant' | 'defuse';
  killerNorm?: { nx: number; ny: number };
  victimNorm?: { nx: number; ny: number };
  killerTeam?: string;
  victimTeam?: string;
  killerName?: string;
  victimName?: string;
  weapon?: string;
  site?: string;
}

interface MiniReplay2DProps {
  mapImageUrl: string;
  rounds: any[];
  kills: any[];
  mapName: string;
}

export function MiniReplay2D({ mapImageUrl, rounds, kills, mapName }: MiniReplay2DProps) {
  const [selectedRound, setSelectedRound] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [mapLoaded, setMapLoaded] = useState(false);
  const intervalRef = useRef<number | null>(null);

  // Extraer eventos de la ronda seleccionada
  const roundKills = kills
    .filter((k: any) => k.round === selectedRound)
    .sort((a: any, b: any) =>
      (a.timeInRound ?? a.round_time_millis ?? 0) - (b.timeInRound ?? b.round_time_millis ?? 0))
    .map((k: any): ReplayEvent => ({
      time: k.timeInRound ?? k.round_time_millis ?? 0,
      type: 'kill',
      killerNorm: k.killerLocationNorm,
      victimNorm: k.victimLocationNorm,
      killerTeam: k.killerTeam || k.killer_team || '',
      victimTeam: k.victimTeam || k.victim_team || '',
      killerName: k.killerName || k.killer_display_name || '',
      victimName: k.victimName || k.victim_display_name || '',
      weapon: k.weaponName || k.damage_weapon_name || '',
    }));

  const maxTime = roundKills.length > 0 ? Math.max(...roundKills.map(e => e.time)) + 2000 : 100000;

  // Eventos visibles hasta currentTime
  const visibleEvents = roundKills.filter(e => e.time <= currentTime);
  const latestEvent = visibleEvents[visibleEvents.length - 1] || null;

  // Playback
  useEffect(() => {
    if (playing) {
      intervalRef.current = window.setInterval(() => {
        setCurrentTime(t => {
          const next = t + 100 * speed;
          if (next >= maxTime) { setPlaying(false); return maxTime; }
          return next;
        });
      }, 100);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [playing, speed, maxTime]);

  const reset = () => { setPlaying(false); setCurrentTime(0); };
  const prevRound = () => { setSelectedRound(r => Math.max(0, r - 1)); reset(); };
  const nextRound = () => { setSelectedRound(r => Math.min(rounds.length - 1, r + 1)); reset(); };

  const r = rounds[selectedRound];
  const winTeam = r?.winningTeam || r?.winning_team || '';

  return (
    <div className="space-y-3">
      {/* Selector de ronda */}
      <div className="flex flex-wrap gap-1">
        {rounds.slice(0, 30).map((_: any, i: number) => {
          const win = (rounds[i]?.winningTeam || rounds[i]?.winning_team || '') === 'Blue';
          return (
            <button key={i} onClick={() => { setSelectedRound(i); reset(); }}
              className={cn('w-7 h-7 rounded text-[10px] font-bold transition-all border',
                selectedRound === i ? 'bg-white/15 border-white/40 text-white' :
                win ? 'border-blue-500/20 text-blue-400/60 hover:bg-blue-500/10' : 'border-red-500/20 text-red-400/60 hover:bg-red-500/10')}>
              {i + 1}
            </button>
          );
        })}
      </div>

      {/* Cabecera ronda */}
      <div className={cn('rounded-lg px-3 py-2 text-xs flex items-center justify-between',
        winTeam === 'Blue' ? 'bg-blue-500/10 border border-blue-500/20' : 'bg-red-500/10 border border-red-500/20')}>
        <span className="font-bold">Ronda {selectedRound + 1}</span>
        <span className={winTeam === 'Blue' ? 'text-blue-400' : 'text-red-400'}>
          {winTeam === 'Blue' ? '🔵 Blue gana' : '🔴 Red gana'}
        </span>
        <span className="text-muted-foreground">{roundKills.length} kills</span>
      </div>

      {/* Mapa con eventos */}
      <div className="relative rounded-xl overflow-hidden" style={{ aspectRatio: '1/1', maxWidth: 480, background: '#0a0b12' }}>
        {mapImageUrl && (
          <img src={mapImageUrl} alt={mapName}
            className="absolute inset-0 w-full h-full object-cover"
            style={{ opacity: mapLoaded ? 0.7 : 0 }}
            onLoad={() => setMapLoaded(true)} />
        )}
        <svg viewBox="0 0 512 512" preserveAspectRatio="xMidYMid meet" className="absolute inset-0 w-full h-full" style={{ zIndex: 2 }}>
          {/* Muerte markers (ya pasados) */}
          {visibleEvents.map((e, i) => (
            <g key={i}>
              {e.victimNorm && (
                <>
                  <circle cx={e.victimNorm.nx * 512} cy={e.victimNorm.ny * 512} r={6}
                    fill="none" stroke={e.victimTeam === 'Blue' ? '#3b82f6' : '#ef4444'} strokeWidth={1.5} opacity={0.6} />
                  <line x1={e.victimNorm.nx * 512 - 4} y1={e.victimNorm.ny * 512 - 4}
                    x2={e.victimNorm.nx * 512 + 4} y2={e.victimNorm.ny * 512 + 4}
                    stroke={e.victimTeam === 'Blue' ? '#3b82f6' : '#ef4444'} strokeWidth={1.5} opacity={0.6} />
                  <line x1={e.victimNorm.nx * 512 + 4} y1={e.victimNorm.ny * 512 - 4}
                    x2={e.victimNorm.nx * 512 - 4} y2={e.victimNorm.ny * 512 + 4}
                    stroke={e.victimTeam === 'Blue' ? '#3b82f6' : '#ef4444'} strokeWidth={1.5} opacity={0.6} />
                </>
              )}
              {e.killerNorm && (
                <circle cx={e.killerNorm.nx * 512} cy={e.killerNorm.ny * 512} r={3}
                  fill={e.killerTeam === 'Blue' ? '#3b82f6' : '#ef4444'} opacity={0.8} />
              )}
            </g>
          ))}
          {/* Último evento: highlight */}
          {latestEvent?.victimNorm && (
            <circle cx={latestEvent.victimNorm.nx * 512} cy={latestEvent.victimNorm.ny * 512} r={10}
              fill="none" stroke="#fbbf24" strokeWidth={2.5} opacity={0.9}>
              <animate attributeName="r" from="6" to="14" dur="0.6s" repeatCount="indefinite" />
              <animate attributeName="opacity" from="1" to="0.2" dur="0.6s" repeatCount="indefinite" />
            </circle>
          )}
        </svg>

        {/* Kill feed overlay */}
        {latestEvent && (
          <div className="absolute bottom-2 left-2 right-2 rounded-lg px-3 py-2 z-10 text-xs flex items-center gap-2"
            style={{ background: 'rgba(6,8,18,0.92)' }}>
            <span className={latestEvent.killerTeam === 'Blue' ? 'text-blue-400 font-bold' : 'text-red-400 font-bold'}>
              {latestEvent.killerName}
            </span>
            <span className="text-muted-foreground">→ {latestEvent.weapon} →</span>
            <span className={latestEvent.victimTeam === 'Blue' ? 'text-blue-400/60' : 'text-red-400/60'}>
              {latestEvent.victimName}
            </span>
          </div>
        )}
      </div>

      {/* Controles playback */}
      <div className="flex items-center gap-2">
        <button onClick={prevRound} className="p-2 rounded-lg border border-white/10 hover:bg-white/5">
          <SkipBack className="w-4 h-4" />
        </button>
        <button onClick={() => setPlaying(!playing)}
          className={cn('p-2 rounded-lg border transition-all',
            playing ? 'border-red-500/40 bg-red-500/15 text-red-300' : 'border-green-500/40 bg-green-500/15 text-green-300')}>
          {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
        </button>
        <button onClick={nextRound} className="p-2 rounded-lg border border-white/10 hover:bg-white/5">
          <SkipForward className="w-4 h-4" />
        </button>
        <button onClick={reset} className="p-2 rounded-lg border border-white/10 hover:bg-white/5">
          <RotateCcw className="w-4 h-4" />
        </button>

        {/* Timeline slider */}
        <div className="flex-1 mx-2">
          <input type="range" min={0} max={maxTime} value={currentTime}
            onChange={e => { setCurrentTime(+e.target.value); setPlaying(false); }}
            className="w-full h-1 rounded-full appearance-none cursor-pointer"
            style={{ background: `linear-gradient(to right, #ef4444 ${(currentTime/maxTime)*100}%, hsl(220 15% 15%) 0%)` }} />
        </div>

        {/* Speed */}
        <div className="flex gap-1">
          {[0.5, 1, 2, 4].map(s => (
            <button key={s} onClick={() => setSpeed(s)}
              className={cn('text-[10px] px-1.5 py-0.5 rounded border transition-all',
                speed === s ? 'border-white/30 bg-white/10 text-white' : 'border-white/10 text-muted-foreground')}>
              {s}×
            </button>
          ))}
        </div>

        {/* Event counter */}
        <span className="text-[10px] text-muted-foreground">
          {visibleEvents.length}/{roundKills.length}
        </span>
      </div>
    </div>
  );
}
