import { useState } from 'react';
import { cn } from '@/lib/utils';

const RIVAL_KEY = 'valoanalytics_rival_teams_v1';
const MAP_LIST = ['Ascent','Bind','Haven','Split','Pearl','Breeze','Abyss','Lotus','Fracture','Sunset','Icebox'];
const AGENTS = ['Jett','Raze','Reyna','Phoenix','Yoru','Neon','Iso','Brimstone','Omen','Viper','Astra','Harbor','Clove','Sova','Breach','Skye','KAYO','Fade','Gekko','Tejo','Cypher','Killjoy','Sage','Chamber','Deadlock'];
const ROLES = ['Duelist','Controller','Initiator','Sentinel','Flex'];
const TIERS = ['Tier 1','Tier 2','Tier 3','Amateurs','Universitario','Premier','Otro'];
const PLAY_STYLES = ['Aggro','Default','Passive','Structured','Chaotic','Fast-paced','Utility-heavy'];

interface RivalMatch { id: string; date: string; map: string; scoreUs: number; scoreOpp: number; won: boolean; notes: string; }
interface RivalPlayer { id: string; ign: string; mainAgent: string; role: string; acs: number; kd: number; hs: number; notes: string; }
interface RivalTeam { id: string; name: string; region: string; tier: string; mapPool: string[]; weakMaps: string[]; playStyle: string; notes: string; players: RivalPlayer[]; matches: RivalMatch[]; createdAt: number; }

function loadRivals(): RivalTeam[] { try { return JSON.parse(localStorage.getItem(RIVAL_KEY) || '[]'); } catch { return []; } }
function saveRivals(data: RivalTeam[]) { localStorage.setItem(RIVAL_KEY, JSON.stringify(data)); }
function emptyRival(): RivalTeam { return { id: crypto.randomUUID(), name: '', region: 'EU', tier: 'Premier', mapPool: [], weakMaps: [], playStyle: 'Default', notes: '', players: [], matches: [], createdAt: Date.now() }; }

