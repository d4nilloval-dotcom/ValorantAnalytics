import { useState, useMemo } from 'react';
import {
  Plus, Trash2, Filter, Search, Download, ChevronDown, ChevronUp, X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  ResponsiveContainer, ReferenceLine, Cell, Legend,
} from 'recharts';

// ── Storage ────────────────────────────────────────────────────────────────────
const STORAGE_KEY = 'valoanalytics_pistol_scout_v1';

// ── Constantes ─────────────────────────────────────────────────────────────────
const VALORANT_MAPS = [
  'Ascent','Bind','Haven','Split','Pearl','Breeze',
  'Abyss','Corrode','Lotus','Fracture','Icebox','Sunset',
];

// ── Tipos ─────────────────────────────────────────────────────────────────────
type PistolResult = 'win' | 'loss';

interface PistolRecord {
  id:          string;
  date:        string;
  tournament:  string;
  phase:       string;     // Grupos, Playoff, Final…
  teamA:       string;     // equipo que juega ATK en R1
  teamB:       string;     // equipo que juega DEF en R1
  mapName:     string;

  // Pistola R1 (ATK)
  atkPistolWinner: string;           // nombre del equipo ganador
  atkPostRounds:   number;           // cuántas rondas gana el ganador de ATK pistola después
  atkPostNotes:    string;           // qué hicieron después (eco/force/full…)

  // Pistola R13 (DEF)
  defPistolWinner: string;
  defPostRounds:   number;
  defPostNotes:    string;

  // Marcador final
  scoreA: number;
  scoreB: number;

  notes: string;
}

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2); }
function pct(n: number, d: number) { return d > 0 ? Math.round(n / d * 100) : 0; }
function pctColor(v: number) { return v >= 55 ? '#22c55e' : v >= 45 ? '#facc15' : '#ef4444'; }

function load(): PistolRecord[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
}
function save(data: PistolRecord[]) { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }

function emptyForm(): Omit<PistolRecord, 'id'> {
  return {
    date: new Date().toISOString().split('T')[0],
    tournament: '', phase: '', teamA: '', teamB: '', mapName: 'Ascent',
    atkPistolWinner: '', atkPostRounds: 0, atkPostNotes: '',
    defPistolWinner: '', defPostRounds: 0, defPostNotes: '',
    scoreA: 0, scoreB: 0, notes: '',
  };
}

// ── Tooltip ────────────────────────────────────────────────────────────────────
function CT({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border p-3 text-xs shadow-2xl space-y-1"
      style={{ background: 'hsl(220 22% 10%)', borderColor: 'hsl(220 15% 22%)' }}>
      <p className="font-bold text-white mb-1">{label}</p>
      {payload.map((p: any) => (
        <div key={p.name} className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full shrink-0" style={{ background: p.color }} />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="font-mono font-bold" style={{ color: p.color }}>{p.value}%</span>
        </div>
      ))}
    </div>
  );
}

function MiniBar({ v, c }: { v: number; c: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex-1 h-1.5 rounded-full bg-white/8">
        <div className="h-full rounded-full" style={{ width: v + '%', background: c }} />
      </div>
      <span className="text-[10px] font-mono w-8 text-right" style={{ color: c }}>{v}%</span>
    </div>
  );
}

