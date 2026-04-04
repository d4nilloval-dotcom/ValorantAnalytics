import { useState, useEffect } from 'react';
import { Monitor, ChevronLeft, ChevronRight, X, Maximize2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const HENRIK_MATCH_CACHE = 'valoanalytics_henrik_matches_v1';
function getCachedMatches(): any[] {
  try { return JSON.parse(localStorage.getItem(HENRIK_MATCH_CACHE) || '[]'); } catch { return []; }
}

type SlideType = 'overview'|'scoreboard'|'mvp'|'stats'|'economy';
interface Slide { id: SlideType; title: string; icon: string; }
const SLIDES: Slide[] = [
  { id:'overview',   title:'Resumen del Partido', icon:'🏆' },
  { id:'scoreboard', title:'Scoreboard',           icon:'📊' },
  { id:'mvp',        title:'MVP del Partido',      icon:'⭐' },
  { id:'stats',      title:'Estadísticas',         icon:'📈' },
  { id:'economy',    title:'Análisis Económico',   icon:'💰' },
];

function BigStat({ label, value, color='#ef4444', sub }: any) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl p-6" style={{background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.07)'}}>
      <p className="text-xs font-mono uppercase tracking-widest" style={{color:'rgba(255,255,255,0.35)'}}>{label}</p>
      <p className="text-5xl font-black leading-none" style={{color}}>{value}</p>
      {sub&&<p className="text-xs" style={{color:'rgba(255,255,255,0.3)'}}>{sub}</p>}
    </div>
  );
}

