import { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import {
  Plus, Trash2, X, RotateCcw, Eye, EyeOff, Filter,
  ZoomIn, ZoomOut, Maximize2, Video, Link, Play,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Storage ────────────────────────────────────────────────────────────────────
const STORAGE_KEY = 'valoanalytics_death_tracker_v1';

// ── Lista de mapas ─────────────────────────────────────────────────────────────
const MAPS = [
  'Ascent','Bind','Haven','Split','Pearl','Breeze',
  'Abyss','Corrode','Lotus','Fracture','Icebox','Sunset',
];

// ── URLs de minimaps: cargadas dinámicamente desde valorant-api.com ──────────
// Elimina el problema de UUIDs hardcodeados que se quedan obsoletos
let _mapCdnCache: Record<string, string> = {};
let _mapCdnLoaded = false;
let _mapCdnPromise: Promise<void> | null = null;

function loadMapCdnUrls(): Promise<void> {
  if (_mapCdnLoaded) return Promise.resolve();
  if (_mapCdnPromise) return _mapCdnPromise;
  _mapCdnPromise = fetch('https://valorant-api.com/v1/maps')
    .then(r => r.json())
    .then(json => {
      (json.data || []).forEach((m: any) => {
        if (m.displayName && m.minimap) {
          _mapCdnCache[m.displayName] = m.minimap;
        }
      });
      _mapCdnLoaded = true;
    })
    .catch(() => {
      // Si falla la API, usar URLs de fallback con UUIDs conocidos
      _mapCdnCache = {
        'Ascent':   'https://media.valorant-api.com/maps/7eaecc1b-4337-bbf6-6ab9-04b8f06b3319/minimap.png',
        'Bind':     'https://media.valorant-api.com/maps/2c9d57ec-4431-9c5e-2cec-1ab2a0952923/minimap.png',
        'Haven':    'https://media.valorant-api.com/maps/2bee0dc9-4ffe-519b-1cbd-7825ad097c59/minimap.png',
        'Split':    'https://media.valorant-api.com/maps/d960549e-485c-e861-8d71-aa9d1aed12a2/minimap.png',
        'Pearl':    'https://media.valorant-api.com/maps/fd267378-4d1d-484f-ff52-77821ed10dc2/minimap.png',
        'Breeze':   'https://media.valorant-api.com/maps/2fb9a4fd-47b8-4e7d-a969-74b4046ebd53/minimap.png',
        'Abyss':    'https://media.valorant-api.com/maps/224b0a95-48b9-f703-1bd8-67aca101a61f/minimap.png',
        'Lotus':    'https://media.valorant-api.com/maps/2fe4ed3a-4166-11e1-bb37-2fb9a0952923/minimap.png',
        'Fracture': 'https://media.valorant-api.com/maps/b529448b-4d60-346e-e89e-00a4c527a405/minimap.png',
        'Icebox':   'https://media.valorant-api.com/maps/e2ad5c54-4114-a870-9641-8ea21279579a/minimap.png',
        'Sunset':   'https://media.valorant-api.com/maps/92584fbe-486a-b1b2-9faa-39d9a5e3eba5/minimap.png',
        'Corrode':  'https://media.valorant-api.com/maps/c4e5764e-4700-5c39-4e20-aaab8fbf73ea/minimap.png',
      };
      _mapCdnLoaded = true;
    });
  return _mapCdnPromise;
}

// ── Caché de imágenes cargadas (HTMLImageElement) ─────────────────────────────
const _imgCache: Record<string, HTMLImageElement | 'loading' | 'error'> = {};
const _imgCallbacks: Record<string, Array<(img: HTMLImageElement | null) => void>> = {};

function loadMapImageCached(
  mapName: string,
  cb: (img: HTMLImageElement | null) => void,
): void {
  const cached = _imgCache[mapName];
  if (cached === 'loading') {
    (_imgCallbacks[mapName] = _imgCallbacks[mapName] || []).push(cb);
    return;
  }
  if (cached instanceof HTMLImageElement) { cb(cached); return; }
  if (cached === 'error') { cb(null); return; }

  _imgCache[mapName] = 'loading';
  _imgCallbacks[mapName] = [cb];

  const notifyAll = (img: HTMLImageElement | null) => {
    _imgCache[mapName] = img ?? 'error';
    (_imgCallbacks[mapName] || []).forEach(f => f(img));
    _imgCallbacks[mapName] = [];
  };

  const tryLoad = (url: string, onSuccess: (img: HTMLImageElement) => void, onFail: () => void) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload  = () => onSuccess(img);
    img.onerror = () => onFail();
    img.src = url;
  };

  // Primero asegurar que tenemos las URLs del CDN cargadas
  loadMapCdnUrls().then(() => {
    const cdnUrl = _mapCdnCache[mapName];
    if (cdnUrl) {
      tryLoad(
        cdnUrl,
        img => notifyAll(img),
        () => {
          const localUrl = `http://localhost:3001/api/maps/${encodeURIComponent(mapName)}/image`;
          tryLoad(localUrl, img => notifyAll(img), () => notifyAll(null));
        },
      );
    } else {
      const localUrl = `http://localhost:3001/api/maps/${encodeURIComponent(mapName)}/image`;
      tryLoad(localUrl, img => notifyAll(img), () => notifyAll(null));
    }
  });
}

// ── Constantes ─────────────────────────────────────────────────────────────────
const MY_PLAYERS    = ['DavidG','Legarzz','Lubin','Perez','Frospo','SantiChoped'];
const PLAYER_COLORS = ['#ef4444','#3b82f6','#22c55e','#f59e0b','#a855f7','#ec4899'];
const ROUND_TYPES   = ['normal','pistol','eco','force','clutch'] as const;

// ── Tipos ─────────────────────────────────────────────────────────────────────
interface DeathPoint {
  id:     string;
  x:      number;
  y:      number;
  player: string;
  round:  number;
  side:   'ATK'|'DEF';
  type:   typeof ROUND_TYPES[number];
}

interface Session {
  id:         string;
  date:       string;
  mapName:    string;
  opponent:   string;
  tournament: string;
  vodUrl:     string;
  deaths:     DeathPoint[];
  notes:      string;
  createdAt:  number;
}

function uid() { return Date.now().toString(36)+Math.random().toString(36).slice(2); }
function load(): Session[] { try { return JSON.parse(localStorage.getItem(STORAGE_KEY)||'[]'); } catch { return []; } }
function save(d: Session[]) { localStorage.setItem(STORAGE_KEY, JSON.stringify(d)); }

// ── Heatmap ────────────────────────────────────────────────────────────────────
function drawHeatmap(
  canvas: HTMLCanvasElement, deaths: DeathPoint[],
  pFilter: string, sFilter: string, rFilter: number,
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const {width:W, height:H} = canvas;
  ctx.clearRect(0,0,W,H);
  const pts = deaths.filter(d => {
    if (pFilter !== 'Todos' && d.player !== pFilter) return false;
    if (sFilter !== 'Todos' && d.side   !== sFilter) return false;
    if (rFilter > 0         && d.round  !== rFilter) return false;
    return true;
  });
  if (!pts.length) return;
  const R = Math.max(22, Math.min(W,H) * 0.07);
  pts.forEach(d => {
    const cx=d.x*W, cy=d.y*H;
    const pi=MY_PLAYERS.indexOf(d.player);
    const base=pi>=0?PLAYER_COLORS[pi]:'#fff';
    const g=ctx.createRadialGradient(cx,cy,0,cx,cy,R);
    if (pFilter !== 'Todos') {
      g.addColorStop(0,base+'cc'); g.addColorStop(0.5,base+'55'); g.addColorStop(1,base+'00');
    } else {
      g.addColorStop(0,'#ef444499'); g.addColorStop(0.4,'#f9731677'); g.addColorStop(1,'#ef444400');
    }
    ctx.globalCompositeOperation='screen';
    ctx.fillStyle=g; ctx.beginPath(); ctx.arc(cx,cy,R,0,Math.PI*2); ctx.fill();
  });
  ctx.globalCompositeOperation='source-over';
  pts.forEach(d => {
    const cx=d.x*W, cy=d.y*H;
    const pi=MY_PLAYERS.indexOf(d.player);
    const color=pi>=0?PLAYER_COLORS[pi]:'#fff';
    ctx.beginPath(); ctx.arc(cx,cy,5,0,Math.PI*2);
    ctx.fillStyle=color; ctx.fill();
    ctx.strokeStyle='rgba(0,0,0,0.7)'; ctx.lineWidth=1.5; ctx.stroke();
    ctx.fillStyle='#000'; ctx.font='bold 6px Arial';
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(d.player[0],cx,cy);
  });
}

// ── MapCanvas ──────────────────────────────────────────────────────────────────
function MapCanvas({ session, onAddDeath, pFilter, sFilter, rFilter,
  curPlayer, curSide, curRound, curType }: {
  session: Session; onAddDeath: (d: Omit<DeathPoint, 'id'>) => void;
  pFilter: string; sFilter: string; rFilter: number;
  curPlayer: string; curSide: 'ATK' | 'DEF'; curRound: number; curType: typeof ROUND_TYPES[number];
}) {
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const mapImgRef  = useRef<HTMLImageElement | null>(null);
  // Usar refs para los valores que usa draw() → evita stale closures
  const deathsRef  = useRef(session.deaths);
  const pRef       = useRef(pFilter);
  const sRef       = useRef(sFilter);
  const rRef       = useRef(rFilter);
  const heatRef    = useRef(true);

  deathsRef.current = session.deaths;
  pRef.current      = pFilter;
  sRef.current      = sFilter;
  rRef.current      = rFilter;

  const [mapState, setMapState] = useState<'loading' | 'ok' | 'fallback'>('loading');
  const [zoom,     setZoom]     = useState(1);
  const [pan,      setPan]      = useState({ x: 0, y: 0 });
  const [panning,  setPanning]  = useState(false);
  const [showHeat, setShowHeat] = useState(true);
  const panRef2 = useRef({ mx: 0, my: 0, px: 0, py: 0 });

  heatRef.current = showHeat;

  // ── Función de dibujo estable (usa refs → no stale closures) ─────────────────
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    // 1. Fondo oscuro
    ctx.fillStyle = '#0d0f1e';
    ctx.fillRect(0, 0, W, H);

    // 2. Imagen del mapa real (del CDN, ocupa TODO el canvas exactamente)
    if (mapImgRef.current) {
      ctx.globalAlpha = 0.82;
      ctx.drawImage(mapImgRef.current, 0, 0, W, H);
      ctx.globalAlpha = 1;
    }

    if (!heatRef.current) return;

    // 3. Filtrar muertes usando refs (valores siempre actualizados)
    const pts = deathsRef.current.filter(d => {
      if (pRef.current !== 'Todos' && d.player !== pRef.current) return false;
      if (sRef.current !== 'Todos' && d.side   !== sRef.current) return false;
      if (rRef.current > 0         && d.round  !== rRef.current) return false;
      return true;
    });

    if (pts.length === 0) return;

    // 4. Glow radial por jugador (blend mode screen)
    const R = Math.max(24, Math.min(W, H) * 0.075);
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    pts.forEach(d => {
      const cx = d.x * W, cy = d.y * H;
      const pi = MY_PLAYERS.indexOf(d.player);
      const base = pi >= 0 ? PLAYER_COLORS[pi] : '#ffffff';
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
      if (pRef.current !== 'Todos') {
        g.addColorStop(0, base + 'cc');
        g.addColorStop(0.5, base + '55');
        g.addColorStop(1, base + '00');
      } else {
        g.addColorStop(0, '#ef444499');
        g.addColorStop(0.4, '#f9731677');
        g.addColorStop(1, '#ef444400');
      }
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();

    // 5. Puntos individuales con inicial del jugador
    ctx.globalCompositeOperation = 'source-over';
    pts.forEach(d => {
      const cx = d.x * W, cy = d.y * H;
      const pi = MY_PLAYERS.indexOf(d.player);
      const color = pi >= 0 ? PLAYER_COLORS[pi] : '#ffffff';
      ctx.beginPath();
      ctx.arc(cx, cy, 5.5, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.7)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = '#000';
      ctx.font = 'bold 6px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(d.player[0], cx, cy);
    });
  }, []); // sin dependencias — usa refs siempre actualizados

  // ── Cargar imagen cuando cambia el mapa ──────────────────────────────────────
  useEffect(() => {
    setMapState('loading');
    mapImgRef.current = null;
    setZoom(1);
    setPan({ x: 0, y: 0 });
    draw(); // fondo inmediatamente

    loadMapImageCached(session.mapName, (img) => {
      mapImgRef.current = img;
      setMapState(img ? 'ok' : 'fallback');
      draw(); // redibujar con imagen real
    });
  }, [session.mapName, draw]);

  // ── Redibujar cuando cambia cualquier dato visual ─────────────────────────────
  useEffect(() => { draw(); }, [session.deaths, pFilter, sFilter, rFilter, showHeat, mapState, draw]);

  // ── Click: añadir muerte ──────────────────────────────────────────────────────
  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (panning) return;
    const rect = canvasRef.current!.getBoundingClientRect();
    // getBoundingClientRect devuelve tamaño visual (ya escalado por CSS transform)
    // → dividir por tamaño visual da coordenadas normalizadas [0,1] directamente
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top)  / rect.height;
    if (x < 0 || x > 1 || y < 0 || y > 1) return;
    onAddDeath({ x, y, player: curPlayer, round: curRound, side: curSide, type: curType });
  };

  // ── Zoom / Pan ────────────────────────────────────────────────────────────────
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    setZoom(z => Math.max(1, Math.min(4, z + (e.deltaY > 0 ? -0.25 : 0.25))));
  };
  const handleMD = (e: React.MouseEvent) => {
    if (e.button === 1 || e.button === 2) {
      e.preventDefault();
      setPanning(true);
      panRef2.current = { mx: e.clientX, my: e.clientY, px: pan.x, py: pan.y };
    }
  };
  const handleMM = (e: React.MouseEvent) => {
    if (!panning) return;
    setPan({ x: panRef2.current.px + (e.clientX - panRef2.current.mx), y: panRef2.current.py + (e.clientY - panRef2.current.my) });
  };
  const handleMU = () => setPanning(false);

  // Puntos visibles para leyenda
  const visible = session.deaths.filter(d => {
    if (pFilter !== 'Todos' && d.player !== pFilter) return false;
    if (sFilter !== 'Todos' && d.side   !== sFilter) return false;
    if (rFilter > 0          && d.round  !== rFilter) return false;
    return true;
  });

  return (
    <div className="space-y-2">
      {/* Barra controles */}
      <div className="flex items-center justify-between text-xs flex-wrap gap-2">
        <span className="text-muted-foreground text-[11px]">
          Clic = marcar <strong className="text-white">{curPlayer}</strong> R{curRound}
          {' · '}Rueda=zoom · Botón der=mover
        </span>
        <div className="flex items-center gap-1">
          <button onClick={() => setZoom(z => Math.min(4, z + 0.25))}
            className="p-1.5 rounded-lg border border-white/10 text-muted-foreground hover:text-white transition-colors">
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <span className="text-[10px] text-muted-foreground w-10 text-center">{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom(z => Math.max(1, z - 0.25))}
            className="p-1.5 rounded-lg border border-white/10 text-muted-foreground hover:text-white transition-colors">
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}
            className="p-1.5 rounded-lg border border-white/10 text-muted-foreground hover:text-white transition-colors">
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => setShowHeat(v => !v)}
            className={cn('flex items-center gap-1 px-2 py-1 rounded-lg border text-[10px] transition-all ml-1',
              showHeat ? 'bg-red-500/15 border-red-500/30 text-red-300' : 'border-white/10 text-muted-foreground hover:text-white')}>
            {showHeat ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />} Heatmap
          </button>
          {mapState === 'loading' && <span className="text-[10px] text-muted-foreground/50 animate-pulse ml-1">cargando…</span>}
          {mapState === 'fallback' && <span className="text-[10px] text-yellow-500/70 ml-1">sin internet</span>}
          {mapState === 'ok' && <span className="text-[10px] text-green-500/60 ml-1">✓</span>}
        </div>
      </div>

      {/* Contenedor con zoom/pan */}
      <div className="relative rounded-xl overflow-hidden select-none"
        style={{ background: '#0d0f1e', aspectRatio: '1/1', maxWidth: 520 }}>
        <div style={{
          position: 'absolute', inset: 0,
          transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
          transformOrigin: '0 0',
        }}>
          <canvas
            ref={canvasRef}
            width={512}
            height={512}
            className="w-full h-full block"
            style={{ cursor: panning ? 'grabbing' : zoom > 1 ? 'grab' : 'crosshair' }}
            onClick={handleClick}
            onWheel={handleWheel}
            onMouseDown={handleMD}
            onMouseMove={handleMM}
            onMouseUp={handleMU}
            onMouseLeave={handleMU}
            onContextMenu={e => e.preventDefault()}
          />
        </div>
      </div>

      {/* Leyenda */}
      <div className="flex flex-wrap gap-2 text-[10px]">
        {MY_PLAYERS.map((p, i) => {
          const count = visible.filter(d => d.player === p).length;
          return count > 0 ? (
            <span key={p} className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: PLAYER_COLORS[i] }} />
              <span className="text-muted-foreground">{p}</span>
              <span className="font-bold text-white">{count}</span>
            </span>
          ) : null;
        })}
        {visible.length > 0 && <span className="text-muted-foreground ml-auto">{visible.length} muertes</span>}
      </div>
    </div>
  );
}

