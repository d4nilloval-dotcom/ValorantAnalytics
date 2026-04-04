import React, { useState, useMemo } from 'react';
import { Plus, Search, Edit2, Trash2, Users, Camera, ChevronDown, ChevronUp, Zap, Clock, DollarSign, BarChart2 } from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import { VALORANT_MAPS, type Match, type MatchType, type Player, type TournamentPlayerStats } from '@/types';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScreenshotImport } from './ScreenshotImport';

// ── Equipo ────────────────────────────────────────────────────────────────────
const MY_TEAM_NAME    = 'NGU eSports';
const MY_TEAM_PLAYERS = ['DavidG', 'Legarzz', 'Lubin', 'Perez', 'Frospo', 'SantiChoped'];

// ── Tipos ─────────────────────────────────────────────────────────────────────
type RoundType = 'normal' | 'pistol' | 'eco' | 'force' | 'clutch' | 'thrifty';

interface RoundResult {
  number:       number;
  side:         'ATK' | 'DEF';
  won:          boolean | null;
  type:         RoundType;
  bombPlanted?: boolean;
  bombDefused?: boolean;
}

interface EcoStats {
  pistolWins: number;  pistolTotal: number;
  ecoWins:    number;  ecoTotal:    number;
  forceWins:  number;  forceTotal:  number;
  fullWins:   number;  fullTotal:   number;
}

interface MapData {
  map:           string;
  scoreUs:       number;
  scoreOpp:      number;
  atk:           number;
  def:           number;
  otWin:         number;
  otLoss:        number;
  pistolAtkWin:  boolean;
  pistolDefWin:  boolean;
  postWin:       number;
  postLoss:      number;
  retakeWin:     number;
  retakeLoss:    number;
  plantsAgainst: number;
  rounds:        RoundResult[];
  playerStats:   TournamentPlayerStats[];
}

