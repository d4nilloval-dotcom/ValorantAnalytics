import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Swords, Loader2, Sparkles, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import { callClaude, getAnthropicKey } from '@/lib/claudeApi';
import { AnthropicKeyBanner } from './AIMatchAnalysis';

const RIVAL_KEY = 'valoanalytics_rival_teams_v1';
const STRAT_CACHE_KEY = 'valoanalytics_rival_strats_v1';

const VALORANT_MAPS_LIST = ['Ascent','Bind','Haven','Split','Pearl','Breeze','Abyss','Lotus','Fracture','Sunset','Icebox'];

interface RivalMatch { id: string; date: string; map: string; scoreUs: number; scoreOpp: number; won: boolean; notes: string; }
interface RivalPlayer { id: string; ign: string; mainAgent: string; role: string; acs: number; kd: number; hs: number; notes: string; }
interface RivalTeam { id: string; name: string; region: string; tier: string; mapPool: string[]; weakMaps: string[]; playStyle: string; notes: string; players: RivalPlayer[]; matches: RivalMatch[]; createdAt: number; }

interface GeneratedStrat { rivalId: string; map: string; text: string; createdAt: number; }

function loadRivals(): RivalTeam[] { try { return JSON.parse(localStorage.getItem(RIVAL_KEY) || '[]'); } catch { return []; } }
function loadStrats(): Record<string, GeneratedStrat> { try { return JSON.parse(localStorage.getItem(STRAT_CACHE_KEY) || '{}'); } catch { return {}; } }
function saveStrat(key: string, strat: GeneratedStrat) {
  const all = loadStrats(); all[key] = strat;
  localStorage.setItem(STRAT_CACHE_KEY, JSON.stringify(all));
}


function buildStratPrompt(rival: RivalTeam, map: string, ourMapStats: string): string {
  const matchHistory = rival.matches.length > 0
    ? `\nHistorial vs este equipo (${rival.matches.length} partidos):
${rival.matches.slice(-5).map(m => `  - ${m.date} ${m.map}: ${m.won ? 'VICTORIA' : 'DERROTA'} ${m.scoreUs}-${m.scoreOpp}${m.notes ? ' — ' + m.notes : ''}`).join('\n')}`
    : '';

  const playerList = rival.players.length > 0
    ? `\nJugadores conocidos:
${rival.players.map(p => `  - ${p.ign} (${p.mainAgent}, ${p.role}): ACS ${p.acs}, K/D ${p.kd}, HS ${p.hs}%${p.notes ? ' — ' + p.notes : ''}`).join('\n')}`
    : '\nNo hay datos de jugadores registrados.';

  return `Eres un coach experto de Valorant. Genera un plan de preparación para jugar contra el siguiente equipo rival.

EQUIPO RIVAL: ${rival.name}
- Nivel: ${rival.tier} | Región: ${rival.region}
- Estilo de juego: ${rival.playStyle}
- Mapas fuertes (pool): ${rival.mapPool.length > 0 ? rival.mapPool.join(', ') : 'desconocido'}
- Mapas débiles: ${rival.weakMaps.length > 0 ? rival.weakMaps.join(', ') : 'desconocido'}
- Notas del scout: ${rival.notes || 'ninguna'}${playerList}${matchHistory}

MAPA A PREPARAR: ${map}
${ourMapStats}

Genera un plan de preparación en español con exactamente estas secciones (en negrita):

**Análisis del rival en ${map}**
**Composición recomendada (5 agentes)**
**Plan de ataque**
**Plan de defensa**
**Puntos clave a explotar**
**Amenazas a vigilar**
**Ejercicios de preparación**

Sé muy específico y técnico. Nombra localizaciones concretas del mapa, utilidades específicas de agentes y timings. Máximo 6 párrafos cortos en total.`;
}

function formatText(text: string) {
  return text.split('\n').map((line, i) => {
    const isBoldLine = line.startsWith('**') && line.endsWith('**');
    const parts = line.split(/(\*\*[^*]+\*\*)/g);
    return (
      <p key={i} className={cn("leading-relaxed", isBoldLine ? "font-bold text-white mt-4 mb-1 text-sm border-l-2 border-red-500/50 pl-2" : "text-sm text-muted-foreground")}>
        {isBoldLine ? line.slice(2, -2) : parts.map((p, j) =>
          p.startsWith('**') && p.endsWith('**')
            ? <strong key={j} className="text-white">{p.slice(2, -2)}</strong> : p
        )}
      </p>
    );
  });
}

