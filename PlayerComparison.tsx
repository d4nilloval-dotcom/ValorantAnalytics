import { useState, useMemo } from 'react';
import { Users, TrendingUp, TrendingDown, Minus, Award } from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import { cn } from '@/lib/utils';
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer } from 'recharts';

const METRICS = [
  { key: 'acsAvg',    label: 'ACS',      fmt: (v:number) => v.toFixed(0),    higherBetter: true },
  { key: 'kd',        label: 'K/D',      fmt: (v:number) => v.toFixed(2),    higherBetter: true },
  { key: 'kastAvg',   label: 'KAST%',    fmt: (v:number) => v.toFixed(1)+'%', higherBetter: true },
  { key: 'winRate',   label: 'Win Rate', fmt: (v:number) => v.toFixed(1)+'%', higherBetter: true },
  { key: 'rating',    label: 'Rating',   fmt: (v:number) => v.toFixed(2),    higherBetter: true },
  { key: 'avgKills',  label: 'K/Partido',fmt: (v:number) => v.toFixed(1),    higherBetter: true },
  { key: 'fkNet',     label: 'FK Net',   fmt: (v:number) => (v>=0?'+':'')+v.toFixed(0), higherBetter: true },
  { key: 'matches',   label: 'Partidos', fmt: (v:number) => String(v),       higherBetter: false },
  { key: 'plants',    label: 'Plantas',  fmt: (v:number) => String(v),       higherBetter: true },
  { key: 'defuses',   label: 'Defuses',  fmt: (v:number) => String(v),       higherBetter: true },
];

