import { useState, useMemo, useEffect } from 'react';
import { Bell, BellOff, Plus, Trash2, AlertTriangle, TrendingUp, Trophy, X, Check } from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import { cn } from '@/lib/utils';

interface NotificationRule {
  id: string;
  type: 'MAP_WR_BELOW' | 'MAP_WR_ABOVE' | 'PLAYER_ACS_RECORD' | 'PLAYER_KD_RECORD' | 'WIN_STREAK' | 'LOSS_STREAK';
  label: string;
  target: string;   // mapa o jugador
  threshold: number;
  active: boolean;
  createdAt: number;
}

interface AppNotification {
  id: string;
  ruleId: string;
  message: string;
  type: 'warning' | 'success' | 'info';
  createdAt: number;
  read: boolean;
}

const RULE_STORAGE = 'valoanalytics_notif_rules_v1';
const NOTIF_STORAGE = 'valoanalytics_notifications_v1';

function loadRules(): NotificationRule[] {
  try { return JSON.parse(localStorage.getItem(RULE_STORAGE) || '[]'); } catch { return []; }
}
function saveRules(r: NotificationRule[]) {
  localStorage.setItem(RULE_STORAGE, JSON.stringify(r));
}
function loadNotifs(): AppNotification[] {
  try { return JSON.parse(localStorage.getItem(NOTIF_STORAGE) || '[]'); } catch { return []; }
}
function saveNotifs(n: AppNotification[]) {
  localStorage.setItem(NOTIF_STORAGE, JSON.stringify(n));
}

const RULE_TYPES = [
  { value: 'MAP_WR_BELOW',      label: 'WR mapa cae por debajo de %',   hasTarget: 'map',    thresholdLabel: 'Porcentaje mínimo' },
  { value: 'MAP_WR_ABOVE',      label: 'WR mapa supera %',              hasTarget: 'map',    thresholdLabel: 'Porcentaje objetivo' },
  { value: 'PLAYER_ACS_RECORD', label: 'Jugador supera su récord ACS',  hasTarget: 'player', thresholdLabel: 'ACS mínimo a alertar' },
  { value: 'PLAYER_KD_RECORD',  label: 'Jugador supera su K/D',         hasTarget: 'player', thresholdLabel: 'K/D mínimo' },
  { value: 'WIN_STREAK',        label: 'Racha de victorias alcanza',     hasTarget: 'none',   thresholdLabel: 'Nº victorias consecutivas' },
  { value: 'LOSS_STREAK',       label: 'Racha de derrotas alcanza',      hasTarget: 'none',   thresholdLabel: 'Nº derrotas consecutivas' },
] as const;

