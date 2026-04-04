import { useState, useMemo } from 'react';
import {
  Plus, Trash2, Filter, BarChart2, Target, TrendingUp, TrendingDown,
  ChevronDown, X, Download,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
  ResponsiveContainer, ReferenceLine, Legend, Cell,
} from 'recharts';

// ── Storage key ────────────────────────────────────────────────────────────────
const STORAGE_KEY = 'valoanalytics_pistol_tracker_v1';

// ── Tipos ─────────────────────────────────────────────────────────────────────
interface PistolEntry {
  id:        string;
  date:      string;
  tournament:string;   // nombre del torneo / fase / liga
  match:     string;   // "NGU vs RIVAL" o libre
  teamA:     string;   // equipo que gana ATK pistola
  teamB:     string;   // equipo que gana DEF pistola
  mapName:   string;
  atkWinner: string;   // nombre del equipo ganador pistola ATK
  defWinner: string;   // nombre del equipo ganador pistola DEF
  notes:     string;
}

const VALORANT_MAPS = ['Ascent','Bind','Haven','Split','Pearl','Breeze','Abyss','Corrode','Lotus','Fracture','Icebox','Sunset'];
const MY_TEAM = 'NGU eSports';

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2); }

function loadData(): PistolEntry[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
  catch { return []; }
}
function saveData(data: PistolEntry[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function pct(n: number, d: number) { return d > 0 ? Math.round(n / d * 100) : 0; }

function pctColor(v: number) {
  return v >= 55 ? '#22c55e' : v >= 45 ? '#facc15' : '#ef4444';
}

function MiniBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-white/8">
        <div className="h-full rounded-full" style={{ width: value + '%', background: color }}/>
      </div>
      <span className="text-[10px] font-mono font-bold w-8 text-right" style={{ color }}>{value}%</span>
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
          <div className="w-2 h-2 rounded-full shrink-0" style={{ background: p.color }}/>
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="font-mono font-bold" style={{ color: p.color }}>{p.value}%</span>
        </div>
      ))}
    </div>
  );
}

// ── Estadísticas de un equipo en un dataset ───────────────────────────────────
function teamStats(entries: PistolEntry[], team: string) {
  const atkW = entries.filter(e => e.atkWinner === team).length;
  const defW = entries.filter(e => e.defWinner === team).length;
  const atkT = entries.filter(e => e.teamA === team || e.teamB === team || e.match.includes(team)).length;
  const total = entries.length;
  return {
    atkWins: atkW, defWins: defW,
    atkPct:  pct(atkW, total),
    defPct:  pct(defW, total),
    bothWins: entries.filter(e => e.atkWinner === team && e.defWinner === team).length,
    noneWins: entries.filter(e => e.atkWinner !== team && e.defWinner !== team).length,
    total,
  };
}