interface MatchFormData {
  id:     string;
  type:   MatchType;
  date:   string;
  isBo3:  boolean;
  notes:  string;
  maps:   MapData[];
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function generateMatchId() {
  const now = new Date();
  return now.toISOString().split('T')[0] + '_' + now.toTimeString().slice(0,5).replace(':','');
}

function emptyRounds(total = 24): RoundResult[] {
  return Array.from({ length: total }, (_, i) => ({
    number: i + 1,
    side:   i < 12 ? 'ATK' as const : 'DEF' as const,
    won:    null,
    type:   (i === 0 || i === 12 ? 'pistol' : 'normal') as RoundType,
  }));
}

function defaultMapData(map = 'Ascent'): MapData {
  return {
    map, scoreUs: 0, scoreOpp: 0, atk: 0, def: 0, otWin: 0, otLoss: 0,
    pistolAtkWin: false, pistolDefWin: false,
    postWin: 0, postLoss: 0, retakeWin: 0, retakeLoss: 0, plantsAgainst: 0,
    rounds: emptyRounds(), playerStats: [],
  };
}

function defaultForm(): MatchFormData {
  return {
    id: generateMatchId(), type: 'SCRIM',
    date: new Date().toISOString().split('T')[0],
    isBo3: false, notes: '', maps: [defaultMapData()],
  };
}

// ── Calcular economía desde las rondas marcadas ────────────────────────────────
function calcEcoFromRounds(rounds: RoundResult[]): EcoStats {
  const played = rounds.filter(r => r.won !== null);
  const s: EcoStats = { pistolWins:0, pistolTotal:0, ecoWins:0, ecoTotal:0, forceWins:0, forceTotal:0, fullWins:0, fullTotal:0 };
  for (const r of played) {
    const w = r.won === true;
    if (r.type === 'pistol')  { s.pistolTotal++; if (w) s.pistolWins++; }
    else if (r.type === 'eco')    { s.ecoTotal++;    if (w) s.ecoWins++;    }
    else if (r.type === 'force')  { s.forceTotal++;  if (w) s.forceWins++;  }
    else                          { s.fullTotal++;   if (w) s.fullWins++;   }
  }
  return s;
}

function pct(n: number, d: number) { return d > 0 ? Math.round(n / d * 100) : 0; }

// ── EcoPanel: muestra las estadísticas calculadas desde las rondas ─────────────
function EcoPanel({ rounds }: { rounds: RoundResult[] }) {
  const eco = calcEcoFromRounds(rounds);
  const played = rounds.filter(r => r.won !== null).length;
  if (played === 0) return null;
  const rows = [
    { label: '🔫 Pistola', wins: eco.pistolWins, total: eco.pistolTotal, color: '#f59e0b' },
    { label: '💸 Eco',     wins: eco.ecoWins,    total: eco.ecoTotal,    color: '#6b7280' },
    { label: '⚡ Force',   wins: eco.forceWins,  total: eco.forceTotal,  color: '#8b5cf6' },
    { label: '✅ Full',    wins: eco.fullWins,   total: eco.fullTotal,   color: '#22c55e' },
  ].filter(r => r.total > 0);
  if (rows.length === 0) return null;
  return (
    <div className="rounded-xl p-3 space-y-2 mt-2" style={{ background: 'hsl(220 20% 6%)', border: '1px solid hsl(220 15% 16%)' }}>
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
        <Zap className="w-3 h-3 text-yellow-400"/> Economía calculada desde rondas
      </p>
      <div className="grid grid-cols-2 gap-2">
        {rows.map(({ label, wins, total, color }) => {
          const p = pct(wins, total);
          return (
            <div key={label} className="flex items-center gap-2">
              <span className="text-[10px] w-20 shrink-0" style={{ color }}>{label}</span>
              <div className="flex-1 h-1.5 rounded-full bg-white/8">
                <div className="h-full rounded-full transition-all" style={{ width: p + '%', background: color }}/>
              </div>
              <span className="text-[10px] font-mono font-bold w-8 text-right" style={{ color }}>{p}%</span>
              <span className="text-[9px] text-muted-foreground/50">{wins}/{total}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Icono de ronda ─────────────────────────────────────────────────────────────
function RoundIcon({ round, onClick }: { round: RoundResult; onClick?: () => void }) {
  const s = 22;
  const won = round.won;
  if (won === null) {
    return (
      <div onClick={onClick} className="rounded-sm cursor-pointer hover:opacity-80 transition-opacity"
        style={{ width: s, height: s, background: 'hsl(220 15% 14%)', border: '1px solid hsl(220 15% 22%)' }}
        title={'R' + round.number + ' ' + round.side + ' — clic para marcar'}/>
    );
  }
  const base = won ? '#22c55e' : '#ef4444';
  let icon = '';
  if (round.type === 'pistol')       icon = '🔫';
  else if (round.type === 'eco')     icon = '💸';
  else if (round.type === 'force')   icon = '⚡';
  else if (round.type === 'clutch')  icon = '⭐';
  else if (round.type === 'thrifty') icon = '💎';
  else if (round.bombDefused)        icon = '🔧';
  else if (round.bombPlanted)        icon = '💣';
  else                               icon = won ? '✓' : '✗';
  return (
    <div onClick={onClick} className="rounded-sm flex items-center justify-center cursor-pointer hover:opacity-80 select-none transition-opacity"
      style={{ width: s, height: s, background: base + '22', border: '1.5px solid ' + base, color: base, fontSize: 9 }}
      title={'R' + round.number + ' ' + round.side + ' ' + (won ? 'GANADA' : 'PERDIDA') + ' ' + round.type}>
      {icon}
    </div>
  );
}

// ── Visualizador de rondas ────────────────────────────────────────────────────
function RoundVisualizer({ rounds, onChange, scoreUs, scoreOpp }: {
  rounds: RoundResult[]; onChange: (r: RoundResult[]) => void;
  scoreUs: number; scoreOpp: number;
}) {
  const [selIdx,  setSelIdx]  = useState<number | null>(null);

  const cycle = (idx: number) => {
    onChange(rounds.map((r, i) => {
      if (i !== idx) return r;
      if (r.won === null) return { ...r, won: true };
      if (r.won === true) return { ...r, won: false };
      return { ...r, won: null };
    }));
  };

  const setType = (idx: number, type: RoundType) => {
    onChange(rounds.map((r, i) => i === idx ? { ...r, type } : r));
    setSelIdx(null);
  };

  const firstHalf  = rounds.slice(0, 12);
  const secondHalf = rounds.slice(12, 24);
  const otRounds   = rounds.slice(24);

  const half_data = [
    { half: firstHalf,  label: '⚔ ATK — Primera mitad (R1–R12)',   color: '#f59e0b', offset: 0  },
    { half: secondHalf, label: '🛡 DEF — Segunda mitad (R13–R24)',  color: '#3b82f6', offset: 12 },
    ...(otRounds.length > 0 ? [{ half: otRounds, label: '⏱ Prórroga', color: '#a855f7', offset: 24 }] : []),
  ];

  const TYPES: [RoundType, string][] = [['normal','Normal'],['pistol','Pistola'],['eco','Eco'],['force','Force'],['clutch','Clutch'],['thrifty','Thrifty']];

  return (
    <div className="space-y-3 p-3 rounded-xl" style={{ background: 'hsl(220 20% 8%)' }}>
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground text-[10px]">Clic = ganada → perdida → vacía · Clic derecho = tipo</span>
        <span className="font-mono font-bold text-sm">
          <span className="text-green-400">{scoreUs}</span>
          <span className="text-muted-foreground mx-1">–</span>
          <span className="text-red-400">{scoreOpp}</span>
        </span>
      </div>

      {half_data.map(({ half, label, color, offset }) => (
        <div key={label} className="space-y-1">
          <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color }}>{label}</p>
          <div className="flex flex-wrap gap-1">
            {half.map((r, i) => {
              const gIdx = offset + i;
              return (
                <div key={gIdx} className="relative flex flex-col items-center"
                  onContextMenu={e => { e.preventDefault(); setSelIdx(selIdx === gIdx ? null : gIdx); }}>
                  <span className="text-[8px] text-muted-foreground/40 mb-0.5">{r.number}</span>
                  <RoundIcon round={r} onClick={() => cycle(gIdx)}/>
                  {/* Popup de tipo al hacer clic derecho */}
                  {selIdx === gIdx && (
                    <div className="absolute top-7 left-0 z-50 rounded-lg border shadow-xl p-1.5 space-y-0.5"
                      style={{ background: 'hsl(220 20% 12%)', borderColor: 'hsl(220 15% 22%)', minWidth: 90 }}>
                      {TYPES.map(([t, l]) => (
                        <button key={t} onClick={() => setType(gIdx, t)}
                          className={"w-full text-left text-[10px] px-2 py-1 rounded hover:bg-white/10 transition-colors " + (r.type === t ? 'text-white font-bold' : 'text-muted-foreground')}>
                          {r.type === t ? '✓ ' : ''}{l}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Leyenda */}
      <div className="flex flex-wrap gap-x-3 gap-y-0.5 pt-1 border-t border-white/6 text-[9px] text-muted-foreground">
        <span className="w-full text-[10px] font-medium text-white/40 mb-0.5">Tipos (clic derecho sobre una ronda):</span>
        {[['🔫','Pistola'],['💸','Eco'],['⚡','Force'],['⭐','Clutch'],['💎','Thrifty'],['💣','Spike'],['🔧','Defuse']].map(([ic,l]) => (
          <span key={l}>{ic} {l}</span>
        ))}
      </div>

      {/* Economía calculada */}
      <EcoPanel rounds={rounds}/>
    </div>
  );
}


// ── EcoTabContent: tab Economía en el editor de partido ──────────────────────
function EcoTabContent({ rounds, playedRounds }: { rounds: RoundResult[]; playedRounds: RoundResult[] }) {
  if (playedRounds.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground space-y-2">
        <DollarSign className="w-10 h-10 mx-auto opacity-30"/>
        <p className="text-sm">Sin rondas marcadas</p>
        <p className="text-xs">Marca rondas en el tab Stats → visualizador de rondas</p>
      </div>
    );
  }
  const eco = calcEcoFromRounds(rounds);
  const rows = [
    { label: '🔫 Pistola', wins: eco.pistolWins, total: eco.pistolTotal, color: '#f59e0b' },
    { label: '💸 Eco',     wins: eco.ecoWins,    total: eco.ecoTotal,    color: '#ef4444' },
    { label: '⚡ Force',   wins: eco.forceWins,  total: eco.forceTotal,  color: '#8b5cf6' },
    { label: '✅ Full',    wins: eco.fullWins,   total: eco.fullTotal,   color: '#22c55e' },
  ].filter(r => r.total > 0);

  return (
    <div className="space-y-4">
      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-4">
          Sin tipos de ronda marcados. Marca pistola/eco/force con clic derecho.
        </p>
      ) : (
        <>
          {/* Barras por tipo */}
          <div className="space-y-3">
            {rows.map(({ label, wins, total, color }) => {
              const p = total > 0 ? Math.round(wins / total * 100) : 0;
              return (
                <div key={label} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span style={{ color }} className="font-medium">{label}</span>
                    <span className="text-muted-foreground">{wins}/{total}</span>
                    <span className="font-bold font-mono" style={{ color }}>{p}%</span>
                  </div>
                  <div className="h-2.5 rounded-full bg-white/8 overflow-hidden">
                    <div className="h-full rounded-full transition-all"
                      style={{ width: p + '%', background: color }}/>
                  </div>
                </div>
              );
            })}
          </div>
          {/* Resumen ATK vs DEF */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: '⚔ ATK', rs: playedRounds.filter(r => r.side === 'ATK'), c: '#f59e0b' },
              { label: '🛡 DEF', rs: playedRounds.filter(r => r.side === 'DEF'), c: '#3b82f6' },
            ].map(({ label, rs, c }) => {
              const w = rs.filter(r => r.won).length;
              const p = rs.length > 0 ? Math.round(w / rs.length * 100) : 0;
              return (
                <div key={label} className="rounded-xl p-3 space-y-1"
                  style={{ background: 'hsl(220 20% 9%)' }}>
                  <p className="text-xs font-bold" style={{ color: c }}>{label}</p>
                  <p className="text-2xl font-black" style={{ color: c }}>{p}%</p>
                  <p className="text-[10px] text-muted-foreground">{w}/{rs.length} rondas</p>
                </div>
              );
            })}
          </div>
          {/* Total de rondas jugadas */}
          <div className="rounded-xl p-3 text-center" style={{ background: 'hsl(220 20% 9%)' }}>
            <p className="text-xs text-muted-foreground">Total rondas marcadas</p>
            <p className="text-2xl font-black text-white">{playedRounds.length}</p>
            <p className="text-xs text-muted-foreground">
              {playedRounds.filter(r => r.won).length} victorias ·{' '}
              {playedRounds.filter(r => !r.won).length} derrotas ·{' '}
              {Math.round(playedRounds.filter(r => r.won).length / playedRounds.length * 100)}% WR
            </p>
          </div>
        </>
      )}
    </div>
  );
}

// ── Formulario de un mapa ─────────────────────────────────────────────────────
function MapForm({ data, onChange, mapIndex, isTournament, showRounds, onToggleRounds }: {
  data: MapData; onChange: (d: MapData) => void; mapIndex: number;
  isTournament: boolean; showRounds: boolean; onToggleRounds: () => void;
}) {
  const [mapTab, setMapTab] = useState<'stats'|'timeline'|'economy'>('stats');
  const set = (field: keyof MapData, value: any) => onChange({ ...data, [field]: value });

  const updateStat = (name: string, field: keyof Omit<TournamentPlayerStats,'playerId'|'playerName'>, value: number) => {
    const newStats = data.playerStats.find(s => s.playerName === name)
      ? data.playerStats.map(s => s.playerName === name ? { ...s, [field]: value } : s)
      : [...data.playerStats, { playerId: crypto.randomUUID(), playerName: name, hsPercent: 0, multiKills: 0, adr: 0, econRating: 0, [field]: value }];
    set('playerStats', newStats);
  };

  const addPlayer = (name: string) => {
    const n = name.trim();
    if (n && !data.playerStats.find(s => s.playerName === n))
      set('playerStats', [...data.playerStats, { playerId: crypto.randomUUID(), playerName: n, hsPercent: 0, multiKills: 0, adr: 0, econRating: 0 }]);
  };

  // ── Timeline: tabla de rondas marcadas ──────────────────────────────────
  const playedRounds = data.rounds.filter(r => r.won !== null);
  
  return (
    <div className="space-y-4 rounded-xl border p-4" style={{ borderColor: 'hsl(220 15% 20%)', background: 'hsl(220 18% 7%)' }}>
      {mapIndex > 0 && <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider pb-2 border-b border-white/8">Mapa {mapIndex + 1}</div>}

      {/* Tabs de sección */}
      <div className="flex gap-1 border-b border-white/8 pb-2 -mt-1">
        {([
          ['stats',    '📊 Stats',    <BarChart2 className="w-3.5 h-3.5"/>],
          ['timeline', '⏱ Timeline',  <Clock className="w-3.5 h-3.5"/>],
          ['economy',  '💰 Economía', <DollarSign className="w-3.5 h-3.5"/>],
        ] as [typeof mapTab, string, React.ReactNode][]).map(([id, label, icon]) => (
          <button key={id} onClick={() => setMapTab(id)}
            className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
              mapTab === id
                ? 'bg-red-500/15 border border-red-500/30 text-white'
                : 'text-muted-foreground hover:text-white hover:bg-white/5')}>
            {icon}{label}
          </button>
        ))}
      </div>

      {/* ── TAB STATS ── */}
      {mapTab === 'stats' && <>

      {/* Mapa */}
      <div>
        <label className="text-sm text-muted-foreground mb-1 block">Mapa</label>
        <select value={data.map} onChange={e => set('map', e.target.value)} className="input-pro">
          {VALORANT_MAPS.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>

      {/* Score + OT */}
      <div className="grid grid-cols-4 gap-3">
        {([['scoreUs','Score NGU'],['scoreOpp','Score Rival'],['otWin','OT Ganados'],['otLoss','OT Perdidos']] as [keyof MapData,string][]).map(([f,l]) => (
          <div key={f}><label className="text-sm text-muted-foreground mb-1 block">{l}</label>
          <input type="number" min="0" value={data[f] as number} onChange={e => set(f, parseInt(e.target.value)||0)} className="input-pro"/></div>
        ))}
      </div>

      {/* ATK/DEF */}
      <div className="grid grid-cols-2 gap-3">
        {([['atk','⚔ ATK Ganadas'],['def','🛡 DEF Ganadas']] as [keyof MapData,string][]).map(([f,l]) => (
          <div key={f}><label className="text-sm text-muted-foreground mb-1 block">{l}</label>
          <input type="number" min="0" value={data[f] as number} onChange={e => set(f, parseInt(e.target.value)||0)} className="input-pro"/></div>
        ))}
      </div>

      {/* Pistolas */}
      <div className="grid grid-cols-2 gap-3">
        {([['pistolAtkWin','🔫 Pistola ATK','text-yellow-400'],['pistolDefWin','🔫 Pistola DEF','text-blue-400']] as [keyof MapData,string,string][]).map(([f,l,c]) => (
          <div key={f} className="flex items-center justify-between p-3 rounded-lg border" style={{ borderColor:'hsl(220 15% 20%)', background:'hsl(220 20% 9%)' }}>
            <span className={"text-sm "+c}>{l}</span>
            <button onClick={() => set(f, !data[f])} className={"w-12 h-6 rounded-full transition-colors relative "+(data[f]?'bg-green-500':'bg-gray-600')}>
              <span className={"absolute top-1 w-4 h-4 rounded-full bg-white transition-all "+(data[f]?'left-7':'left-1')}/>
            </button>
          </div>
        ))}
      </div>

      {/* Post-plant + Retake + Plants */}
      <div className="grid grid-cols-4 gap-2">
        {([['postWin','PostP W'],['postLoss','PostP L'],['retakeWin','Retake W'],['retakeLoss','Retake L']] as [keyof MapData,string][]).map(([f,l]) => (
          <div key={f}><label className="text-xs text-muted-foreground mb-1 block">{l}</label>
          <input type="number" min="0" value={data[f] as number} onChange={e => set(f, parseInt(e.target.value)||0)} className="input-pro"/></div>
        ))}
      </div>
      <div>
        <label className="text-xs text-muted-foreground mb-1 block">🌱 Plantas recibidas (DEF)</label>
        <input type="number" min="0" value={data.plantsAgainst} onChange={e => set('plantsAgainst', parseInt(e.target.value)||0)} className="input-pro w-36"/>
      </div>

      {/* Visualizador de rondas */}
      <div>
        <button onClick={onToggleRounds} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-white transition-colors mb-2">
          {showRounds ? <ChevronUp className="w-3.5 h-3.5"/> : <ChevronDown className="w-3.5 h-3.5"/>}
          {showRounds ? 'Ocultar' : 'Mostrar'} visualizador de rondas
        </button>
        {showRounds && (
          <RoundVisualizer
            rounds={data.rounds} onChange={r => set('rounds', r)}
            scoreUs={data.scoreUs} scoreOpp={data.scoreOpp}
          />
        )}
      </div>

      </> /* fin tab stats */}

      {/* ── TAB TIMELINE ── */}
      {mapTab === 'timeline' && (
        <div className="space-y-3">
          {playedRounds.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground space-y-2">
              <Clock className="w-10 h-10 mx-auto opacity-30"/>
              <p className="text-sm">Sin rondas marcadas</p>
              <p className="text-xs">Marca rondas en el tab Stats → visualizador de rondas</p>
            </div>
          ) : (
            <>
              {/* KPIs rápidos */}
              <div className="grid grid-cols-4 gap-2">
                {[
                  { l:'Jugadas',   v: playedRounds.length,                              c:'#94a3b8' },
                  { l:'Victorias', v: playedRounds.filter(r=>r.won).length,             c:'#22c55e' },
                  { l:'Derrotas',  v: playedRounds.filter(r=>!r.won).length,            c:'#ef4444' },
                  { l:'WR %',      v: Math.round(playedRounds.filter(r=>r.won).length/playedRounds.length*100)+'%', c:'#f59e0b' },
                ].map(({l,v,c}) => (
                  <div key={l} className="rounded-xl p-3 text-center" style={{ background:'hsl(220 20% 9%)' }}>
                    <p className="text-lg font-black" style={{color:c}}>{v}</p>
                    <p className="text-[10px] text-muted-foreground">{l}</p>
                  </div>
                ))}
              </div>

              {/* Timeline visual de rondas */}
              <div className="space-y-2">
                {[
                  { label:'⚔ ATK (R1–R12)',  rounds: playedRounds.filter(r=>r.side==='ATK'), color:'#f59e0b' },
                  { label:'🛡 DEF (R13–R24)', rounds: playedRounds.filter(r=>r.side==='DEF'), color:'#3b82f6' },
                ].map(({ label, rounds: half, color }) => half.length > 0 && (
                  <div key={label} className="space-y-1.5">
                    <div className="flex items-center justify-between text-[10px]">
                      <span style={{color}} className="font-bold uppercase tracking-wider">{label}</span>
                      <span className="text-muted-foreground">
                        {half.filter(r=>r.won).length}/{half.length} ganadas
                        ({Math.round(half.filter(r=>r.won).length/half.length*100)}%)
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {half.sort((a,b)=>a.number-b.number).map(r => {
                        const typeColors: Record<string,string> = {
                          pistol:'#f59e0b', eco:'#6b7280', force:'#8b5cf6',
                          clutch:'#ec4899', thrifty:'#06b6d4', normal: r.won?'#22c55e':'#ef4444'
                        };
                        const tc = typeColors[r.type] || (r.won?'#22c55e':'#ef4444');
                        return (
                          <div key={r.number}
                            className="rounded flex flex-col items-center gap-0.5"
                            title={`R${r.number} ${r.side} ${r.won?'W':'L'} ${r.type}`}>
                            <span className="text-[8px] text-muted-foreground/50">{r.number}</span>
                            <div className="w-6 h-6 rounded flex items-center justify-center text-[9px] font-bold"
                              style={{ background: tc+'22', border:'1.5px solid '+tc, color:tc }}>
                              {r.won?'W':'L'}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              {/* Racha máxima */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                {[
                  { label:'Mejor racha W', key:'WIN',  c:'#22c55e' },
                  { label:'Peor racha L',  key:'LOSS', c:'#ef4444' },
                ].map(({ label, key, c }) => {
                  let max=0, cur=0;
                  playedRounds.sort((a,b)=>a.number-b.number).forEach(r => {
                    if ((key==='WIN'&&r.won)||(key==='LOSS'&&!r.won)) { cur++; max=Math.max(max,cur); } else cur=0;
                  });
                  return (
                    <div key={label} className="rounded-xl p-3 flex items-center gap-3" style={{background:'hsl(220 20% 9%)'}}>
                      <span className="text-2xl font-black" style={{color:c}}>{max}</span>
                      <span className="text-[10px] text-muted-foreground">{label}</span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── TAB ECONOMÍA ── */}
      {mapTab === 'economy' && (
        <EcoTabContent rounds={data.rounds} playedRounds={playedRounds}/>
      )}

      {/* Stats de jugadores */}
      {isTournament && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 pb-1 border-b border-yellow-500/30">
            <span className="text-yellow-400 text-sm font-medium">🏆 Stats por jugador</span>
          </div>

          {/* Botones NGU */}
          <div className="flex flex-wrap gap-1">
            <p className="text-[10px] text-muted-foreground w-full">Jugadores NGU:</p>
            {MY_TEAM_PLAYERS.map(p => (
              <button key={p} onClick={() => addPlayer(p)} disabled={!!data.playerStats.find(s => s.playerName===p)}
                className={"text-[10px] px-2 py-1 rounded border transition-all "+(data.playerStats.find(s=>s.playerName===p)?"border-green-500/30 bg-green-500/10 text-green-400":"border-white/15 text-muted-foreground hover:text-white")}>
                {data.playerStats.find(s=>s.playerName===p)?"✓ ":"+ "}{p}
              </button>
            ))}
          </div>

          {/* Input externo */}
          <div className="flex gap-2">
            <input type="text" id={"ts-ext-"+mapIndex} placeholder="Jugador externo..." className="input-pro text-xs flex-1"
              onKeyDown={e => { if (e.key==='Enter') { const i=e.target as HTMLInputElement; addPlayer(i.value); i.value=''; } }}/>
            <Button type="button" size="sm" variant="outline" className="text-xs"
              onClick={() => { const i=document.getElementById("ts-ext-"+mapIndex) as HTMLInputElement; if(i){ addPlayer(i.value); i.value=''; } }}>+ Añadir</Button>
          </div>

          {/* Tabla stats */}
          {data.playerStats.length > 0 && (
            <div className="space-y-1.5">
              <div className="grid grid-cols-[1fr_60px_60px_60px_60px_24px] gap-1 text-[10px] text-muted-foreground px-2">
                <span>Jugador</span><span className="text-center">HS%</span><span className="text-center">MK</span><span className="text-center">ADR</span><span className="text-center">ECON</span><span/>
              </div>
              {data.playerStats.map(ts => (
                <div key={ts.playerId} className="grid grid-cols-[1fr_60px_60px_60px_60px_24px] gap-1 items-center bg-[#0f0f1e] rounded-lg px-2 py-1.5">
                  <p className="text-xs font-medium text-white truncate">{ts.playerName}</p>
                  {(['hsPercent','multiKills','adr','econRating'] as const).map(f => (
                    <input key={f} type="number" min="0" value={ts[f]} className="input-pro text-xs text-center p-1 h-7"
                      onChange={e => updateStat(ts.playerName, f, parseFloat(e.target.value)||0)}/>
                  ))}
                  <button onClick={() => set('playerStats', data.playerStats.filter(s=>s.playerName!==ts.playerName))} className="text-red-400 hover:text-red-300 text-xs">✕</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Componente principal ───────────────────────────────────────────────────────
export function Matches() {
  const {
    getFilteredMatches, addMatch, updateMatch, deleteMatch,
    setActiveMatchId, setActiveTab, filters, setFilters, setPlayersForMatch,
  } = useAppStore();

  const [isDialogOpen,        setIsDialogOpen]        = useState(false);
  const [isImportDialogOpen,  setIsImportDialogOpen]  = useState(false);
  const [editingMatch,        setEditingMatch]        = useState<Match | null>(null);
  const [formData,            setFormData]            = useState<MatchFormData>(defaultForm());
  const [pendingPlayers,      setPendingPlayers]      = useState<Player[]>([]);
  const [showRoundsMap,       setShowRoundsMap]       = useState<Record<number,boolean>>({});

  const matches     = getFilteredMatches();
  const isTournament = ['PREMIER','OFICIAL','TOURNAMENT'].includes(formData.type);

  const updateMap = (idx: number, d: MapData) =>
    setFormData(f => ({ ...f, maps: f.maps.map((m,i) => i===idx ? d : m) }));

  const toggleBo3 = (enable: boolean) => {
    if (enable) setFormData(f => ({ ...f, isBo3:true, maps:[...f.maps, defaultMapData(), defaultMapData()].slice(0,3) }));
    else        setFormData(f => ({ ...f, isBo3:false, maps:[f.maps[0]] }));
  };

  // ── FIX PRINCIPAL: siempre restaurar desde bo3Maps (que guardamos siempre) ──
  const handleOpenDialog = (match?: Match) => {
    if (match) {
      setEditingMatch(match);
      const anyMatch = match as any;
      // bo3Maps siempre se guarda desde la versión corregida.
      // Si existe, lo usamos directamente (contiene playerStats, rounds, etc.)
      const savedMaps: MapData[] | undefined = anyMatch.bo3Maps;
      const maps: MapData[] = savedMaps?.length
        ? savedMaps
        : [{
            map:           match.map,
            scoreUs:       match.scoreUs,
            scoreOpp:      match.scoreOpp,
            atk:           match.atk,
            def:           match.def,
            otWin:         match.otWin,
            otLoss:        match.otLoss,
            pistolAtkWin:  match.pistolAtkWin,
            pistolDefWin:  match.pistolDefWin,
            postWin:       match.postWin,
            postLoss:      match.postLoss,
            retakeWin:     match.retakeWin,
            retakeLoss:    match.retakeLoss,
            plantsAgainst: match.plantsAgainst ?? 0,
            rounds:        anyMatch.roundResults?.length ? anyMatch.roundResults : emptyRounds(),
            playerStats:   match.tournamentPlayerStats ?? [],
          }];

      setFormData({
        id:    match.id,
        type:  match.type,
        date:  match.date,
        notes: match.notes || '',
        isBo3: !!(savedMaps && savedMaps.length > 1),
        maps,
      });
    } else {
      setEditingMatch(null);
      setFormData(defaultForm());
    }
    setShowRoundsMap({});
    setIsDialogOpen(true);
  };

  // ── FIX: guardar SIEMPRE bo3Maps aunque sea 1 mapa ────────────────────────
  const handleSave = () => {
    const main = formData.maps[0];
    const won  = formData.isBo3
      ? formData.maps.filter(m => m.scoreUs > m.scoreOpp).length
        > formData.maps.filter(m => m.scoreUs + m.scoreOpp > 0).length / 2
      : main.scoreUs > main.scoreOpp;

    // Calcular economía del mapa 1 desde las rondas marcadas
    const eco = calcEcoFromRounds(main.rounds);

    const match: any = {
      id:           formData.id,
      type:         formData.type,
      map:          main.map,
      date:         formData.date,
      atk:          main.atk,
      def:          main.def,
      scoreUs:      main.scoreUs,
      scoreOpp:     main.scoreOpp,
      otWin:        main.otWin,
      otLoss:       main.otLoss,
      won,
      pistolAtkWin: main.pistolAtkWin,
      pistolDefWin: main.pistolDefWin,
      postWin:      main.postWin,
      postLoss:     main.postLoss,
      retakeWin:    main.retakeWin,
      retakeLoss:   main.retakeLoss,
      plantsAgainst:main.plantsAgainst,
      notes:        formData.notes,
      // Stats de torneo del mapa 1 (compatibilidad con el store)
      tournamentPlayerStats: isTournament && main.playerStats.length > 0 ? main.playerStats : undefined,
      // Rondas marcadas del mapa 1 (formato simple para visualizador)
      roundResults: main.rounds.filter((r: RoundResult) => r.won !== null),
      // Economía calculada
      ecoFromRounds: eco,
      // Rondas convertidas al formato Round[] del store (para MatchTimeline/EcoPatterns)
      rounds: main.rounds
        .filter((r: RoundResult) => r.won !== null)
        .map((r: RoundResult) => roundResultToRound(r, formData.id)),
      // SIEMPRE guardamos bo3Maps — así al reabrir siempre tenemos todos los datos
      bo3Maps: formData.maps,
      createdAt: editingMatch?.createdAt || Date.now(),
      updatedAt: Date.now(),
    };

    if (editingMatch) {
      updateMatch(match.id, match);
    } else {
      addMatch(match);
      if (pendingPlayers.length > 0) {
        setPlayersForMatch(match.id, pendingPlayers);
        setPendingPlayers([]);
      }
    }

    setIsDialogOpen(false);
    setFormData(defaultForm());
    setEditingMatch(null);
  };

  const handleDelete = (id: string) => {
    if (confirm('¿Eliminar este partido?')) deleteMatch(id);
  };

  const handleImportFromScreenshot = (data: any) => {
    setFormData(f => ({
      ...f,
      maps: f.maps.map((m, i) => i === 0 ? {
        ...m,
        scoreUs:  data.scoreUs  ?? m.scoreUs,
        scoreOpp: data.scoreOpp ?? m.scoreOpp,
        map:      data.map      ?? m.map,
      } : m),
      type: data.type ?? f.type,
      date: data.date ?? f.date,
    }));
    setIsImportDialogOpen(false);
    setIsDialogOpen(true);
  };

  const kpis = useMemo(() => {
    const total  = matches.length;
    const wins   = matches.filter(m => m.won).length;
    const cnt: Record<string,number> = {};
    matches.forEach(m => { cnt[m.map] = (cnt[m.map]||0)+1; });
    const topMap = Object.entries(cnt).sort((a,b) => b[1]-a[1])[0]?.[0] || '—';
    return { total, wins, winRate: total>0 ? Math.round(wins/total*100) : 0, topMap };
  }, [matches]);

  return (
    <div className="space-y-6 p-6">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-black">Partidos</h2>
          <p className="text-sm text-muted-foreground">{MY_TEAM_NAME}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => { setFormData(defaultForm()); setIsImportDialogOpen(true); }} className="text-xs gap-1">
            <Camera className="w-4 h-4"/> Importar
          </Button>
          <Button onClick={() => handleOpenDialog()} className="btn-primary gap-1">
            <Plus className="w-4 h-4"/> Nuevo Partido
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-4">
        <div className="glass-card p-4"><p className="text-xs text-muted-foreground mb-1">Total</p><p className="text-2xl font-bold">{kpis.total}</p></div>
        <div className="glass-card p-4"><p className="text-xs text-muted-foreground mb-1">Victorias</p><p className="text-2xl font-bold text-green-400">{kpis.wins}</p></div>
        <div className="glass-card p-4"><p className="text-xs text-muted-foreground mb-1">Win Rate</p><p className="text-2xl font-bold">{kpis.winRate}%</p></div>
        <div className="glass-card p-4"><p className="text-xs text-muted-foreground mb-1">Top Mapa</p><p className="text-2xl font-bold">{kpis.topMap}</p></div>
      </div>

      {/* Filtros */}
      <div className="glass-card p-4 flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-2 flex-1 min-w-[180px]">
          <Search className="w-4 h-4 text-muted-foreground"/>
          <input type="text" placeholder="Buscar..." value={filters.search||''}
            onChange={e => setFilters({...filters, search: e.target.value})} className="input-pro flex-1 text-sm"/>
        </div>
        <select value={filters.type||''} onChange={e => setFilters({...filters, type: e.target.value as MatchType|''})} className="input-pro text-sm">
          <option value="">Todos los tipos</option>
          <option value="SCRIM">SCRIM</option><option value="PREMIER">PREMIER</option>
          <option value="OFICIAL">OFICIAL</option><option value="TOURNAMENT">TOURNAMENT</option>
          <option value="CUSTOM">CUSTOM</option>
        </select>
      </div>

      {/* Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingMatch ? '✏️ Editar' : '➕ Nuevo'} partido — {MY_TEAM_NAME}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            {/* Tipo + Fecha */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Tipo</label>
                <select value={formData.type} className="input-pro"
                  onChange={e => {
                    const t = e.target.value as MatchType;
                    setFormData(f => ({ ...f, type:t, isBo3: ['PREMIER','OFICIAL','TOURNAMENT'].includes(t) ? f.isBo3 : false }));
                  }}>
                  <option value="SCRIM">SCRIM</option>
                  <option value="PREMIER">PREMIER</option>
                  <option value="OFICIAL">OFICIAL</option>
                  <option value="TOURNAMENT">Torneo</option>
                  <option value="CUSTOM">Custom</option>
                </select>
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Fecha</label>
                <input type="date" value={formData.date}
                  onChange={e => setFormData(f => ({...f, date:e.target.value}))} className="input-pro"/>
              </div>
            </div>

            {/* Bo3 toggle */}
            {isTournament && (
              <div className="flex items-center justify-between p-3 rounded-xl border"
                style={{ borderColor:'hsl(220 15% 20%)', background:'hsl(220 20% 9%)' }}>
                <div>
                  <p className="text-sm font-medium">Serie Bo3</p>
                  <p className="text-[10px] text-muted-foreground">Registrar hasta 3 mapas de la serie</p>
                </div>
                <button onClick={() => toggleBo3(!formData.isBo3)}
                  className={"w-12 h-6 rounded-full transition-colors relative "+(formData.isBo3?'bg-blue-500':'bg-gray-600')}>
                  <span className={"absolute top-1 w-4 h-4 rounded-full bg-white transition-all "+(formData.isBo3?'left-7':'left-1')}/>
                </button>
              </div>
            )}

            {/* Formulario por mapa */}
            {formData.maps.map((mapData, idx) => (
              <MapForm
                key={idx}
                data={mapData}
                onChange={d => updateMap(idx, d)}
                mapIndex={idx}
                isTournament={isTournament}
                showRounds={!!showRoundsMap[idx]}
                onToggleRounds={() => setShowRoundsMap(m => ({...m, [idx]: !m[idx]}))}
              />
            ))}

            {/* Notas */}
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Notas</label>
              <textarea value={formData.notes}
                onChange={e => setFormData(f => ({...f, notes:e.target.value}))}
                className="input-pro w-full h-16 resize-none text-sm"
                placeholder="Notas del partido..."/>
            </div>

            {/* Acciones */}
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleSave} className="btn-primary">
                {editingMatch ? 'Guardar cambios' : 'Crear partido'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Tabla */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-xs text-muted-foreground uppercase" style={{ background:'hsl(220 20% 9%)' }}>
                <th className="py-3 px-4">Resultado</th><th className="py-3 px-4">ID</th>
                <th className="py-3 px-4">Mapa</th><th className="py-3 px-4">Tipo</th>
                <th className="py-3 px-4">Score</th><th className="py-3 px-4">ATK/DEF</th>
                <th className="py-3 px-4">Pistolas</th><th className="py-3 px-4">Post/Retake</th>
                <th className="py-3 px-4">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {matches.length === 0
                ? <tr><td colSpan={9} className="py-8 text-center text-muted-foreground">No hay partidos registrados</td></tr>
                : matches.map(match => (
                  <tr key={match.id} className="border-t border-border/50 hover:bg-white/5">
                    <td className="py-3 px-4">
                      <span className={"px-2 py-1 rounded-full text-xs font-medium "+(match.won?"bg-green-500/10 text-green-400":"bg-red-500/10 text-red-400")}>
                        {match.won ? 'VICTORIA' : 'DERROTA'}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-xs text-muted-foreground">{match.id}</td>
                    <td className="py-3 px-4 font-medium">
                      {match.map}
                      {(match as any).bo3Maps?.length > 1 && (
                        <span className="ml-1 text-[10px] text-blue-400 border border-blue-400/30 px-1 rounded">Bo3</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-1 rounded text-xs"
                        style={{
                          background: match.type==='SCRIM'?'hsl(355 85% 58% / 0.15)':match.type==='PREMIER'?'hsl(217 90% 55% / 0.15)':'hsl(142 71% 45% / 0.15)',
                          color:      match.type==='SCRIM'?'hsl(355 85% 65%)':match.type==='PREMIER'?'hsl(217 90% 65%)':'hsl(142 71% 55%)'
                        }}>
                        {match.type}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono">
                      <span className={match.won?'text-green-400':'text-red-400'}>{match.scoreUs}</span>
                      <span className="text-muted-foreground mx-1">–</span>
                      <span className={!match.won?'text-green-400':'text-red-400'}>{match.scoreOpp}</span>
                      {(match.otWin>0||match.otLoss>0) && <span className="text-xs text-muted-foreground ml-1">OT</span>}
                    </td>
                    <td className="py-3 px-4 font-mono text-sm">
                      <span className="text-yellow-400">{match.atk}</span>/<span className="text-blue-400">{match.def}</span>
                    </td>
                    <td className="py-3 px-4 text-xs">
                      <span className={match.pistolAtkWin?'text-green-400':'text-red-400'}>ATK {match.pistolAtkWin?'✓':'✗'} </span>
                      <span className={match.pistolDefWin?'text-green-400':'text-red-400'}>DEF {match.pistolDefWin?'✓':'✗'}</span>
                    </td>
                    <td className="py-3 px-4 font-mono text-xs">
                      <span className="text-green-400">{match.postWin}</span>/<span className="text-red-400">{match.postLoss}</span>
                      <span className="text-muted-foreground mx-1">·</span>
                      <span className="text-blue-400">{match.retakeWin}</span>/<span className="text-red-400">{match.retakeLoss}</span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex gap-1">
                        <button onClick={() => { setActiveMatchId(match.id); setActiveTab('players'); }}
                          className="p-2 rounded-lg hover:bg-white/10 transition-colors" title="Jugadores"><Users className="w-4 h-4"/></button>
                        <button onClick={() => handleOpenDialog(match)}
                          className="p-2 rounded-lg hover:bg-white/10 transition-colors" title="Editar"><Edit2 className="w-4 h-4"/></button>
                        <button onClick={() => handleDelete(match.id)}
                          className="p-2 rounded-lg hover:bg-red-500/20 text-red-400 transition-colors" title="Eliminar"><Trash2 className="w-4 h-4"/></button>
                      </div>
                    </td>
                  </tr>
                ))
              }
            </tbody>
          </table>
        </div>
      </div>

      <ScreenshotImport isOpen={isImportDialogOpen} onClose={() => setIsImportDialogOpen(false)} onImport={handleImportFromScreenshot}/>
    </div>
  );
}