// ── VOD Panel ─────────────────────────────────────────────────────────────────
function VodPanel({ session, onUpdate }: { session:Session; onUpdate:(url:string)=>void }) {
  const [editUrl, setEditUrl] = useState(session.vodUrl||'');
  const [show, setShow] = useState(!!session.vodUrl);

  const toEmbed = (url: string): string|null => {
    if (!url) return null;
    const ytV  = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s?]+)/);
    if (ytV)  return `https://www.youtube.com/embed/${ytV[1]}?controls=1`;
    const ytL  = url.match(/youtube\.com\/live\/([^?&\s]+)/);
    if (ytL)  return `https://www.youtube.com/embed/${ytL[1]}?controls=1`;
    const twV  = url.match(/twitch\.tv\/videos\/(\d+)/);
    if (twV)  return `https://player.twitch.tv/?video=${twV[1]}&parent=localhost`;
    const twC  = url.match(/twitch\.tv\/([^/?\s]+)$/);
    if (twC)  return `https://player.twitch.tv/?channel=${twC[1]}&parent=localhost`;
    if (url.startsWith('http')) return url;
    return null;
  };

  const embedUrl = toEmbed(session.vodUrl||'');

  return (
    <div className="glass-card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/8">
        <div className="flex items-center gap-2"><Video className="w-4 h-4 text-red-400"/><span className="text-sm font-bold">VOD</span></div>
        <button onClick={()=>setShow(v=>!v)} className="text-xs text-muted-foreground hover:text-white transition-colors">{show?'Ocultar':'Mostrar'}</button>
      </div>
      {show&&(
        <div className="p-3 space-y-3">
          <div className="flex gap-2">
            <div className="flex-1 flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2" style={{background:'hsl(220 20% 8%)'}}>
              <Link className="w-3.5 h-3.5 text-muted-foreground shrink-0"/>
              <input value={editUrl} onChange={e=>setEditUrl(e.target.value)}
                onKeyDown={e=>e.key==='Enter'&&onUpdate(editUrl)}
                placeholder="YouTube, Twitch VOD…"
                className="flex-1 bg-transparent text-xs text-white outline-none placeholder:text-muted-foreground/50"/>
            </div>
            <button onClick={()=>onUpdate(editUrl)} className="px-3 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white text-xs transition-colors"><Play className="w-3.5 h-3.5"/></button>
          </div>
          {embedUrl ? (
            <div className="rounded-xl overflow-hidden" style={{aspectRatio:'16/9'}}>
              <iframe src={embedUrl} className="w-full h-full" allowFullScreen frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture"/>
            </div>
          ) : session.vodUrl ? (
            <p className="text-xs text-yellow-400 text-center py-2">Formato no reconocido. Prueba YouTube o Twitch.</p>
          ) : null}
          <p className="text-[10px] text-muted-foreground/50">YouTube · youtu.be · youtube.com/live · twitch.tv/videos</p>
        </div>
      )}
    </div>
  );
}

