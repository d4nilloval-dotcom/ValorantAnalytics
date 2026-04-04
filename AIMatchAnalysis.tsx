import { useState } from 'react';
import { useAppStore } from '@/store/appStore';
import { cn } from '@/lib/utils';
import { Brain, Loader2, ChevronDown, ChevronUp, Sparkles, Key, Eye, EyeOff, Wifi, WifiOff } from 'lucide-react';
import { callClaude, getAnthropicKey, setAnthropicKey, testProxyConnection } from '@/lib/claudeApi';

const AI_ANALYSES_KEY = 'valoanalytics_ai_analyses_v1';

interface StoredAnalysis {
  matchId: string;
  text: string;
  createdAt: number;
}

function loadAnalyses(): Record<string, StoredAnalysis> {
  try { return JSON.parse(localStorage.getItem(AI_ANALYSES_KEY) || '{}'); } catch { return {}; }
}
function saveAnalysis(matchId: string, text: string) {
  const all = loadAnalyses();
  all[matchId] = { matchId, text, createdAt: Date.now() };
  localStorage.setItem(AI_ANALYSES_KEY, JSON.stringify(all));
}

// Componente reutilizable para configurar la API key
export function AnthropicKeyBanner({ onSaved }: { onSaved?: () => void }) {
  const [key, setKey] = useState(getAnthropicKey());
  const [show, setShow] = useState(false);
  const [saved, setSaved] = useState(false);

  const save = () => {
    setAnthropicKey(key.trim());
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    onSaved?.();
  };

  return (
    <div className="rounded-xl border border-yellow-500/25 bg-yellow-500/8 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Key className="w-4 h-4 text-yellow-400" />
        <p className="text-sm font-semibold text-yellow-300">API Key de Anthropic requerida</p>
      </div>
      <p className="text-xs text-muted-foreground">
        La IA necesita tu API key personal de Anthropic. Se guarda solo en tu navegador (localStorage), nunca se envía a ningún servidor externo.
        Consíguela en <span className="text-yellow-400">console.anthropic.com</span>
      </p>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            type={show ? 'text' : 'password'}
            className="input-pro w-full pr-9 font-mono text-xs"
            placeholder="sk-ant-api03-..."
            value={key}
            onChange={e => setKey(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && save()}
          />
          <button className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-white"
            onClick={() => setShow(!show)}>
            {show ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          </button>
        </div>
        <button onClick={save} disabled={!key.trim()}
          className={cn("px-4 py-2 rounded-lg text-xs font-bold border transition-all",
            saved ? 'bg-green-500/20 border-green-500/40 text-green-400'
                  : 'bg-yellow-500/20 border-yellow-500/40 text-yellow-300 hover:bg-yellow-500/30')}>
          {saved ? '✓ Guardada' : 'Guardar'}
        </button>
      </div>
    </div>
  );
}

function ProxyBanner() {
  const [status, setStatus] = useState<'idle' | 'testing' | 'ok' | 'fail'>('idle');

  const test = async () => {
    setStatus('testing');
    const ok = await testProxyConnection();
    setStatus(ok ? 'ok' : 'fail');
    // Reset tras 5s
    setTimeout(() => setStatus('idle'), 5000);
  };

  return (
    <div className={cn("rounded-xl border p-4 space-y-2 transition-colors",
      status === 'ok'   ? 'border-green-500/30 bg-green-500/8' :
      status === 'fail' ? 'border-red-500/30 bg-red-500/8' :
                          'border-blue-500/25 bg-blue-500/8')}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-base">🖥</span>
          <p className={cn("text-sm font-semibold",
            status === 'ok' ? 'text-green-300' : status === 'fail' ? 'text-red-300' : 'text-blue-300')}>
            Proxy local requerido
          </p>
        </div>
        <button onClick={test} disabled={status === 'testing'}
          className={cn("flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-all",
            status === 'ok'      ? 'border-green-500/40 bg-green-500/15 text-green-300' :
            status === 'fail'    ? 'border-red-500/40 bg-red-500/15 text-red-300' :
            status === 'testing' ? 'border-white/10 text-muted-foreground cursor-wait' :
                                   'border-blue-500/30 bg-blue-500/15 text-blue-300 hover:bg-blue-500/25 cursor-pointer')}>
          {status === 'testing' ? <><Loader2 className="w-3 h-3 animate-spin" />Probando...</> :
           status === 'ok'      ? <><Wifi className="w-3 h-3" />Conectado ✓</> :
           status === 'fail'    ? <><WifiOff className="w-3 h-3" />Sin conexión</> :
                                  <><Wifi className="w-3 h-3" />Probar conexión</>}
        </button>
      </div>

      {status === 'fail' ? (
        <div className="text-xs text-red-300 space-y-1">
          <p>❌ El proxy no responde. Pasos para arreglarlo:</p>
          <p className="text-muted-foreground">1. Abre una terminal en la carpeta del proyecto</p>
          <p className="text-muted-foreground">2. Ejecuta el comando:</p>
          <code className="block bg-black/40 rounded px-3 py-2 text-green-400 font-mono">node proxy-server.cjs</code>
          <p className="text-muted-foreground">3. Deja esa terminal abierta y pulsa "Probar conexión" de nuevo</p>
        </div>
      ) : status === 'ok' ? (
        <p className="text-xs text-green-400">✅ Proxy corriendo correctamente en localhost:3001</p>
      ) : (
        <div className="text-xs text-muted-foreground space-y-1">
          <p>La IA necesita el proxy para evitar errores CORS. Asegúrate de tener en terminal:</p>
          <code className="block bg-black/40 rounded px-3 py-2 text-green-400 font-mono">node proxy-server.cjs</code>
          <p>Luego pulsa "Probar conexión" para verificar.</p>
        </div>
      )}
    </div>
  );
}


function buildMatchPrompt(match: any, players: any[]): string {
  const totalRounds = match.scoreUs + match.scoreOpp + (match.otWin || 0) + (match.otLoss || 0);
  const roundData = match.rounds?.length > 0
    ? `\nRondas registradas: ${match.rounds.length}
      - ECO: ${match.rounds.filter((r:any)=>r.buyType==='ECO').length} rondas (${match.rounds.filter((r:any)=>r.buyType==='ECO'&&r.outcome==='WIN').length} ganadas)
      - Force: ${match.rounds.filter((r:any)=>r.buyType==='FORCE').length} rondas (${match.rounds.filter((r:any)=>r.buyType==='FORCE'&&r.outcome==='WIN').length} ganadas)
      - Full Buy: ${match.rounds.filter((r:any)=>r.buyType==='FULL').length} rondas (${match.rounds.filter((r:any)=>r.buyType==='FULL'&&r.outcome==='WIN').length} ganadas)`
    : '';

  const playerData = players.length > 0
    ? '\nJugadores:\n' + players.map((p: any) =>
        `  - ${p.name} (${p.agent}): ${p.k}/${p.d}/${p.a} KDA, ACS ${p.acs}, KAST ${p.kast}%, FK ${p.fk}`
      ).join('\n')
    : '';

  const tournamentStats = match.tournamentPlayerStats?.length > 0
    ? '\nStats de torneo:\n' + match.tournamentPlayerStats.map((t: any) =>
        `  - ${t.playerName}: HS${t.hsPercent}%, MK${t.multiKills}, ADR${t.adr}, ECON${t.econRating}`
      ).join('\n')
    : '';

  return `Eres el analista de un equipo de Valorant competitivo. Analiza este partido y genera un informe breve pero muy útil para el coach.

PARTIDO:
- Resultado: ${match.won ? 'VICTORIA' : 'DERROTA'} ${match.scoreUs}-${match.scoreOpp} en ${match.map}
- Tipo: ${match.type} | Fecha: ${match.date}
- Rondas totales: ${totalRounds} (ATK ganadas: ${match.atk}, DEF ganadas: ${match.def})
- Pistol ATK: ${match.pistolAtkWin ? 'GANADO' : 'PERDIDO'} | Pistol DEF: ${match.pistolDefWin ? 'GANADO' : 'PERDIDO'}
- Post-plant: ${match.postWin} ganados / ${match.postLoss} perdidos
- Retakes: ${match.retakeWin} ganados / ${match.retakeLoss} perdidos${roundData}${playerData}${tournamentStats}
${match.notes ? `\nNotas del partido: ${match.notes}` : ''}

INSTRUCCIONES:
Genera un análisis en español de máximo 5 párrafos cortos con estas secciones (usa exactamente estos encabezados en negrita):
**Resumen del partido**
**Puntos fuertes**
**Puntos débiles**
**Jugadores destacados**
**Recomendaciones para entrenar**

Sé directo, técnico y accionable. No uses bullet points, escribe en prosa concisa.`;
}

export function MatchAIAnalysis({ matchId }: { matchId: string }) {
  const { matches, players } = useAppStore();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analyses, setAnalyses] = useState<Record<string, StoredAnalysis>>(loadAnalyses);
  const [isExpanded, setIsExpanded] = useState(false);

  const match = matches[matchId];
  const matchPlayers = players[matchId] || [];
  const existing = analyses[matchId];

  const generate = async () => {
    if (!match) return;
    setIsLoading(true);
    setError(null);
    try {
      const prompt = buildMatchPrompt(match, matchPlayers);
      const text = await callClaude(prompt);
      saveAnalysis(matchId, text);
      setAnalyses(loadAnalyses());
      setIsExpanded(true);
    } catch (e: any) {
      setError('Error al conectar con la IA. Verifica que la app está funcionando correctamente.');
    } finally {
      setIsLoading(false);
    }
  };

  // Format markdown-style bold
  const formatText = (text: string) => {
    return text.split('\n').map((line, i) => {
      if (line.startsWith('**') && line.endsWith('**')) {
        return <p key={i} className="font-bold text-white mt-3 mb-1 text-sm">{line.slice(2, -2)}</p>;
      }
      // inline bold
      const parts = line.split(/(\*\*[^*]+\*\*)/g);
      return (
        <p key={i} className="text-sm text-muted-foreground leading-relaxed">
          {parts.map((part, j) =>
            part.startsWith('**') && part.endsWith('**')
              ? <strong key={j} className="text-white font-bold">{part.slice(2, -2)}</strong>
              : part
          )}
        </p>
      );
    });
  };

  return (
    <div className={cn("rounded-xl border p-4 space-y-3 transition-all",
      existing ? 'border-purple-500/20 bg-purple-500/5' : 'border-white/10')}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="w-4 h-4 text-purple-400" />
          <span className="text-sm font-medium text-white">Análisis IA</span>
          {existing && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400 border border-purple-500/30">
              Generado {new Date(existing.createdAt).toLocaleDateString('es-ES')}
            </span>
          )}
        </div>
        <div className="flex gap-2">
          {existing && (
            <button onClick={() => setIsExpanded(!isExpanded)}
              className="text-xs text-muted-foreground hover:text-white flex items-center gap-1">
              {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              {isExpanded ? 'Ocultar' : 'Ver'}
            </button>
          )}
          <button onClick={generate} disabled={isLoading}
            className={cn("flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-all",
              isLoading
                ? 'border-purple-500/30 bg-purple-500/10 text-purple-400 cursor-wait'
                : 'border-purple-500/40 bg-purple-500/15 text-purple-300 hover:bg-purple-500/25'
            )}>
            {isLoading
              ? <><Loader2 className="w-3 h-3 animate-spin" />Analizando...</>
              : <><Sparkles className="w-3 h-3" />{existing ? 'Regenerar' : 'Analizar con IA'}</>
            }
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg p-3 bg-red-500/10 border border-red-500/20 text-xs text-red-400">{error}</div>
      )}

      {isExpanded && existing && (
        <div className="border-t border-white/10 pt-3 space-y-0.5">
          {formatText(existing.text)}
        </div>
      )}
    </div>
  );
}

