import { useState } from 'react';
import {
  Search, Loader2, ChevronDown, ChevronRight, ChevronUp,
  Skull, Activity, Users, BarChart3, Zap, Key, Eye, EyeOff,
  TrendingUp, TrendingDown, Minus, Server, Shield, Star, Clock
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── ValoAnalytics API (proxy local puerto 3001) ──────────────────────────────
// Para player lookup seguimos usando Henrik directamente (account, mmr, mmr-history)
// ya que la API propia sólo proxea los endpoints de partidos.
// Rutas de Henrik que NO están en nuestra API las llamamos directo con CORS.
const HENRIK_BASE = 'https://api.henrikdev.xyz/valorant';
const VALO_API    = 'http://localhost:3001';
const STORAGE_KEY = 'valoanalytics_henrik_key_v1';
const getKey = () => localStorage.getItem(STORAGE_KEY) || '';
const saveKey = (k: string) => localStorage.setItem(STORAGE_KEY, k);

async function hFetch(path: string): Promise<any> {
  const key = getKey();
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (key) headers['Authorization'] = key;
  const res = await fetch(HENRIK_BASE + path, { headers });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json?.errors?.[0]?.message || json?.message || 'HTTP ' + res.status);
  }
  return json.data ?? json;
}

// Rutas que sí están en nuestra API propia (partidos normalizados con assets)
async function vaFetch(path: string): Promise<any> {
  const key = getKey();
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (key) headers['x-henrik-key'] = key;
  const res = await fetch(VALO_API + path, { headers });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error || 'HTTP ' + res.status);
  return json.data ?? json;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const RANK_COLORS: Record<string, string> = {
  Iron: '#9CA3AF', Bronze: '#CD7F32', Silver: '#C0C0C0', Gold: '#FFD700',
  Platinum: '#4FC3F7', Diamond: '#B39DDB', Ascendant: '#34D399',
  Immortal: '#F87171', Radiant: '#FDE68A',
};
const rankColor = (t: string) => RANK_COLORS[t?.split(' ')[0]] || '#6B7280';

function timeAgo(ts: number) {
  const d = Math.floor((Date.now() / 1000 - ts) / 86400);
  if (d === 0) return 'hoy';
  if (d === 1) return 'ayer';
  if (d < 7) return d + 'd';
  if (d < 30) return Math.floor(d / 7) + 'sem';
  return Math.floor(d / 30) + 'mes';
}

function kdRatio(k: number, d: number) {
  return d > 0 ? (k / d).toFixed(2) : k.toFixed(2);
}
function acsCalc(score: number, rounds: number) {
  return rounds > 0 ? Math.round(score / rounds) : 0;
}
function hsCalc(hs: number, bs: number, ls: number) {
  const t = hs + bs + ls;
  return t > 0 ? Math.round((hs / t) * 100) : 0;
}

// ─── RR Delta Badge ───────────────────────────────────────────────────────────
function RRDelta({ v }: { v: number }) {
  if (v > 0) return <span className="text-green-400 text-xs font-bold flex items-center gap-0.5"><TrendingUp className="w-3 h-3"/>+{v}</span>;
  if (v < 0) return <span className="text-red-400 text-xs font-bold flex items-center gap-0.5"><TrendingDown className="w-3 h-3"/>{v}</span>;
  return <span className="text-muted-foreground text-xs flex items-center gap-0.5"><Minus className="w-3 h-3"/>0</span>;
}

// ─── Rank Badge ───────────────────────────────────────────────────────────────
function RankBadge({ tier, rr, size = 'md' }: { tier: string; rr?: number; size?: 'sm' | 'md' | 'lg' }) {
  const color = rankColor(tier);
  const sizes = { sm: 'text-xs px-2 py-1', md: 'text-sm px-3 py-1.5', lg: 'text-base px-4 py-2' };
  return (
    <span className={cn('rounded-lg font-bold border inline-flex items-center gap-1.5', sizes[size])}
      style={{ color, borderColor: color + '40', background: color + '15' }}>
      {tier}
      {rr !== undefined && <span className="opacity-70 font-normal text-xs">{rr} RR</span>}
    </span>
  );
}

