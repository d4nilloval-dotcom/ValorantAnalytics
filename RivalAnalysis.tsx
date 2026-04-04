import { useState, useMemo } from 'react';
import {
  Plus, Trash2, Edit2, ChevronDown, ChevronUp, Search, X,
  Users, Map, Target, TrendingUp, TrendingDown, Shield, Swords,
  BookOpen, BarChart2, Star, AlertTriangle, Download,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine,
  LineChart, Line, Legend, Cell,
} from 'recharts';

// ── Storage ────────────────────────────────────────────────────────────────────
const STORAGE_KEY = 'valoanalytics_rivals_v2';

// ── Tipos ─────────────────────────────────────────────────────────────────────
const VALORANT_MAPS   = ['Ascent','Bind','Haven','Split','Pearl','Breeze','Abyss','Corrode','Lotus','Fracture','Icebox','Sunset'];
const VALORANT_AGENTS = ['Jett','Raze','Reyna','Phoenix','Yoru','Neon','Iso','Waylay','Brimstone','Omen','Viper','Astra','Harbor','Clove','Sova','Breach','Skye','KAY/O','Fade','Gekko','Tejo','Sage','Cypher','Killjoy','Chamber','Deadlock','Veto'];
const SITES          = ['A', 'B', 'C'];
const MY_TEAM        = 'NGU eSports';
const MY_PLAYERS     = ['DavidG','Legarzz','Lubin','Perez','Frospo','SantiChoped'];

type Side = 'ATK' | 'DEF';

interface RivalPlayer {
  id:         string;
  name:       string;
  agent:      string;
  pistolAtkWins: number;
  pistolDefWins: number;
  pistolTotal:   number;
  ecoWins:    number;
  ecoTotal:   number;
  forceWins:  number;
  forceTotal: number;
  clutchWins: number;
  clutchTotal:number;
  acs:        number;
  adr:        number;
  hs:         number;
  notes:      string;
}

interface SiteData {
  site: string;
  atkPct: number;   // % de rondas ATK que van a este site
  defPct: number;   // % de rondas DEF que defienden este site
  winPct: number;   // % de victorias en este site
  plantPct: number; // % de plantas en este site
}

interface MapStrategy {
  mapName:    string;
  setupNotes: string;   // qué setup usan típicamente
  atkDefault: string;   // estrategia ATK por defecto
  defDefault: string;   // estrategia DEF por defecto
  pivotTiming:string;   // cuándo rotan (ej: "al plantar en B rotan a A a 20s")
  keyPositions:string;  // posiciones clave que ocupan
  weaknesses: string;   // debilidades detectadas
  sites:      SiteData[];
}

interface MatchRecord {
  id:         string;
  date:       string;
  tournament: string;
  mapName:    string;
  scoreUs:    number;
  scoreOpp:   number;
  atkUs:      number;
  defUs:      number;
  pistolAtkUs:boolean;
  pistolDefUs:boolean;
  notes:      string;
}

interface RivalTeam {
  id:          string;
  name:        string;
  region:      string;
  tier:        string;     // 'T1' | 'T2' | 'T3' | 'Amateur'
  rating:      number;     // 1-5
  players:     RivalPlayer[];
  mapStrategies: MapStrategy[];
  matches:     MatchRecord[];
  preferredMaps:  string[];
  bannedMaps:     string[];
  agentPool:   string[];
  notes:       string;
  createdAt:   number;
  updatedAt:   number;
}

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2); }
function pct(n:number, d:number) { return d>0 ? Math.round(n/d*100) : 0; }
function pctColor(v:number, lo=45, hi=55) { return v>=hi?'#22c55e':v>=lo?'#facc15':'#ef4444'; }

function loadRivals(): RivalTeam[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)||'[]'); }
  catch { return []; }
}
function saveRivals(data: RivalTeam[]) { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }

function emptyRival(name=''):RivalTeam {
  return { id:uid(), name, region:'ES', tier:'Amateur', rating:3,
    players:[], mapStrategies:[], matches:[], preferredMaps:[], bannedMaps:[],
    agentPool:[], notes:'', createdAt:Date.now(), updatedAt:Date.now() };
}
function emptyPlayer():RivalPlayer {
  return { id:uid(), name:'', agent:'Jett', pistolAtkWins:0, pistolDefWins:0, pistolTotal:0,
    ecoWins:0, ecoTotal:0, forceWins:0, forceTotal:0, clutchWins:0, clutchTotal:0,
    acs:0, adr:0, hs:0, notes:'' };
}
function emptyMapStrategy(mapName='Ascent'):MapStrategy {
  return { mapName, setupNotes:'', atkDefault:'', defDefault:'', pivotTiming:'',
    keyPositions:'', weaknesses:'', sites:[] };
}
function emptyMatch():Omit<MatchRecord,'id'> {
  return { date:new Date().toISOString().split('T')[0], tournament:'', mapName:'Ascent',
    scoreUs:0, scoreOpp:0, atkUs:0, defUs:0, pistolAtkUs:false, pistolDefUs:false, notes:'' };
}

// ── Tooltip ───────────────────────────────────────────────────────────────────
function CT({ active, payload, label }:any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border p-3 text-xs shadow-2xl space-y-1"
      style={{ background:'hsl(220 22% 10%)', borderColor:'hsl(220 15% 22%)' }}>
      <p className="font-bold text-white mb-1">{label}</p>
      {payload.map((p:any) => (
        <div key={p.name} className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ background:p.color }}/>
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="font-mono font-bold" style={{ color:p.color }}>{p.value}{typeof p.value==='number'&&p.name.includes('%')?'':''}</span>
        </div>
      ))}
    </div>
  );
}

function MiniBar({ v, c }:{ v:number; c:string }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex-1 h-1.5 rounded-full bg-white/8">
        <div className="h-full rounded-full" style={{ width:v+'%', background:c }}/>
      </div>
      <span className="text-[10px] font-mono w-8 text-right" style={{ color:c }}>{v}%</span>
    </div>
  );
}

