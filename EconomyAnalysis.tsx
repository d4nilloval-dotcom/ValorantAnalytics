import { useMemo } from 'react';
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  Wallet,
  PiggyBank,
  Zap,
  Target,
  AlertTriangle
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  ReferenceLine
} from 'recharts';
import { useAppStore } from '@/store/appStore';
import { type BuyType } from '@/types';
import { cn } from '@/lib/utils';

interface EconomyAnalysisProps {
  matchId: string;
}

const buyColors: Record<BuyType, string> = {
  ECO: '#ef4444',
  FORCE: '#eab308',
  FULL: '#22c55e',
  OVERTIME: '#a855f7'
};

export function EconomyAnalysis({ matchId }: EconomyAnalysisProps) {
  const { matches, calculateEconomyStats } = useAppStore();
  
  const match = matches[matchId];
  const rounds = match?.rounds || [];
  
  // Calculate economy stats if not exists
  const economyStats = match?.economyStats || calculateEconomyStats(matchId);

  const roundData = useMemo(() => {
    return rounds.map((round, i) => ({
      round: i + 1,
      economyUs: round.economyUs,
      economyOpp: round.economyOpp,
      outcome: round.outcome,
      buyType: round.buyType,
      spent: 3900 - round.economyUs,
      earned: round.economyUs
    }));
  }, [rounds]);

  const buyTypeData = useMemo(() => {
    const byType: Record<BuyType, { count: number; wins: number }> = {
      ECO: { count: 0, wins: 0 },
      FORCE: { count: 0, wins: 0 },
      FULL: { count: 0, wins: 0 },
      OVERTIME: { count: 0, wins: 0 }
    };
    
    rounds.forEach(r => {
      byType[r.buyType].count++;
      if (r.outcome === 'WIN') byType[r.buyType].wins++;
    });

    return Object.entries(byType)
      .filter(([_, data]) => data.count > 0)
      .map(([type, data]) => ({
        name: type,
        count: data.count,
        wins: data.wins,
        losses: data.count - data.wins,
        winRate: data.count > 0 ? (data.wins / data.count) * 100 : 0,
        color: buyColors[type as BuyType]
      }));
  }, [rounds]);

  const economyFlow = useMemo(() => {
    let cumulative = 0;
    return rounds.map((round, i) => {
      const spent = 3900 - round.economyUs;
      const earned = round.outcome === 'WIN' ? 3000 : round.outcome === 'LOSS' ? 1900 + (Math.min(i, 4) * 500) : 2400;
      cumulative += earned - spent;
      return {
        round: i + 1,
        spent,
        earned,
        net: earned - spent,
        cumulative
      };
    });
  }, [rounds]);

  const winRateByEconomy = useMemo(() => {
    const ranges = [
      { min: 0, max: 2000, label: '0-2k', wins: 0, total: 0 },
      { min: 2000, max: 4000, label: '2-4k', wins: 0, total: 0 },
      { min: 4000, max: 6000, label: '4-6k', wins: 0, total: 0 },
      { min: 6000, max: 10000, label: '6k+', wins: 0, total: 0 }
    ];

    rounds.forEach(r => {
      const range = ranges.find(range => r.economyUs >= range.min && r.economyUs < range.max);
      if (range) {
        range.total++;
        if (r.outcome === 'WIN') range.wins++;
      }
    });

    return ranges.map(r => ({
      ...r,
      winRate: r.total > 0 ? (r.wins / r.total) * 100 : 0
    }));
  }, [rounds]);

  if (rounds.length === 0) {
    return (
      <div className="glass-card p-8 text-center text-muted-foreground">
        <Wallet className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p>No hay datos de rondas</p>
        <p className="text-sm mt-1">Añade rondas en el Timeline para ver el análisis de economía</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-4 h-4 text-green-400" />
            <span className="text-xs text-muted-foreground">Total Ganado</span>
          </div>
          <p className="text-2xl font-bold font-mono">
            ${economyStats?.totalEarned.toLocaleString() || 0}
          </p>
        </div>
        
        <div className="glass-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingDown className="w-4 h-4 text-red-400" />
            <span className="text-xs text-muted-foreground">Total Gastado</span>
          </div>
          <p className="text-2xl font-bold font-mono">
            ${economyStats?.totalSpent.toLocaleString() || 0}
          </p>
        </div>
        
        <div className="glass-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <PiggyBank className="w-4 h-4 text-yellow-400" />
            <span className="text-xs text-muted-foreground">Economía Media</span>
          </div>
          <p className="text-2xl font-bold font-mono">
            ${Math.round(economyStats?.avgEconomy || 0).toLocaleString()}
          </p>
        </div>
        
        <div className="glass-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="w-4 h-4 text-blue-400" />
            <span className="text-xs text-muted-foreground">Breaks de Eco</span>
          </div>
          <p className="text-2xl font-bold font-mono">
            {economyStats?.economyBreaks || 0}
          </p>
        </div>
      </div>

      {/* Win Rate by Buy Type */}
      <div className="glass-card p-5">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <Target className="w-5 h-5 text-red-400" />
          Win Rate por Tipo de Compra
        </h3>
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="p-4 rounded-lg bg-red-500/10 text-center">
            <p className="text-xs text-muted-foreground mb-1">ECO Win Rate</p>
            <p className={cn(
              "text-2xl font-bold",
              (economyStats?.ecoWinRate || 0) >= 30 ? "text-green-400" :
              (economyStats?.ecoWinRate || 0) >= 15 ? "text-yellow-400" :
              "text-red-400"
            )}>
              {(economyStats?.ecoWinRate || 0).toFixed(1)}%
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {economyStats?.ecoRounds || 0} rondas
            </p>
          </div>
          <div className="p-4 rounded-lg bg-yellow-500/10 text-center">
            <p className="text-xs text-muted-foreground mb-1">Force Win Rate</p>
            <p className={cn(
              "text-2xl font-bold",
              (economyStats?.forceWinRate || 0) >= 40 ? "text-green-400" :
              (economyStats?.forceWinRate || 0) >= 25 ? "text-yellow-400" :
              "text-red-400"
            )}>
              {(economyStats?.forceWinRate || 0).toFixed(1)}%
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {economyStats?.forceRounds || 0} rondas
            </p>
          </div>
          <div className="p-4 rounded-lg bg-green-500/10 text-center">
            <p className="text-xs text-muted-foreground mb-1">Full Buy Win Rate</p>
            <p className={cn(
              "text-2xl font-bold",
              (economyStats?.fullBuyWinRate || 0) >= 60 ? "text-green-400" :
              (economyStats?.fullBuyWinRate || 0) >= 45 ? "text-yellow-400" :
              "text-red-400"
            )}>
              {(economyStats?.fullBuyWinRate || 0).toFixed(1)}%
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {economyStats?.fullBuyRounds || 0} rondas
            </p>
          </div>
        </div>

        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={buyTypeData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 15% 20%)" />
              <XAxis dataKey="name" stroke="hsl(215 15% 55%)" fontSize={12} />
              <YAxis stroke="hsl(215 15% 55%)" fontSize={12} />
              <Tooltip 
                contentStyle={{ 
                  background: 'hsl(220 22% 8%)',
                  border: '1px solid hsl(220 15% 20%)',
                  borderRadius: '8px'
                }}
                formatter={(value: number, name: string) => {
                  if (name === 'winRate') return [`${value.toFixed(1)}%`, 'Win Rate'];
                  return [value, name === 'wins' ? 'Victorias' : 'Derrotas'];
                }}
              />
              <Bar dataKey="wins" stackId="a" fill="#22c55e" radius={[4, 4, 0, 0]} name="wins" />
              <Bar dataKey="losses" stackId="a" fill="#ef4444" radius={[4, 4, 0, 0]} name="losses" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Economy Timeline */}
      <div className="glass-card p-5">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-blue-400" />
          Evolución de la Economía
        </h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={roundData}>
              <defs>
                <linearGradient id="colorEcoUs" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorEcoOpp" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 15% 20%)" />
              <XAxis dataKey="round" stroke="hsl(215 15% 55%)" fontSize={12} />
              <YAxis stroke="hsl(215 15% 55%)" fontSize={12} />
              <Tooltip 
                contentStyle={{ 
                  background: 'hsl(220 22% 8%)',
                  border: '1px solid hsl(220 15% 20%)',
                  borderRadius: '8px'
                }}
                formatter={(value: number, name: string) => {
                  return [`$${value.toLocaleString()}`, name === 'economyUs' ? 'Nosotros' : 'Rival'];
                }}
              />
              <Area 
                type="monotone" 
                dataKey="economyUs" 
                stroke="#22c55e" 
                fillOpacity={1} 
                fill="url(#colorEcoUs)"
                name="Nosotros"
              />
              <Area 
                type="monotone" 
                dataKey="economyOpp" 
                stroke="#ef4444" 
                fillOpacity={1} 
                fill="url(#colorEcoOpp)"
                name="Rival"
              />
              <ReferenceLine y={4000} stroke="#eab308" strokeDasharray="3 3" label="Full Buy" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Win Rate by Economy Range */}
      <div className="glass-card p-5">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-yellow-400" />
          Win Rate por Rango de Economía
        </h3>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={winRateByEconomy}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 15% 20%)" />
              <XAxis dataKey="label" stroke="hsl(215 15% 55%)" fontSize={12} />
              <YAxis stroke="hsl(215 15% 55%)" fontSize={12} domain={[0, 100]} />
              <Tooltip 
                contentStyle={{ 
                  background: 'hsl(220 22% 8%)',
                  border: '1px solid hsl(220 15% 20%)',
                  borderRadius: '8px'
                }}
                formatter={(value: number) => [`${value.toFixed(1)}%`, 'Win Rate']}
              />
              <Bar dataKey="winRate" radius={[4, 4, 0, 0]}>
                {winRateByEconomy.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={entry.winRate >= 60 ? '#22c55e' : entry.winRate >= 40 ? '#eab308' : '#ef4444'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Economy Distribution */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="glass-card p-5">
          <h3 className="font-semibold mb-4">Distribución de Compras</h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={buyTypeData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={70}
                  paddingAngle={5}
                  dataKey="count"
                  nameKey="name"
                >
                  {buyTypeData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ 
                    background: 'hsl(220 22% 8%)',
                    border: '1px solid hsl(220 15% 20%)',
                    borderRadius: '8px'
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap justify-center gap-3 mt-2">
            {buyTypeData.map((type) => (
              <div key={type.name} className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full" style={{ background: type.color }} />
                <span className="text-xs text-muted-foreground">{type.name}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-card p-5">
          <h3 className="font-semibold mb-4">Flujo de Economía (Neto)</h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={economyFlow}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 15% 20%)" />
                <XAxis dataKey="round" stroke="hsl(215 15% 55%)" fontSize={12} />
                <YAxis stroke="hsl(215 15% 55%)" fontSize={12} />
                <Tooltip 
                  contentStyle={{ 
                    background: 'hsl(220 22% 8%)',
                    border: '1px solid hsl(220 15% 20%)',
                    borderRadius: '8px'
                  }}
                  formatter={(value: number) => [`$${value.toLocaleString()}`, 'Neto']}
                />
                <Line 
                  type="monotone" 
                  dataKey="net" 
                  stroke="#3b82f6" 
                  strokeWidth={2}
                  dot={false}
                />
                <ReferenceLine y={0} stroke="#666" strokeDasharray="3 3" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Tips */}
      <div className="glass-card p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-yellow-400 mt-0.5" />
          <div>
            <p className="font-medium text-sm">Análisis de Economía</p>
            <p className="text-sm text-muted-foreground mt-1">
              • Un buen win rate en ECO (&gt;25%) indica buena coordinación en rondas difíciles.<br/>
              • El win rate en Full Buy debería estar por encima del 55% para ser competitivo.<br/>
              • Los &quot;breaks de eco&quot; (ganar ECO) pueden cambiar el momentum del partido.<br/>
              • Mantener la economía por encima de 4000 permite flexibilidad en compras.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