// ─── Win/Loss Bar ─────────────────────────────────────────────────────────────
function WinBar({ wins, total }: { wins: number; total: number }) {
  const pct = total > 0 ? Math.round((wins / total) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-green-400">{wins}V</span>
        <span className="font-bold">{pct}%</span>
        <span className="text-red-400">{total - wins}D</span>
      </div>
      <div className="h-2 rounded-full overflow-hidden bg-red-500/30">
        <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: pct + '%' }} />
      </div>
    </div>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="rounded-xl p-3 text-center border border-white/8" style={{ background: 'hsl(220 15% 11%)' }}>
      <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">{label}</p>
      <p className={cn('text-xl font-black', color || 'text-white')}>{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

// ─── API Key Panel ────────────────────────────────────────────────────────────
function KeyPanel({ onDone }: { onDone: () => void }) {
  const [k, setK] = useState(getKey());
  const [show, setShow] = useState(false);
  const [saved, setSaved] = useState(false);
  const save = () => { saveKey(k.trim()); setSaved(true); setTimeout(() => { setSaved(false); onDone(); }, 1500); };
  return (
    <div className="rounded-xl border border-blue-500/25 bg-blue-500/8 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Key className="w-4 h-4 text-blue-400" />
        <p className="text-sm font-semibold text-blue-300">API Key de HenrikDev (opcional)</p>
      </div>
      <p className="text-xs text-muted-foreground">
        Sin key: 30 req/min. Con key gratis: 100 req/min.<br />
        Consíguela en <strong className="text-blue-400">henrikdev.xyz</strong> → Discord → #api-key-request.
      </p>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input type={show ? 'text' : 'password'} value={k} onChange={e => setK(e.target.value)}
            placeholder="HDEV-xxxxxxxx-..." className="input-pro w-full pr-9 font-mono text-xs"
            onKeyDown={e => e.key === 'Enter' && save()} />
          <button onClick={() => setShow(!show)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-white">
            {show ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          </button>
        </div>
        <button onClick={save} className={cn('px-4 rounded-lg text-xs font-bold border transition-all',
          saved ? 'bg-green-500/20 border-green-500/40 text-green-400' : 'bg-blue-500/20 border-blue-500/40 text-blue-300 hover:bg-blue-500/30')}>
          {saved ? '✓ OK' : 'Guardar'}
        </button>
      </div>
    </div>
  );
}

// ─── Profile Section ──────────────────────────────────────────────────────────
function ProfileSection({ data }: { data: any }) {
  const cardUrl = data.card
    ? `https://media.valorant-api.com/playercards/${data.card}/wideart.png`
    : null;
  return (
    <div className="relative rounded-2xl overflow-hidden border border-white/10">
      {cardUrl && (
        <div className="absolute inset-0">
          <img src={cardUrl} alt="" className="w-full h-full object-cover opacity-20" />
          <div className="absolute inset-0" style={{ background: 'linear-gradient(to right, hsl(220 20% 8% / 0.95) 40%, transparent)' }} />
        </div>
      )}
      <div className="relative p-5 flex items-center gap-5">
        {cardUrl && <img src={`https://media.valorant-api.com/playercards/${data.card}/smallart.png`} alt="" className="w-16 h-16 rounded-xl border border-white/20 object-cover flex-shrink-0" />}
        <div>
          <h2 className="text-2xl font-black">{data.name}<span className="text-muted-foreground font-normal text-lg">#{data.tag}</span></h2>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            <span className="text-xs text-muted-foreground border border-white/10 px-2 py-0.5 rounded bg-white/5">{data.region?.toUpperCase()}</span>
            <span className="text-xs text-muted-foreground">Nivel <strong className="text-white">{data.account_level}</strong></span>
            {data.platforms && <span className="text-xs text-muted-foreground">{data.platforms.join(' · ')}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── MMR Section ─────────────────────────────────────────────────────────────
function MMRSection({ mmr }: { mmr: any }) {
  const current = mmr.current;
  const highest = mmr.highest_rank;
  const history: any[] = mmr.by_season ? Object.entries(mmr.by_season).slice(-6) : [];

  return (
    <div className="space-y-4">
      {/* Current rank */}
      <div className="glass-card p-5">
        <h3 className="font-bold text-sm mb-4 text-muted-foreground uppercase tracking-wider">Rango Actual</h3>
        <div className="flex items-start gap-6 flex-wrap">
          <div className="text-center">
            {current?.images?.large && (
              <img src={current.images.large} alt={current.currenttierpatched} className="w-20 h-20 mx-auto" />
            )}
            <p className="font-black text-lg mt-1" style={{ color: rankColor(current?.currenttierpatched || '') }}>
              {current?.currenttierpatched || 'Sin rango'}
            </p>
            <p className="text-sm text-muted-foreground">{current?.ranking_in_tier ?? 0} RR</p>
          </div>
          <div className="flex-1 min-w-0 grid grid-cols-2 sm:grid-cols-3 gap-3">
            <StatCard label="ELO Total" value={current?.elo ?? '—'} color="text-yellow-400" />
            <StatCard label="Último partido" value={current?.mmr_change_to_last_game > 0 ? '+' + current.mmr_change_to_last_game : current?.mmr_change_to_last_game ?? '—'}
              color={current?.mmr_change_to_last_game > 0 ? 'text-green-400' : 'text-red-400'} />
            {highest && <StatCard label="Pico histórico" value={highest.patched_tier} sub={'Temporada ' + (highest.season?.short || '')} color={rankColor(highest.patched_tier)} />}
          </div>
        </div>
      </div>

      {/* Season history */}
      {history.length > 0 && (
        <div className="glass-card p-5">
          <h3 className="font-bold text-sm mb-4 text-muted-foreground uppercase tracking-wider">Historial por Temporada</h3>
          <div className="space-y-2">
            {history.reverse().map(([season, data]: [string, any]) => (
              <div key={season} className="flex items-center justify-between p-3 rounded-lg border border-white/8" style={{ background: 'hsl(220 15% 11%)' }}>
                <span className="text-sm font-medium text-muted-foreground">{season}</span>
                <div className="flex items-center gap-3">
                  {data.final_rank_patched && <RankBadge tier={data.final_rank_patched} size="sm" />}
                  {data.wins !== undefined && (
                    <span className="text-xs text-muted-foreground">{data.wins}V · {data.number_of_games - data.wins}D</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── MMR History Chart ────────────────────────────────────────────────────────
function MMRHistorySection({ history }: { history: any[] }) {
  if (!history || history.length === 0) return null;
  const recent = history.slice(0, 20).reverse();
  const elos = recent.map(h => h.elo || 0);
  const min = Math.min(...elos);
  const max = Math.max(...elos);
  const range = max - min || 1;
  const w = 100 / (recent.length - 1);

  return (
    <div className="glass-card p-5">
      <h3 className="font-bold text-sm mb-4 text-muted-foreground uppercase tracking-wider">Evolución RR (últimas {recent.length} partidas)</h3>
      <div className="relative h-32">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full">
          <defs>
            <linearGradient id="mmrGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#FF4655" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#FF4655" stopOpacity="0" />
            </linearGradient>
          </defs>
          <polyline fill="none" stroke="#FF4655" strokeWidth="2"
            points={recent.map((h, i) => `${i * w},${100 - ((h.elo - min) / range) * 85 - 5}`).join(' ')} />
          <polygon fill="url(#mmrGrad)"
            points={[
              ...recent.map((h, i) => `${i * w},${100 - ((h.elo - min) / range) * 85 - 5}`),
              `${(recent.length - 1) * w},100`, `0,100`
            ].join(' ')} />
        </svg>
        <div className="absolute top-0 right-0 flex flex-col justify-between h-full text-[9px] text-muted-foreground">
          <span>{max}</span>
          <span>{Math.round((max + min) / 2)}</span>
          <span>{min}</span>
        </div>
      </div>
      {/* Last 10 entries */}
      <div className="mt-3 grid grid-cols-5 gap-1.5">
        {history.slice(0, 10).map((h: any, i: number) => (
          <div key={i} className={cn('rounded-lg p-2 text-center text-[10px] border',
            h.mmr_change_to_last_game > 0 ? 'border-green-500/20 bg-green-500/8' : 'border-red-500/20 bg-red-500/8')}>
            <p className="text-muted-foreground truncate">{h.map?.name || '?'}</p>
            <p className={h.mmr_change_to_last_game > 0 ? 'text-green-400 font-bold' : 'text-red-400 font-bold'}>
              {h.mmr_change_to_last_game > 0 ? '+' : ''}{h.mmr_change_to_last_game}
            </p>
            <p className="text-[9px] text-muted-foreground" style={{ color: rankColor(h.currenttier_patched || '') }}>{h.currenttier_patched?.split(' ')[0]}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Matches Section ──────────────────────────────────────────────────────────
function MatchesSection({ matches }: { matches: any[] }) {
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div className="space-y-2">
      {matches.map((m: any) => {
        const meta = m.metadata;
        const me = m.players?.all_players?.[0]; // No tenemos el jugador buscado, usamos la data disponible
        const blueWon = m.teams?.blue?.has_won;
        const isOpen = expanded === meta.match_id;

        return (
          <div key={meta.match_id} className="glass-card overflow-hidden">
            <button className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/5 transition-colors"
              onClick={() => setExpanded(isOpen ? null : meta.match_id)}>
              <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center text-xs font-black border flex-shrink-0',
                blueWon ? 'bg-blue-500/15 text-blue-400 border-blue-500/30' : 'bg-red-500/15 text-red-400 border-red-500/30')}>
                {meta.mode?.slice(0, 3).toUpperCase() || '?'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-sm">{meta.map}</span>
                  <span className="text-xs text-muted-foreground">{meta.mode}</span>
                  <span className="text-[10px] text-muted-foreground">{timeAgo(meta.game_start)}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  🔵 {m.teams?.blue?.rounds_won} – {m.teams?.red?.rounds_won} 🔴 · {meta.rounds_played} rondas
                </p>
              </div>
              {isOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
            </button>

            {isOpen && m.players?.all_players && (
              <div className="border-t border-white/10 px-4 pb-4 pt-3">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs min-w-max">
                    <thead>
                      <tr className="text-left text-[10px] text-muted-foreground uppercase border-b border-white/10">
                        <th className="pb-2 pr-3">Jugador</th>
                        <th className="pb-2 px-2 text-center">Agente</th>
                        <th className="pb-2 px-2 text-center">ACS</th>
                        <th className="pb-2 px-2 text-center">K/D/A</th>
                        <th className="pb-2 px-2 text-center">K/D</th>
                        <th className="pb-2 px-2 text-center">HS%</th>
                        <th className="pb-2 px-2 text-center">Rango</th>
                      </tr>
                    </thead>
                    <tbody>
                      {['blue', 'red'].map(team => (
                        <>
                          <tr key={team + '-sep'}>
                            <td colSpan={7} className="pt-2 pb-1">
                              <span className={cn('text-[10px] font-bold', team === 'blue' ? 'text-blue-400' : 'text-red-400')}>
                                {team === 'blue' ? '🔵 Blue' : '🔴 Red'} — {team === 'blue' ? (blueWon ? 'VICTORIA' : 'DERROTA') : (!blueWon ? 'VICTORIA' : 'DERROTA')}
                              </span>
                            </td>
                          </tr>
                          {(m.players[team] || [])
                            .sort((a: any, b: any) => b.stats.score - a.stats.score)
                            .map((p: any) => {
                              const acs = acsCalc(p.stats.score, meta.rounds_played);
                              const kd = parseFloat(kdRatio(p.stats.kills, p.stats.deaths));
                              return (
                                <tr key={p.puuid} className="border-t border-white/5 hover:bg-white/5">
                                  <td className="py-2 pr-3">
                                    <div className="flex items-center gap-2">
                                      {p.assets?.agent?.killfeed && (
                                        <img src={p.assets.agent.killfeed} alt={p.character} className="w-6 h-6 rounded object-cover" />
                                      )}
                                      <span className="font-medium">{p.name}<span className="text-muted-foreground">#{p.tag}</span></span>
                                    </div>
                                  </td>
                                  <td className="py-2 px-2 text-center text-muted-foreground">{p.character}</td>
                                  <td className="py-2 px-2 text-center font-bold text-yellow-400">{acs}</td>
                                  <td className="py-2 px-2 text-center">
                                    <span className="text-green-400">{p.stats.kills}</span>/
                                    <span className="text-red-400">{p.stats.deaths}</span>/
                                    <span className="text-blue-400">{p.stats.assists}</span>
                                  </td>
                                  <td className="py-2 px-2 text-center">
                                    <span className={kd >= 1.5 ? 'text-green-400 font-bold' : kd >= 1 ? 'text-yellow-400' : 'text-red-400'}>{kdRatio(p.stats.kills, p.stats.deaths)}</span>
                                  </td>
                                  <td className="py-2 px-2 text-center">
                                    <span className={hsCalc(p.stats.headshots, p.stats.bodyshots, p.stats.legshots) >= 25 ? 'text-orange-400' : 'text-muted-foreground'}>
                                      {hsCalc(p.stats.headshots, p.stats.bodyshots, p.stats.legshots)}%
                                    </span>
                                  </td>
                                  <td className="py-2 px-2 text-center">
                                    {p.currenttier_patched && (
                                      <span className="text-[10px] font-bold" style={{ color: rankColor(p.currenttier_patched) }}>
                                        {p.currenttier_patched}
                                      </span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                        </>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Server Status Section ────────────────────────────────────────────────────
function ServerStatus({ data }: { data: any }) {
  if (!data) return null;
  const maintenances = data.maintenances || [];
  const incidents = data.incidents || [];
  const allOk = maintenances.length === 0 && incidents.length === 0;

  return (
    <div className="glass-card p-5 space-y-4">
      <div className="flex items-center gap-3">
        <Server className="w-5 h-5 text-muted-foreground" />
        <h3 className="font-bold text-sm">Estado del Servidor</h3>
        <span className={cn('ml-auto text-xs font-bold px-2 py-1 rounded-full', allOk ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400')}>
          {allOk ? '✓ Todo operativo' : '⚠ Problemas detectados'}
        </span>
      </div>
      {incidents.map((inc: any, i: number) => (
        <div key={i} className="rounded-lg border border-red-500/20 bg-red-500/8 p-3 text-xs space-y-1">
          <p className="font-bold text-red-400">🔴 Incidente: {inc.titles?.[0]?.content || 'Sin título'}</p>
          <p className="text-muted-foreground">{inc.updates?.[0]?.translations?.[0]?.content || ''}</p>
        </div>
      ))}
      {maintenances.map((m: any, i: number) => (
        <div key={i} className="rounded-lg border border-yellow-500/20 bg-yellow-500/8 p-3 text-xs space-y-1">
          <p className="font-bold text-yellow-400">🔧 Mantenimiento: {m.titles?.[0]?.content || 'Sin título'}</p>
          <p className="text-muted-foreground">{m.updates?.[0]?.translations?.[0]?.content || ''}</p>
        </div>
      ))}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
type Tab = 'profile' | 'mmr' | 'matches';

export function HenrikPlayerLookup() {
  const [name, setName] = useState('');
  const [tag, setTag] = useState('');
  const [region, setRegion] = useState('eu');
  const [mode, setMode] = useState('competitive');
  const [loading, setLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showKey, setShowKey] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('profile');

  const [profile, setProfile] = useState<any>(null);
  const [mmr, setMmr] = useState<any>(null);
  const [mmrHistory, setMmrHistory] = useState<any[]>([]);
  const [matches, setMatches] = useState<any[]>([]);
  const [serverStatus, setServerStatus] = useState<any>(null);

  const loadStatus = async () => {
    setLoadingStatus(true);
    try {
      const d = await hFetch('/v1/status/' + region);
      setServerStatus(d);
    } catch { setServerStatus(null); }
    finally { setLoadingStatus(false); }
  };

  const search = async () => {
    if (!name.trim() || !tag.trim()) { setError('Introduce nombre y tag'); return; }
    setLoading(true); setError(null);
    setProfile(null); setMmr(null); setMmrHistory([]); setMatches([]);

    try {
      // Fetch en paralelo: perfil + MMR + historial MMR + partidas (partidas via API propia)
      const [profileData, mmrData, mmrHistData, matchData] = await Promise.allSettled([
        hFetch('/v2/account/' + encodeURIComponent(name.trim()) + '/' + encodeURIComponent(tag.trim())),
        hFetch('/v2/mmr/' + region + '/' + encodeURIComponent(name.trim()) + '/' + encodeURIComponent(tag.trim())),
        hFetch('/v1/lifetime/mmr-history/' + region + '/' + encodeURIComponent(name.trim()) + '/' + encodeURIComponent(tag.trim())),
        vaFetch('/api/player/' + encodeURIComponent(region) + '/' + encodeURIComponent(name.trim()) + '/' + encodeURIComponent(tag.trim()) + '/matches?mode=' + mode + '&size=10'),
      ]);

      if (profileData.status === 'fulfilled') setProfile(profileData.value);
      else throw new Error('Jugador no encontrado: ' + (profileData as any).reason?.message);

      if (mmrData.status === 'fulfilled') setMmr(mmrData.value);
      if (mmrHistData.status === 'fulfilled') {
        const hist = mmrHistData.value;
        setMmrHistory(Array.isArray(hist) ? hist : hist?.history || []);
      }
      if (matchData.status === 'fulfilled') setMatches(Array.isArray(matchData.value) ? matchData.value : []);

      // Cargar estado servidor en paralelo
      loadStatus();
    } catch (e: any) {
      if (e.message?.toLowerCase().includes('unauthorized') || e.message?.includes('401')) {
        setError('🔑 La Henrik API requiere API key. Consíguela gratis en discord.gg/henrikdev → escribe /apikey en cualquier canal. Luego pégala en "API Key (opcional)" arriba.');
      } else {
        setError(e.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const tabs: { id: Tab; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: 'profile', label: 'Perfil', icon: <Users className="w-4 h-4" /> },
    { id: 'mmr',     label: 'Rango / MMR', icon: <TrendingUp className="w-4 h-4" /> },
    { id: 'matches', label: 'Partidas', icon: <Activity className="w-4 h-4" />, badge: matches.length || undefined },
  ];

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header / Search */}
      <div className="glass-card p-5">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, hsl(355 85% 58%) 0%, hsl(355 70% 45%) 100%)' }}>
            <Search className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold">Player Lookup</h2>
            <p className="text-sm text-muted-foreground">
              Perfil completo, rango, historial MMR y partidas — vía <a href="https://henrikdev.xyz" target="_blank" rel="noopener noreferrer" className="text-red-400 hover:underline">HenrikDev API</a>
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Región</label>
            <select value={region} onChange={e => setRegion(e.target.value)} className="input-pro w-full">
              <option value="eu">EU</option>
              <option value="na">NA</option>
              <option value="ap">AP</option>
              <option value="latam">LATAM</option>
              <option value="br">BR</option>
              <option value="kr">KR</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Nombre</label>
            <input className="input-pro w-full" placeholder="NombreJugador" value={name}
              onChange={e => setName(e.target.value)} onKeyDown={e => e.key === 'Enter' && search()} />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Tag</label>
            <input className="input-pro w-full" placeholder="EU1" value={tag}
              onChange={e => setTag(e.target.value)} onKeyDown={e => e.key === 'Enter' && search()} />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Modo partidas</label>
            <select value={mode} onChange={e => setMode(e.target.value)} className="input-pro w-full">
              <option value="competitive">Competitivo</option>
              <option value="unrated">Normal</option>
              <option value="premier">Premier</option>
              <option value="custom">Custom Game</option>
              <option value="deathmatch">Deathmatch</option>
              <option value="teamdeathmatch">TDM</option>
            </select>
          </div>
          <div className="flex items-end">
            <button onClick={search} disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2 h-9">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              {loading ? 'Buscando...' : 'Buscar'}
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3 mt-3 flex-wrap">
          <button onClick={() => setShowKey(!showKey)}
            className="btn-secondary flex items-center gap-1.5 h-8 px-3 text-xs">
            <Key className="w-3 h-3" />
            {getKey() ? '✓ API Key' : 'API Key (opcional)'}
          </button>
          <button onClick={loadStatus} disabled={loadingStatus}
            className="btn-secondary flex items-center gap-1.5 h-8 px-3 text-xs">
            {loadingStatus ? <Loader2 className="w-3 h-3 animate-spin" /> : <Server className="w-3 h-3" />}
            Estado servidor
          </button>
        </div>
      </div>

      {showKey && <KeyPanel onDone={() => setShowKey(false)} />}

      {error && (
        <div className="glass-card p-4 bg-red-500/10 border-red-500/20 text-sm text-red-400 flex items-start gap-2">
          <span>⚠️</span><span>{error}</span>
        </div>
      )}

      {serverStatus && <ServerStatus data={serverStatus} />}

      {!profile && !loading && !error && (
        <div className="glass-card p-16 text-center text-muted-foreground">
          <Search className="w-14 h-14 mx-auto mb-4 opacity-15" />
          <p className="text-base font-medium mb-1">Busca cualquier jugador de Valorant</p>
          <p className="text-sm opacity-70">Introduce nombre#tag y pulsa Buscar</p>
          <p className="text-xs mt-3 opacity-50">No necesitas proxy ni API key oficial de Riot</p>
        </div>
      )}

      {profile && (
        <div className="space-y-4 animate-fade-in">
          <ProfileSection data={profile} />

          {/* Tabs */}
          <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'hsl(220 15% 12%)' }}>
            {tabs.map(t => (
              <button key={t.id} onClick={() => setActiveTab(t.id)}
                className={cn('flex-1 py-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-all relative',
                  activeTab === t.id ? 'bg-red-500/15 border border-red-500/30 text-white' : 'text-muted-foreground hover:text-foreground')}>
                {t.icon}{t.label}
                {t.badge && <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] flex items-center justify-center font-bold">{t.badge}</span>}
              </button>
            ))}
          </div>

          {/* Tab content */}
          {activeTab === 'profile' && (
            <div className="space-y-4">
              {mmr?.current && (
                <div className="glass-card p-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <StatCard label="Rango actual" value={mmr.current.currenttierpatched || '—'}
                    color={rankColor(mmr.current.currenttierpatched || '')} />
                  <StatCard label="RR" value={mmr.current.ranking_in_tier ?? '—'} color="text-yellow-400" />
                  <StatCard label="ELO" value={mmr.current.elo ?? '—'} color="text-blue-400" />
                  <StatCard label="Último cambio" value={mmr.current.mmr_change_to_last_game > 0
                    ? '+' + mmr.current.mmr_change_to_last_game
                    : mmr.current.mmr_change_to_last_game ?? '—'}
                    color={mmr.current.mmr_change_to_last_game > 0 ? 'text-green-400' : 'text-red-400'} />
                </div>
              )}
              {mmrHistory.length > 0 && <MMRHistorySection history={mmrHistory} />}
            </div>
          )}

          {activeTab === 'mmr' && mmr && <MMRSection mmr={mmr} />}
          {activeTab === 'mmr' && !mmr && <p className="text-sm text-muted-foreground text-center py-8">No hay datos de MMR disponibles para este jugador.</p>}

          {activeTab === 'matches' && matches.length > 0 && <MatchesSection matches={matches} />}
          {activeTab === 'matches' && matches.length === 0 && (
            <div className="glass-card p-10 text-center text-muted-foreground">
              <Activity className="w-10 h-10 mx-auto mb-3 opacity-20" />
              <p>No se encontraron partidas en modo {mode}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
