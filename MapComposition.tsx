import { useState, useMemo } from 'react';
import { Users, Map, Filter, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

const HENRIK_MATCH_CACHE = 'valoanalytics_henrik_matches_v1';

function getCachedMatches(): any[] {
  try { return JSON.parse(localStorage.getItem(HENRIK_MATCH_CACHE) || '[]'); } catch { return []; }
}

const ROLES: Record<string,string> = {
  'Jett':'Duelista','Reyna':'Duelista','Phoenix':'Duelista','Neon':'Duelista','Yoru':'Duelista','Iso':'Duelista',
  'Omen':'Controlador','Brimstone':'Controlador','Viper':'Controlador','Astra':'Controlador','Harbor':'Controlador','Clove':'Controlador',
  'Sova':'Iniciador','Breach':'Iniciador','Skye':'Iniciador','KAY/O':'Iniciador','Fade':'Iniciador','Gekko':'Iniciador',
  'Sage':'Centinela','Cypher':'Centinela','Killjoy':'Centinela','Chamber':'Centinela','Deadlock':'Centinela','Vyse':'Centinela',
};
const ROLE_COLORS: Record<string,string> = {
  'Duelista':'#ef4444','Controlador':'#8b5cf6','Iniciador':'#22c55e','Centinela':'#f59e0b'
};

interface AgentStat { agent:string; role:string; map:string; wins:number; losses:number; kills:number; deaths:number; }

export function MapComposition() {
  const [, forceUpdate] = useState(0);
  const [selectedMap, setSelectedMap] = useState('');
  const [selectedRole, setSelectedRole] = useState('');
  const [sortBy, setSortBy] = useState<'winrate'|'kd'|'games'>('winrate');

  const cachedMatches = useMemo(() => getCachedMatches(), []);

  // Construir stats desde los partidos Henrik cacheados
  const stats = useMemo(() => {
    const map: Record<string, AgentStat> = {};
    cachedMatches.forEach((match: any) => {
      const mapName = match.metadata?.map || 'Desconocido';
      const players: any[] = match.players?.all_players || [];
      const blueWon = match.teams?.blue?.has_won || match.teams?.blue?.rounds_won > match.teams?.red?.rounds_won;
      players.forEach((p: any) => {
        const agent = p.character || '?';
        const won = p.team === 'Blue' ? blueWon : !blueWon;
        const key = `${agent}::${mapName}`;
        if (!map[key]) map[key] = { agent, role: ROLES[agent]||'Desconocido', map: mapName, wins:0, losses:0, kills:0, deaths:0 };
        won ? map[key].wins++ : map[key].losses++;
        map[key].kills  += p.stats?.kills  || 0;
        map[key].deaths += p.stats?.deaths || 0;
      });
    });
    return Object.values(map).filter(s => s.wins + s.losses > 0);
  }, [cachedMatches]);

  const availableMaps = [...new Set(stats.map(s => s.map))].filter(Boolean);

  const filtered = useMemo(() => {
    let s = stats;
    if (selectedMap) s = s.filter(x => x.map === selectedMap);
    if (selectedRole) s = s.filter(x => x.role === selectedRole);
    return [...s].sort((a,b) => {
      if (sortBy==='winrate') return (b.wins/(b.wins+b.losses||1)) - (a.wins/(a.wins+a.losses||1));
      if (sortBy==='kd') return (b.kills/(b.deaths||1)) - (a.kills/(a.deaths||1));
      return (b.wins+b.losses) - (a.wins+a.losses);
    });
  }, [stats, selectedMap, selectedRole, sortBy]);

  // Top por mapa (sin filtro de mapa)
  const topByMap = useMemo(() => {
    const result: Record<string, AgentStat[]> = {};
    availableMaps.forEach(map => {
      result[map] = stats.filter(s => s.map === map)
        .sort((a,b) => (b.wins/(b.wins+b.losses||1)) - (a.wins/(a.wins+a.losses||1)))
        .slice(0, 5);
    });
    return result;
  }, [stats, availableMaps]);

  if (cachedMatches.length === 0) {
    return (
      <div className="glass-card p-12 flex flex-col items-center justify-center text-center animate-fade-in">
        <Map className="w-12 h-12 text-red-500/30 mb-4"/>
        <h3 className="text-lg font-bold mb-2">Sin datos históricos</h3>
        <p className="text-muted-foreground text-sm max-w-sm">
          Carga partidos desde <strong>Match Viewer</strong> usando la API de HenrikDev.<br/>
          Los datos se guardan automáticamente para este análisis.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="glass-card p-5 flex items-center justify-between">
        <div>
          <h2 className="font-bold text-lg mb-1 flex items-center gap-2">
            <Users className="w-5 h-5 text-red-400"/> Composición por Mapa
          </h2>
          <p className="text-sm text-muted-foreground">
            Rendimiento de agentes por mapa · {cachedMatches.length} partidos · {stats.length} registros
          </p>
        </div>
        <button onClick={()=>forceUpdate(n=>n+1)}
          className="p-2 rounded-xl hover:bg-white/10 transition-all text-muted-foreground hover:text-white">
          <RefreshCw className="w-4 h-4"/>
        </button>
      </div>

      {/* Cards rápidas por mapa */}
      {!selectedMap && availableMaps.length > 0 && (
        <div className="grid grid-cols-2 xl:grid-cols-3 gap-4">
          {availableMaps.map(map => {
            const top = topByMap[map] || [];
            const totalGames = top.reduce((s,x)=>s+x.wins+x.losses,0);
            return (
              <div key={map} className="glass-card p-4 cursor-pointer hover:scale-[1.01] transition-all"
                onClick={()=>setSelectedMap(map)}>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold">{map}</h3>
                  <span className="text-xs text-muted-foreground">{totalGames} apariciones</span>
                </div>
                <div className="space-y-2">
                  {top.map((s,i) => {
                    const wr = Math.round(s.wins/(s.wins+s.losses)*100);
                    return (
                      <div key={s.agent} className="flex items-center gap-2">
                        <span className={cn('w-4 h-4 rounded text-[9px] flex items-center justify-center font-bold',
                          i===0?'bg-yellow-500/20 text-yellow-400':i===1?'bg-white/10 text-white/60':'bg-white/5 text-white/30')}>{i+1}</span>
                        <span className="flex-1 text-sm truncate">{s.agent}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded" style={{background:(ROLE_COLORS[s.role]||'#888')+'20',color:ROLE_COLORS[s.role]||'#888'}}>{s.role}</span>
                        <span className={cn('text-xs font-bold w-10 text-right',wr>=60?'text-green-400':wr>=50?'text-yellow-400':'text-red-400')}>{wr}%</span>
                        <div className="w-12 h-1.5 rounded-full bg-white/10">
                          <div className="h-full rounded-full" style={{width:`${wr}%`,background:wr>=60?'#22c55e':wr>=50?'#f59e0b':'#ef4444'}}/>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Tabla detallada */}
      <div className="glass-card p-5">
        <div className="flex flex-wrap gap-3 items-center mb-5">
          <h3 className="font-semibold flex items-center gap-2"><Filter className="w-4 h-4"/> Tabla detallada</h3>
          <select value={selectedMap} onChange={e=>setSelectedMap(e.target.value)}
            className="text-xs rounded-xl px-3 py-2 border ml-auto" style={{background:'hsl(220 15% 10%)',borderColor:'hsl(220 15% 20%)'}}>
            <option value="">Todos los mapas</option>
            {availableMaps.map(m=><option key={m}>{m}</option>)}
          </select>
          <select value={selectedRole} onChange={e=>setSelectedRole(e.target.value)}
            className="text-xs rounded-xl px-3 py-2 border" style={{background:'hsl(220 15% 10%)',borderColor:'hsl(220 15% 20%)'}}>
            <option value="">Todos los roles</option>
            {['Duelista','Controlador','Iniciador','Centinela'].map(r=><option key={r}>{r}</option>)}
          </select>
          <div className="flex border rounded-xl overflow-hidden" style={{borderColor:'hsl(220 15% 20%)'}}>
            {(['winrate','kd','games'] as const).map(s=>(
              <button key={s} onClick={()=>setSortBy(s)}
                className={cn('text-xs px-3 py-2 transition-all',sortBy===s?'bg-red-500/20 text-red-300':'text-muted-foreground hover:text-white')}>
                {s==='winrate'?'WR%':s==='kd'?'K/D':'Partidas'}
              </button>
            ))}
          </div>
        </div>
        {filtered.length===0 ? <p className="text-center text-muted-foreground py-8">Sin datos para estos filtros.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground border-b" style={{borderColor:'hsl(220 15% 15%)'}}>
                  <th className="pb-2">#</th><th className="pb-2">Agente</th><th className="pb-2">Rol</th>
                  <th className="pb-2">Mapa</th><th className="pb-2 text-right">Partidas</th>
                  <th className="pb-2 text-right">WR%</th><th className="pb-2 text-right">K/D</th><th className="pb-2 w-24"/>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s,i) => {
                  const wr = Math.round(s.wins/(s.wins+s.losses)*100);
                  const kd = (s.kills/(s.deaths||1)).toFixed(2);
                  return (
                    <tr key={`${s.agent}${s.map}`} className="border-b hover:bg-white/3 transition-all" style={{borderColor:'hsl(220 15% 12%)'}}>
                      <td className="py-2.5 text-muted-foreground/40 text-xs">{i+1}</td>
                      <td className="py-2.5 font-semibold">{s.agent}</td>
                      <td><span className="text-[10px] px-2 py-0.5 rounded-full" style={{background:(ROLE_COLORS[s.role]||'#888')+'20',color:ROLE_COLORS[s.role]||'#888'}}>{s.role}</span></td>
                      <td className="text-muted-foreground text-xs">{s.map}</td>
                      <td className="text-right text-muted-foreground">{s.wins+s.losses}</td>
                      <td className={cn('text-right font-bold',wr>=60?'text-green-400':wr>=50?'text-yellow-400':'text-red-400')}>{wr}%</td>
                      <td className="text-right font-mono text-xs">{kd}</td>
                      <td className="pl-3"><div className="h-1.5 rounded-full bg-white/8"><div className="h-full rounded-full" style={{width:`${wr}%`,background:wr>=60?'#22c55e':wr>=50?'#f59e0b':'#ef4444'}}/></div></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