// ── Formulario de entrada ──────────────────────────────────────────────────────
function RecordForm({
  onSave, onCancel, initial, allTeams, allTournaments,
}: {
  onSave: (r: Omit<PistolRecord, 'id'>) => void;
  onCancel: () => void;
  initial?: Omit<PistolRecord, 'id'>;
  allTeams: string[];
  allTournaments: string[];
}) {
  const [form, setForm] = useState<Omit<PistolRecord, 'id'>>(initial ?? emptyForm());
  const set = (f: keyof typeof form, v: any) => setForm(x => ({ ...x, [f]: v }));

  const teams = [form.teamA, form.teamB].filter(Boolean);
  const canSave = form.tournament && form.teamA && form.teamB &&
    form.atkPistolWinner && form.defPistolWinner;

  return (
    <div className="glass-card p-5 space-y-5">
      <p className="text-sm font-semibold">Nuevo registro de pistola (scout)</p>

      {/* Partido */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Fecha</label>
          <input type="date" value={form.date} onChange={e => set('date', e.target.value)} className="input-pro" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Torneo</label>
          <input value={form.tournament} onChange={e => set('tournament', e.target.value)}
            list="scout-tour" placeholder="Champions, Premier…" className="input-pro" />
          <datalist id="scout-tour">
            {allTournaments.map(t => <option key={t} value={t} />)}
          </datalist>
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Fase</label>
          <input value={form.phase} onChange={e => set('phase', e.target.value)}
            placeholder="Grupos, Playoff…" className="input-pro" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Mapa</label>
          <select value={form.mapName} onChange={e => set('mapName', e.target.value)} className="input-pro">
            {VALORANT_MAPS.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
      </div>

      {/* Equipos y marcador */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Equipo A (ATK en R1)</label>
          <input value={form.teamA} onChange={e => set('teamA', e.target.value)}
            list="scout-teams" placeholder="Nombre equipo…" className="input-pro" />
          <datalist id="scout-teams">
            {allTeams.map(t => <option key={t} value={t} />)}
          </datalist>
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Equipo B (DEF en R1)</label>
          <input value={form.teamB} onChange={e => set('teamB', e.target.value)}
            list="scout-teams" placeholder="Nombre equipo…" className="input-pro" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Score {form.teamA || 'A'}</label>
          <input type="number" min="0" value={form.scoreA}
            onChange={e => set('scoreA', +e.target.value)} className="input-pro" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Score {form.teamB || 'B'}</label>
          <input type="number" min="0" value={form.scoreB}
            onChange={e => set('scoreB', +e.target.value)} className="input-pro" />
        </div>
      </div>

      {/* Pistola ATK (R1) */}
      <div className="rounded-xl p-4 space-y-3" style={{ background: 'hsl(220 20% 8%)', border: '1px solid hsl(220 15% 16%)' }}>
        <p className="text-xs font-bold text-yellow-400 uppercase tracking-wider">⚔ Pistola ATK — Ronda 1</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="text-[10px] text-muted-foreground mb-1.5 block">¿Quién gana?</label>
            <div className="flex gap-2">
              {teams.map(t => (
                <button key={t} onClick={() => set('atkPistolWinner', t)}
                  className={cn('flex-1 py-2 rounded-lg border text-xs font-medium transition-all',
                    form.atkPistolWinner === t
                      ? 'bg-yellow-500/20 border-yellow-500/50 text-yellow-300'
                      : 'border-white/10 text-muted-foreground hover:text-white')}>
                  {t}
                </button>
              ))}
              {teams.length === 0 && <p className="text-[10px] text-muted-foreground">Rellena los equipos primero</p>}
            </div>
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground mb-1 block">
              Rondas que gana el ganador después de pistola ATK
            </label>
            <input type="number" min="0" max="12" value={form.atkPostRounds}
              onChange={e => set('atkPostRounds', +e.target.value)} className="input-pro" />
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground mb-1 block">¿Qué hicieron después? (eco/force/full/plant…)</label>
            <input value={form.atkPostNotes} onChange={e => set('atkPostNotes', e.target.value)}
              placeholder="Ej: 2 eco luego full, 4 rounds seguidos ATK…" className="input-pro text-xs" />
          </div>
        </div>
      </div>

      {/* Pistola DEF (R13) */}
      <div className="rounded-xl p-4 space-y-3" style={{ background: 'hsl(220 20% 8%)', border: '1px solid hsl(220 15% 16%)' }}>
        <p className="text-xs font-bold text-blue-400 uppercase tracking-wider">🛡 Pistola DEF — Ronda 13</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="text-[10px] text-muted-foreground mb-1.5 block">¿Quién gana?</label>
            <div className="flex gap-2">
              {teams.map(t => (
                <button key={t} onClick={() => set('defPistolWinner', t)}
                  className={cn('flex-1 py-2 rounded-lg border text-xs font-medium transition-all',
                    form.defPistolWinner === t
                      ? 'bg-blue-500/20 border-blue-500/50 text-blue-300'
                      : 'border-white/10 text-muted-foreground hover:text-white')}>
                  {t}
                </button>
              ))}
              {teams.length === 0 && <p className="text-[10px] text-muted-foreground">Rellena los equipos primero</p>}
            </div>
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground mb-1 block">
              Rondas que gana el ganador después de pistola DEF
            </label>
            <input type="number" min="0" max="12" value={form.defPostRounds}
              onChange={e => set('defPostRounds', +e.target.value)} className="input-pro" />
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground mb-1 block">¿Qué hicieron después?</label>
            <input value={form.defPostNotes} onChange={e => set('defPostNotes', e.target.value)}
              placeholder="Ej: eco + force, hold site B, 3 rounds seguidos…" className="input-pro text-xs" />
          </div>
        </div>
      </div>

      <div>
        <label className="text-xs text-muted-foreground mb-1 block">Notas generales</label>
        <input value={form.notes} onChange={e => set('notes', e.target.value)}
          placeholder="Observaciones adicionales…" className="input-pro" />
      </div>

      <div className="flex justify-end gap-2">
        <button onClick={onCancel} className="px-4 py-2 rounded-xl border border-white/10 text-sm text-muted-foreground hover:text-white transition-colors">
          Cancelar
        </button>
        <button onClick={() => canSave && onSave(form)} disabled={!canSave}
          className="px-4 py-2 rounded-xl bg-red-500 hover:bg-red-600 disabled:opacity-40 text-white text-sm font-medium transition-colors">
          Guardar registro
        </button>
      </div>
    </div>
  );
}

// ── Componente principal ───────────────────────────────────────────────────────
export function PistolScout() {
  const [records,     setRecords]     = useState<PistolRecord[]>(load);
  const [showForm,    setShowForm]    = useState(false);
  const [filterTour,  setFilterTour]  = useState('Todos');
  const [filterMap,   setFilterMap]   = useState('Todos');
  const [filterTeam,  setFilterTeam]  = useState('Todos');
  const [search,      setSearch]      = useState('');
  const [view,        setView]        = useState<'log'|'stats'|'team'>('log');
  const [expandedId,  setExpandedId]  = useState<string|null>(null);

  const persist = (data: PistolRecord[]) => { setRecords(data); save(data); };

  const addRecord = (r: Omit<PistolRecord, 'id'>) => {
    persist([{ ...r, id: uid() }, ...records]);
    setShowForm(false);
  };

  const deleteRecord = (id: string) => {
    if (confirm('¿Eliminar este registro?')) persist(records.filter(r => r.id !== id));
  };

  // Listas únicas
  const allTournaments = useMemo(() =>
    Array.from(new Set(records.map(r => r.tournament).filter(Boolean))), [records]);
  const allMaps = useMemo(() =>
    ['Todos', ...VALORANT_MAPS.filter(m => records.some(r => r.mapName === m))], [records]);
  const allTeams = useMemo(() => {
    const s = new Set<string>();
    records.forEach(r => { if (r.teamA) s.add(r.teamA); if (r.teamB) s.add(r.teamB); });
    return Array.from(s).sort();
  }, [records]);

  const tournaments = ['Todos', ...allTournaments];
  const teams       = ['Todos', ...allTeams];

  // Filtrar
  const filtered = useMemo(() => records.filter(r => {
    if (filterTour !== 'Todos' && r.tournament !== filterTour) return false;
    if (filterMap  !== 'Todos' && r.mapName    !== filterMap)  return false;
    if (filterTeam !== 'Todos' && r.teamA !== filterTeam && r.teamB !== filterTeam) return false;
    if (search && !r.teamA.toLowerCase().includes(search.toLowerCase()) &&
        !r.teamB.toLowerCase().includes(search.toLowerCase()) &&
        !r.tournament.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [records, filterTour, filterMap, filterTeam, search]);

  // ── Estadísticas por equipo ────────────────────────────────────────────────
  const teamStats = useMemo(() => {
    return allTeams.map(team => {
      const asAtk = filtered.filter(r => r.teamA === team);  // juegan ATK en R1
      const asDef = filtered.filter(r => r.teamB === team);  // juegan DEF en R1
      const total = asAtk.length + asDef.length;
      if (total === 0) return null;

      const atkPistolWins = asAtk.filter(r => r.atkPistolWinner === team).length;
      const defPistolWins = asDef.filter(r => r.defPistolWinner === team).length;

      // Rondas post-pistola cuando ganan ATK
      const atkPostWon  = asAtk.filter(r => r.atkPistolWinner === team);
      const avgAtkPost  = atkPostWon.length > 0
        ? (atkPostWon.reduce((s, r) => s + r.atkPostRounds, 0) / atkPostWon.length).toFixed(1)
        : '—';

      // Rondas post-pistola cuando ganan DEF
      const defPostWon  = asDef.filter(r => r.defPistolWinner === team);
      const avgDefPost  = defPostWon.length > 0
        ? (defPostWon.reduce((s, r) => s + r.defPostRounds, 0) / defPostWon.length).toFixed(1)
        : '—';

      // Por mapa
      const byMap = VALORANT_MAPS.map(m => {
        const mapAsAtk = asAtk.filter(r => r.mapName === m);
        const mapAsDef = asDef.filter(r => r.mapName === m);
        const tot = mapAsAtk.length + mapAsDef.length;
        if (tot === 0) return null;
        const aw = mapAsAtk.filter(r => r.atkPistolWinner === team).length;
        const dw = mapAsDef.filter(r => r.defPistolWinner === team).length;
        return { map: m, total: tot, atkPct: pct(aw, mapAsAtk.length), defPct: pct(dw, mapAsDef.length) };
      }).filter(Boolean) as { map:string; total:number; atkPct:number; defPct:number }[];

      // Notas post-pistola más frecuentes
      const atkNotes = atkPostWon.map(r => r.atkPostNotes).filter(Boolean);
      const defNotes = defPostWon.map(r => r.defPostNotes).filter(Boolean);

      return {
        team, total, atkMatches: asAtk.length, defMatches: asDef.length,
        atkPistolWins, defPistolWins,
        atkPistolPct: pct(atkPistolWins, asAtk.length),
        defPistolPct: pct(defPistolWins, asDef.length),
        avgAtkPost, avgDefPost,
        byMap,
        atkNotes: Array.from(new Set(atkNotes)).slice(0, 3),
        defNotes: Array.from(new Set(defNotes)).slice(0, 3),
      };
    }).filter(Boolean).sort((a, b) => (b!.total - a!.total)) as NonNullable<ReturnType<typeof teamStats>[number]>[];
  }, [filtered, allTeams]);

  // ── Datos para gráfico global por mapa ────────────────────────────────────
  const globalByMap = useMemo(() => {
    return VALORANT_MAPS.map(m => {
      const ms = filtered.filter(r => r.mapName === m);
      if (ms.length === 0) return null;
      // atkWins = partidos en que el equipo ATK (teamA) ganó la pistola ATK
      // Un partido tiene ganador de pistola ATK si atkPistolWinner está relleno
      const withAtkWinner = ms.filter(r => r.atkPistolWinner);
      const withDefWinner = ms.filter(r => r.defPistolWinner);
      // El atacante (teamA) ganó si el ganador coincide con teamA
      const atkWins = withAtkWinner.filter(r => r.atkPistolWinner === r.teamA).length;
      // El defensor (teamB) ganó la DEF pistola si el ganador coincide con teamB
      const defWins = withDefWinner.filter(r => r.defPistolWinner === r.teamB).length;
      // Promedio de rondas post-pistola (solo registros con dato > 0)
      const atkPostData = ms.filter(r => r.atkPostRounds > 0);
      const defPostData = ms.filter(r => r.defPostRounds > 0);
      const avgPostAtk = atkPostData.length > 0
        ? atkPostData.reduce((s, r) => s + r.atkPostRounds, 0) / atkPostData.length : 0;
      const avgPostDef = defPostData.length > 0
        ? defPostData.reduce((s, r) => s + r.defPostRounds, 0) / defPostData.length : 0;
      return {
        map: m, total: ms.length,
        atkWinPct: pct(atkWins, withAtkWinner.length || ms.length),
        defWinPct: pct(defWins, withDefWinner.length || ms.length),
        avgPostAtk: +avgPostAtk.toFixed(1),
        avgPostDef: +avgPostDef.toFixed(1),
      };
    }).filter(Boolean) as NonNullable<ReturnType<typeof globalByMap>[number]>[];
  }, [filtered]);

  // ── Exportar CSV ──────────────────────────────────────────────────────────
  const exportCSV = () => {
    const h = 'Fecha,Torneo,Fase,Mapa,EquipoA(ATK),EquipoB(DEF),ScoreA,ScoreB,GanadorPistolaATK,RondasPostATK,NotasPostATK,GanadorPistolaDEF,RondasPostDEF,NotasPostDEF,Notas\n';
    const rows = filtered.map(r =>
      `${r.date},"${r.tournament}","${r.phase}",${r.mapName},"${r.teamA}","${r.teamB}",${r.scoreA},${r.scoreB},"${r.atkPistolWinner}",${r.atkPostRounds},"${r.atkPostNotes}","${r.defPistolWinner}",${r.defPostRounds},"${r.defPostNotes}","${r.notes}"`
    ).join('\n');
    const blob = new Blob([h + rows], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = 'pistol_scout.csv'; a.click();
  };

  return (
    <div className="p-6 space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-black">Pistol Scout</h2>
          <p className="text-sm text-muted-foreground">
            Registro de pistolas de todos los equipos del torneo — sin importar si juegas contra ellos
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportCSV}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-white/10 text-xs text-muted-foreground hover:text-white transition-colors">
            <Download className="w-3.5 h-3.5"/> CSV
          </button>
          <button onClick={() => setShowForm(v => !v)}
            className={cn('flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all',
              showForm ? 'bg-red-500/20 border border-red-500/40 text-red-300' : 'btn-primary')}>
            {showForm ? <X className="w-4 h-4"/> : <Plus className="w-4 h-4"/>}
            {showForm ? 'Cancelar' : 'Añadir partido'}
          </button>
        </div>
      </div>

      {/* Formulario */}
      {showForm && (
        <RecordForm
          onSave={addRecord}
          onCancel={() => setShowForm(false)}
          allTeams={allTeams}
          allTournaments={allTournaments}
        />
      )}

      {/* Filtros */}
      <div className="glass-card p-3 flex flex-wrap gap-3 items-end">
        <div className="flex items-center gap-2 flex-1 min-w-[160px]">
          <Search className="w-4 h-4 text-muted-foreground shrink-0"/>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar equipo, torneo…" className="input-pro flex-1 text-sm"/>
        </div>
        {[
          { label:'Torneo', val:filterTour, set:setFilterTour, opts:tournaments },
          { label:'Mapa',   val:filterMap,  set:setFilterMap,  opts:allMaps },
          { label:'Equipo', val:filterTeam, set:setFilterTeam, opts:teams },
        ].map(({ label, val, set: setFn, opts }) => (
          <div key={label}>
            <p className="text-[9px] text-muted-foreground mb-1 uppercase tracking-wider">{label}</p>
            <select value={val} onChange={e => setFn(e.target.value)} className="input-pro text-xs py-1">
              {opts.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
        ))}
        <span className="text-xs text-muted-foreground self-end pb-1">{filtered.length} registros</span>
        {(filterTour !== 'Todos' || filterMap !== 'Todos' || filterTeam !== 'Todos' || search) && (
          <button onClick={() => { setFilterTour('Todos'); setFilterMap('Todos'); setFilterTeam('Todos'); setSearch(''); }}
            className="text-xs text-red-400 hover:text-red-300 transition-colors self-end pb-1">
            × Limpiar
          </button>
        )}
      </div>

      {records.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <p className="text-muted-foreground">Sin registros. Añade el primer partido observado.</p>
        </div>
      ) : (
        <>
          {/* Sub-tabs */}
          <div className="flex gap-1 border-b border-white/8 pb-1">
            {([
              ['log',  '📋 Registro'],
              ['stats','📊 Por mapa'],
              ['team', '👥 Por equipo'],
            ] as [typeof view, string][]).map(([id, label]) => (
              <button key={id} onClick={() => setView(id)}
                className={cn('px-3 py-2 text-xs font-medium rounded-t-lg transition-all',
                  view === id ? 'bg-red-500/15 border border-red-500/30 border-b-transparent text-white' : 'text-muted-foreground hover:text-white')}>
                {label}
              </button>
            ))}
          </div>

          {/* ── LOG ───────────────────────────────────────────────────── */}
          {view === 'log' && (
            <div className="space-y-2">
              {filtered.map(r => {
                const expanded = expandedId === r.id;
                return (
                  <div key={r.id} className="rounded-xl border overflow-hidden"
                    style={{ borderColor: 'hsl(220 15% 16%)' }}>
                    {/* Fila resumen */}
                    <div
                      className="grid items-center gap-3 px-4 py-3 cursor-pointer hover:bg-white/3 transition-colors"
                      style={{ gridTemplateColumns: '80px 1fr 1fr 90px 110px 110px 24px' }}
                      onClick={() => setExpandedId(expanded ? null : r.id)}>
                      <span className="text-[10px] text-muted-foreground">{r.date}</span>
                      <div>
                        <p className="text-xs font-bold">{r.teamA} vs {r.teamB}</p>
                        <p className="text-[10px] text-muted-foreground">{r.tournament}{r.phase ? ' · '+r.phase : ''}</p>
                      </div>
                      <span className="text-xs text-muted-foreground">{r.mapName}</span>
                      <span className="text-xs font-mono">
                        <span className={r.scoreA > r.scoreB ? 'text-green-400' : 'text-red-400'}>{r.scoreA}</span>
                        <span className="text-muted-foreground mx-0.5">–</span>
                        <span className={r.scoreB > r.scoreA ? 'text-green-400' : 'text-red-400'}>{r.scoreB}</span>
                      </span>
                      {/* Ganadores pistola */}
                      <div className="text-[10px] space-y-0.5">
                        <p><span className="text-yellow-400">ATK:</span> <span className="font-medium text-white">{r.atkPistolWinner}</span></p>
                        <p className="text-muted-foreground">+{r.atkPostRounds}r post</p>
                      </div>
                      <div className="text-[10px] space-y-0.5">
                        <p><span className="text-blue-400">DEF:</span> <span className="font-medium text-white">{r.defPistolWinner}</span></p>
                        <p className="text-muted-foreground">+{r.defPostRounds}r post</p>
                      </div>
                      <button onClick={e => { e.stopPropagation(); deleteRecord(r.id); }}
                        className="text-red-400/40 hover:text-red-400 transition-colors">
                        <Trash2 className="w-3.5 h-3.5"/>
                      </button>
                    </div>

                    {/* Detalle expandido */}
                    {expanded && (
                      <div className="px-4 pb-4 pt-0 grid grid-cols-2 gap-4 border-t border-white/6">
                        <div className="rounded-xl p-3 space-y-1.5 mt-3" style={{ background: 'hsl(220 20% 8%)' }}>
                          <p className="text-[10px] font-bold text-yellow-400 uppercase tracking-wider">⚔ Post-pistola ATK</p>
                          <p className="text-xs"><span className="text-muted-foreground">Ganador:</span> <span className="font-bold text-white">{r.atkPistolWinner}</span></p>
                          <p className="text-xs"><span className="text-muted-foreground">Rondas ganadas después:</span> <span className="font-bold text-white">{r.atkPostRounds}</span></p>
                          {r.atkPostNotes && <p className="text-xs text-white/70 italic">"{r.atkPostNotes}"</p>}
                        </div>
                        <div className="rounded-xl p-3 space-y-1.5 mt-3" style={{ background: 'hsl(220 20% 8%)' }}>
                          <p className="text-[10px] font-bold text-blue-400 uppercase tracking-wider">🛡 Post-pistola DEF</p>
                          <p className="text-xs"><span className="text-muted-foreground">Ganador:</span> <span className="font-bold text-white">{r.defPistolWinner}</span></p>
                          <p className="text-xs"><span className="text-muted-foreground">Rondas ganadas después:</span> <span className="font-bold text-white">{r.defPostRounds}</span></p>
                          {r.defPostNotes && <p className="text-xs text-white/70 italic">"{r.defPostNotes}"</p>}
                        </div>
                        {r.notes && (
                          <div className="col-span-2 text-xs text-white/60 italic">{r.notes}</div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* ── STATS POR MAPA ─────────────────────────────────────────── */}
          {view === 'stats' && globalByMap.length > 0 && (
            <div className="space-y-5">

              {/* Barras % pistola ATK ganada por mapa */}
              <div className="glass-card p-4">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">
                  % pistola ATK ganada por el equipo atacante — por mapa
                </p>
                <p className="text-[10px] text-muted-foreground mb-4">
                  Indica qué tan fuerte es el lado ATK pistola en cada mapa (todos los equipos del dataset).
                </p>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={globalByMap} barSize={18}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)"/>
                    <XAxis dataKey="map" tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.4)' }}/>
                    <YAxis domain={[0,100]} tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.4)' }} tickFormatter={v=>v+'%'}/>
                    <Tooltip content={<CT/>}/>
                    <ReferenceLine y={50} stroke="rgba(255,255,255,0.15)" strokeDasharray="4 4"/>
                    <Bar dataKey="atkWinPct" name="ATK%" radius={[3,3,0,0]}>
                      {globalByMap.map((d,i) => <Cell key={i} fill={pctColor(d.atkWinPct)}/>)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Rondas post-pistola por mapa */}
              <div className="glass-card p-4">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">
                  Rondas promedio ganadas post-pistola — por mapa
                </p>
                <p className="text-[10px] text-muted-foreground mb-4">
                  Cuántas rondas seguidas gana el ganador de la pistola ATK (amarillo) y DEF (azul).
                </p>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={globalByMap} barSize={14} barGap={3}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)"/>
                    <XAxis dataKey="map" tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.4)' }}/>
                    <YAxis tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.4)' }}/>
                    <Tooltip content={<CT/>}/>
                    <Legend wrapperStyle={{ fontSize: 10, paddingTop: 8 }}/>
                    <Bar dataKey="avgPostAtk" name="Post ATK (rondas)" fill="#f59e0b" radius={[3,3,0,0]}/>
                    <Bar dataKey="avgPostDef" name="Post DEF (rondas)" fill="#3b82f6" radius={[3,3,0,0]}/>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Tabla resumen */}
              <div className="glass-card p-4">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Resumen por mapa</p>
                <div className="overflow-x-auto rounded-xl border" style={{ borderColor: 'hsl(220 15% 15%)' }}>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="uppercase tracking-wider text-muted-foreground border-b text-left"
                        style={{ borderColor:'hsl(220 15% 15%)', background:'hsl(220 20% 9%)' }}>
                        <th className="px-3 py-2">Mapa</th>
                        <th className="px-3 py-2 text-center">Partidos</th>
                        <th className="px-3 py-2 text-yellow-400">ATK pistola %</th>
                        <th className="px-3 py-2 text-blue-400">DEF pistola %</th>
                        <th className="px-3 py-2">Post ATK avg</th>
                        <th className="px-3 py-2">Post DEF avg</th>
                      </tr>
                    </thead>
                    <tbody>
                      {globalByMap.map(d => (
                        <tr key={d.map} className="border-b hover:bg-white/3" style={{ borderColor:'hsl(220 15% 12%)' }}>
                          <td className="px-3 py-2 font-medium">{d.map}</td>
                          <td className="px-3 py-2 text-center text-muted-foreground">{d.total}</td>
                          <td className="px-3 py-2 w-32"><MiniBar v={d.atkWinPct} c={pctColor(d.atkWinPct)}/></td>
                          <td className="px-3 py-2 w-32"><MiniBar v={d.defWinPct} c={pctColor(d.defWinPct)}/></td>
                          <td className="px-3 py-2 font-mono text-yellow-400">{d.avgPostAtk}r</td>
                          <td className="px-3 py-2 font-mono text-blue-400">{d.avgPostDef}r</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ── STATS POR EQUIPO ───────────────────────────────────────── */}
          {view === 'team' && (
            <div className="space-y-3">
              {teamStats.length === 0 && (
                <div className="glass-card p-8 text-center text-muted-foreground text-sm">
                  Sin equipos en los registros filtrados.
                </div>
              )}
              {teamStats.map(ts => (
                <div key={ts.team} className="glass-card p-4 space-y-4">
                  {/* Header equipo */}
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-sm">{ts.team}</h3>
                      <p className="text-[10px] text-muted-foreground">
                        {ts.total} partidos observados · {ts.atkMatches} como ATK · {ts.defMatches} como DEF
                      </p>
                    </div>
                  </div>

                  {/* Pistola ATK / DEF */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <p className="text-[10px] font-bold text-yellow-400 uppercase tracking-wider">Pistola ATK (R1)</p>
                      <MiniBar v={ts.atkPistolPct} c={pctColor(ts.atkPistolPct)}/>
                      <p className="text-[9px] text-muted-foreground">{ts.atkPistolWins}/{ts.atkMatches} ganadas · avg {ts.avgAtkPost}r post</p>
                      {ts.atkNotes.length > 0 && (
                        <div className="space-y-0.5 mt-1">
                          {ts.atkNotes.map((n, i) => (
                            <p key={i} className="text-[10px] text-white/50 italic">• {n}</p>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <p className="text-[10px] font-bold text-blue-400 uppercase tracking-wider">Pistola DEF (R13)</p>
                      <MiniBar v={ts.defPistolPct} c={pctColor(ts.defPistolPct)}/>
                      <p className="text-[9px] text-muted-foreground">{ts.defPistolWins}/{ts.defMatches} ganadas · avg {ts.avgDefPost}r post</p>
                      {ts.defNotes.length > 0 && (
                        <div className="space-y-0.5 mt-1">
                          {ts.defNotes.map((n, i) => (
                            <p key={i} className="text-[10px] text-white/50 italic">• {n}</p>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Por mapa */}
                  {ts.byMap.length > 0 && (
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Por mapa</p>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        {ts.byMap.map(d => (
                          <div key={d.map} className="rounded-lg p-2.5 space-y-1.5" style={{ background: 'hsl(220 20% 9%)' }}>
                            <p className="text-[10px] font-bold text-white">{d.map}
                              <span className="text-muted-foreground font-normal ml-1">({d.total}p)</span>
                            </p>
                            <div>
                              <p className="text-[9px] text-yellow-400 mb-0.5">ATK</p>
                              <MiniBar v={d.atkPct} c={pctColor(d.atkPct)}/>
                            </div>
                            <div>
                              <p className="text-[9px] text-blue-400 mb-0.5">DEF</p>
                              <MiniBar v={d.defPct} c={pctColor(d.defPct)}/>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