export function PlayerComparison() {
  const { getPlayerStats } = useAppStore();
  const allStats = getPlayerStats('ALL');
  const names = allStats.map(s => s.name).sort();

  const [p1, setP1] = useState(names[0] || '');
  const [p2, setP2] = useState(names[1] || '');

  const s1 = allStats.find(s => s.name === p1);
  const s2 = allStats.find(s => s.name === p2);

  const radarData = useMemo(() => {
    if (!s1 || !s2) return [];
    const norm = (v:number, max:number) => Math.min(Math.round(v/max*100),100);
    return [
      { axis:'ACS',     [p1]: norm(s1.acsAvg,250), [p2]: norm(s2.acsAvg,250) },
      { axis:'K/D',     [p1]: norm(s1.kd,2),       [p2]: norm(s2.kd,2) },
      { axis:'KAST',    [p1]: Math.min(Math.round(s1.kastAvg),100), [p2]: Math.min(Math.round(s2.kastAvg),100) },
      { axis:'Win%',    [p1]: Math.min(Math.round(s1.winRate),100), [p2]: Math.min(Math.round(s2.winRate),100) },
      { axis:'Rating',  [p1]: norm(s1.rating,1.5),  [p2]: norm(s2.rating,1.5) },
      { axis:'Entry',   [p1]: Math.min(Math.max(50+Math.round((s1.fkNet/Math.max(s1.matches,1))*33),0),100),
                        [p2]: Math.min(Math.max(50+Math.round((s2.fkNet/Math.max(s2.matches,1))*33),0),100) },
    ];
  }, [s1, s2, p1, p2]);

  const p1Wins = METRICS.filter(m => {
    if (!s1||!s2) return false;
    const v1=(s1 as any)[m.key], v2=(s2 as any)[m.key];
    return m.higherBetter ? v1>v2 : v1<v2;
  }).length;
  const p2Wins = METRICS.filter(m => {
    if (!s1||!s2) return false;
    const v1=(s1 as any)[m.key], v2=(s2 as any)[m.key];
    return m.higherBetter ? v2>v1 : v2<v1;
  }).length;

  if (names.length < 2) return (
    <div className="glass-card p-12 text-center animate-fade-in">
      <Users className="w-12 h-12 text-red-500/30 mx-auto mb-4"/>
      <h3 className="font-bold text-lg mb-2">Comparador de Jugadores</h3>
      <p className="text-muted-foreground text-sm">Necesitas al menos 2 jugadores con datos para comparar.</p>
    </div>
  );

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="glass-card p-5">
        <h2 className="font-bold text-lg flex items-center gap-2 mb-1"><Users className="w-5 h-5 text-red-400"/> Comparador de Jugadores</h2>
        <p className="text-sm text-muted-foreground">Dos jugadores cara a cara en todas las métricas</p>
      </div>

      {/* Selector de jugadores */}
      <div className="glass-card p-5">
        <div className="grid grid-cols-[1fr,auto,1fr] gap-4 items-center">
          <div className="text-center">
            <select value={p1} onChange={e=>setP1(e.target.value)}
              className="w-full text-sm rounded-xl px-4 py-3 border font-semibold text-center"
              style={{background:'hsl(220 20% 13%)',borderColor:'hsl(220 15% 22%)'}}>
              {names.filter(n=>n!==p2).map(n=><option key={n}>{n}</option>)}
            </select>
            {s1 && (
              <div className="mt-2 flex items-center justify-center gap-2">
                <span className="text-2xl font-black text-blue-400">{p1Wins}</span>
                <span className="text-xs text-muted-foreground">métricas ganadas</span>
              </div>
            )}
          </div>
          <div className="text-2xl font-black text-muted-foreground/30">VS</div>
          <div className="text-center">
            <select value={p2} onChange={e=>setP2(e.target.value)}
              className="w-full text-sm rounded-xl px-4 py-3 border font-semibold text-center"
              style={{background:'hsl(220 20% 13%)',borderColor:'hsl(220 15% 22%)'}}>
              {names.filter(n=>n!==p1).map(n=><option key={n}>{n}</option>)}
            </select>
            {s2 && (
              <div className="mt-2 flex items-center justify-center gap-2">
                <span className="text-2xl font-black text-red-400">{p2Wins}</span>
                <span className="text-xs text-muted-foreground">métricas ganadas</span>
              </div>
            )}
          </div>
        </div>

        {/* Veredicto */}
        {s1 && s2 && p1Wins !== p2Wins && (
          <div className="mt-4 text-center py-3 rounded-xl" style={{background:'hsl(220 15% 10%)'}}>
            <Award className="w-5 h-5 inline mr-2 text-yellow-400"/>
            <span className="font-bold">{p1Wins > p2Wins ? p1 : p2}</span>
            <span className="text-muted-foreground"> domina con </span>
            <span className="font-bold text-yellow-400">{Math.max(p1Wins,p2Wins)}</span>
            <span className="text-muted-foreground"> de {METRICS.length} métricas</span>
          </div>
        )}
        {s1 && s2 && p1Wins === p2Wins && (
          <div className="mt-4 text-center py-3 rounded-xl" style={{background:'hsl(220 15% 10%)'}}>
            <span className="text-muted-foreground">⚖️ Empate perfecto — {p1Wins} métricas cada uno</span>
          </div>
        )}
      </div>

      {s1 && s2 && (
        <>
          {/* Radar comparativo */}
          <div className="glass-card p-5">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Radar Comparativo</h3>
            <div className="flex justify-center gap-6 text-xs mb-2">
              <span className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-blue-500"/>{p1}</span>
              <span className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-red-500"/>{p2}</span>
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="hsl(220 15% 18%)"/>
                <PolarAngleAxis dataKey="axis" tick={{fontSize:11, fill:'hsl(215 15% 55%)'}}/>
                <Radar dataKey={p1} stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.2} strokeWidth={2}/>
                <Radar dataKey={p2} stroke="#ef4444" fill="#ef4444" fillOpacity={0.2} strokeWidth={2}/>
              </RadarChart>
            </ResponsiveContainer>
          </div>

          {/* Tabla métricas */}
          <div className="glass-card p-5">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Métricas detalladas</h3>
            <div className="space-y-1">
              {METRICS.map(metric => {
                const v1 = (s1 as any)[metric.key] as number;
                const v2 = (s2 as any)[metric.key] as number;
                const p1Better = metric.higherBetter ? v1 > v2 : v1 < v2;
                const p2Better = metric.higherBetter ? v2 > v1 : v2 < v1;
                const diff = Math.abs(v1-v2);
                const pct = Math.max(v1,v2) > 0 ? (diff/Math.max(v1,v2)*100) : 0;
                const max = Math.max(v1, v2, 0.001);
                return (
                  <div key={metric.key} className="grid grid-cols-[1fr,auto,1fr] gap-3 items-center py-2 border-b"
                    style={{borderColor:'hsl(220 15% 12%)'}}>
                    {/* P1 */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex-1 h-2 rounded-full bg-white/8 overflow-hidden" style={{direction:'rtl'}}>
                        <div className="h-full rounded-full" style={{width:`${(v1/max)*100}%`,background:p1Better?'#3b82f6':'hsl(220 15% 25%)'}}/>
                      </div>
                      <span className={cn('text-sm font-bold w-16 text-right',p1Better?'text-blue-400':p2Better?'text-muted-foreground':'text-white/60')}>
                        {metric.fmt(v1)}
                      </span>
                      {p1Better && <TrendingUp className="w-3 h-3 text-blue-400 shrink-0"/>}
                      {!p1Better && p2Better && <TrendingDown className="w-3 h-3 text-muted-foreground shrink-0"/>}
                      {!p1Better && !p2Better && <Minus className="w-3 h-3 text-muted-foreground shrink-0"/>}
                    </div>
                    {/* Label */}
                    <div className="text-center w-24">
                      <p className="text-[11px] text-muted-foreground font-medium">{metric.label}</p>
                      {pct > 5 && <p className="text-[9px] text-muted-foreground/50">Δ{pct.toFixed(0)}%</p>}
                    </div>
                    {/* P2 */}
                    <div className="flex items-center justify-between gap-2">
                      {p2Better && <TrendingUp className="w-3 h-3 text-red-400 shrink-0"/>}
                      {!p2Better && p1Better && <TrendingDown className="w-3 h-3 text-muted-foreground shrink-0"/>}
                      {!p1Better && !p2Better && <Minus className="w-3 h-3 text-muted-foreground shrink-0"/>}
                      <span className={cn('text-sm font-bold w-16',p2Better?'text-red-400':p1Better?'text-muted-foreground':'text-white/60')}>
                        {metric.fmt(v2)}
                      </span>
                      <div className="flex-1 h-2 rounded-full bg-white/8 overflow-hidden">
                        <div className="h-full rounded-full" style={{width:`${(v2/max)*100}%`,background:p2Better?'#ef4444':'hsl(220 15% 25%)'}}/>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
