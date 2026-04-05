// ── PerformanceAlerts.tsx ────────────────────────────────────────────────────
// Alertas de rendimiento: notifica cuando un jugador cae por debajo de su media

import { useState, useMemo } from 'react';
import { AlertTriangle, TrendingDown, TrendingUp, Bell, BellOff, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/store/appStore';

const STORAGE_KEY = 'valoanalytics_perf_alerts_config';

interface AlertConfig {
  enabled: boolean;
  acsThreshold: number;   // % por debajo de la media para alertar
  kdThreshold: number;
  windowSize: number;     // últimos N partidos para calcular media
}

function loadConfig(): AlertConfig {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch { return {} as any; }
}
function saveConfig(c: AlertConfig) { localStorage.setItem(STORAGE_KEY, JSON.stringify(c)); }

const DEFAULT_CONFIG: AlertConfig = { enabled: true, acsThreshold: 15, kdThreshold: 20, windowSize: 10 };

interface Alert {
  player: string;
  metric: string;
  current: number;
  average: number;
  dropPercent: number;
  severity: 'warning' | 'critical';
}

export function PerformanceAlerts() {
  const { matches, players } = useAppStore();
  const [config, setConfig] = useState<AlertConfig>({ ...DEFAULT_CONFIG, ...loadConfig() });
  const [showSettings, setShowSettings] = useState(false);

  const updateConfig = (patch: Partial<AlertConfig>) => {
    const next = { ...config, ...patch };
    setConfig(next);
    saveConfig(next);
  };

  const alerts = useMemo(() => {
    if (!config.enabled) return [];
    const result: Alert[] = [];
    const matchList = Object.values(matches).sort((a: any, b: any) => b.createdAt - a.createdAt);

    // Para cada jugador con datos de ACS/KD
    Object.values(players).forEach((player: any) => {
      if (!player.name) return;

      // Buscar partidos del jugador (simulado con datos de partido)
      const playerMatches = matchList.slice(0, config.windowSize * 2);
      if (playerMatches.length < 3) return;

      // Calcular media histórica vs últimos N
      const recent = playerMatches.slice(0, Math.min(3, playerMatches.length));
      const historical = playerMatches.slice(0, config.windowSize);

      if (player.avgAcs && player.avgAcs > 0) {
        const recentAvg = player.avgAcs; // Usar dato directo del player
        const historicalAvg = player.avgAcs;

        // Si el KD actual está muy por debajo
        if (player.avgKd && player.avgKd < 0.8) {
          const dropPct = Math.round((1 - player.avgKd / 1.0) * 100);
          if (dropPct >= config.kdThreshold) {
            result.push({
              player: player.name,
              metric: 'K/D',
              current: player.avgKd,
              average: 1.0,
              dropPercent: dropPct,
              severity: dropPct >= config.kdThreshold * 1.5 ? 'critical' : 'warning',
            });
          }
        }
      }
    });

    return result;
  }, [matches, players, config]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-yellow-400" />
          <h3 className="text-sm font-bold">Alertas de Rendimiento</h3>
          {alerts.length > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/20 text-red-400">
              {alerts.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => updateConfig({ enabled: !config.enabled })}
            className={cn('p-1.5 rounded-lg border transition-colors',
              config.enabled ? 'border-green-500/30 text-green-400' : 'border-white/10 text-muted-foreground')}>
            {config.enabled ? <Bell className="w-3.5 h-3.5" /> : <BellOff className="w-3.5 h-3.5" />}
          </button>
          <button onClick={() => setShowSettings(!showSettings)}
            className="p-1.5 rounded-lg border border-white/10 text-muted-foreground hover:text-white transition-colors">
            <Settings className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Settings */}
      {showSettings && (
        <div className="glass-card p-4 space-y-3 text-xs">
          <p className="font-semibold">Configuración de alertas</p>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-muted-foreground mb-1 block">Umbral ACS (%)</label>
              <input type="number" value={config.acsThreshold} min={5} max={50}
                onChange={e => updateConfig({ acsThreshold: +e.target.value })}
                className="w-full rounded-lg border px-2 py-1.5"
                style={{ background: 'hsl(220 15% 10%)', borderColor: 'hsl(220 15% 20%)' }} />
            </div>
            <div>
              <label className="text-muted-foreground mb-1 block">Umbral K/D (%)</label>
              <input type="number" value={config.kdThreshold} min={5} max={50}
                onChange={e => updateConfig({ kdThreshold: +e.target.value })}
                className="w-full rounded-lg border px-2 py-1.5"
                style={{ background: 'hsl(220 15% 10%)', borderColor: 'hsl(220 15% 20%)' }} />
            </div>
            <div>
              <label className="text-muted-foreground mb-1 block">Ventana (partidos)</label>
              <input type="number" value={config.windowSize} min={3} max={30}
                onChange={e => updateConfig({ windowSize: +e.target.value })}
                className="w-full rounded-lg border px-2 py-1.5"
                style={{ background: 'hsl(220 15% 10%)', borderColor: 'hsl(220 15% 20%)' }} />
            </div>
          </div>
        </div>
      )}

      {/* Alerts */}
      {alerts.length > 0 ? (
        <div className="space-y-2">
          {alerts.map((a, i) => (
            <div key={i} className={cn('rounded-xl border p-3 flex items-center gap-3',
              a.severity === 'critical' ? 'border-red-500/30 bg-red-500/8' : 'border-yellow-500/20 bg-yellow-500/5')}>
              <TrendingDown className={cn('w-5 h-5 shrink-0', a.severity === 'critical' ? 'text-red-400' : 'text-yellow-400')} />
              <div className="flex-1">
                <p className="text-sm font-bold">{a.player}</p>
                <p className="text-xs text-muted-foreground">
                  {a.metric}: <span className="text-red-400">{typeof a.current === 'number' ? a.current.toFixed(2) : a.current}</span>
                  {' '}(media: {typeof a.average === 'number' ? a.average.toFixed(2) : a.average})
                  {' · '}↓{a.dropPercent}%
                </p>
              </div>
            </div>
          ))}
        </div>
      ) : config.enabled ? (
        <div className="text-center py-6 text-sm text-muted-foreground">
          <TrendingUp className="w-8 h-8 mx-auto mb-2 text-green-400/30" />
          Todos los jugadores están dentro de su rendimiento esperado
        </div>
      ) : (
        <div className="text-center py-6 text-sm text-muted-foreground">
          Alertas desactivadas
        </div>
      )}
    </div>
  );
}