export function NotificationCenter() {
  const { getMapStats, getPlayerStats, getFilteredMatches } = useAppStore();
  const [rules, setRules] = useState<NotificationRule[]>(loadRules);
  const [notifs, setNotifs] = useState<AppNotification[]>(loadNotifs);
  const [showAdd, setShowAdd] = useState(false);
  const [tab, setTab] = useState<'alerts'|'rules'>('alerts');

  // Form state
  const [fType, setFType] = useState<NotificationRule['type']>('MAP_WR_BELOW');
  const [fTarget, setFTarget] = useState('');
  const [fThreshold, setFThreshold] = useState(50);

  const mapStats    = getMapStats('ALL');
  const playerStats = getPlayerStats('ALL');
  const matches     = getFilteredMatches();

  const maps    = mapStats.map(m => m.map);
  const players = playerStats.map(p => p.name);

  // Evaluar reglas al cambiar datos
  useEffect(() => {
    const newNotifs: AppNotification[] = [];
    const sorted = [...matches].sort((a,b)=>new Date(a.date).getTime()-new Date(b.date).getTime());

    rules.filter(r => r.active).forEach(rule => {
      const existing = notifs.filter(n => n.ruleId === rule.id);
      const lastCheck = existing.length > 0 ? Math.max(...existing.map(n=>n.createdAt)) : 0;
      const sinceLastCheck = Date.now() - lastCheck > 1000 * 60; // al menos 1 min de diferencia

      if (rule.type === 'MAP_WR_BELOW') {
        const ms = mapStats.find(m => m.map === rule.target);
        if (ms && ms.winPct < rule.threshold && sinceLastCheck) {
          newNotifs.push({
            id: crypto.randomUUID(), ruleId: rule.id, read: false, createdAt: Date.now(),
            type: 'warning',
            message: `⚠️ WR en ${rule.target} es ${ms.winPct.toFixed(1)}% — por debajo del umbral de ${rule.threshold}%`,
          });
        }
      } else if (rule.type === 'MAP_WR_ABOVE') {
        const ms = mapStats.find(m => m.map === rule.target);
        if (ms && ms.winPct >= rule.threshold && sinceLastCheck) {
          newNotifs.push({
            id: crypto.randomUUID(), ruleId: rule.id, read: false, createdAt: Date.now(),
            type: 'success',
            message: `🏆 WR en ${rule.target} ha alcanzado ${ms.winPct.toFixed(1)}% — objetivo de ${rule.threshold}% logrado`,
          });
        }
      } else if (rule.type === 'PLAYER_ACS_RECORD') {
        const ps = playerStats.find(p => p.name === rule.target);
        if (ps && ps.acsAvg >= rule.threshold && sinceLastCheck) {
          newNotifs.push({
            id: crypto.randomUUID(), ruleId: rule.id, read: false, createdAt: Date.now(),
            type: 'success',
            message: `🔥 ${rule.target} tiene ACS medio de ${ps.acsAvg.toFixed(0)} — supera ${rule.threshold} ACS`,
          });
        }
      } else if (rule.type === 'PLAYER_KD_RECORD') {
        const ps = playerStats.find(p => p.name === rule.target);
        if (ps && ps.kd >= rule.threshold && sinceLastCheck) {
          newNotifs.push({
            id: crypto.randomUUID(), ruleId: rule.id, read: false, createdAt: Date.now(),
            type: 'success',
            message: `💪 ${rule.target} tiene K/D ${ps.kd.toFixed(2)} — supera objetivo de ${rule.threshold}`,
          });
        }
      } else if (rule.type === 'WIN_STREAK') {
        let streak = 0;
        sorted.forEach(m => { streak = m.won ? streak + 1 : 0; });
        if (streak >= rule.threshold && sinceLastCheck) {
          newNotifs.push({
            id: crypto.randomUUID(), ruleId: rule.id, read: false, createdAt: Date.now(),
            type: 'success',
            message: `🔥 ¡Racha de ${streak} victorias consecutivas! Objetivo de ${rule.threshold} alcanzado`,
          });
        }
      } else if (rule.type === 'LOSS_STREAK') {
        let streak = 0;
        sorted.forEach(m => { streak = m.won ? 0 : streak + 1; });
        if (streak >= rule.threshold && sinceLastCheck) {
          newNotifs.push({
            id: crypto.randomUUID(), ruleId: rule.id, read: false, createdAt: Date.now(),
            type: 'warning',
            message: `😰 Racha de ${streak} derrotas consecutivas — umbral de ${rule.threshold} alcanzado`,
          });
        }
      }
    });

    if (newNotifs.length > 0) {
      const merged = [...notifs, ...newNotifs].slice(-50); // max 50 notificaciones
      setNotifs(merged);
      saveNotifs(merged);
    }
  }, [matches.length, mapStats, playerStats]);

  const unread = notifs.filter(n => !n.read).length;

  const addRule = () => {
    const ruleDef = RULE_TYPES.find(r => r.value === fType)!;
    const needsTarget = ruleDef.hasTarget !== 'none';
    const newRule: NotificationRule = {
      id: crypto.randomUUID(),
      type: fType,
      label: ruleDef.label,
      target: needsTarget ? fTarget : '',
      threshold: fThreshold,
      active: true,
      createdAt: Date.now(),
    };
    const updated = [...rules, newRule];
    setRules(updated);
    saveRules(updated);
    setShowAdd(false);
  };

  const toggleRule = (id: string) => {
    const updated = rules.map(r => r.id === id ? { ...r, active: !r.active } : r);
    setRules(updated);
    saveRules(updated);
  };

  const deleteRule = (id: string) => {
    const updated = rules.filter(r => r.id !== id);
    setRules(updated);
    saveRules(updated);
  };

  const markAllRead = () => {
    const updated = notifs.map(n => ({ ...n, read: true }));
    setNotifs(updated);
    saveNotifs(updated);
  };

  const clearNotif = (id: string) => {
    const updated = notifs.filter(n => n.id !== id);
    setNotifs(updated);
    saveNotifs(updated);
  };

  const ruleTypeDef = RULE_TYPES.find(r => r.value === fType)!;

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="glass-card p-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Bell className="w-6 h-6 text-red-400"/>
            {unread > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-[9px] text-white flex items-center justify-center font-bold">
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </div>
          <div>
            <h2 className="font-bold text-lg">Centro de Notificaciones</h2>
            <p className="text-sm text-muted-foreground">{unread} sin leer · {rules.length} reglas activas</p>
          </div>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border transition-all"
          style={{ background: 'hsl(355 85% 58% / 0.15)', border: '1px solid hsl(355 85% 58% / 0.3)', color: 'hsl(355 85% 68%)' }}
        >
          <Plus className="w-4 h-4"/> Nueva regla
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b" style={{ borderColor: 'hsl(220 15% 15%)' }}>
        {(['alerts', 'rules'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={cn('px-4 py-2.5 text-sm font-medium transition-colors', tab === t ? 'text-white border-b-2 border-red-500' : 'text-muted-foreground hover:text-white')}>
            {t === 'alerts' ? `Alertas (${notifs.length})` : `Reglas (${rules.length})`}
          </button>
        ))}
      </div>

      {/* Alertas */}
      {tab === 'alerts' && (
        <div className="space-y-2">
          {notifs.length > 0 && (
            <div className="flex justify-end">
              <button onClick={markAllRead} className="text-xs text-muted-foreground hover:text-white flex items-center gap-1 transition-colors">
                <Check className="w-3 h-3"/> Marcar todo como leído
              </button>
            </div>
          )}
          {notifs.length === 0 && (
            <div className="glass-card p-12 text-center">
              <BellOff className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4"/>
              <p className="text-muted-foreground">Sin notificaciones todavía.</p>
              <p className="text-sm text-muted-foreground/60 mt-1">Crea reglas para que el sistema te avise automáticamente.</p>
            </div>
          )}
          {[...notifs].reverse().map(n => (
            <div key={n.id}
              className={cn('glass-card p-4 flex items-start gap-3 rounded-xl transition-all', !n.read && 'border-l-2 border-red-500')}
            >
              {n.type === 'warning'
                ? <AlertTriangle className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5"/>
                : n.type === 'success'
                ? <Trophy className="w-4 h-4 text-green-400 shrink-0 mt-0.5"/>
                : <TrendingUp className="w-4 h-4 text-blue-400 shrink-0 mt-0.5"/>}
              <div className="flex-1 min-w-0">
                <p className="text-sm">{n.message}</p>
                <p className="text-[11px] text-muted-foreground mt-1">
                  {new Date(n.createdAt).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
              <button onClick={() => clearNotif(n.id)} className="p-1 rounded hover:bg-white/10 shrink-0 transition-colors">
                <X className="w-3.5 h-3.5 text-muted-foreground"/>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Reglas */}
      {tab === 'rules' && (
        <div className="space-y-3">
          {rules.length === 0 && (
            <div className="glass-card p-12 text-center">
              <Bell className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4"/>
              <p className="text-muted-foreground">Sin reglas configuradas.</p>
              <p className="text-sm text-muted-foreground/60 mt-1">Añade reglas para recibir alertas automáticas.</p>
            </div>
          )}
          {rules.map(rule => {
            const def = RULE_TYPES.find(r => r.value === rule.type);
            return (
              <div key={rule.id} className={cn('glass-card p-4 flex items-center gap-3', !rule.active && 'opacity-50')}>
                <button onClick={() => toggleRule(rule.id)}
                  className={cn('w-9 h-5 rounded-full transition-colors relative shrink-0', rule.active ? 'bg-red-500' : 'bg-white/20')}>
                  <div className={cn('w-3.5 h-3.5 rounded-full bg-white absolute top-0.5 transition-all', rule.active ? 'right-0.5' : 'left-0.5')}/>
                </button>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{def?.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {rule.target && `${rule.target} · `}Umbral: {rule.threshold}
                    {rule.type.includes('WR') ? '%' : ''}
                  </p>
                </div>
                <button onClick={() => deleteRule(rule.id)} className="p-1.5 rounded hover:bg-red-500/20 transition-colors">
                  <Trash2 className="w-4 h-4 text-red-400"/>
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal nueva regla */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'hsl(220 22% 5% / 0.85)' }}>
          <div className="glass-card p-6 rounded-2xl w-full max-w-md space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-lg">Nueva Regla de Alerta</h3>
              <button onClick={() => setShowAdd(false)} className="p-1 rounded hover:bg-white/10">
                <X className="w-5 h-5"/>
              </button>
            </div>

            <div>
              <label className="text-sm text-muted-foreground">Tipo de alerta</label>
              <select value={fType} onChange={e => { setFType(e.target.value as any); setFTarget(''); }}
                className="w-full mt-1 rounded-xl px-3 py-2 border text-sm outline-none"
                style={{ background: 'hsl(220 15% 10%)', borderColor: 'hsl(220 15% 22%)' }}>
                {RULE_TYPES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>

            {ruleTypeDef.hasTarget !== 'none' && (
              <div>
                <label className="text-sm text-muted-foreground">
                  {ruleTypeDef.hasTarget === 'map' ? 'Mapa' : 'Jugador'}
                </label>
                <select value={fTarget} onChange={e => setFTarget(e.target.value)}
                  className="w-full mt-1 rounded-xl px-3 py-2 border text-sm outline-none"
                  style={{ background: 'hsl(220 15% 10%)', borderColor: 'hsl(220 15% 22%)' }}>
                  <option value="">Seleccionar...</option>
                  {(ruleTypeDef.hasTarget === 'map' ? maps : players).map(v => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="text-sm text-muted-foreground">{ruleTypeDef.thresholdLabel}</label>
              <input type="number" value={fThreshold} onChange={e => setFThreshold(+e.target.value)}
                min={0} max={100} step={1}
                className="w-full mt-1 rounded-xl px-3 py-2 border text-sm outline-none"
                style={{ background: 'hsl(220 15% 10%)', borderColor: 'hsl(220 15% 22%)' }}/>
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowAdd(false)}
                className="flex-1 py-2.5 rounded-xl text-sm border transition-colors hover:bg-white/5"
                style={{ borderColor: 'hsl(220 15% 22%)' }}>
                Cancelar
              </button>
              <button
                onClick={addRule}
                disabled={ruleTypeDef.hasTarget !== 'none' && !fTarget}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-40"
                style={{ background: 'hsl(355 85% 58% / 0.25)', border: '1px solid hsl(355 85% 58% / 0.3)', color: 'hsl(355 85% 68%)' }}>
                Crear regla
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