// ── Componente principal ───────────────────────────────────────────────────────
export function PistolTracker() {
  const [entries,     setEntries]     = useState<PistolEntry[]>(loadData);
  const [showForm,    setShowForm]    = useState(false);
  const [filterTour,  setFilterTour]  = useState('Todos');
  const [filterMap,   setFilterMap]   = useState('Todos');
  const [filterTeam,  setFilterTeam]  = useState('Todos');
  const [activeTab,   setActiveTab]   = useState<'log'|'stats'|'vs'>('log');
  const [form,        setForm]        = useState<Omit<PistolEntry,'id'>>({
    date: new Date().toISOString().split('T')[0],
    tournament: '', match: '', teamA: MY_TEAM, teamB: '',
    mapName: 'Ascent', atkWinner: '', defWinner: '', notes: '',
  });

  const persist = (data: PistolEntry[]) => { setEntries(data); saveData(data); };

  const addEntry = () => {
    if (!form.tournament || !form.match || !form.atkWinner || !form.defWinner) return;
    persist([{ ...form, id: uid() }, ...entries]);
    setForm(f => ({ ...f, match:'', atkWinner:'', defWinner:'', notes:'' }));
    setShowForm(false);
  };

  const deleteEntry = (id: string) => {
    if (confirm('¿Eliminar este registro?')) persist(entries.filter(e => e.id !== id));
  };

  // Filtrar
  const filtered = useMemo(() => entries.filter(e => {
    if (filterTour !== 'Todos' && e.tournament !== filterTour) return false;
    if (filterMap  !== 'Todos' && e.mapName    !== filterMap)  return false;
    if (filterTeam !== 'Todos' && e.teamA !== filterTeam && e.teamB !== filterTeam &&
        e.atkWinner !== filterTeam && e.defWinner !== filterTeam) return false;
    return true;
  }), [entries, filterTour, filterMap, filterTeam]);

  // Listas únicas para filtros
  const tournaments = useMemo(() => ['Todos', ...Array.from(new Set(entries.map(e => e.tournament).filter(Boolean)))], [entries]);
  const maps        = useMemo(() => ['Todos', ...VALORANT_MAPS.filter(m => entries.some(e => e.mapName === m))], [entries]);
  const teams       = useMemo(() => {
    const s = new Set<string>();
    entries.forEach(e => { if(e.teamA) s.add(e.teamA); if(e.teamB) s.add(e.teamB); });
    return ['Todos', ...Array.from(s).sort()];
  }, [entries]);

  // Stats globales
  const globalStats = useMemo(() => {
    const atkWins = filtered.filter(e => e.atkWinner === MY_TEAM).length;
    const defWins = filtered.filter(e => e.defWinner === MY_TEAM).length;
    const total   = filtered.length;
    const both    = filtered.filter(e => e.atkWinner === MY_TEAM && e.defWinner === MY_TEAM).length;
    const none    = filtered.filter(e => e.atkWinner !== MY_TEAM && e.defWinner !== MY_TEAM).length;
    return { atkWins, defWins, total, both, none,
      atkPct: pct(atkWins, total), defPct: pct(defWins, total),
      bothPct: pct(both, total), nonePct: pct(none, total) };
  }, [filtered]);

  // Datos para gráfico por torneo
  const byTournament = useMemo(() => {
    const map: Record<string, { atk:number; def:number; total:number }> = {};
    filtered.forEach(e => {
      if (!map[e.tournament]) map[e.tournament] = { atk:0, def:0, total:0 };
      map[e.tournament].total++;
      if (e.atkWinner === MY_TEAM) map[e.tournament].atk++;
      if (e.defWinner === MY_TEAM) map[e.tournament].def++;
    });
    return Object.entries(map).map(([t, s]) => ({
      name: t.length > 14 ? t.slice(0,13)+'…' : t,
      fullName: t,
      atkPct: pct(s.atk, s.total),
      defPct: pct(s.def, s.total),
      total:  s.total,
    }));
  }, [filtered]);

  // Datos para gráfico por mapa
  const byMap = useMemo(() => {
    const map: Record<string, { atk:number; def:number; total:number }> = {};
    filtered.forEach(e => {
      if (!map[e.mapName]) map[e.mapName] = { atk:0, def:0, total:0 };
      map[e.mapName].total++;
      if (e.atkWinner === MY_TEAM) map[e.mapName].atk++;
      if (e.defWinner === MY_TEAM) map[e.mapName].def++;
    });
    return Object.entries(map)
      .filter(([,s]) => s.total > 0)
      .map(([m, s]) => ({
        name: m,
        atkPct: pct(s.atk, s.total),
        defPct: pct(s.def, s.total),
        total: s.total,
      }));
  }, [filtered]);

  // Progresión temporal (últimas 15 entradas)
  const progression = useMemo(() => {
    return filtered.slice(0, 15).reverse().map((e, i) => ({
      n: i + 1,
      match: e.match,
      map:   e.mapName,
      atk:   e.atkWinner === MY_TEAM ? 100 : 0,
      def:   e.defWinner === MY_TEAM ? 100 : 0,
      both:  e.atkWinner === MY_TEAM && e.defWinner === MY_TEAM ? 100 : 0,
      tournament: e.tournament,
    }));
  }, [filtered]);

  // Stats por rival
  const vsData = useMemo(() => {
    const rivals = new Set<string>();
    filtered.forEach(e => {
      if (e.teamA !== MY_TEAM) rivals.add(e.teamA);
      if (e.teamB !== MY_TEAM) rivals.add(e.teamB);
    });
    return Array.from(rivals).sort().map(rival => {
      const matches = filtered.filter(e => e.teamA === rival || e.teamB === rival);
      const atkWe  = matches.filter(e => e.atkWinner === MY_TEAM).length;
      const defWe  = matches.filter(e => e.defWinner === MY_TEAM).length;
      const atkThey= matches.filter(e => e.atkWinner === rival).length;
      const defThey= matches.filter(e => e.defWinner === rival).length;
      return {
        rival, total: matches.length,
        atkWePct:   pct(atkWe,   matches.length),
        defWePct:   pct(defWe,   matches.length),
        atkTheyPct: pct(atkThey, matches.length),
        defTheyPct: pct(defThey, matches.length),
      };
    }).sort((a,b) => b.total - a.total);
  }, [filtered]);

  // Exportar CSV
  const exportCSV = () => {
    const header = 'Fecha,Torneo,Partido,Mapa,GanadorPistolaATK,GanadorPistolaDEF,Notas\n';
    const rows = filtered.map(e => `${e.date},${e.tournament},"${e.match}",${e.mapName},${e.atkWinner},${e.defWinner},"${e.notes}"`).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'pistolas.csv';
    a.click();
  };

  return (
    <div className="p-6 space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-black">Pistol Tracker</h2>
          <p className="text-sm text-muted-foreground">Registro y análisis de pistolas por torneo y equipo</p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportCSV} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-white/10 text-xs text-muted-foreground hover:text-white transition-colors">
            <Download className="w-3.5 h-3.5"/> CSV
          </button>
          <button onClick={() => setShowForm(v => !v)}
            className={cn('flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all',
              showForm ? 'bg-red-500/20 border border-red-500/40 text-red-300' : 'btn-primary')}>
            {showForm ? <X className="w-4 h-4"/> : <Plus className="w-4 h-4"/>}
            {showForm ? 'Cancelar' : 'Añadir registro'}
          </button>
        </div>
      </div>

      {/* Formulario */}
      {showForm && (
        <div className="glass-card p-5 space-y-4">
          <p className="text-sm font-semibold text-white">Nuevo registro de pistola</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Fecha</label>
              <input type="date" value={form.date} onChange={e => setForm(f=>({...f,date:e.target.value}))} className="input-pro"/>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Torneo / Fase</label>
              <input type="text" value={form.tournament} onChange={e => setForm(f=>({...f,tournament:e.target.value}))}
                placeholder="Champions 2025, Premier…" className="input-pro"
                list="tour-list"/>
              <datalist id="tour-list">
                {tournaments.filter(t=>t!=='Todos').map(t => <option key={t} value={t}/>)}
              </datalist>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Mapa</label>
              <select value={form.mapName} onChange={e => setForm(f=>({...f,mapName:e.target.value}))} className="input-pro">
                {VALORANT_MAPS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Equipo A (nosotros)</label>
              <input type="text" value={form.teamA} onChange={e => setForm(f=>({...f,teamA:e.target.value}))} className="input-pro"/>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Equipo B (rival)</label>
              <input type="text" value={form.teamB} onChange={e => setForm(f=>({...f,teamB:e.target.value}))}
                placeholder="Nombre del rival…" className="input-pro"/>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Partido</label>
              <input type="text" value={form.match}
                onChange={e => setForm(f=>({...f,match:e.target.value}))}
                placeholder={form.teamA + ' vs ' + (form.teamB||'Rival')}
                className="input-pro"/>
            </div>
          </div>

          {/* Ganadores pistola */}
          <div className="grid grid-cols-2 gap-4 p-3 rounded-xl" style={{ background: 'hsl(220 20% 8%)' }}>
            <div>
              <label className="text-xs text-muted-foreground mb-2 block font-medium">⚔ Ganador Pistola ATK (R1)</label>
              <div className="flex gap-2">
                {[form.teamA, form.teamB].filter(Boolean).map(team => (
                  <button key={team} onClick={() => setForm(f=>({...f,atkWinner:team}))}
                    className={cn('flex-1 py-2 rounded-lg border text-xs font-medium transition-all',
                      form.atkWinner === team
                        ? 'bg-yellow-500/20 border-yellow-500/50 text-yellow-300'
                        : 'border-white/10 text-muted-foreground hover:text-white')}>
                    {team}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-2 block font-medium">🛡 Ganador Pistola DEF (R13)</label>
              <div className="flex gap-2">
                {[form.teamA, form.teamB].filter(Boolean).map(team => (
                  <button key={team} onClick={() => setForm(f=>({...f,defWinner:team}))}
                    className={cn('flex-1 py-2 rounded-lg border text-xs font-medium transition-all',
                      form.defWinner === team
                        ? 'bg-blue-500/20 border-blue-500/50 text-blue-300'
                        : 'border-white/10 text-muted-foreground hover:text-white')}>
                    {team}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Notas</label>
            <input type="text" value={form.notes} onChange={e => setForm(f=>({...f,notes:e.target.value}))}
              placeholder="Opcional…" className="input-pro"/>
          </div>

          <div className="flex justify-end gap-2">
            <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-xl border border-white/10 text-sm text-muted-foreground hover:text-white transition-colors">Cancelar</button>
            <button onClick={addEntry}
              disabled={!form.tournament || !form.match || !form.atkWinner || !form.defWinner}
              className="px-4 py-2 rounded-xl bg-red-500 hover:bg-red-600 disabled:opacity-40 text-white text-sm font-medium transition-colors">
              Guardar
            </button>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="glass-card p-3 flex flex-wrap gap-3 items-center">
        <Filter className="w-3.5 h-3.5 text-muted-foreground shrink-0"/>
        <div className="flex flex-wrap gap-2 flex-1">
          <div>
            <p className="text-[9px] text-muted-foreground mb-1 uppercase tracking-wider">Torneo</p>
            <select value={filterTour} onChange={e => setFilterTour(e.target.value)} className="input-pro text-xs py-1">
              {tournaments.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <p className="text-[9px] text-muted-foreground mb-1 uppercase tracking-wider">Mapa</p>
            <select value={filterMap} onChange={e => setFilterMap(e.target.value)} className="input-pro text-xs py-1">
              {maps.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <p className="text-[9px] text-muted-foreground mb-1 uppercase tracking-wider">Equipo</p>
            <select value={filterTeam} onChange={e => setFilterTeam(e.target.value)} className="input-pro text-xs py-1">
              {teams.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>
        <span className="text-xs text-muted-foreground">{filtered.length} registros</span>
        {(filterTour !== 'Todos' || filterMap !== 'Todos' || filterTeam !== 'Todos') && (
          <button onClick={() => { setFilterTour('Todos'); setFilterMap('Todos'); setFilterTeam('Todos'); }}
            className="text-xs text-red-400 hover:text-red-300 transition-colors">× Limpiar</button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="glass-card p-10 text-center">
          <Target className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3"/>
          <p className="text-muted-foreground">Sin registros aún. Añade el primer partido.</p>
        </div>
      ) : (
        <>
          {/* KPIs NGU */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label:'Pistola ATK ganada', value: globalStats.atkPct+'%', sub: globalStats.atkWins+'/'+globalStats.total, color: pctColor(globalStats.atkPct) },
              { label:'Pistola DEF ganada', value: globalStats.defPct+'%', sub: globalStats.defWins+'/'+globalStats.total, color: pctColor(globalStats.defPct) },
              { label:'Ambas pistolas',     value: globalStats.bothPct+'%', sub: globalStats.both+' partidos', color: pctColor(globalStats.bothPct, 20, 40) },
              { label:'Ninguna pistola',    value: globalStats.nonePct+'%', sub: globalStats.none+' partidos', color: '#94a3b8' },
            ].map(({ label, value, sub, color }) => (
              <div key={label} className="glass-card p-4 space-y-1">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
                <p className="text-2xl font-black" style={{ color }}>{value}</p>
                <p className="text-[10px] text-muted-foreground">{sub}</p>
              </div>
            ))}
          </div>

          {/* Sub-tabs */}
          <div className="flex gap-1 border-b border-white/8 pb-1">
            {([['log','📋 Registro'],['stats','📊 Gráficas'],['vs','⚔ vs Rivales']] as [typeof activeTab, string][]).map(([id, label]) => (
              <button key={id} onClick={() => setActiveTab(id)}
                className={cn('px-3 py-2 rounded-t-lg text-xs font-medium transition-all',
                  activeTab === id ? 'bg-red-500/15 border border-red-500/30 border-b-transparent text-white' : 'text-muted-foreground hover:text-white')}>
                {label}
              </button>
            ))}
          </div>

          {/* ── LOG ──────────────────────────────────────────────────────── */}
          {activeTab === 'log' && (
            <div className="overflow-x-auto rounded-xl border" style={{ borderColor: 'hsl(220 15% 15%)' }}>
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left uppercase tracking-wider text-muted-foreground border-b"
                    style={{ borderColor: 'hsl(220 15% 15%)', background: 'hsl(220 20% 9%)' }}>
                    <th className="px-3 py-2">Fecha</th><th className="px-3 py-2">Torneo</th>
                    <th className="px-3 py-2">Partido</th><th className="px-3 py-2">Mapa</th>
                    <th className="px-3 py-2 text-yellow-400">Pistola ATK</th>
                    <th className="px-3 py-2 text-blue-400">Pistola DEF</th>
                    <th className="px-3 py-2">Notas</th><th className="px-3 py-2"/>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(e => (
                    <tr key={e.id} className="border-b hover:bg-white/3 transition-colors" style={{ borderColor: 'hsl(220 15% 12%)' }}>
                      <td className="px-3 py-2 text-muted-foreground">{e.date}</td>
                      <td className="px-3 py-2"><span className="px-1.5 py-0.5 rounded text-[10px]" style={{ background:'hsl(217 90% 55% / 0.15)', color:'hsl(217 90% 65%)' }}>{e.tournament}</span></td>
                      <td className="px-3 py-2 font-medium">{e.match}</td>
                      <td className="px-3 py-2">{e.mapName}</td>
                      <td className="px-3 py-2">
                        <span className={cn('font-bold', e.atkWinner === MY_TEAM ? 'text-green-400' : 'text-red-400')}>
                          {e.atkWinner === MY_TEAM ? '✓ ' : '✗ '}{e.atkWinner}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <span className={cn('font-bold', e.defWinner === MY_TEAM ? 'text-green-400' : 'text-red-400')}>
                          {e.defWinner === MY_TEAM ? '✓ ' : '✗ '}{e.defWinner}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-muted-foreground/60 max-w-[120px] truncate">{e.notes}</td>
                      <td className="px-3 py-2">
                        <button onClick={() => deleteEntry(e.id)} className="text-red-400/50 hover:text-red-400 transition-colors">
                          <Trash2 className="w-3.5 h-3.5"/>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ── GRÁFICAS ─────────────────────────────────────────────────── */}
          {activeTab === 'stats' && (
            <div className="space-y-5">

              {/* Por torneo */}
              {byTournament.length > 0 && (
                <div className="glass-card p-4">
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-4">
                    % Pistolas ganadas por torneo — {MY_TEAM}
                  </p>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={byTournament} barSize={20} barGap={4}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)"/>
                      <XAxis dataKey="name" tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.4)' }}/>
                      <YAxis domain={[0,100]} tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.4)' }} tickFormatter={v=>v+'%'}/>
                      <Tooltip content={({ active, payload, label }) => {
                        if (!active || !payload?.length) return null;
                        const d = byTournament.find(t => t.name === label);
                        return (
                          <div className="rounded-xl border p-3 text-xs" style={{ background:'hsl(220 22% 10%)', borderColor:'hsl(220 15% 22%)' }}>
                            <p className="font-bold mb-1">{d?.fullName}</p>
                            <p className="text-muted-foreground">{d?.total} partidos</p>
                            {payload.map((p:any) => (
                              <div key={p.name} className="flex items-center gap-2 mt-1">
                                <div className="w-2 h-2 rounded-full" style={{ background:p.color }}/>
                                <span style={{ color:p.color }}>{p.name}: {p.value}%</span>
                              </div>
                            ))}
                          </div>
                        );
                      }}/>
                      <ReferenceLine y={50} stroke="rgba(255,255,255,0.15)" strokeDasharray="4 4"/>
                      <Legend wrapperStyle={{ fontSize: 10, paddingTop: 8 }}/>
                      <Bar dataKey="atkPct" name="ATK%" fill="#f59e0b" radius={[3,3,0,0]}/>
                      <Bar dataKey="defPct" name="DEF%" fill="#3b82f6" radius={[3,3,0,0]}/>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Por mapa */}
              {byMap.length > 0 && (
                <div className="glass-card p-4">
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-4">
                    % Pistolas ganadas por mapa — {MY_TEAM}
                  </p>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={byMap} barSize={18} barGap={3}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)"/>
                      <XAxis dataKey="name" tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.4)' }}/>
                      <YAxis domain={[0,100]} tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.4)' }} tickFormatter={v=>v+'%'}/>
                      <Tooltip content={<CustomTooltip/>}/>
                      <ReferenceLine y={50} stroke="rgba(255,255,255,0.15)" strokeDasharray="4 4"/>
                      <Legend wrapperStyle={{ fontSize: 10, paddingTop: 8 }}/>
                      <Bar dataKey="atkPct" name="ATK%" radius={[3,3,0,0]}>
                        {byMap.map((d,i) => <Cell key={i} fill={pctColor(d.atkPct)}/>)}
                      </Bar>
                      <Bar dataKey="defPct" name="DEF%" fill="#3b82f6" radius={[3,3,0,0]}/>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Progresión histórica */}
              {progression.length >= 3 && (
                <div className="glass-card p-4">
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">
                    Historial (últimos {progression.length} partidos) — 100 = ganada · 0 = perdida
                  </p>
                  <p className="text-[10px] text-muted-foreground mb-4">Cada punto = un partido. Verde arriba = ganamos la pistola.</p>
                  <ResponsiveContainer width="100%" height={160}>
                    <LineChart data={progression} margin={{ top:4, right:4, bottom:4, left:-20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)"/>
                      <XAxis dataKey="n" tick={{ fontSize: 8, fill: 'rgba(255,255,255,0.3)' }}/>
                      <YAxis domain={[-10,110]} ticks={[0,100]} tickFormatter={v=>v===100?'W':'L'} tick={{ fontSize: 8, fill: 'rgba(255,255,255,0.3)' }}/>
                      <Tooltip content={({ active, payload, label }) => {
                        if (!active || !payload?.length) return null;
                        const d = progression[Number(label)-1];
                        return (
                          <div className="rounded-xl border p-2 text-xs" style={{ background:'hsl(220 22% 10%)', borderColor:'hsl(220 15% 22%)' }}>
                            <p className="font-bold mb-0.5">{d?.match}</p>
                            <p className="text-muted-foreground">{d?.map} · {d?.tournament}</p>
                            <p className={d?.atk===100?'text-yellow-400':'text-muted-foreground'}>ATK: {d?.atk===100?'✓ Ganada':'✗ Perdida'}</p>
                            <p className={d?.def===100?'text-blue-400':'text-muted-foreground'}>DEF: {d?.def===100?'✓ Ganada':'✗ Perdida'}</p>
                          </div>
                        );
                      }}/>
                      <ReferenceLine y={50} stroke="rgba(255,255,255,0.1)" strokeDasharray="4 4"/>
                      <Line type="stepAfter" dataKey="atk" name="ATK" stroke="#f59e0b" strokeWidth={2}
                        dot={(p:any) => <circle cx={p.cx} cy={p.cy} r={4} fill={p.value===100?'#22c55e':'#ef4444'} stroke="#f59e0b" strokeWidth={1.5}/>}/>
                      <Line type="stepAfter" dataKey="def" name="DEF" stroke="#3b82f6" strokeWidth={2}
                        dot={(p:any) => <circle cx={p.cx} cy={p.cy} r={4} fill={p.value===100?'#22c55e':'#ef4444'} stroke="#3b82f6" strokeWidth={1.5}/>}/>
                    </LineChart>
                  </ResponsiveContainer>
                  <div className="flex gap-4 mt-1 text-[10px] text-muted-foreground">
                    <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-yellow-500 inline-block rounded"/>ATK</span>
                    <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-blue-500 inline-block rounded"/>DEF</span>
                    <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block"/>Ganada</span>
                    <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block"/>Perdida</span>
                  </div>
                </div>
              )}

              {/* Tabla resumen por torneo */}
              <div className="glass-card p-4">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Resumen por torneo</p>
                <div className="overflow-x-auto rounded-xl border" style={{ borderColor:'hsl(220 15% 15%)' }}>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="uppercase tracking-wider text-muted-foreground border-b text-left"
                        style={{ borderColor:'hsl(220 15% 15%)', background:'hsl(220 20% 9%)' }}>
                        <th className="px-3 py-2">Torneo</th>
                        <th className="px-3 py-2 text-center">Partidos</th>
                        <th className="px-3 py-2 text-yellow-400">ATK%</th>
                        <th className="px-3 py-2 text-blue-400">DEF%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {byTournament.map(d => (
                        <tr key={d.name} className="border-b hover:bg-white/3" style={{ borderColor:'hsl(220 15% 12%)' }}>
                          <td className="px-3 py-2 font-medium">{d.fullName}</td>
                          <td className="px-3 py-2 text-center text-muted-foreground">{d.total}</td>
                          <td className="px-3 py-2"><MiniBar value={d.atkPct} color={pctColor(d.atkPct)}/></td>
                          <td className="px-3 py-2"><MiniBar value={d.defPct} color={pctColor(d.defPct)}/></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ── VS RIVALES ────────────────────────────────────────────────── */}
          {activeTab === 'vs' && (
            <div className="space-y-4">
              {vsData.length === 0 ? (
                <div className="glass-card p-8 text-center text-muted-foreground text-sm">Sin datos de rivales con los filtros actuales.</div>
              ) : vsData.map(d => (
                <div key={d.rival} className="glass-card p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="font-bold text-sm">{d.rival}</p>
                      <p className="text-[10px] text-muted-foreground">{d.total} enfrentamiento{d.total!==1?'s':''}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <p className="text-[10px] font-bold text-yellow-400 uppercase tracking-wider">Pistola ATK</p>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-[10px]">
                          <span className="w-16 text-green-400 font-medium truncate">NGU</span>
                          <MiniBar value={d.atkWePct} color="#22c55e"/>
                        </div>
                        <div className="flex items-center gap-2 text-[10px]">
                          <span className="w-16 text-red-400 truncate">{d.rival.slice(0,7)}</span>
                          <MiniBar value={d.atkTheyPct} color="#ef4444"/>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <p className="text-[10px] font-bold text-blue-400 uppercase tracking-wider">Pistola DEF</p>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-[10px]">
                          <span className="w-16 text-green-400 font-medium truncate">NGU</span>
                          <MiniBar value={d.defWePct} color="#22c55e"/>
                        </div>
                        <div className="flex items-center gap-2 text-[10px]">
                          <span className="w-16 text-red-400 truncate">{d.rival.slice(0,7)}</span>
                          <MiniBar value={d.defTheyPct} color="#ef4444"/>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
