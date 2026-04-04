import { useState, useRef, useEffect } from 'react';
import { Share2, Download, Camera } from 'lucide-react';
import { cn } from '@/lib/utils';

const HENRIK_MATCH_CACHE = 'valoanalytics_henrik_matches_v1';
function getCachedMatches(): any[] {
  try { return JSON.parse(localStorage.getItem(HENRIK_MATCH_CACHE) || '[]'); } catch { return []; }
}

const THEMES = [
  { id:'valorant', label:'Valorant', bg:'#120a0b', accent:'#ff4655', text:'#fffbf0', sub:'#c9b99a', line:'#ff465530' },
  { id:'dark',     label:'Dark',     bg:'#0d0f14', accent:'#ef4444', text:'#ffffff',  sub:'#9ca3af', line:'#ef444420' },
  { id:'neon',     label:'Neon',     bg:'#050810', accent:'#00e5ff', text:'#ffffff',  sub:'#67e8f9', line:'#00e5ff20' },
  { id:'midnight', label:'Midnight', bg:'#06081a', accent:'#818cf8', text:'#e2e8f0',  sub:'#6366f1', line:'#818cf830' },
];

export function PostMatchGenerator() {
  const [matches] = useState<any[]>(getCachedMatches);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [theme, setTheme] = useState(THEMES[0]);
  const [selectedPuuid, setSelectedPuuid] = useState('');
  const [downloading, setDownloading] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const match = matches[selectedIdx];
  const allPlayers: any[] = match?.players?.all_players || [];
  const focusPlayer = allPlayers.find(p => p.puuid === selectedPuuid) || allPlayers[0];
  const blueWon = match?.teams?.blue?.has_won || (match?.teams?.blue?.rounds_won > match?.teams?.red?.rounds_won);
  const won = focusPlayer ? (focusPlayer.team === 'Blue' ? blueWon : !blueWon) : blueWon;
  const bScore = match?.teams?.blue?.rounds_won ?? 0;
  const rScore = match?.teams?.red?.rounds_won  ?? 0;
  const fStats = focusPlayer?.stats || {};
  const kda = `${fStats.kills||0}/${fStats.deaths||0}/${fStats.assists||0}`;
  const kd = fStats.deaths > 0 ? (fStats.kills/fStats.deaths).toFixed(2) : String(fStats.kills||0);
  const hs = fStats.kills > 0 ? Math.round((fStats.headshots||0)/fStats.kills*100) : 0;
  const rounds = match?.rounds?.length || (bScore+rScore);
  const acs = fStats.score && rounds > 0 ? Math.round(fStats.score/rounds) : 0;

  function rr(ctx: CanvasRenderingContext2D, x:number,y:number,w:number,h:number,r:number,fill:string) {
    ctx.fillStyle = fill;
    ctx.beginPath(); ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y);
    ctx.arcTo(x+w,y,x+w,y+r,r); ctx.lineTo(x+w,y+h-r);
    ctx.arcTo(x+w,y+h,x+w-r,y+h,r); ctx.lineTo(x+r,y+h);
    ctx.arcTo(x,y+h,x,y+h-r,r); ctx.lineTo(x,y+r);
    ctx.arcTo(x,y,x+r,y,r); ctx.closePath(); ctx.fill();
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !match) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    const W = 800, H = 420; canvas.width = W; canvas.height = H;
    const t = theme;

    // Fondo
    ctx.fillStyle = t.bg; ctx.fillRect(0,0,W,H);

    // Grid decorativo
    ctx.strokeStyle = t.accent+'10'; ctx.lineWidth = 1;
    for (let i=0;i<10;i++) { ctx.beginPath(); ctx.moveTo(0,i*46); ctx.lineTo(W,i*46); ctx.stroke(); }
    for (let i=0;i<18;i++) { ctx.beginPath(); ctx.moveTo(i*48,0); ctx.lineTo(i*48,H); ctx.stroke(); }

    // Barra izquierda degradado
    const g = ctx.createLinearGradient(0,0,0,H);
    g.addColorStop(0,t.accent); g.addColorStop(1,t.accent+'00');
    ctx.fillStyle = g; ctx.fillRect(0,0,5,H);

    // Triángulo decorativo fondo
    ctx.fillStyle = t.accent+'08';
    ctx.beginPath(); ctx.moveTo(W,0); ctx.lineTo(W-300,0); ctx.lineTo(W,300); ctx.closePath(); ctx.fill();

    // WON / LOST watermark
    ctx.save();
    ctx.font = 'bold 100px monospace';
    ctx.fillStyle = won ? t.accent+'10' : '#ffffff08';
    ctx.fillText(won?'VICTORY':'DEFEAT', 20, 290);
    ctx.restore();

    // Mapa + modo (top)
    ctx.font = '12px monospace'; ctx.fillStyle = t.sub;
    const mapLabel = `${(match.metadata?.map||'MAP').toUpperCase()}  ·  ${(match.metadata?.mode||'COMPETITIVO').toUpperCase()}  ·  ${match.metadata?.game_start_patched||''}`;
    ctx.fillText(mapLabel, 22, 36);

    // Score central grande
    const scoreText = `${bScore}   —   ${rScore}`;
    ctx.font = 'bold 56px monospace';
    const scoreW = ctx.measureText(scoreText).width;
    ctx.fillStyle = t.text+'20'; // sombra
    ctx.fillText(scoreText, W/2 - scoreW/2 + 2, 102);
    ctx.fillStyle = t.text;
    ctx.fillText(scoreText, W/2 - scoreW/2, 100);

    // Blue / Red labels
    ctx.font = '10px monospace';
    ctx.fillStyle = '#60a5fa'; ctx.fillText('BLUE', W/2 - scoreW/2 + 2, 116);
    ctx.fillStyle = '#f87171'; ctx.fillText('RED', W/2 + scoreW/2 - 30, 116);

    // Badge resultado
    ctx.font = 'bold 13px monospace';
    const badge = won ? '✦  VICTORIA  ✦' : '✦  DERROTA  ✦';
    const bw = ctx.measureText(badge).width + 32;
    rr(ctx, W/2-bw/2, 124, bw, 26, 4, won?t.accent+'28':'#ffffff10');
    ctx.fillStyle = won ? t.accent : '#6b7280';
    ctx.fillText(badge, W/2 - ctx.measureText(badge).width/2, 142);

    // Jugador principal
    if (focusPlayer) {
      ctx.font = 'bold 30px monospace'; ctx.fillStyle = t.text;
      ctx.fillText(focusPlayer.name||'Player', 22, 200);
      ctx.font = '13px monospace'; ctx.fillStyle = t.accent;
      ctx.fillText((focusPlayer.character||'').toUpperCase(), 22, 220);

      // Stats 4 columnas
      const statItems = [
        {label:'K/D/A',  value: kda},
        {label:'K/D',    value: kd},
        {label:'HS %',   value: `${hs}%`},
        {label:'ACS',    value: acs > 0 ? String(acs) : '—'},
      ];
      statItems.forEach((item, i) => {
        const x = 22 + i * 175;
        ctx.font = 'bold 28px monospace'; ctx.fillStyle = t.accent;
        ctx.fillText(item.value, x, 300);
        ctx.font = '11px monospace'; ctx.fillStyle = t.sub;
        ctx.fillText(item.label, x, 318);
      });
    }

    // Top fraggers tabla derecha
    const top5 = [...allPlayers].sort((a:any,b:any)=>(b.stats?.kills||0)-(a.stats?.kills||0)).slice(0,5);
    const tx = W - 238, ty = 152;
    rr(ctx, tx-10, ty-18, 228, top5.length*38+24, 8, '#ffffff06');
    ctx.font = 'bold 10px monospace'; ctx.fillStyle = t.sub;
    ctx.fillText('TOP FRAGGERS', tx, ty-4);

    top5.forEach((p:any, i) => {
      const y = ty + 14 + i*38;
      const isBlue = p.team === 'Blue';
      rr(ctx, tx-8, y-14, 224, 30, 4, isBlue?'#3b82f614':'#ef444414');
      ctx.font = 'bold 12px monospace';
      ctx.fillStyle = isBlue ? '#93c5fd' : '#fca5a5';
      ctx.fillText(p.name||'?', tx, y+1);
      ctx.font = 'bold 13px monospace'; ctx.fillStyle = t.text;
      ctx.fillText(`${p.stats?.kills||0}K`, tx+192, y+1);
      if (p.character) {
        ctx.font = '10px monospace'; ctx.fillStyle = t.sub;
        ctx.fillText(p.character, tx, y+14);
      }
    });

    // Watermark
    ctx.font = 'bold 11px monospace'; ctx.fillStyle = t.accent+'50';
    ctx.fillText('ValoAnalytics Pro', W-148, H-12);
  }, [match, theme, focusPlayer, selectedPuuid]);

  const download = () => {
    const canvas = canvasRef.current; if (!canvas) return;
    setDownloading(true);
    const a = document.createElement('a');
    a.download = `valoanalytics-${match?.metadata?.map||'match'}.png`;
    a.href = canvas.toDataURL('image/png'); a.click();
    setTimeout(() => setDownloading(false), 1500);
  };

  if (matches.length === 0) {
    return (
      <div className="glass-card p-12 flex flex-col items-center justify-center text-center animate-fade-in">
        <Camera className="w-12 h-12 text-red-500/30 mb-4"/>
        <h3 className="text-lg font-bold mb-2">Sin partidos cargados</h3>
        <p className="text-muted-foreground text-sm">Carga partidos desde <strong>Match Viewer</strong> para generar la imagen.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="glass-card p-5">
        <h2 className="font-bold text-lg flex items-center gap-2 mb-1"><Share2 className="w-5 h-5 text-red-400"/> Generador Post-Match</h2>
        <p className="text-sm text-muted-foreground">Imagen para compartir en redes · {matches.length} partidos disponibles</p>
      </div>
      <div className="grid grid-cols-[280px,1fr] gap-5">
        <div className="space-y-4">
          <div className="glass-card p-4 space-y-3">
            <h3 className="text-sm font-semibold">Configuración</h3>
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">Partido</label>
              <select value={selectedIdx} onChange={e=>setSelectedIdx(+e.target.value)}
                className="w-full text-xs rounded-xl px-3 py-2 border" style={{background:'hsl(220 15% 10%)',borderColor:'hsl(220 15% 20%)'}}>
                {matches.map((m:any,i:number)=>(
                  <option key={i} value={i}>{m.metadata?.map||'Mapa'} · {m.metadata?.game_start_patched?.slice(0,10)||`#${i+1}`}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">Jugador destacado</label>
              <select value={selectedPuuid} onChange={e=>setSelectedPuuid(e.target.value)}
                className="w-full text-xs rounded-xl px-3 py-2 border" style={{background:'hsl(220 15% 10%)',borderColor:'hsl(220 15% 20%)'}}>
                <option value="">Top fragger (auto)</option>
                {allPlayers.map((p:any)=><option key={p.puuid} value={p.puuid}>{p.name} ({p.character})</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">Tema</label>
              <div className="grid grid-cols-2 gap-2">
                {THEMES.map(th=>(
                  <button key={th.id} onClick={()=>setTheme(th)}
                    className={cn('px-3 py-2 rounded-xl text-xs font-medium border transition-all flex items-center gap-2',
                      theme.id===th.id?'border-red-500/40 bg-red-500/10 text-white':'border-white/10 text-muted-foreground hover:text-white')}>
                    <div className="w-3 h-3 rounded-full" style={{background:th.accent}}/>{th.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <button onClick={download} className="w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all"
            style={{background:'hsl(355 85% 58% / 0.25)',border:'1px solid hsl(355 85% 58% / 0.4)',color:'hsl(355 85% 70%)'}}>
            <Download className="w-4 h-4"/>{downloading?'Descargando...':'Descargar PNG (800×420)'}
          </button>
        </div>
        <div className="glass-card p-4">
          <p className="text-xs text-muted-foreground mb-3">Vista previa</p>
          <canvas ref={canvasRef} className="w-full rounded-xl border border-white/10" style={{imageRendering:'crisp-edges'}}/>
        </div>
      </div>
    </div>
  );
}