// ── Componente principal ───────────────────────────────────────────────────────
export function DeathTracker() {
  const [sessions,     setSessions]     = useState<Session[]>(load);
  const [activeId,     setActiveId]     = useState<string|null>(null);
  const [showNew,      setShowNew]      = useState(false);
  const [curPlayer,    setCurPlayer]    = useState(MY_PLAYERS[0]);
  const [curSide,      setCurSide]      = useState<'ATK'|'DEF'>('ATK');
  const [curRound,     setCurRound]     = useState(1);
  const [curType,      setCurType]      = useState<typeof ROUND_TYPES[number]>('normal');
  const [pFilter,      setPFilter]      = useState('Todos');
  const [sFilter,      setSFilter]      = useState('Todos');
  const [rFilter,      setRFilter]      = useState(0);
  const [newForm, setNewForm] = useState({
    date: new Date().toISOString().split('T')[0],
    mapName:'Ascent', opponent:'', tournament:'', vodUrl:'',
  });

  const persist = (d: Session[]) => { setSessions(d); save(d); };

  const createSession = () => {
    const ns: Session = {id:uid(), ...newForm, notes:'', deaths:[], createdAt:Date.now()};
    persist([ns, ...sessions]);
    setActiveId(ns.id);
    setShowNew(false);
    setNewForm({date:new Date().toISOString().split('T')[0],mapName:'Ascent',opponent:'',tournament:'',vodUrl:''});
  };

  const addDeath    = (sid:string, d:Omit<DeathPoint,'id'>) =>
    persist(sessions.map(s=>s.id===sid?{...s,deaths:[...s.deaths,{...d,id:uid()}]}:s));
  const undoLast    = (sid:string) =>
    persist(sessions.map(s=>s.id===sid?{...s,deaths:s.deaths.slice(0,-1)}:s));
  const clearAll    = (sid:string) => {
    if (confirm('¿Borrar todos los puntos?'))
      persist(sessions.map(s=>s.id===sid?{...s,deaths:[]}:s));
  };
  const delSession  = (id:string) => {
    if (confirm('¿Eliminar sesión?')) {
      const next = sessions.filter(s=>s.id!==id);
      persist(next);
      if (activeId===id) setActiveId(next[0]?.id||null);
    }
  };
  const updateVod   = (sid:string, url:string) =>
    persist(sessions.map(s=>s.id===sid?{...s,vodUrl:url}:s));

  const session = sessions.find(s=>s.id===activeId);

  const playerStats = useMemo(() => {
    if (!session) return [];
    return MY_PLAYERS.map((p,i)=>{
      const d=session.deaths.filter(x=>x.player===p);
      return {player:p,color:PLAYER_COLORS[i],total:d.length,
        atk:d.filter(x=>x.side==='ATK').length,def:d.filter(x=>x.side==='DEF').length};
    }).filter(p=>p.total>0);
  },[session]);

  const byRound = useMemo(()=>{
    if (!session) return [];
    const m:Record<number,number>={};
    session.deaths.forEach(d=>{m[d.round]=(m[d.round]||0)+1;});
    return Object.entries(m).map(([r,n])=>({round:+r,count:n})).sort((a,b)=>a.round-b.round);
  },[session]);

  return (
    <div className="p-6 space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-black">Death Tracker</h2>
          <p className="text-sm text-muted-foreground">Heatmap manual · Zoom · VOD integrado</p>
        </div>
        <button onClick={()=>setShowNew(v=>!v)}
          className={cn('flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all',
            showNew?'bg-red-500/20 border border-red-500/40 text-red-300':'btn-primary')}>
          {showNew?<X className="w-4 h-4"/>:<Plus className="w-4 h-4"/>}
          {showNew?'Cancelar':'Nueva sesión'}
        </button>
      </div>

      {/* Formulario nueva sesión */}
      {showNew && (
        <div className="glass-card p-4 space-y-3">
          <p className="text-sm font-semibold">Nueva sesión</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Fecha</label>
              <input type="date" value={newForm.date} onChange={e=>setNewForm(f=>({...f,date:e.target.value}))} className="input-pro"/>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Mapa</label>
              <select value={newForm.mapName} onChange={e=>setNewForm(f=>({...f,mapName:e.target.value}))} className="input-pro">
                {MAPS.map(m=><option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Rival</label>
              <input value={newForm.opponent} onChange={e=>setNewForm(f=>({...f,opponent:e.target.value}))} placeholder="Nombre…" className="input-pro"/>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Torneo</label>
              <input value={newForm.tournament} onChange={e=>setNewForm(f=>({...f,tournament:e.target.value}))} placeholder="Torneo/scrim…" className="input-pro"/>
            </div>
            <div className="col-span-2">
              <label className="text-xs text-muted-foreground mb-1 block">URL VOD (opcional)</label>
              <input value={newForm.vodUrl} onChange={e=>setNewForm(f=>({...f,vodUrl:e.target.value}))} placeholder="youtube.com/watch?v=…" className="input-pro"/>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={()=>setShowNew(false)} className="px-3 py-1.5 rounded-xl border border-white/10 text-xs text-muted-foreground hover:text-white transition-colors">Cancelar</button>
            <button onClick={createSession} className="px-3 py-1.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-xs font-medium transition-colors">Crear</button>
          </div>
        </div>
      )}

      {/* Selector de sesiones (con selector de mapa inline) */}
      {sessions.length > 0 && (
        <div className="glass-card p-3 space-y-2">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Sesiones</p>
          <div className="flex gap-2 flex-wrap">
            {sessions.map(s=>(
              <button key={s.id} onClick={()=>setActiveId(s.id)}
                className={cn('flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-medium transition-all',
                  activeId===s.id?'bg-red-500/20 border-red-500/40 text-white':'border-white/10 text-muted-foreground hover:text-white')}>
                <span className="font-bold">{s.mapName}</span>
                {s.opponent&&<span className="text-muted-foreground">vs {s.opponent}</span>}
                {s.vodUrl&&<Video className="w-3 h-3 text-blue-400"/>}
                <span className="text-muted-foreground/50">{s.deaths.length}m</span>
                <span onClick={e=>{e.stopPropagation();delSession(s.id);}}
                  className="text-red-400/40 hover:text-red-400 cursor-pointer ml-0.5">×</span>
              </button>
            ))}
          </div>

          {/* Cambiar mapa de la sesión activa sin crear una nueva */}
          {session && (
            <div className="flex items-center gap-3 pt-2 border-t border-white/8">
              <span className="text-[10px] text-muted-foreground">Cambiar mapa:</span>
              <div className="flex gap-1 flex-wrap">
                {MAPS.map(m=>(
                  <button key={m} onClick={()=>persist(sessions.map(s=>s.id===session.id?{...s,mapName:m}:s))}
                    className={cn('text-[10px] px-2 py-1 rounded-lg border transition-all',
                      session.mapName===m?'bg-red-500/20 border-red-500/40 text-red-300':'border-white/10 text-muted-foreground hover:text-white')}>
                    {m}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {session ? (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-5">

          {/* Columna izquierda */}
          <div className="space-y-4">

            {/* Controles de marcaje */}
            <div className="glass-card p-4 space-y-3">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1.5 uppercase">Jugador</p>
                  <div className="flex flex-col gap-1">
                    {MY_PLAYERS.map((p,i)=>(
                      <button key={p} onClick={()=>setCurPlayer(p)}
                        className={cn('text-xs px-2 py-1 rounded-lg border text-left flex items-center gap-1.5 transition-all',
                          curPlayer===p?'text-white':'border-white/10 text-muted-foreground hover:text-white')}
                        style={curPlayer===p?{borderColor:PLAYER_COLORS[i],background:PLAYER_COLORS[i]+'22'}:{}}>
                        <span className="w-2 h-2 rounded-full shrink-0" style={{background:PLAYER_COLORS[i]}}/>{p}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1.5 uppercase">Lado</p>
                  <div className="flex flex-col gap-1">
                    {(['ATK','DEF'] as const).map(s=>(
                      <button key={s} onClick={()=>setCurSide(s)}
                        className={cn('text-xs px-3 py-2 rounded-lg border font-medium transition-all',
                          curSide===s?s==='ATK'?'bg-yellow-500/20 border-yellow-500/50 text-yellow-300':'bg-blue-500/20 border-blue-500/50 text-blue-300':'border-white/10 text-muted-foreground hover:text-white')}>
                        {s==='ATK'?'⚔ ATK':'🛡 DEF'}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1.5 uppercase">Ronda</p>
                  <input type="number" min={1} max={30} value={curRound}
                    onChange={e=>setCurRound(+e.target.value||1)}
                    className="input-pro text-center text-xl font-bold w-full"/>
                  <div className="flex gap-1 mt-1">
                    <button onClick={()=>setCurRound(r=>Math.max(1,r-1))} className="flex-1 text-xs rounded-lg border border-white/10 py-1 hover:bg-white/10 transition-colors">−</button>
                    <button onClick={()=>setCurRound(r=>r+1)} className="flex-1 text-xs rounded-lg border border-white/10 py-1 hover:bg-white/10 transition-colors">+</button>
                  </div>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1.5 uppercase">Tipo</p>
                  <div className="flex flex-col gap-1">
                    {ROUND_TYPES.map(t=>(
                      <button key={t} onClick={()=>setCurType(t)}
                        className={cn('text-xs px-2 py-1 rounded-lg border transition-all',
                          curType===t?'bg-white/10 border-white/30 text-white':'border-white/10 text-muted-foreground hover:text-white')}>
                        {t==='normal'?'Normal':t==='pistol'?'🔫 Pistola':t==='eco'?'💸 Eco':t==='force'?'⚡ Force':'⭐ Clutch'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex gap-2 pt-2 border-t border-white/8">
                <button onClick={()=>undoLast(session.id)} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl border border-white/10 text-muted-foreground hover:text-white transition-colors">
                  <RotateCcw className="w-3.5 h-3.5"/> Deshacer
                </button>
                <button onClick={()=>clearAll(session.id)} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl border border-red-500/20 text-red-400/60 hover:text-red-400 transition-colors">
                  <Trash2 className="w-3.5 h-3.5"/> Limpiar
                </button>
                <span className="text-xs text-muted-foreground ml-auto self-center">{session.deaths.length} puntos</span>
              </div>
            </div>

            {/* Filtros */}
            <div className="glass-card p-3 flex flex-wrap gap-3 items-end">
              <Filter className="w-3.5 h-3.5 text-muted-foreground self-center"/>
              {[
                {l:'Jugador',v:pFilter,fn:setPFilter,opts:['Todos',...MY_PLAYERS]},
                {l:'Lado',   v:sFilter,fn:setSFilter,opts:['Todos','ATK','DEF']},
              ].map(({l,v,fn,opts})=>(
                <div key={l}>
                  <p className="text-[9px] text-muted-foreground mb-1">{l}</p>
                  <select value={v} onChange={e=>fn(e.target.value)} className="input-pro text-xs py-1">
                    {opts.map(o=><option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
              ))}
              <div>
                <p className="text-[9px] text-muted-foreground mb-1">Ronda</p>
                <select value={rFilter} onChange={e=>setRFilter(+e.target.value)} className="input-pro text-xs py-1">
                  <option value={0}>Todas</option>
                  {Array.from(new Set(session.deaths.map(d=>d.round))).sort((a,b)=>a-b).map(r=>(
                    <option key={r} value={r}>R{r}</option>
                  ))}
                </select>
              </div>
              {(pFilter!=='Todos'||sFilter!=='Todos'||rFilter>0)&&(
                <button onClick={()=>{setPFilter('Todos');setSFilter('Todos');setRFilter(0);}}
                  className="text-xs text-red-400 hover:text-red-300 self-end pb-0.5">× Limpiar</button>
              )}
            </div>

            {/* MAPA */}
            <div className="glass-card p-4">
              <MapCanvas
                session={session} onAddDeath={d=>addDeath(session.id,d)}
                pFilter={pFilter} sFilter={sFilter} rFilter={rFilter}
                curPlayer={curPlayer} curSide={curSide} curRound={curRound} curType={curType}
              />
            </div>

            {/* VOD */}
            <VodPanel session={session} onUpdate={url=>updateVod(session.id,url)}/>
          </div>

          {/* Columna derecha */}
          <div className="space-y-4">
            <div className="glass-card p-4 space-y-1.5">
              <p className="text-sm font-bold">{session.mapName}
                {session.opponent&&<span className="text-muted-foreground font-normal"> vs {session.opponent}</span>}
              </p>
              <p className="text-xs text-muted-foreground">{session.date}{session.tournament?' · '+session.tournament:''}</p>
              <p className="text-xs text-muted-foreground">{session.deaths.length} muertes registradas</p>
            </div>

            {playerStats.length>0&&(
              <div className="glass-card p-4 space-y-3">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Por jugador</p>
                {playerStats.map(p=>(
                  <div key={p.player} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-xs font-medium">
                        <span className="w-2.5 h-2.5 rounded-full" style={{background:p.color}}/>{p.player}
                      </span>
                      <span className="text-xs font-bold">{p.total}</span>
                    </div>
                    <div className="flex gap-1 text-[9px]">
                      <span className="text-yellow-400">ATK:{p.atk}</span>
                      <span className="text-muted-foreground">·</span>
                      <span className="text-blue-400">DEF:{p.def}</span>
                    </div>
                    <div className="flex h-1.5 rounded-full overflow-hidden gap-0.5">
                      {p.atk>0&&<div style={{flex:p.atk,background:'#f59e0b'}} className="rounded-full"/>}
                      {p.def>0&&<div style={{flex:p.def,background:'#3b82f6'}} className="rounded-full"/>}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {byRound.length>0&&(
              <div className="glass-card p-4 space-y-2">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Por ronda</p>
                <div className="space-y-1 max-h-52 overflow-y-auto">
                  {byRound.map(r=>(
                    <div key={r.round} className="flex items-center gap-2 text-xs">
                      <button onClick={()=>setRFilter(rFilter===r.round?0:r.round)}
                        className={cn('w-8 text-right shrink-0 hover:text-white transition-colors',
                          rFilter===r.round?'text-white font-bold':'text-muted-foreground')}>
                        R{r.round}
                      </button>
                      <div className="flex-1 h-1.5 rounded-full bg-white/8">
                        <div className="h-full rounded-full bg-red-500"
                          style={{width:`${Math.min(100,r.count/Math.max(...byRound.map(x=>x.count))*100)}%`}}/>
                      </div>
                      <span className="text-muted-foreground w-4 text-right shrink-0">{r.count}</span>
                    </div>
                  ))}
                </div>
                <p className="text-[9px] text-muted-foreground">Clic = filtrar heatmap</p>
              </div>
            )}

            {session.deaths.length>0&&(
              <div className="glass-card p-4 space-y-2">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Últimas muertes</p>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {[...session.deaths].reverse().slice(0,20).map(d=>{
                    const pi=MY_PLAYERS.indexOf(d.player);
                    const color=pi>=0?PLAYER_COLORS[pi]:'#fff';
                    return (
                      <div key={d.id} className="flex items-center gap-1.5 text-[10px]">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{background:color}}/>
                        <span style={{color}} className="font-medium">{d.player}</span>
                        <span className="text-muted-foreground">R{d.round}</span>
                        <span className={d.side==='ATK'?'text-yellow-400':'text-blue-400'}>{d.side}</span>
                        {d.type!=='normal'&&<span className="text-muted-foreground/50 capitalize">{d.type}</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="glass-card p-12 text-center">
          <p className="text-muted-foreground">
            {sessions.length===0?'Crea una sesión para empezar.':'Selecciona una sesión arriba.'}
          </p>
        </div>
      )}
    </div>
  );
}