// ── Panel de selección de partido para analizar (página completa) ──────────────
export function AIMatchAnalysisPage() {
  const { matches, players } = useAppStore();
  const [selectedMatch, setSelectedMatch] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analyses, setAnalyses] = useState<Record<string, StoredAnalysis>>(loadAnalyses);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [hasKey, setHasKey] = useState(() => !!getAnthropicKey());

  const matchList = Object.values(matches).sort((a: any, b: any) => b.createdAt - a.createdAt);

  const generate = async (matchId: string) => {
    const match = matches[matchId];
    if (!match) return;
    setIsLoading(true);
    setError(null);
    setSelectedMatch(matchId);
    try {
      const matchPlayers = players[matchId] || [];
      const prompt = buildMatchPrompt(match, matchPlayers);
      const text = await callClaude(prompt);
      saveAnalysis(matchId, text);
      const updated = loadAnalyses();
      setAnalyses(updated);
      setExpandedId(matchId);
    } catch (e: any) {
      if (e.message === 'NO_KEY') {
        setError('⚙️ Configura tu API key de Anthropic (banner amarillo arriba).');
      } else if (e.message === 'PROXY_DOWN') {
        setError('🔌 El proxy no está corriendo. Abre una terminal y ejecuta: node proxy-server.cjs — luego pulsa "Probar conexión".');
      } else if (e.message === 'BAD_KEY') {
        setError('🔑 API key incorrecta o expirada. Comprueba tu key en console.anthropic.com y vuelve a guardarla.');
      } else {
        setError('Error IA: ' + e.message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const formatText = (text: string) =>
    text.split('\n').map((line, i) => {
      const parts = line.split(/(\*\*[^*]+\*\*)/g);
      const isBoldLine = line.startsWith('**') && line.endsWith('**');
      return (
        <p key={i} className={cn("leading-relaxed", isBoldLine ? "font-bold text-white mt-3 mb-1 text-sm" : "text-sm text-muted-foreground")}>
          {isBoldLine ? line.slice(2, -2) : parts.map((p, j) =>
            p.startsWith('**') && p.endsWith('**')
              ? <strong key={j} className="text-white">{p.slice(2, -2)}</strong> : p
          )}
        </p>
      );
    });

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="glass-card p-5">
        <h2 className="text-xl font-bold flex items-center gap-2 mb-1">
          <Brain className="w-5 h-5 text-purple-400" /> Análisis IA de Partidos
        </h2>
        <p className="text-sm text-muted-foreground">
          Selecciona un partido y la IA generará un informe de coach con puntos fuertes, débiles y recomendaciones.
        </p>
      </div>

      {/* Config: proxy y API key */}
      <ProxyBanner />
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

      {error && (
        <div className="glass-card p-4 bg-red-500/10 border-red-500/20 text-sm text-red-400 flex items-start gap-2">
          <span className="text-base">⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {matchList.length === 0 ? (
        <div className="glass-card p-10 text-center text-muted-foreground">
          <Brain className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>Sin partidos. Añade partidos para poder analizarlos con IA.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {matchList.map((match: any) => {
            const analysis = analyses[match.id];
            const isThisLoading = isLoading && selectedMatch === match.id;
            const isOpen = expandedId === match.id;

            return (
              <div key={match.id} className={cn("glass-card p-4 space-y-3 transition-all",
                analysis ? 'border-purple-500/20' : '')}>
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-3">
                    <span className={cn("w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold",
                      match.won ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400')}>
                      {match.won ? 'W' : 'L'}
                    </span>
                    <div>
                      <p className="font-bold text-sm">{match.map} · {match.scoreUs}-{match.scoreOpp}</p>
                      <p className="text-xs text-muted-foreground">{match.type} · {match.date}</p>
                    </div>
                    {analysis && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400 border border-purple-500/30">
                        ✓ Analizado
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {analysis && (
                      <button onClick={() => setExpandedId(isOpen ? null : match.id)}
                        className="text-xs text-muted-foreground hover:text-white flex items-center gap-1 px-2 py-1.5">
                        {isOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        {isOpen ? 'Ocultar' : 'Ver análisis'}
                      </button>
                    )}
                    <button onClick={() => generate(match.id)} disabled={isLoading}
                      className={cn("flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-all",
                        isThisLoading
                          ? 'border-purple-500/30 bg-purple-500/10 text-purple-400 cursor-wait'
                          : 'border-purple-500/40 bg-purple-500/15 text-purple-300 hover:bg-purple-500/25 cursor-pointer'
                      )}>
                      {isThisLoading
                        ? <><Loader2 className="w-3 h-3 animate-spin" />Analizando...</>
                        : <><Sparkles className="w-3 h-3" />{analysis ? 'Regenerar' : 'Analizar con IA'}</>
                      }
                    </button>
                  </div>
                </div>

                {isOpen && analysis && (
                  <div className="border-t border-white/10 pt-3 space-y-0.5">
                    {formatText(analysis.text)}
                    <p className="text-[10px] text-muted-foreground pt-2 border-t border-white/5 mt-3">
                      Generado el {new Date(analysis.createdAt).toLocaleString('es-ES')}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