export function RivalTeamProfiles() {
  const [rivals, setRivals] = useState<RivalTeam[]>(loadRivals);
  const [selected, setSelected] = useState<string | null>(null);
  const [editing, setEditing] = useState<RivalTeam | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [activeDetailTab, setActiveDetailTab] = useState<'overview'|'players'|'matches'>('overview');

  const persist = (data: RivalTeam[]) => { setRivals(data); saveRivals(data); };
  const selectedTeam = rivals.find(r => r.id === selected) || null;

  const openNew = () => { setEditing(emptyRival()); setIsFormOpen(true); };
  const openEdit = (t: RivalTeam) => { setEditing({ ...t, players: t.players.map(p=>({...p})), matches: t.matches.map(m=>({...m})), mapPool: [...t.mapPool], weakMaps: [...t.weakMaps] }); setIsFormOpen(true); };
  const saveTeam = () => {
    if (!editing || !editing.name.trim()) return;
    const exists = rivals.find(r => r.id === editing.id);
    persist(exists ? rivals.map(r => r.id === editing.id ? editing : r) : [...rivals, editing]);
    setIsFormOpen(false); setEditing(null);
  };
  const deleteTeam = (id: string) => { if (confirm('¿Eliminar equipo rival?')) { persist(rivals.filter(r => r.id !== id)); if (selected === id) setSelected(null); } };

  const addPlayer = () => { if (!editing) return; setEditing({ ...editing, players: [...editing.players, { id: crypto.randomUUID(), ign: '', mainAgent: 'Jett', role: 'Duelist', acs: 0, kd: 1.0, hs: 0, notes: '' }] }); };
  const updatePlayer = (idx: number, field: keyof RivalPlayer, value: any) => { if (!editing) return; setEditing({ ...editing, players: editing.players.map((p, i) => i === idx ? { ...p, [field]: value } : p) }); };
  const removePlayer = (idx: number) => { if (!editing) return; setEditing({ ...editing, players: editing.players.filter((_, i) => i !== idx) }); };

  const addMatch = () => { if (!editing) return; setEditing({ ...editing, matches: [...editing.matches, { id: crypto.randomUUID(), date: new Date().toISOString().split('T')[0], map: 'Ascent', scoreUs: 13, scoreOpp: 7, won: true, notes: '' }] }); };
  const updateMatch = (idx: number, field: keyof RivalMatch, value: any) => { if (!editing) return; setEditing({ ...editing, matches: editing.matches.map((m, i) => i === idx ? { ...m, [field]: value } : m) }); };
  const removeMatch = (idx: number) => { if (!editing) return; setEditing({ ...editing, matches: editing.matches.filter((_, i) => i !== idx) }); };
  const toggleMap = (map: string, field: 'mapPool' | 'weakMaps') => { if (!editing) return; const list = editing[field]; setEditing({ ...editing, [field]: list.includes(map) ? list.filter(m => m !== map) : [...list, map] }); };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{rivals.length} equipos rivales registrados</p>
        <button className="btn-primary text-sm flex items-center gap-1 h-9 px-3" onClick={openNew}>+ Nuevo equipo rival</button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Lista de equipos */}
        <div className="space-y-2">
          {rivals.length === 0 && (
            <div className="glass-card p-8 text-center text-muted-foreground text-sm">
              <p className="text-2xl mb-2">🎯</p>
              <p>Sin equipos rivales registrados.</p>
              <p className="text-xs mt-1">Crea un perfil para empezar.</p>
            </div>
          )}
          {rivals.map(team => {
            const wr = team.matches.length > 0 ? Math.round(team.matches.filter(m => m.won).length / team.matches.length * 100) : null;
            return (
              <div key={team.id} onClick={() => { setSelected(team.id); setActiveDetailTab('overview'); }}
                className={cn("glass-card p-4 cursor-pointer transition-all hover:border-white/20", selected === team.id && 'border-red-500/40')}>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-bold">{team.name}</p>
                    <p className="text-xs text-muted-foreground">{team.tier} · {team.region}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {team.matches.length} partidos{wr !== null ? ` · ${wr}% WR vs ellos` : ''}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <button className="text-xs text-blue-400 hover:text-blue-300 px-2 py-1" onClick={e => { e.stopPropagation(); openEdit(team); }}>✏</button>
                    <button className="text-xs text-red-400 hover:text-red-300 px-2 py-1" onClick={e => { e.stopPropagation(); deleteTeam(team.id); }}>✕</button>
                  </div>
                </div>
                {team.mapPool.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {team.mapPool.map(m => <span key={m} className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/15 text-green-400">{m}</span>)}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Panel de detalle */}
        {selectedTeam ? (
          <div className="lg:col-span-2 glass-card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold">{selectedTeam.name}</h3>
                <p className="text-sm text-muted-foreground">{selectedTeam.tier} · {selectedTeam.region} · {selectedTeam.playStyle}</p>
              </div>
              <button className="btn-secondary text-xs px-3 py-2" onClick={() => openEdit(selectedTeam)}>✏ Editar</button>
            </div>

            <div className="flex gap-1 p-1 rounded-lg" style={{ background: 'hsl(220 15% 12%)' }}>
              {(['overview','players','matches'] as const).map(t => (
                <button key={t} onClick={() => setActiveDetailTab(t)}
                  className={cn("flex-1 py-1.5 rounded text-xs font-medium transition-all",
                    activeDetailTab === t ? 'bg-white/10 text-white' : 'text-muted-foreground hover:text-foreground')}>
                  {t === 'overview' ? '📊 Resumen' : t === 'players' ? '👥 Jugadores' : '🎮 Partidos'}
                </button>
              ))}
            </div>

            {activeDetailTab === 'overview' && (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: 'Partidos vs ellos', value: selectedTeam.matches.length, color: 'text-white' },
                    { label: 'WR vs ellos', value: selectedTeam.matches.length > 0 ? `${Math.round(selectedTeam.matches.filter(m=>m.won).length/selectedTeam.matches.length*100)}%` : '—', color: selectedTeam.matches.length > 0 ? (selectedTeam.matches.filter(m=>m.won).length/selectedTeam.matches.length >= 0.5 ? 'text-green-400' : 'text-red-400') : 'text-white' },
                    { label: 'Jugadores', value: selectedTeam.players.length, color: 'text-white' },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="rounded-lg p-3 text-center" style={{ background: 'hsl(220 15% 10%)' }}>
                      <p className="text-xs text-muted-foreground">{label}</p>
                      <p className={cn("text-2xl font-bold", color)}>{value}</p>
                    </div>
                  ))}
                </div>
                {selectedTeam.mapPool.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">🟢 Mapas fuertes (pool)</p>
                    <div className="flex flex-wrap gap-1">{selectedTeam.mapPool.map(m => <span key={m} className="px-2 py-0.5 rounded bg-green-500/15 text-green-400 text-xs">{m}</span>)}</div>
                  </div>
                )}
                {selectedTeam.weakMaps.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">🔴 Mapas débiles</p>
                    <div className="flex flex-wrap gap-1">{selectedTeam.weakMaps.map(m => <span key={m} className="px-2 py-0.5 rounded bg-red-500/15 text-red-400 text-xs">{m}</span>)}</div>
                  </div>
                )}
                {selectedTeam.notes && (
                  <div className="rounded-lg p-3 text-sm" style={{ background: 'hsl(220 15% 10%)' }}>
                    <p className="text-xs text-muted-foreground mb-1">Notas del equipo</p>
                    <p>{selectedTeam.notes}</p>
                  </div>
                )}
              </div>
            )}

            {activeDetailTab === 'players' && (
              <div className="space-y-2">
                {selectedTeam.players.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">Sin jugadores registrados.</p>}
                {selectedTeam.players.map(p => (
                  <div key={p.id} className="rounded-lg p-3 flex items-center gap-3 flex-wrap" style={{ background: 'hsl(220 15% 10%)' }}>
                    <div className="flex-1 min-w-[120px]">
                      <p className="font-bold text-sm">{p.ign || '—'}</p>
                      <p className="text-xs text-muted-foreground">{p.role} · {p.mainAgent}</p>
                    </div>
                    <div className="flex gap-3 text-xs">
                      <div className="text-center"><p className="text-muted-foreground">ACS</p><p className="font-bold text-yellow-400">{p.acs}</p></div>
                      <div className="text-center"><p className="text-muted-foreground">K/D</p><p className="font-bold">{p.kd}</p></div>
                      <div className="text-center"><p className="text-muted-foreground">HS%</p><p className="font-bold">{p.hs}%</p></div>
                    </div>
                    {p.notes && <p className="text-xs text-muted-foreground w-full border-t border-white/5 pt-2 mt-1">📝 {p.notes}</p>}
                  </div>
                ))}
              </div>
            )}

            {activeDetailTab === 'matches' && (
              <div className="space-y-2">
                {selectedTeam.matches.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">Sin partidos registrados.</p>}
                {[...selectedTeam.matches].sort((a,b) => new Date(b.date).getTime()-new Date(a.date).getTime()).map(m => (
                  <div key={m.id} className={cn("rounded-lg p-3 flex items-center gap-3 flex-wrap border", m.won ? 'bg-green-500/10 border-green-500/20' : 'bg-red-500/10 border-red-500/20')}>
                    <span className={cn("font-bold text-sm", m.won ? 'text-green-400' : 'text-red-400')}>{m.won ? '✓ Victoria' : '✗ Derrota'}</span>
                    <span className="font-mono text-white font-bold">{m.scoreUs} — {m.scoreOpp}</span>
                    <span className="text-sm text-muted-foreground">{m.map}</span>
                    <span className="text-xs text-muted-foreground ml-auto">{m.date}</span>
                    {m.notes && <p className="text-xs text-muted-foreground w-full border-t border-white/5 pt-2">📝 {m.notes}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="lg:col-span-2 glass-card p-12 flex items-center justify-center text-muted-foreground text-sm">
            ← Selecciona un equipo rival para ver su perfil
          </div>
        )}
      </div>

      {/* Formulario modal */}
      {isFormOpen && editing && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70">
          <div className="flex min-h-full items-start justify-center p-4 py-6">
          <div className="w-full max-w-3xl rounded-2xl border border-white/10 p-6 space-y-5"
            style={{ background: 'hsl(220 22% 8%)' }}>
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-lg">Perfil de Equipo Rival</h3>
              <button className="text-muted-foreground hover:text-white text-xl" onClick={() => setIsFormOpen(false)}>✕</button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="text-xs text-muted-foreground block mb-1">Nombre del equipo *</label>
                <input className="input-pro w-full" value={editing.name} onChange={e => setEditing({...editing, name: e.target.value})} placeholder="Nombre del equipo..." />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Región</label>
                <input className="input-pro w-full" value={editing.region} onChange={e => setEditing({...editing, region: e.target.value})} placeholder="EU, NA, LATAM..." />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Nivel / Tier</label>
                <select className="input-pro w-full" value={editing.tier} onChange={e => setEditing({...editing, tier: e.target.value})}>
                  {TIERS.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <label className="text-xs text-muted-foreground block mb-1">Estilo de juego</label>
                <div className="flex flex-wrap gap-1">
                  {PLAY_STYLES.map(s => (
                    <button key={s} type="button" onClick={() => setEditing({...editing, playStyle: s})}
                      className={cn("px-3 py-1 rounded text-xs border transition-all",
                        editing.playStyle === s ? 'bg-red-500/30 border-red-500 text-red-300' : 'bg-white/5 border-white/10 text-muted-foreground hover:bg-white/10')}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <label className="text-xs text-muted-foreground block mb-2">🟢 Mapas fuertes</label>
              <div className="flex flex-wrap gap-1">
                {MAP_LIST.map(m => (
                  <button key={m} type="button" onClick={() => toggleMap(m, 'mapPool')}
                    className={cn("px-2 py-1 rounded text-xs border transition-all",
                      editing.mapPool.includes(m) ? 'bg-green-500/30 border-green-500 text-green-300' : 'bg-white/5 border-white/10 text-muted-foreground hover:bg-white/10')}>
                    {m}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs text-muted-foreground block mb-2">🔴 Mapas débiles</label>
              <div className="flex flex-wrap gap-1">
                {MAP_LIST.map(m => (
                  <button key={m} type="button" onClick={() => toggleMap(m, 'weakMaps')}
                    className={cn("px-2 py-1 rounded text-xs border transition-all",
                      editing.weakMaps.includes(m) ? 'bg-red-500/30 border-red-500 text-red-300' : 'bg-white/5 border-white/10 text-muted-foreground hover:bg-white/10')}>
                    {m}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs text-muted-foreground block mb-1">Notas del equipo</label>
              <textarea className="input-pro w-full h-16 resize-none text-sm" value={editing.notes}
                onChange={e => setEditing({...editing, notes: e.target.value})}
                placeholder="Tendencias, puntos débiles, composiciones habituales..." />
            </div>

            {/* Jugadores */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-semibold text-white">👥 Jugadores</label>
                <button type="button" className="btn-secondary text-xs px-3 py-1" onClick={addPlayer}>+ Añadir</button>
              </div>
              {editing.players.map((p, idx) => (
                <div key={p.id} className="rounded-lg p-3 space-y-2" style={{ background: 'hsl(220 15% 10%)' }}>
                  <div className="grid grid-cols-3 gap-2">
                    <input className="input-pro text-xs" placeholder="IGN" value={p.ign} onChange={e => updatePlayer(idx,'ign',e.target.value)} />
                    <select className="input-pro text-xs" value={p.mainAgent} onChange={e => updatePlayer(idx,'mainAgent',e.target.value)}>
                      {AGENTS.map(a => <option key={a}>{a}</option>)}
                    </select>
                    <select className="input-pro text-xs" value={p.role} onChange={e => updatePlayer(idx,'role',e.target.value)}>
                      {ROLES.map(r => <option key={r}>{r}</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    <div><label className="text-[10px] text-muted-foreground">ACS</label><input type="number" className="input-pro text-xs w-full" value={p.acs} onChange={e => updatePlayer(idx,'acs',parseFloat(e.target.value)||0)} /></div>
                    <div><label className="text-[10px] text-muted-foreground">K/D</label><input type="number" step="0.01" className="input-pro text-xs w-full" value={p.kd} onChange={e => updatePlayer(idx,'kd',parseFloat(e.target.value)||0)} /></div>
                    <div><label className="text-[10px] text-muted-foreground">HS%</label><input type="number" className="input-pro text-xs w-full" value={p.hs} onChange={e => updatePlayer(idx,'hs',parseFloat(e.target.value)||0)} /></div>
                    <div className="flex items-end"><button type="button" className="w-full py-2 text-xs text-red-400 hover:text-red-300" onClick={() => removePlayer(idx)}>✕ Quitar</button></div>
                  </div>
                  <input className="input-pro text-xs w-full" placeholder="Notas sobre el jugador..." value={p.notes} onChange={e => updatePlayer(idx,'notes',e.target.value)} />
                </div>
              ))}
            </div>

            {/* Partidos */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-semibold text-white">🎮 Partidos vs este equipo</label>
                <button type="button" className="btn-secondary text-xs px-3 py-1" onClick={addMatch}>+ Añadir</button>
              </div>
              {editing.matches.map((m, idx) => (
                <div key={m.id} className="rounded-lg p-3 space-y-2" style={{ background: 'hsl(220 15% 10%)' }}>
                  <div className="grid grid-cols-5 gap-2 items-end">
                    <div><label className="text-[10px] text-muted-foreground">Fecha</label><input type="date" className="input-pro text-xs w-full" value={m.date} onChange={e => updateMatch(idx,'date',e.target.value)} /></div>
                    <div><label className="text-[10px] text-muted-foreground">Mapa</label>
                      <select className="input-pro text-xs w-full" value={m.map} onChange={e => updateMatch(idx,'map',e.target.value)}>
                        {MAP_LIST.map(mp => <option key={mp}>{mp}</option>)}
                      </select>
                    </div>
                    <div><label className="text-[10px] text-muted-foreground">Score Us</label><input type="number" className="input-pro text-xs w-full text-center" value={m.scoreUs} onChange={e => updateMatch(idx,'scoreUs',parseInt(e.target.value)||0)} /></div>
                    <div><label className="text-[10px] text-muted-foreground">Score Ellos</label><input type="number" className="input-pro text-xs w-full text-center" value={m.scoreOpp} onChange={e => updateMatch(idx,'scoreOpp',parseInt(e.target.value)||0)} /></div>
                    <div className="flex gap-1 items-end pb-0.5">
                      <button type="button" onClick={() => updateMatch(idx,'won',!m.won)}
                        className={cn("flex-1 py-1.5 rounded text-xs font-bold border transition-all",
                          m.won ? 'bg-green-500/30 border-green-500 text-green-300' : 'bg-red-500/30 border-red-500 text-red-300')}>
                        {m.won ? '✓ Win' : '✗ Loss'}
                      </button>
                      <button type="button" className="text-red-400 text-xs px-2 py-1.5" onClick={() => removeMatch(idx)}>✕</button>
                    </div>
                  </div>
                  <input className="input-pro text-xs w-full" placeholder="Notas del partido..." value={m.notes} onChange={e => updateMatch(idx,'notes',e.target.value)} />
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button className="btn-secondary" onClick={() => setIsFormOpen(false)}>Cancelar</button>
              <button className="btn-primary" onClick={saveTeam} disabled={!editing.name.trim()}>Guardar Equipo</button>
            </div>
          </div>
          </div>
        </div>
      )}
    </div>
  );
}