function StarRating({ value, onChange }:{ value:number; onChange?:(n:number)=>void }) {
  return (
    <div className="flex gap-0.5">
      {[1,2,3,4,5].map(n => (
        <button key={n} onClick={() => onChange?.(n)} className="transition-colors">
          <Star className={cn('w-4 h-4', n<=value?'text-yellow-400 fill-yellow-400':'text-muted-foreground/30')}/>
        </button>
      ))}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ── Vista: Ficha del rival ────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
function RivalCard({ rival, onEdit }:{ rival:RivalTeam; onEdit:()=>void }) {
  const [tab, setTab] = useState<'overview'|'players'|'maps'|'matches'|'compare'>('overview');

  const totalMatches = rival.matches.length;
  const wins         = rival.matches.filter(m => m.scoreUs > m.scoreOpp).length;
  const wrVs         = pct(wins, totalMatches);
  const avgAtkUs     = totalMatches > 0 ? (rival.matches.reduce((s,m)=>s+(m.atkUs||0),0)/totalMatches).toFixed(1) : '—';
  const avgDefUs     = totalMatches > 0 ? (rival.matches.reduce((s,m)=>s+(m.defUs||0),0)/totalMatches).toFixed(1) : '—';
  const pistolAtkW   = rival.matches.filter(m=>m.pistolAtkUs).length;
  const pistolDefW   = rival.matches.filter(m=>m.pistolDefUs).length;

  // Radar de comparativa vs NGU
  const radarData = [
    { axis:'ATK%',      ngu: totalMatches>0?pct(rival.matches.reduce((s,m)=>s+(m.atkUs||0),0), rival.matches.reduce((s,m)=>s+(m.scoreUs+m.scoreOpp)/2,0)):50,
      rival: totalMatches>0?pct(rival.matches.reduce((s,m)=>s+((m.scoreUs+m.scoreOpp)/2-(m.atkUs||0)),0), rival.matches.reduce((s,m)=>s+(m.scoreUs+m.scoreOpp)/2,0)):50 },
    { axis:'DEF%',      ngu: totalMatches>0?pct(rival.matches.reduce((s,m)=>s+(m.defUs||0),0), rival.matches.reduce((s,m)=>s+(m.scoreUs+m.scoreOpp)/2,0)):50, rival:50 },
    { axis:'Pistola',   ngu: pct(pistolAtkW+pistolDefW, totalMatches*2||1), rival: 50 },
    { axis:'WR vs ellos', ngu: wrVs, rival: 100-wrVs },
    { axis:'Score Avg', ngu: totalMatches>0?Math.min(100,Math.round(rival.matches.reduce((s,m)=>s+m.scoreUs,0)/totalMatches*7)):50, rival:50 },
  ];

  // Por mapa
  const byMap = VALORANT_MAPS.map(m => {
    const ms = rival.matches.filter(e=>e.mapName===m);
    const w  = ms.filter(e=>e.scoreUs>e.scoreOpp).length;
    return { map:m, total:ms.length, wins:w, wr:pct(w,ms.length) };
  }).filter(d=>d.total>0);

  return (
    <div className="glass-card overflow-hidden">
      {/* Header equipo */}
      <div className="p-5 border-b border-white/8">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-xl font-black">{rival.name}</h3>
              <span className="text-[10px] px-2 py-0.5 rounded-full border font-bold"
                style={{ borderColor:'hsl(220 15% 25%)', color:'hsl(220 10% 60%)' }}>
                {rival.tier}
              </span>
              {rival.region && <span className="text-[10px] text-muted-foreground">{rival.region}</span>}
            </div>
            <StarRating value={rival.rating}/>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onEdit} className="p-2 rounded-lg hover:bg-white/10 transition-colors text-muted-foreground hover:text-white">
              <Edit2 className="w-4 h-4"/>
            </button>
          </div>
        </div>

        {/* KPIs rápidos */}
        {totalMatches > 0 && (
          <div className="grid grid-cols-4 gap-3 mt-4">
            {[
              { l:'Partidos vs',  v:totalMatches,                  c:'#94a3b8' },
              { l:'WR vs ellos',  v:wrVs+'%',                      c:pctColor(wrVs) },
              { l:'Pistola ATK',  v:pct(pistolAtkW,totalMatches)+'%', c:pctColor(pct(pistolAtkW,totalMatches)) },
              { l:'Pistola DEF',  v:pct(pistolDefW,totalMatches)+'%', c:pctColor(pct(pistolDefW,totalMatches)) },
            ].map(({l,v,c}) => (
              <div key={l} className="rounded-xl p-3 text-center" style={{ background:'hsl(220 15% 10%)' }}>
                <p className="text-lg font-black" style={{ color:c }}>{v}</p>
                <p className="text-[10px] text-muted-foreground">{l}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-1 px-4 pt-3 border-b border-white/8">
        {([
          ['overview','📊 Overview'],
          ['players','👤 Jugadores'],
          ['maps','🗺 Estrategias'],
          ['matches','📋 Historial'],
          ['compare','⚡ Comparativa'],
        ] as [typeof tab,string][]).map(([id,label]) => (
          <button key={id} onClick={() => setTab(id)}
            className={cn('px-3 py-2 text-xs font-medium rounded-t-lg transition-all',
              tab===id?'bg-red-500/15 border border-red-500/30 border-b-transparent text-white':'text-muted-foreground hover:text-white')}>
            {label}
          </button>
        ))}
      </div>

      <div className="p-5 space-y-5">

        {/* ── OVERVIEW ──────────────────────────────────────────────────── */}
        {tab==='overview' && (
          <div className="space-y-5">
            {/* Agentes */}
            {rival.agentPool.length>0 && (
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Pool de agentes</p>
                <div className="flex flex-wrap gap-1.5">
                  {rival.agentPool.map(a => (
                    <span key={a} className="text-xs px-2.5 py-1 rounded-lg border border-white/10 text-white/70">{a}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Mapas preferidos / baneados */}
            <div className="grid grid-cols-2 gap-4">
              {[
                { label:'✅ Mapas preferidos', maps:rival.preferredMaps, color:'#22c55e' },
                { label:'🚫 Mapas que banean', maps:rival.bannedMaps,    color:'#ef4444' },
              ].map(({ label, maps: ms, color }) => ms.length>0 && (
                <div key={label}>
                  <p className="text-xs text-muted-foreground mb-1.5">{label}</p>
                  <div className="flex flex-wrap gap-1">
                    {ms.map(m => <span key={m} className="text-xs px-2 py-0.5 rounded border font-medium" style={{ borderColor:color+'44', color }}>{m}</span>)}
                  </div>
                </div>
              ))}
            </div>

            {/* WR por mapa */}
            {byMap.length>0 && (
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">WR vs ellos por mapa</p>
                <div className="space-y-2">
                  {byMap.map(d => (
                    <div key={d.map} className="flex items-center gap-3">
                      <span className="text-xs w-20 shrink-0">{d.map}</span>
                      <MiniBar v={d.wr} c={pctColor(d.wr)}/>
                      <span className="text-[10px] text-muted-foreground shrink-0">{d.wins}/{d.total}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Notas */}
            {rival.notes && (
              <div className="rounded-xl p-3 text-sm" style={{ background:'hsl(220 15% 10%)', borderLeft:'3px solid #3b82f6' }}>
                <p className="text-[10px] text-muted-foreground mb-1 uppercase tracking-wider">Notas generales</p>
                <p className="text-sm text-white/80 whitespace-pre-wrap">{rival.notes}</p>
              </div>
            )}

            {totalMatches===0 && <p className="text-sm text-muted-foreground text-center py-4">Añade partidos vs este rival en el tab Historial.</p>}
          </div>
        )}

        {/* ── JUGADORES ─────────────────────────────────────────────────── */}
        {tab==='players' && (
          <div className="space-y-3">
            {rival.players.length===0 && (
              <p className="text-sm text-muted-foreground text-center py-6">Sin jugadores añadidos.</p>
            )}
            {rival.players.map(p => (
              <div key={p.id} className="rounded-xl border p-4 space-y-3" style={{ borderColor:'hsl(220 15% 18%)', background:'hsl(220 18% 8%)' }}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm">{p.name}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full border border-white/10 text-muted-foreground">{p.agent}</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <div>
                    <p className="text-[10px] text-muted-foreground mb-1">🔫 Pistola ATK</p>
                    <MiniBar v={pct(p.pistolAtkWins,p.pistolTotal||1)} c={pctColor(pct(p.pistolAtkWins,p.pistolTotal||1))}/>
                    <p className="text-[9px] text-muted-foreground mt-0.5">{p.pistolAtkWins}/{p.pistolTotal} ganadas</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground mb-1">🛡 Pistola DEF</p>
                    <MiniBar v={pct(p.pistolDefWins,p.pistolTotal||1)} c={pctColor(pct(p.pistolDefWins,p.pistolTotal||1))}/>
                    <p className="text-[9px] text-muted-foreground mt-0.5">{p.pistolDefWins}/{p.pistolTotal} ganadas</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground mb-1">💸 Eco</p>
                    <MiniBar v={pct(p.ecoWins,p.ecoTotal||1)} c={pctColor(pct(p.ecoWins,p.ecoTotal||1))}/>
                    <p className="text-[9px] text-muted-foreground mt-0.5">{p.ecoWins}/{p.ecoTotal}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground mb-1">⚡ Force</p>
                    <MiniBar v={pct(p.forceWins,p.forceTotal||1)} c={pctColor(pct(p.forceWins,p.forceTotal||1))}/>
                    <p className="text-[9px] text-muted-foreground mt-0.5">{p.forceWins}/{p.forceTotal}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground mb-1">⭐ Clutch</p>
                    <MiniBar v={pct(p.clutchWins,p.clutchTotal||1)} c={pctColor(pct(p.clutchWins,p.clutchTotal||1))}/>
                    <p className="text-[9px] text-muted-foreground mt-0.5">{p.clutchWins}/{p.clutchTotal}</p>
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-[10px] text-muted-foreground">ACS <span className="text-white font-bold">{p.acs||'—'}</span></p>
                    <p className="text-[10px] text-muted-foreground">ADR <span className="text-white font-bold">{p.adr||'—'}</span></p>
                    <p className="text-[10px] text-muted-foreground">HS% <span className="text-white font-bold">{p.hs||'—'}</span></p>
                  </div>
                </div>
                {p.notes && <p className="text-[10px] text-blue-300/70 italic">{p.notes}</p>}
              </div>
            ))}
          </div>
        )}

        {/* ── ESTRATEGIAS POR MAPA ──────────────────────────────────────── */}
        {tab==='maps' && (
          <div className="space-y-4">
            {rival.mapStrategies.length===0 && (
              <p className="text-sm text-muted-foreground text-center py-6">Sin estrategias registradas.</p>
            )}
            {rival.mapStrategies.map(ms => (
              <div key={ms.mapName} className="rounded-xl border overflow-hidden" style={{ borderColor:'hsl(220 15% 18%)' }}>
                <div className="px-4 py-3 flex items-center gap-2" style={{ background:'hsl(220 18% 9%)' }}>
                  <Map className="w-4 h-4 text-red-400"/>
                  <h4 className="font-bold text-sm">{ms.mapName}</h4>
                </div>
                <div className="p-4 space-y-3">
                  {[
                    { label:'⚔ ATK Default', value:ms.atkDefault, color:'#f59e0b' },
                    { label:'🛡 DEF Default', value:ms.defDefault, color:'#3b82f6' },
                    { label:'⏱ Timing de rotación', value:ms.pivotTiming, color:'#a855f7' },
                    { label:'📍 Posiciones clave', value:ms.keyPositions, color:'#22c55e' },
                    { label:'⚠️ Debilidades detectadas', value:ms.weaknesses, color:'#ef4444' },
                    { label:'📝 Setup general', value:ms.setupNotes, color:'#94a3b8' },
                  ].filter(({value}) => !!value).map(({ label, value, color }) => (
                    <div key={label} className="space-y-0.5">
                      <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color }}>{label}</p>
                      <p className="text-xs text-white/80 bg-white/3 rounded-lg p-2 whitespace-pre-wrap">{value}</p>
                    </div>
                  ))}
                  {/* Sites */}
                  {ms.sites.length>0 && (
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Sites preferidos</p>
                      <div className="grid grid-cols-3 gap-2">
                        {ms.sites.map(s => (
                          <div key={s.site} className="rounded-lg p-2 text-center" style={{ background:'hsl(220 20% 10%)' }}>
                            <p className="font-black text-lg text-white">{s.site}</p>
                            <div className="space-y-0.5 mt-1">
                              <p className="text-[9px] text-yellow-400">ATK {s.atkPct}%</p>
                              <p className="text-[9px] text-blue-400">DEF {s.defPct}%</p>
                              <p className="text-[9px] text-orange-400">Plant {s.plantPct}%</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── HISTORIAL ─────────────────────────────────────────────────── */}
        {tab==='matches' && (
          <div className="space-y-3">
            {rival.matches.length===0 && (
              <p className="text-sm text-muted-foreground text-center py-6">Sin partidos registrados vs este rival.</p>
            )}
            <div className="overflow-x-auto rounded-xl border" style={{ borderColor:'hsl(220 15% 15%)' }}>
              <table className="w-full text-xs">
                <thead>
                  <tr className="uppercase tracking-wider text-muted-foreground border-b text-left"
                    style={{ borderColor:'hsl(220 15% 15%)', background:'hsl(220 20% 9%)' }}>
                    <th className="px-3 py-2">Fecha</th><th className="px-3 py-2">Torneo</th>
                    <th className="px-3 py-2">Mapa</th><th className="px-3 py-2">Score</th>
                    <th className="px-3 py-2">ATK/DEF</th><th className="px-3 py-2">Pistolas</th>
                    <th className="px-3 py-2">Notas</th>
                  </tr>
                </thead>
                <tbody>
                  {rival.matches.map(m => {
                    const won = m.scoreUs > m.scoreOpp;
                    return (
                      <tr key={m.id} className="border-b hover:bg-white/3" style={{ borderColor:'hsl(220 15% 12%)' }}>
                        <td className="px-3 py-2 text-muted-foreground">{m.date}</td>
                        <td className="px-3 py-2"><span className="px-1.5 py-0.5 rounded text-[10px]" style={{ background:'hsl(217 90% 55%/0.15)', color:'hsl(217 90% 65%)' }}>{m.tournament||'—'}</span></td>
                        <td className="px-3 py-2 font-medium">{m.mapName}</td>
                        <td className="px-3 py-2 font-mono">
                          <span className={won?'text-green-400':'text-red-400'}>{m.scoreUs}</span>
                          <span className="text-muted-foreground mx-0.5">–</span>
                          <span className={!won?'text-green-400':'text-red-400'}>{m.scoreOpp}</span>
                        </td>
                        <td className="px-3 py-2 font-mono">
                          <span className="text-yellow-400">{m.atkUs}</span>/<span className="text-blue-400">{m.defUs}</span>
                        </td>
                        <td className="px-3 py-2 text-xs">
                          <span className={m.pistolAtkUs?'text-green-400':'text-red-400'}>A{m.pistolAtkUs?'✓':'✗'} </span>
                          <span className={m.pistolDefUs?'text-green-400':'text-red-400'}>D{m.pistolDefUs?'✓':'✗'}</span>
                        </td>
                        <td className="px-3 py-2 text-muted-foreground/60 max-w-[120px] truncate">{m.notes}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── COMPARATIVA ───────────────────────────────────────────────── */}
        {tab==='compare' && (
          <div className="space-y-5">
            {totalMatches===0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Añade partidos en el tab Historial para ver la comparativa.</p>
            ) : (
              <>
                {/* Radar */}
                <div className="glass-card p-4">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-4 text-center">NGU vs {rival.name} — Radar comparativo</p>
                  <ResponsiveContainer width="100%" height={260}>
                    <RadarChart data={radarData}>
                      <PolarGrid stroke="rgba(255,255,255,0.1)"/>
                      <PolarAngleAxis dataKey="axis" tick={{ fontSize:10, fill:'rgba(255,255,255,0.5)' }}/>
                      <Radar name="NGU" dataKey="ngu" stroke="#22c55e" fill="#22c55e" fillOpacity={0.25}/>
                      <Radar name={rival.name} dataKey="rival" stroke="#ef4444" fill="#ef4444" fillOpacity={0.2}/>
                      <Legend wrapperStyle={{ fontSize:10 }}/>
                    </RadarChart>
                  </ResponsiveContainer>
                </div>

                {/* ATK/DEF por mapa */}
                {byMap.length > 0 && (
                  <div className="glass-card p-4">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-4">WR vs {rival.name} por mapa</p>
                    <ResponsiveContainer width="100%" height={180}>
                      <BarChart data={byMap} barSize={18}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)"/>
                        <XAxis dataKey="map" tick={{ fontSize:9, fill:'rgba(255,255,255,0.4)' }}/>
                        <YAxis domain={[0,100]} tick={{ fontSize:9, fill:'rgba(255,255,255,0.4)' }} tickFormatter={v=>v+'%'}/>
                        <Tooltip content={<CT/>}/>
                        <ReferenceLine y={50} stroke="rgba(255,255,255,0.15)" strokeDasharray="4 4"/>
                        <Bar dataKey="wr" name="WR%" radius={[3,3,0,0]}>
                          {byMap.map((d,i) => <Cell key={i} fill={pctColor(d.wr)}/>)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* Tabla métricas clave */}
                <div className="glass-card p-4">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">Métricas históricas vs {rival.name}</p>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label:'WR vs ellos',  ngu:wrVs, rival:100-wrVs },
                      { label:'Pistola ATK',  ngu:pct(pistolAtkW,totalMatches), rival:pct(totalMatches-pistolAtkW,totalMatches) },
                      { label:'Pistola DEF',  ngu:pct(pistolDefW,totalMatches), rival:pct(totalMatches-pistolDefW,totalMatches) },
                      { label:'Score Medio NGU', ngu:totalMatches>0?Math.round(rival.matches.reduce((s,m)=>s+m.scoreUs,0)/totalMatches):0, rival:totalMatches>0?Math.round(rival.matches.reduce((s,m)=>s+m.scoreOpp,0)/totalMatches):0 },
                    ].map(({ label, ngu, rival: rv }) => (
                      <div key={label} className="rounded-xl p-3" style={{ background:'hsl(220 15% 10%)' }}>
                        <p className="text-[10px] text-muted-foreground mb-2">{label}</p>
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-green-400 w-8 shrink-0">NGU</span>
                            <MiniBar v={ngu} c="#22c55e"/>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-red-400 w-8 shrink-0 truncate">{rival.name.slice(0,5)}</span>
                            <MiniBar v={rv} c="#ef4444"/>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ── Editor de rival ───────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
function RivalEditor({ rival, onSave, onCancel }:{ rival:RivalTeam; onSave:(r:RivalTeam)=>void; onCancel:()=>void }) {
  const [data,    setData]    = useState<RivalTeam>({ ...rival });
  const [section, setSection] = useState<'general'|'players'|'maps'|'matches'>('general');
  const [newMatch,setNewMatch]= useState(emptyMatch());

  const upd = (field: keyof RivalTeam, val: any) => setData(d => ({ ...d, [field]:val }));

  // Players
  const addPlayer = () => setData(d => ({ ...d, players:[...d.players, emptyPlayer()] }));
  const updPlayer = (id:string, field:keyof RivalPlayer, val:any) =>
    setData(d => ({ ...d, players:d.players.map(p => p.id===id?{...p,[field]:val}:p) }));
  const delPlayer = (id:string) => setData(d => ({ ...d, players:d.players.filter(p=>p.id!==id) }));

  // Map strategies
  const addMapStrat = (mapName:string) => {
    if (data.mapStrategies.find(m=>m.mapName===mapName)) return;
    setData(d => ({ ...d, mapStrategies:[...d.mapStrategies, emptyMapStrategy(mapName)] }));
  };
  const updMapStrat = (mapName:string, field:keyof MapStrategy, val:any) =>
    setData(d => ({ ...d, mapStrategies:d.mapStrategies.map(m => m.mapName===mapName?{...m,[field]:val}:m) }));
  const delMapStrat = (mapName:string) =>
    setData(d => ({ ...d, mapStrategies:d.mapStrategies.filter(m=>m.mapName!==mapName) }));

  // Matches
  const addMatchRecord = () => {
    if (!newMatch.mapName) return;
    setData(d => ({ ...d, matches:[{ ...newMatch, id:uid() }, ...d.matches] }));
    setNewMatch(emptyMatch());
  };
  const delMatch = (id:string) => setData(d => ({ ...d, matches:d.matches.filter(m=>m.id!==id) }));

  const toggleItem = (field:'preferredMaps'|'bannedMaps'|'agentPool', val:string) => {
    const arr = data[field] as string[];
    setData(d => ({ ...d, [field]: arr.includes(val) ? arr.filter(x=>x!==val) : [...arr, val] }));
  };

  return (
    <div className="glass-card overflow-hidden">
      <div className="p-4 border-b border-white/8 flex items-center justify-between">
        <h3 className="font-bold text-lg">{rival.id ? 'Editar' : 'Nuevo'} rival: {data.name||'Sin nombre'}</h3>
        <div className="flex gap-2">
          <button onClick={onCancel} className="px-3 py-1.5 rounded-lg border border-white/10 text-xs text-muted-foreground hover:text-white transition-colors">Cancelar</button>
          <button onClick={() => onSave({ ...data, updatedAt:Date.now() })} className="px-3 py-1.5 rounded-lg bg-red-500 hover:bg-red-600 text-white text-xs font-medium transition-colors">Guardar</button>
        </div>
      </div>

      {/* Secciones editor */}
      <div className="flex gap-1 px-4 pt-3 border-b border-white/8">
        {([['general','General'],['players','Jugadores'],['maps','Mapas/Estrategias'],['matches','Partidos']] as [typeof section,string][]).map(([id,label]) => (
          <button key={id} onClick={() => setSection(id)}
            className={cn('px-3 py-2 text-xs rounded-t-lg transition-all',
              section===id?'bg-white/10 border border-white/15 border-b-transparent text-white':'text-muted-foreground hover:text-white')}>
            {label}
          </button>
        ))}
      </div>

      <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">

        {/* ── GENERAL ─────────────────────────────────────────────────── */}
        {section==='general' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs text-muted-foreground mb-1 block">Nombre</label>
                <input value={data.name} onChange={e=>upd('name',e.target.value)} className="input-pro" placeholder="Nombre del equipo"/></div>
              <div><label className="text-xs text-muted-foreground mb-1 block">Región</label>
                <input value={data.region} onChange={e=>upd('region',e.target.value)} className="input-pro" placeholder="ES, EU, NA…"/></div>
              <div><label className="text-xs text-muted-foreground mb-1 block">Tier</label>
                <select value={data.tier} onChange={e=>upd('tier',e.target.value)} className="input-pro">
                  {['T1','T2','T3','Amateur','Semi-pro'].map(t=><option key={t} value={t}>{t}</option>)}
                </select></div>
              <div><label className="text-xs text-muted-foreground mb-1 block">Rating</label>
                <StarRating value={data.rating} onChange={n=>upd('rating',n)}/></div>
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-2 block">✅ Mapas preferidos</label>
              <div className="flex flex-wrap gap-1">
                {VALORANT_MAPS.map(m => (
                  <button key={m} onClick={() => toggleItem('preferredMaps',m)}
                    className={cn('text-xs px-2 py-1 rounded border transition-all',
                      data.preferredMaps.includes(m)?'bg-green-500/20 border-green-500/40 text-green-300':'border-white/10 text-muted-foreground hover:text-white')}>
                    {m}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-2 block">🚫 Mapas baneados</label>
              <div className="flex flex-wrap gap-1">
                {VALORANT_MAPS.map(m => (
                  <button key={m} onClick={() => toggleItem('bannedMaps',m)}
                    className={cn('text-xs px-2 py-1 rounded border transition-all',
                      data.bannedMaps.includes(m)?'bg-red-500/20 border-red-500/40 text-red-300':'border-white/10 text-muted-foreground hover:text-white')}>
                    {m}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-2 block">Pool de agentes</label>
              <div className="flex flex-wrap gap-1">
                {VALORANT_AGENTS.map(a => (
                  <button key={a} onClick={() => toggleItem('agentPool',a)}
                    className={cn('text-xs px-2 py-1 rounded border transition-all',
                      data.agentPool.includes(a)?'bg-blue-500/20 border-blue-500/40 text-blue-300':'border-white/10 text-muted-foreground hover:text-white')}>
                    {a}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Notas generales</label>
              <textarea value={data.notes} onChange={e=>upd('notes',e.target.value)}
                className="input-pro w-full h-24 resize-none text-sm" placeholder="Observaciones generales del equipo…"/>
            </div>
          </div>
        )}

        {/* ── JUGADORES ─────────────────────────────────────────────────── */}
        {section==='players' && (
          <div className="space-y-3">
            <button onClick={addPlayer} className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-xl border border-white/15 text-muted-foreground hover:text-white hover:border-white/30 transition-all">
              <Plus className="w-3.5 h-3.5"/> Añadir jugador
            </button>
            {data.players.map(p => (
              <div key={p.id} className="rounded-xl border p-4 space-y-3" style={{ borderColor:'hsl(220 15% 18%)', background:'hsl(220 18% 8%)' }}>
                <div className="grid grid-cols-2 gap-2">
                  <div><label className="text-xs text-muted-foreground mb-1 block">IGN</label>
                    <input value={p.name} onChange={e=>updPlayer(p.id,'name',e.target.value)} className="input-pro text-xs" placeholder="Nombre"/></div>
                  <div><label className="text-xs text-muted-foreground mb-1 block">Agente principal</label>
                    <select value={p.agent} onChange={e=>updPlayer(p.id,'agent',e.target.value)} className="input-pro text-xs">
                      {VALORANT_AGENTS.map(a=><option key={a} value={a}>{a}</option>)}
                    </select></div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div><label className="text-[10px] text-muted-foreground mb-1 block">ACS</label><input type="number" min="0" value={p.acs} onChange={e=>updPlayer(p.id,'acs',+e.target.value)} className="input-pro text-xs"/></div>
                  <div><label className="text-[10px] text-muted-foreground mb-1 block">ADR</label><input type="number" min="0" value={p.adr} onChange={e=>updPlayer(p.id,'adr',+e.target.value)} className="input-pro text-xs"/></div>
                  <div><label className="text-[10px] text-muted-foreground mb-1 block">HS%</label><input type="number" min="0" max="100" value={p.hs} onChange={e=>updPlayer(p.id,'hs',+e.target.value)} className="input-pro text-xs"/></div>
                </div>
                <p className="text-[10px] text-muted-foreground font-bold uppercase">Pistola (total partidos vs nosotros)</p>
                <div className="grid grid-cols-3 gap-2">
                  {[['pistolTotal','Total'],['pistolAtkWins','ATK W'],['pistolDefWins','DEF W']].map(([f,l]) => (
                    <div key={f}><label className="text-[10px] text-muted-foreground mb-1 block">{l}</label>
                    <input type="number" min="0" value={(p as any)[f]} onChange={e=>updPlayer(p.id,f as keyof RivalPlayer,+e.target.value)} className="input-pro text-xs"/></div>
                  ))}
                </div>
                <p className="text-[10px] text-muted-foreground font-bold uppercase">Economía (rondas ganadas / totales)</p>
                <div className="grid grid-cols-3 gap-2">
                  {[['ecoWins','Eco W'],['ecoTotal','Eco T'],['forceWins','Force W'],['forceTotal','Force T'],['clutchWins','Clutch W'],['clutchTotal','Clutch T']].map(([f,l]) => (
                    <div key={f}><label className="text-[10px] text-muted-foreground mb-1 block">{l}</label>
                    <input type="number" min="0" value={(p as any)[f]} onChange={e=>updPlayer(p.id,f as keyof RivalPlayer,+e.target.value)} className="input-pro text-xs"/></div>
                  ))}
                </div>
                <div><label className="text-[10px] text-muted-foreground mb-1 block">Notas del jugador</label>
                  <input value={p.notes} onChange={e=>updPlayer(p.id,'notes',e.target.value)} className="input-pro text-xs w-full" placeholder="Tendencias, hábitos, puntos débiles…"/></div>
                <button onClick={() => delPlayer(p.id)} className="text-red-400/60 hover:text-red-400 text-xs flex items-center gap-1 transition-colors">
                  <Trash2 className="w-3 h-3"/> Eliminar jugador
                </button>
              </div>
            ))}
          </div>
        )}

        {/* ── MAPAS / ESTRATEGIAS ──────────────────────────────────────── */}
        {section==='maps' && (
          <div className="space-y-4">
            <div>
              <p className="text-xs text-muted-foreground mb-2">Añadir estrategia para mapa:</p>
              <div className="flex flex-wrap gap-1">
                {VALORANT_MAPS.filter(m => !data.mapStrategies.find(s=>s.mapName===m)).map(m => (
                  <button key={m} onClick={() => addMapStrat(m)}
                    className="text-xs px-2.5 py-1 rounded border border-white/10 text-muted-foreground hover:text-white hover:border-white/30 transition-all flex items-center gap-1">
                    <Plus className="w-3 h-3"/> {m}
                  </button>
                ))}
              </div>
            </div>
            {data.mapStrategies.map(ms => (
              <div key={ms.mapName} className="rounded-xl border overflow-hidden" style={{ borderColor:'hsl(220 15% 18%)' }}>
                <div className="px-4 py-2.5 flex items-center justify-between" style={{ background:'hsl(220 18% 9%)' }}>
                  <span className="font-bold text-sm">{ms.mapName}</span>
                  <button onClick={() => delMapStrat(ms.mapName)} className="text-red-400/50 hover:text-red-400 transition-colors"><X className="w-4 h-4"/></button>
                </div>
                <div className="p-4 space-y-3">
                  {[
                    ['atkDefault','⚔ ATK Default','Estrategia de ataque por defecto…'],
                    ['defDefault','🛡 DEF Default','Estrategia de defensa por defecto…'],
                    ['pivotTiming','⏱ Timing de rotación','Ej: rotan a A tras plantar en B a 20s…'],
                    ['keyPositions','📍 Posiciones clave','Posiciones que suelen tomar al inicio…'],
                    ['weaknesses','⚠️ Debilidades','Puntos donde son vulnerables…'],
                    ['setupNotes','📝 Notas generales','Observaciones adicionales…'],
                  ].map(([f,l,ph]) => (
                    <div key={f}>
                      <label className="text-[10px] text-muted-foreground mb-1 block font-bold uppercase tracking-wider">{l}</label>
                      <textarea value={(ms as any)[f]} onChange={e => updMapStrat(ms.mapName,f as keyof MapStrategy,e.target.value)}
                        className="input-pro text-xs w-full h-16 resize-none" placeholder={ph as string}/>
                    </div>
                  ))}
                  {/* Sites */}
                  <div>
                    <p className="text-[10px] text-muted-foreground mb-2 font-bold uppercase tracking-wider">Sites (% uso estimado)</p>
                    <div className="grid grid-cols-3 gap-2">
                      {SITES.map(site => {
                        const s = ms.sites.find(x=>x.site===site) || { site, atkPct:0, defPct:0, winPct:0, plantPct:0 };
                        const updSite = (field:keyof SiteData, val:number) => {
                          const newSites = ms.sites.find(x=>x.site===site)
                            ? ms.sites.map(x=>x.site===site?{...x,[field]:val}:x)
                            : [...ms.sites, {...s,[field]:val}];
                          updMapStrat(ms.mapName,'sites',newSites);
                        };
                        return (
                          <div key={site} className="rounded-lg p-3 space-y-1.5" style={{ background:'hsl(220 20% 10%)' }}>
                            <p className="font-black text-center text-white">{site}</p>
                            {[['atkPct','ATK%'],['defPct','DEF%'],['plantPct','Plant%']].map(([f,l]) => (
                              <div key={f}>
                                <label className="text-[9px] text-muted-foreground">{l}</label>
                                <input type="number" min="0" max="100" value={(s as any)[f]}
                                  onChange={e => updSite(f as keyof SiteData, +e.target.value)}
                                  className="input-pro text-xs p-1 h-6 w-full text-center"/>
                              </div>
                            ))}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── PARTIDOS ─────────────────────────────────────────────────── */}
        {section==='matches' && (
          <div className="space-y-4">
            <div className="rounded-xl border p-4 space-y-3" style={{ borderColor:'hsl(220 15% 20%)', background:'hsl(220 18% 7%)' }}>
              <p className="text-xs font-bold text-muted-foreground uppercase">Añadir partido vs {data.name||'rival'}</p>
              <div className="grid grid-cols-3 gap-2">
                <div><label className="text-[10px] text-muted-foreground mb-1 block">Fecha</label>
                  <input type="date" value={newMatch.date} onChange={e=>setNewMatch(m=>({...m,date:e.target.value}))} className="input-pro text-xs"/></div>
                <div><label className="text-[10px] text-muted-foreground mb-1 block">Torneo</label>
                  <input value={newMatch.tournament} onChange={e=>setNewMatch(m=>({...m,tournament:e.target.value}))} className="input-pro text-xs" placeholder="Torneo…"/></div>
                <div><label className="text-[10px] text-muted-foreground mb-1 block">Mapa</label>
                  <select value={newMatch.mapName} onChange={e=>setNewMatch(m=>({...m,mapName:e.target.value}))} className="input-pro text-xs">
                    {VALORANT_MAPS.map(m=><option key={m} value={m}>{m}</option>)}
                  </select></div>
                <div><label className="text-[10px] text-muted-foreground mb-1 block">Score NGU</label>
                  <input type="number" min="0" value={newMatch.scoreUs} onChange={e=>setNewMatch(m=>({...m,scoreUs:+e.target.value}))} className="input-pro text-xs"/></div>
                <div><label className="text-[10px] text-muted-foreground mb-1 block">Score Rival</label>
                  <input type="number" min="0" value={newMatch.scoreOpp} onChange={e=>setNewMatch(m=>({...m,scoreOpp:+e.target.value}))} className="input-pro text-xs"/></div>
                <div><label className="text-[10px] text-muted-foreground mb-1 block">ATK Ganadas</label>
                  <input type="number" min="0" value={newMatch.atkUs} onChange={e=>setNewMatch(m=>({...m,atkUs:+e.target.value}))} className="input-pro text-xs"/></div>
                <div><label className="text-[10px] text-muted-foreground mb-1 block">DEF Ganadas</label>
                  <input type="number" min="0" value={newMatch.defUs} onChange={e=>setNewMatch(m=>({...m,defUs:+e.target.value}))} className="input-pro text-xs"/></div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[['pistolAtkUs','Pistola ATK ganada'],['pistolDefUs','Pistola DEF ganada']].map(([f,l]) => (
                  <div key={f} className="flex items-center gap-2 p-2 rounded-lg" style={{ background:'hsl(220 20% 10%)' }}>
                    <span className="text-xs flex-1">{l}</span>
                    <button onClick={() => setNewMatch(m=>({...m,[f]:!(m as any)[f]}))}
                      className={"w-10 h-5 rounded-full relative transition-colors "+(( newMatch as any)[f]?'bg-green-500':'bg-gray-600')}>
                      <span className={"absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all "+((newMatch as any)[f]?'left-5':'left-0.5')}/>
                    </button>
                  </div>
                ))}
              </div>
              <div><label className="text-[10px] text-muted-foreground mb-1 block">Notas</label>
                <input value={newMatch.notes} onChange={e=>setNewMatch(m=>({...m,notes:e.target.value}))} className="input-pro text-xs w-full" placeholder="Notas…"/></div>
              <button onClick={addMatchRecord} className="px-4 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white text-xs font-medium transition-colors">
                + Añadir partido
              </button>
            </div>
            {/* Lista partidos guardados */}
            {data.matches.length > 0 && (
              <div className="space-y-1">
                {data.matches.map(m => (
                  <div key={m.id} className="flex items-center gap-3 p-2.5 rounded-lg" style={{ background:'hsl(220 15% 10%)' }}>
                    <span className="text-xs text-muted-foreground w-20 shrink-0">{m.date}</span>
                    <span className="text-xs font-medium flex-1">{m.mapName}</span>
                    <span className={cn('text-xs font-bold', m.scoreUs>m.scoreOpp?'text-green-400':'text-red-400')}>{m.scoreUs}–{m.scoreOpp}</span>
                    <button onClick={()=>delMatch(m.id)} className="text-red-400/50 hover:text-red-400 transition-colors"><X className="w-3.5 h-3.5"/></button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ── Componente raíz ───────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
export function RivalAnalysis() {
  const [rivals,   setRivals]   = useState<RivalTeam[]>(loadRivals);
  const [editing,  setEditing]  = useState<string|null>(null);   // id del rival en edición, 'new' para nuevo
  const [search,   setSearch]   = useState('');
  const [filterTier, setTier]   = useState('Todos');

  const persist = (data: RivalTeam[]) => { setRivals(data); saveRivals(data); };

  const saveRival = (r: RivalTeam) => {
    const exists = rivals.find(x=>x.id===r.id);
    persist(exists ? rivals.map(x=>x.id===r.id?r:x) : [r, ...rivals]);
    setEditing(null);
  };

  const deleteRival = (id:string) => {
    if (confirm('¿Eliminar este equipo rival?')) persist(rivals.filter(r=>r.id!==id));
  };

  const tiers = ['Todos', ...Array.from(new Set(rivals.map(r=>r.tier)))];

  const filtered = useMemo(() => rivals.filter(r => {
    if (search && !r.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterTier !== 'Todos' && r.tier !== filterTier) return false;
    return true;
  }), [rivals, search, filterTier]);

  const editingRival = editing === 'new'
    ? emptyRival()
    : rivals.find(r=>r.id===editing) ?? null;

  return (
    <div className="p-6 space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-black">Análisis de Rivales</h2>
          <p className="text-sm text-muted-foreground">Fichas · Scout · Estrategias · Comparativa NGU vs rival</p>
        </div>
        {!editing && (
          <button onClick={() => setEditing('new')} className="btn-primary flex items-center gap-1.5 px-4 py-2 text-sm">
            <Plus className="w-4 h-4"/> Nuevo rival
          </button>
        )}
      </div>

      {/* Editor */}
      {editing && editingRival && (
        <RivalEditor rival={editingRival} onSave={saveRival} onCancel={() => setEditing(null)}/>
      )}

      {!editing && (
        <>
          {/* Búsqueda + filtro */}
          <div className="glass-card p-3 flex flex-wrap gap-3 items-center">
            <div className="flex items-center gap-2 flex-1 min-w-[160px]">
              <Search className="w-4 h-4 text-muted-foreground"/>
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar rival…" className="input-pro flex-1 text-sm"/>
            </div>
            <select value={filterTier} onChange={e=>setTier(e.target.value)} className="input-pro text-sm">
              {tiers.map(t=><option key={t} value={t}>{t}</option>)}
            </select>
            <span className="text-xs text-muted-foreground">{filtered.length} rivales</span>
          </div>

          {/* Lista */}
          {filtered.length === 0 ? (
            <div className="glass-card p-12 text-center">
              <Swords className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3"/>
              <p className="text-muted-foreground">Sin rivales registrados. Añade el primero.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filtered.map(r => (
                <div key={r.id}>
                  <RivalCard rival={r} onEdit={() => setEditing(r.id)}/>
                  <button onClick={() => deleteRival(r.id)}
                    className="mt-1 text-[10px] text-red-400/40 hover:text-red-400 transition-colors flex items-center gap-1 ml-1">
                    <Trash2 className="w-3 h-3"/> Eliminar rival
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