function SlideContent({ slide, match }: { slide: Slide, match: any }) {
  const players: any[] = match?.players?.all_players || [];
  const rounds = match?.rounds || [];
  const blueWon = match?.teams?.blue?.has_won || (match?.teams?.blue?.rounds_won > match?.teams?.red?.rounds_won);
  const bScore = match?.teams?.blue?.rounds_won ?? 0;
  const rScore = match?.teams?.red?.rounds_won  ?? 0;
  const blue = players.filter(p=>p.team==='Blue').sort((a,b)=>(b.stats?.kills||0)-(a.stats?.kills||0));
  const red  = players.filter(p=>p.team==='Red').sort((a,b)=>(b.stats?.kills||0)-(a.stats?.kills||0));
  const mvp  = [...players].sort((a,b)=>(b.stats?.kills||0)-(a.stats?.kills||0))[0];
  const totalKills = players.reduce((s,p)=>s+(p.stats?.kills||0),0);
  const avgHS = players.length > 0 ? Math.round(players.reduce((s,p)=>{
    const k=p.stats?.kills||0, h=p.stats?.headshots||0; return s+(k>0?h/k*100:0);
  },0)/players.length) : 0;
  const roundsPlayed = rounds.length || bScore + rScore;

  if (slide.id === 'overview') return (
    <div className="h-full flex flex-col items-center justify-center gap-10">
      <div className="text-center">
        <p className="text-sm font-mono uppercase tracking-[0.35em] mb-3" style={{color:'rgba(255,255,255,0.3)'}}>
          {match.metadata?.map?.toUpperCase()} · {(match.metadata?.mode||'COMPETITIVO').toUpperCase()}
        </p>
        <div className="flex items-center gap-12">
          <div className="text-center">
            <p className="text-sm font-mono mb-2" style={{color:'#60a5fa'}}>BLUE</p>
            <p className="text-9xl font-black leading-none" style={{color:blueWon?'#60a5fa':'rgba(255,255,255,0.2)'}}>{bScore}</p>
            <p className="text-xs mt-2 font-mono" style={{color:blueWon?'#4ade80':'rgba(255,255,255,0.2)'}}>{blueWon?'VICTORIA':'DERROTA'}</p>
          </div>
          <div style={{color:'rgba(255,255,255,0.1)',fontSize:48,fontWeight:100}}>—</div>
          <div className="text-center">
            <p className="text-sm font-mono mb-2" style={{color:'#f87171'}}>RED</p>
            <p className="text-9xl font-black leading-none" style={{color:!blueWon?'#f87171':'rgba(255,255,255,0.2)'}}>{rScore}</p>
            <p className="text-xs mt-2 font-mono" style={{color:!blueWon?'#4ade80':'rgba(255,255,255,0.2)'}}>{!blueWon?'VICTORIA':'DERROTA'}</p>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-6 w-full max-w-xl">
        <BigStat label="Total Kills" value={totalKills} color="#ef4444"/>
        <BigStat label="Rondas" value={roundsPlayed} color="#8b5cf6"/>
        <BigStat label="HS% Medio" value={`${avgHS}%`} color="#f59e0b"/>
      </div>
    </div>
  );

  if (slide.id === 'scoreboard') {
    const TeamBlock = ({ pl, team, won }: any) => (
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-3 mb-5">
          <div className={cn('w-3 h-3 rounded-full',team==='Blue'?'bg-blue-400':'bg-red-400')}/>
          <p className={cn('font-bold text-xl',team==='Blue'?'text-blue-400':'text-red-400')}>{team}</p>
          {won&&<span className="text-xs px-3 py-1 rounded-full bg-green-500/20 text-green-400 font-bold border border-green-500/30">VICTORIA</span>}
        </div>
        <div className="space-y-2">
          {pl.map((p:any,i:number) => {
            const k=p.stats?.kills||0, d=p.stats?.deaths||0, a=p.stats?.assists||0;
            const hs=k>0?Math.round((p.stats?.headshots||0)/k*100):0;
            return (
              <div key={p.puuid||i} className="flex items-center gap-4 rounded-xl px-4 py-3"
                style={{background:i===0?'rgba(255,255,255,0.08)':'rgba(255,255,255,0.03)'}}>
                {i===0&&<span style={{color:'#fbbf24'}}>★</span>}
                <div className="flex-1 min-w-0">
                  <p className="font-bold truncate">{p.name||'?'}</p>
                  <p className="text-xs" style={{color:'rgba(255,255,255,0.35)'}}>{p.character||''}</p>
                </div>
                <div className="grid grid-cols-4 gap-4 text-center shrink-0 text-sm">
                  <div><p className="font-black text-xl">{k}</p><p style={{color:'rgba(255,255,255,0.3)',fontSize:10}}>K</p></div>
                  <div><p className="font-bold text-xl" style={{color:'rgba(255,255,255,0.5)'}}>{d}</p><p style={{color:'rgba(255,255,255,0.3)',fontSize:10}}>D</p></div>
                  <div><p className="font-bold text-xl" style={{color:'rgba(255,255,255,0.5)'}}>{a}</p><p style={{color:'rgba(255,255,255,0.3)',fontSize:10}}>A</p></div>
                  <div><p className="font-bold text-sm" style={{color:'#fbbf24'}}>{hs}%</p><p style={{color:'rgba(255,255,255,0.3)',fontSize:10}}>HS</p></div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
    return (
      <div className="h-full flex gap-10 items-start pt-2 overflow-auto">
        <TeamBlock pl={blue} team="Blue" won={blueWon}/>
        <div className="w-px self-stretch shrink-0" style={{background:'rgba(255,255,255,0.07)'}}/>
        <TeamBlock pl={red} team="Red" won={!blueWon}/>
      </div>
    );
  }

  if (slide.id === 'mvp') {
    if (!mvp) return <p style={{color:'rgba(255,255,255,0.3)'}} className="text-center pt-20">Sin datos</p>;
    const k=mvp.stats?.kills||0, d=mvp.stats?.deaths||0, a=mvp.stats?.assists||0;
    const hs=k>0?Math.round((mvp.stats?.headshots||0)/k*100):0;
    const kd=d>0?(k/d).toFixed(2):String(k);
    const acs=mvp.stats?.score&&roundsPlayed?Math.round(mvp.stats.score/roundsPlayed):0;
    return (
      <div className="h-full flex flex-col items-center justify-center gap-8">
        <div className="text-center">
          <p className="text-sm font-mono uppercase tracking-[0.4em] mb-4" style={{color:'#fbbf24'}}>MVP del Partido ✦</p>
          <p className="text-7xl font-black">{mvp.name}</p>
          <p className="text-2xl mt-3" style={{color:'rgba(255,255,255,0.4)'}}>{mvp.character||''} · {mvp.team}</p>
        </div>
        <div className="grid grid-cols-4 gap-5 w-full max-w-3xl">
          <BigStat label="Kills" value={k} color="#ef4444" sub={`${k}/${d}/${a}`}/>
          <BigStat label="K/D Ratio" value={kd} color="#22c55e"/>
          <BigStat label="HS%" value={`${hs}%`} color="#f59e0b"/>
          <BigStat label="ACS" value={acs||'—'} color="#8b5cf6" sub="Avg Combat Score"/>
        </div>
      </div>
    );
  }

  if (slide.id === 'stats') {
    const topK = [...players].sort((a,b)=>(b.stats?.kills||0)-(a.stats?.kills||0)).slice(0,5);
    const topD = [...players].sort((a,b)=>(b.stats?.damage||0)-(a.stats?.damage||0)).slice(0,5);
    const maxK = topK[0]?.stats?.kills||1, maxD = topD[0]?.stats?.damage||1;
    const Bar = ({val,max,color}:{val:number,max:number,color:string}) => (
      <div className="flex-1 h-2 rounded-full" style={{background:'rgba(255,255,255,0.08)'}}>
        <div className="h-full rounded-full" style={{width:`${val/max*100}%`,background:color}}/>
      </div>
    );
    return (
      <div className="h-full grid grid-cols-2 gap-10 pt-2 overflow-auto">
        <div>
          <p className="text-xs font-mono uppercase tracking-widest mb-5" style={{color:'rgba(255,255,255,0.35)'}}>Top Fraggers</p>
          <div className="space-y-4">
            {topK.map((p,i)=>(
              <div key={p.puuid||i} className="flex items-center gap-3">
                <span className="w-5 text-xs" style={{color:'rgba(255,255,255,0.2)'}}>{i+1}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between mb-1.5">
                    <span className="font-semibold truncate">{p.name}</span>
                    <span className="font-black ml-2" style={{color:'#ef4444'}}>{p.stats?.kills||0}</span>
                  </div>
                  <Bar val={p.stats?.kills||0} max={maxK} color="#ef4444"/>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div>
          <p className="text-xs font-mono uppercase tracking-widest mb-5" style={{color:'rgba(255,255,255,0.35)'}}>Top Daño</p>
          <div className="space-y-4">
            {topD.map((p,i)=>(
              <div key={p.puuid||i} className="flex items-center gap-3">
                <span className="w-5 text-xs" style={{color:'rgba(255,255,255,0.2)'}}>{i+1}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between mb-1.5">
                    <span className="font-semibold truncate">{p.name}</span>
                    <span className="font-black ml-2" style={{color:'#f97316'}}>{p.stats?.damage||0}</span>
                  </div>
                  <Bar val={p.stats?.damage||0} max={maxD} color="#f97316"/>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (slide.id === 'economy') {
    const econRounds = rounds.slice(0, 26);
    const maxEco = Math.max(...econRounds.flatMap((r:any)=>
      (r.player_stats||[]).map((ps:any)=>ps.economy?.loadout_value||0)), 1);
    return (
      <div className="h-full flex flex-col pt-2 gap-6 overflow-auto">
        <div className="flex items-end gap-1 h-40">
          {econRounds.map((r:any,i:number)=>{
            const bv=(r.player_stats||[]).filter((p:any)=>p.player_team==='Blue').reduce((s:number,p:any)=>s+(p.economy?.loadout_value||0),0);
            const rv=(r.player_stats||[]).filter((p:any)=>p.player_team==='Red').reduce((s:number,p:any)=>s+(p.economy?.loadout_value||0),0);
            const bh=Math.round((bv/maxEco)*130), rh=Math.round((rv/maxEco)*130);
            return (
              <div key={i} className="flex items-end gap-0.5 flex-1" title={`R${i+1}`}>
                <div className="flex-1 rounded-t-sm" style={{height:bh,background:r.winning_team==='Blue'?'#3b82f6':'#3b82f640'}}/>
                <div className="flex-1 rounded-t-sm" style={{height:rh,background:r.winning_team==='Red'?'#ef4444':'#ef444440'}}/>
              </div>
            );
          })}
        </div>
        <div className="flex gap-6 text-xs" style={{color:'rgba(255,255,255,0.4)'}}>
          <span className="flex items-center gap-2"><span className="w-3 h-3 rounded bg-blue-500 inline-block"/>Blue loadout</span>
          <span className="flex items-center gap-2"><span className="w-3 h-3 rounded bg-red-500 inline-block"/>Red loadout</span>
          <span className="ml-auto">Colores sólidos = equipo ganador de la ronda</span>
        </div>
      </div>
    );
  }
  return null;
}

export function PresentationMode() {
  const [matches] = useState<any[]>(getCachedMatches);
  const [matchIdx, setMatchIdx] = useState(0);
  const [slideIdx, setSlideIdx] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);

  const match = matches[matchIdx];
  const slide = SLIDES[slideIdx];

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (!fullscreen) return;
      if (e.key==='ArrowRight'||e.key===' ') setSlideIdx(s=>Math.min(s+1,SLIDES.length-1));
      if (e.key==='ArrowLeft') setSlideIdx(s=>Math.max(s-1,0));
      if (e.key==='Escape') setFullscreen(false);
    };
    window.addEventListener('keydown',h);
    return ()=>window.removeEventListener('keydown',h);
  }, [fullscreen]);

  if (matches.length === 0) return (
    <div className="glass-card p-12 flex flex-col items-center justify-center text-center animate-fade-in">
      <Monitor className="w-12 h-12 text-red-500/30 mb-4"/>
      <h3 className="text-lg font-bold mb-2">Modo Presentación</h3>
      <p className="text-muted-foreground text-sm">Carga partidos desde <strong>Match Viewer</strong> para usar la presentación.</p>
    </div>
  );

  const PresentContent = () => (
    <div className="h-full flex flex-col" style={{background:'#07090f',color:'white'}}>
      {/* Header */}
      <div className="flex items-center justify-between px-8 py-4" style={{borderBottom:'1px solid rgba(255,255,255,0.06)'}}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{background:'rgba(239,68,68,0.2)'}}>
            <span style={{color:'#ef4444',fontWeight:'black',fontSize:14}}>V</span>
          </div>
          <div>
            <p className="font-bold">{slide.icon} {slide.title}</p>
            <p className="text-xs" style={{color:'rgba(255,255,255,0.3)'}}>{match?.metadata?.map} · {match?.metadata?.mode}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-mono text-sm" style={{color:'rgba(255,255,255,0.3)'}}>{slideIdx+1}/{SLIDES.length}</span>
          {fullscreen&&<button onClick={()=>setFullscreen(false)} className="p-2 rounded-lg hover:bg-white/10 transition-all"><X className="w-5 h-5" style={{color:'rgba(255,255,255,0.5)'}}/></button>}
        </div>
      </div>

      {/* Progress */}
      <div className="flex gap-1 px-8 py-2">
        {SLIDES.map((_,i)=>(
          <div key={i} onClick={()=>setSlideIdx(i)} className="flex-1 h-1 rounded-full cursor-pointer transition-all"
            style={{background:i===slideIdx?'#ef4444':i<slideIdx?'rgba(239,68,68,0.3)':'rgba(255,255,255,0.1)'}}/>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden px-8 py-4">
        {match ? <SlideContent slide={slide} match={match}/> : <p style={{color:'rgba(255,255,255,0.3)'}} className="text-center pt-20">Sin datos del partido.</p>}
      </div>

      {/* Nav */}
      <div className="flex items-center justify-between px-8 py-4" style={{borderTop:'1px solid rgba(255,255,255,0.06)'}}>
        <button onClick={()=>setSlideIdx(s=>Math.max(s-1,0))} disabled={slideIdx===0}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm disabled:opacity-20 hover:bg-white/10 transition-all"
          style={{color:'rgba(255,255,255,0.6)'}}>
          <ChevronLeft className="w-4 h-4"/> Anterior
        </button>
        <div className="flex gap-2">
          {SLIDES.map((sl,i)=>(
            <button key={i} onClick={()=>setSlideIdx(i)} className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs transition-all"
              style={{background:i===slideIdx?'rgba(239,68,68,0.2)':'transparent',color:i===slideIdx?'#fca5a5':'rgba(255,255,255,0.3)'}}>
              {sl.icon} {sl.title}
            </button>
          ))}
        </div>
        <button onClick={()=>setSlideIdx(s=>Math.min(s+1,SLIDES.length-1))} disabled={slideIdx===SLIDES.length-1}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm disabled:opacity-20 hover:bg-white/10 transition-all"
          style={{color:'rgba(255,255,255,0.6)'}}>
          Siguiente <ChevronRight className="w-4 h-4"/>
        </button>
      </div>
    </div>
  );

  if (fullscreen) return (
    <div className="fixed inset-0 z-50">
      <PresentContent/>
      <div className="fixed bottom-4 right-4 font-mono text-xs" style={{color:'rgba(255,255,255,0.2)'}}>ESC · ← →</div>
    </div>
  );

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="glass-card p-5 flex items-center justify-between">
        <div>
          <h2 className="font-bold text-lg flex items-center gap-2 mb-1"><Monitor className="w-5 h-5 text-red-400"/> Modo Presentación</h2>
          <p className="text-sm text-muted-foreground">Vista para stream o pantalla del equipo · {matches.length} partidos</p>
        </div>
        <div className="flex gap-3">
          <select value={matchIdx} onChange={e=>setMatchIdx(+e.target.value)}
            className="text-xs rounded-xl px-3 py-2 border" style={{background:'hsl(220 15% 10%)',borderColor:'hsl(220 15% 20%)'}}>
            {matches.map((m:any,i:number)=><option key={i} value={i}>{m.metadata?.map||'Partido'} #{i+1}</option>)}
          </select>
          <button onClick={()=>{setFullscreen(true);setSlideIdx(0);}}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all"
            style={{background:'hsl(355 85% 58% / 0.25)',border:'1px solid hsl(355 85% 58% / 0.4)',color:'hsl(355 85% 70%)'}}>
            <Maximize2 className="w-4 h-4"/> Pantalla Completa
          </button>
        </div>
      </div>
      <div className="rounded-2xl overflow-hidden border" style={{height:520,borderColor:'hsl(220 15% 15%)'}}>
        <PresentContent/>
      </div>
    </div>
  );
}