export function RivalStrategyGenerator() {
  const { matches } = useAppStore();
  const [rivals] = useState<RivalTeam[]>(loadRivals);
  const [strats, setStrats] = useState<Record<string, GeneratedStrat>>(loadStrats);
  const [selectedRival, setSelectedRival] = useState<string | null>(null);
  const [selectedMap, setSelectedMap] = useState('Ascent');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [hasKey, setHasKey] = useState(() => !!getAnthropicKey());

  const rival = rivals.find(r => r.id === selectedRival) || null;

  // Build our map stats string for context
  const ourMapStats = (() => {
    const mapMatches = Object.values(matches).filter((m: any) => m.map === selectedMap);
    if (mapMatches.length === 0) return 'Sin datos propios en este mapa.';
    const wins = mapMatches.filter((m: any) => m.won).length;
    const wr = Math.round(wins / mapMatches.length * 100);
    const avgAtk = mapMatches.reduce((s: number, m: any) => s + (m.atk || 0), 0) / mapMatches.length;
    const avgDef = mapMatches.reduce((s: number, m: any) => s + (m.def || 0), 0) / mapMatches.length;
    return `Nuestros datos en ${selectedMap}: ${mapMatches.length} partidos, ${wr}% WR, media ${avgAtk.toFixed(1)} rondas ATK / ${avgDef.toFixed(1)} rondas DEF.`;
  })();

  const generate = async () => {
    if (!rival) return;
    setIsLoading(true);
    setError(null);
    try {
      const prompt = buildStratPrompt(rival, selectedMap, ourMapStats);
      const text = await callClaude(prompt, 1200);
      const key = `${rival.id}_${selectedMap}`;
      const strat: GeneratedStrat = { rivalId: rival.id, map: selectedMap, text, createdAt: Date.now() };
      saveStrat(key, strat);
      setStrats(loadStrats());
      setExpandedKey(key);
    } catch (e: any) {
      if (e.message === 'NO_KEY') {
        setError('Configura tu API key de Anthropic primero (ver banner arriba).');
      } else if (e.message?.includes('fetch') || e.message?.includes('Failed')) {
        setError('No se puede conectar con el proxy. ¿Tienes "node proxy-server.cjs" corriendo en terminal?');
      } else {
        setError('Error IA: ' + e.message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const currentKey = rival ? `${rival.id}_${selectedMap}` : null;
  const currentStrat = currentKey ? strats[currentKey] : null;

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="glass-card p-5">
        <h2 className="text-xl font-bold flex items-center gap-2 mb-1">
          <Swords className="w-5 h-5 text-red-400" /> Generador de Estrategias por Rival
        </h2>
        <p className="text-sm text-muted-foreground">
          Selecciona un equipo rival y un mapa. La IA generará un plan de preparación completo basado en los datos de scouting.
        </p>
      </div>

      {rivals.length === 0 ? (
        <div className="glass-card p-10 text-center text-muted-foreground">
          <Swords className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>Sin equipos rivales registrados.</p>
          <p className="text-sm mt-1">Ve a Scouting → Perfiles de Equipos Rivales para añadir tu primer rival.</p>
        </div>
      ) : (
        <>
          {/* Banners de configuración */}
          <div className="rounded-xl border border-blue-500/25 bg-blue-500/8 p-4 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-base">🖥</span>
              <p className="text-sm font-semibold text-blue-300">Proxy local requerido</p>
            </div>
            <p className="text-xs text-muted-foreground">La IA necesita el proxy local para funcionar. Asegúrate de tener en terminal:</p>
            <code className="block bg-black/40 rounded px-3 py-2 text-xs text-green-400 font-mono">node proxy-server.cjs</code>
          </div>
          {!hasKey && <AnthropicKeyBanner onSaved={() => setHasKey(true)} />}
          {hasKey && (
            <div className="flex items-center justify-between px-1">
              <span className="text-xs text-green-400 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-green-400 inline-block" /> API Key configurada
              </span>
              <button className="text-xs text-muted-foreground hover:text-white underline"
                onClick={() => setHasKey(false)}>Cambiar key</button>
            </div>
          )}
          {/* Config panel */}
          <div className="glass-card p-5 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-muted-foreground block mb-2">Equipo rival</label>
                <div className="space-y-2">
                  {rivals.map(r => {
                    const wr = r.matches.length > 0
                      ? Math.round(r.matches.filter(m => m.won).length / r.matches.length * 100)
                      : null;
                    return (
                      <button key={r.id} onClick={() => setSelectedRival(r.id)}
                        className={cn("w-full text-left p-3 rounded-lg border transition-all",
                          selectedRival === r.id
                            ? 'border-red-500/40 bg-red-500/10'
                            : 'border-white/10 bg-white/5 hover:border-white/20')}>
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-bold text-sm">{r.name}</p>
                            <p className="text-xs text-muted-foreground">{r.tier} · {r.playStyle}</p>
                          </div>
                          {wr !== null && (
                            <span className={cn("text-xs font-bold px-2 py-0.5 rounded",
                              wr >= 50 ? 'text-green-400 bg-green-500/15' : 'text-red-400 bg-red-500/15')}>
                              {wr}% WR
                            </span>
                          )}
                        </div>
                        {r.mapPool.length > 0 && (
                          <div className="flex gap-1 mt-1.5 flex-wrap">
                            {r.mapPool.map(m => <span key={m} className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/15 text-green-400">{m}</span>)}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-xs text-muted-foreground block mb-2">Mapa a preparar</label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {VALORANT_MAPS_LIST.map(m => (
                      <button key={m} onClick={() => setSelectedMap(m)}
                        className={cn("py-1.5 px-2 rounded text-xs font-medium border transition-all",
                          selectedMap === m
                            ? 'bg-red-500/20 border-red-500/40 text-red-300'
                            : 'bg-white/5 border-white/10 text-muted-foreground hover:bg-white/10')}>
                        {m}
                      </button>
                    ))}
                  </div>
                </div>

                {rival && (
                  <div className="rounded-lg p-3 space-y-1" style={{ background: 'hsl(220 15% 10%)' }}>
                    <p className="text-xs font-semibold text-white">Contexto disponible para {rival.name}:</p>
                    <p className="text-xs text-muted-foreground">
                      {rival.players.length} jugadores · {rival.matches.length} partidos · {rival.mapPool.length} mapas fuertes
                    </p>
                    <p className="text-xs text-muted-foreground">{ourMapStats}</p>
                  </div>
                )}

                <button
                  onClick={generate}
                  disabled={!rival || isLoading}
                  className={cn("w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all",
                    !rival ? 'opacity-40 cursor-not-allowed bg-white/5 border border-white/10 text-muted-foreground' :
                    isLoading ? 'bg-purple-500/20 border border-purple-500/30 text-purple-400 cursor-wait' :
                    'bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white shadow-lg shadow-red-900/20 border border-red-500/30'
                  )}>
                  {isLoading
                    ? <><Loader2 className="w-4 h-4 animate-spin" />Generando estrategia...</>
                    : currentStrat
                    ? <><RefreshCw className="w-4 h-4" />Regenerar estrategia</>
                    : <><Sparkles className="w-4 h-4" />Generar plan de preparación</>
                  }
                </button>
              </div>
            </div>
          </div>

          {error && (
            <div className="glass-card p-4 bg-red-500/10 border-red-500/20 text-sm text-red-400">{error}</div>
          )}

          {/* Result */}
          {currentStrat && (
            <div className="glass-card p-5 space-y-4 border-red-500/20">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-base flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-yellow-400" />
                    Plan: {rival?.name} en {currentStrat.map}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Generado el {new Date(currentStrat.createdAt).toLocaleString('es-ES')}
                  </p>
                </div>
                <button onClick={() => setExpandedKey(expandedKey === currentKey ? null : currentKey!)}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-white">
                  {expandedKey === currentKey ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  {expandedKey === currentKey ? 'Ocultar' : 'Mostrar'}
                </button>
              </div>

              {expandedKey === currentKey && (
                <div className="border-t border-white/10 pt-4 space-y-0.5">
                  {formatText(currentStrat.text)}
                </div>
              )}
            </div>
          )}

          {/* All generated strats history */}
          {Object.values(strats).filter(s => rivals.some(r => r.id === s.rivalId)).length > 0 && (
            <div className="glass-card p-5 space-y-3">
              <h3 className="font-semibold text-sm text-muted-foreground">Estrategias generadas anteriormente</h3>
              <div className="space-y-2">
                {Object.entries(strats)
                  .filter(([, s]) => rivals.some(r => r.id === s.rivalId))
                  .sort(([, a], [, b]) => b.createdAt - a.createdAt)
                  .slice(0, 10)
                  .map(([key, s]) => {
                    const r = rivals.find(rv => rv.id === s.rivalId);
                    const isOpen = expandedKey === key;
                    return (
                      <div key={key} className="rounded-lg border border-white/10 overflow-hidden">
                        <button onClick={() => setExpandedKey(isOpen ? null : key)}
                          className="w-full flex items-center justify-between p-3 hover:bg-white/5 transition-colors">
                          <div className="flex items-center gap-3">
                            <span className="text-xs px-2 py-0.5 rounded bg-red-500/15 text-red-400 border border-red-500/20">{s.map}</span>
                            <span className="text-sm font-medium">{r?.name || 'Equipo eliminado'}</span>
                            <span className="text-xs text-muted-foreground">{new Date(s.createdAt).toLocaleDateString('es-ES')}</span>
                          </div>
                          {isOpen ? <ChevronUp className="w-3 h-3 text-muted-foreground" /> : <ChevronDown className="w-3 h-3 text-muted-foreground" />}
                        </button>
                        {isOpen && (
                          <div className="px-4 pb-4 border-t border-white/5 pt-3 space-y-0.5">
                            {formatText(s.text)}
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
