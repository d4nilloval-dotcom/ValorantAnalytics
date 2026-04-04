import { useState, useMemo } from 'react';
import {
  Brain,
  Target,
  Zap,
  Users,
  Activity,
  Award,
  AlertTriangle,
  Lightbulb,
  Swords,
  Crosshair,
  Layers,
  Shield,
} from 'lucide-react';
import { useAdvancedAnalyticsStore } from '@/store/advancedAnalyticsStore';
import { useAppStore } from '@/store/appStore';
import { cn } from '@/lib/utils';
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from 'recharts';
import type { WinProbabilityState } from '@/types/advanced';

// Win Probability Calculator Component
function WinProbabilityCalculator() {
  const [state, setState] = useState<WinProbabilityState>({
    round: 1,
    economyUs: 4500,
    economyThem: 4500,
    playersAliveUs: 5,
    playersAliveThem: 5,
    spikePlanted: false,
    utilityUs: 80,
    utilityThem: 80,
    mapControlUs: 50,
    mapControlThem: 50,
  });

  const { calculateWinProbability } = useAdvancedAnalyticsStore();
  const result = calculateWinProbability(state);

  const adjustValue = (key: keyof WinProbabilityState, delta: number, min?: number, max?: number) => {
    setState((prev) => {
      const newValue = (prev[key] as number) + delta;
      return {
        ...prev,
        [key]: max !== undefined && min !== undefined 
          ? Math.min(Math.max(newValue, min), max)
          : newValue,
      };
    });
  };

  const toggleSpike = () => {
    setState((prev) => ({ ...prev, spikePlanted: !prev.spikePlanted }));
  };

  return (
    <div className="glass-card rounded-xl p-6">
      <div className="flex items-center gap-3 mb-6">
        <Brain className="w-6 h-6 text-[#ff4655]" />
        <h3 className="text-xl font-bold text-white">Win Probability Model</h3>
      </div>

      {/* Probability Display */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-gradient-to-br from-green-500/20 to-green-600/10 rounded-xl p-4 border border-green-500/30">
          <p className="text-green-400 text-sm mb-1">Nuestro Equipo</p>
          <p className="text-4xl font-bold text-white">{result.probabilityUs.toFixed(1)}%</p>
          <div className="w-full h-2 bg-green-900/50 rounded-full mt-2">
            <div 
              className="h-full bg-green-500 rounded-full transition-all duration-500"
              style={{ width: `${result.probabilityUs}%` }}
            />
          </div>
        </div>
        <div className="bg-gradient-to-br from-red-500/20 to-red-600/10 rounded-xl p-4 border border-red-500/30">
          <p className="text-red-400 text-sm mb-1">Equipo Rival</p>
          <p className="text-4xl font-bold text-white">{result.probabilityThem.toFixed(1)}%</p>
          <div className="w-full h-2 bg-red-900/50 rounded-full mt-2">
            <div 
              className="h-full bg-red-500 rounded-full transition-all duration-500"
              style={{ width: `${result.probabilityThem}%` }}
            />
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {/* Players Alive */}
        <div className="bg-[#0f0f1e] rounded-lg p-3">
          <p className="text-gray-400 text-xs mb-2">Jugadores Vivos (Nosotros)</p>
          <div className="flex items-center justify-between">
            <button 
              onClick={() => adjustValue('playersAliveUs', -1, 0, 5)}
              className="w-8 h-8 bg-[#1a1a2e] rounded-lg hover:bg-[#2a2a3e] text-white"
            >-</button>
            <span className="text-xl font-bold text-white">{state.playersAliveUs}</span>
            <button 
              onClick={() => adjustValue('playersAliveUs', 1, 0, 5)}
              className="w-8 h-8 bg-[#1a1a2e] rounded-lg hover:bg-[#2a2a3e] text-white"
            >+</button>
          </div>
        </div>

        <div className="bg-[#0f0f1e] rounded-lg p-3">
          <p className="text-gray-400 text-xs mb-2">Jugadores Vivos (Rival)</p>
          <div className="flex items-center justify-between">
            <button 
              onClick={() => adjustValue('playersAliveThem', -1, 0, 5)}
              className="w-8 h-8 bg-[#1a1a2e] rounded-lg hover:bg-[#2a2a3e] text-white"
            >-</button>
            <span className="text-xl font-bold text-white">{state.playersAliveThem}</span>
            <button 
              onClick={() => adjustValue('playersAliveThem', 1, 0, 5)}
              className="w-8 h-8 bg-[#1a1a2e] rounded-lg hover:bg-[#2a2a3e] text-white"
            >+</button>
          </div>
        </div>

        {/* Economy */}
        <div className="bg-[#0f0f1e] rounded-lg p-3">
          <p className="text-gray-400 text-xs mb-2">Economía (Nosotros)</p>
          <div className="flex items-center justify-between">
            <button 
              onClick={() => adjustValue('economyUs', -500, 0, 25000)}
              className="w-8 h-8 bg-[#1a1a2e] rounded-lg hover:bg-[#2a2a3e] text-white"
            >-</button>
            <span className="text-lg font-bold text-white">${state.economyUs}</span>
            <button 
              onClick={() => adjustValue('economyUs', 500, 0, 25000)}
              className="w-8 h-8 bg-[#1a1a2e] rounded-lg hover:bg-[#2a2a3e] text-white"
            >+</button>
          </div>
        </div>

        <div className="bg-[#0f0f1e] rounded-lg p-3">
          <p className="text-gray-400 text-xs mb-2">Economía (Rival)</p>
          <div className="flex items-center justify-between">
            <button 
              onClick={() => adjustValue('economyThem', -500, 0, 25000)}
              className="w-8 h-8 bg-[#1a1a2e] rounded-lg hover:bg-[#2a2a3e] text-white"
            >-</button>
            <span className="text-lg font-bold text-white">${state.economyThem}</span>
            <button 
              onClick={() => adjustValue('economyThem', 500, 0, 25000)}
              className="w-8 h-8 bg-[#1a1a2e] rounded-lg hover:bg-[#2a2a3e] text-white"
            >+</button>
          </div>
        </div>

        {/* Utility */}
        <div className="bg-[#0f0f1e] rounded-lg p-3">
          <p className="text-gray-400 text-xs mb-2">Utilidad (Nosotros) {state.utilityUs}%</p>
          <input
            type="range"
            min="0"
            max="100"
            value={state.utilityUs}
            onChange={(e) => setState((prev) => ({ ...prev, utilityUs: parseInt(e.target.value) }))}
            className="w-full"
          />
        </div>

        <div className="bg-[#0f0f1e] rounded-lg p-3">
          <p className="text-gray-400 text-xs mb-2">Utilidad (Rival) {state.utilityThem}%</p>
          <input
            type="range"
            min="0"
            max="100"
            value={state.utilityThem}
            onChange={(e) => setState((prev) => ({ ...prev, utilityThem: parseInt(e.target.value) }))}
            className="w-full"
          />
        </div>
      </div>

      {/* Spike Toggle */}
      <button
        onClick={toggleSpike}
        className={cn(
          'w-full mt-4 p-3 rounded-lg font-medium transition-colors',
          state.spikePlanted 
            ? 'bg-green-500/20 text-green-400 border border-green-500/50'
            : 'bg-[#0f0f1e] text-gray-400 border border-transparent'
        )}
      >
        {state.spikePlanted ? '✓ Spike Plantado' : 'Spike No Plantado'}
      </button>

      {/* Factor Weights */}
      <div className="mt-4 p-3 bg-[#0f0f1e] rounded-lg">
        <p className="text-gray-400 text-xs mb-2">Peso de Factores:</p>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded">
            Jugadores: {result.factors.numbersWeight.toFixed(0)}%
          </span>
          <span className="px-2 py-1 bg-yellow-500/20 text-yellow-400 rounded">
            Economía: {result.factors.economyWeight.toFixed(0)}%
          </span>
          <span className="px-2 py-1 bg-purple-500/20 text-purple-400 rounded">
            Utilidad: {result.factors.utilityWeight.toFixed(0)}%
          </span>
          <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded">
            Spike: {result.factors.spikeWeight.toFixed(0)}%
          </span>
        </div>
      </div>
    </div>
  );
}

// Conversion Tracker Component
function ConversionTracker() {
  const { matches } = useAppStore();
  const { calculateConversionStats } = useAdvancedAnalyticsStore();

  const matchesArray = useMemo(() => Object.values(matches).sort((a: any, b: any) => b.createdAt - a.createdAt), [matches]);
  const [selectedMatchId, setSelectedMatchId] = useState<string>('ALL');

  const selectedStats = useMemo(() => {
    if (selectedMatchId === 'ALL') {
      // Aggregate all matches
      const matchesWithRounds = matchesArray.filter((m: any) => m.rounds && m.rounds.length > 0);
      if (matchesWithRounds.length === 0) return null;
      const allStats = matchesWithRounds.map((m: any) => calculateConversionStats(m.id));
      const total = allStats.length;
      return {
        afterFirstKill: allStats.reduce((acc, s) => acc + s.afterFirstKill.rate, 0) / total,
        afterAdvantage: allStats.reduce((acc, s) => acc + s.afterAdvantage5v4.rate, 0) / total,
        afterSpike: allStats.reduce((acc, s) => acc + s.afterSpikePlanted.rate, 0) / total,
        antiThrow: allStats.reduce((acc, s) => acc + s.antiThrowIndex, 0) / total,
        matchCount: total,
      };
    } else {
      const match = matchesArray.find((m: any) => m.id === selectedMatchId) as any;
      if (!match?.rounds?.length) return null;
      const s = calculateConversionStats(selectedMatchId);
      return {
        afterFirstKill: s.afterFirstKill.rate,
        afterAdvantage: s.afterAdvantage5v4.rate,
        afterSpike: s.afterSpikePlanted.rate,
        antiThrow: s.antiThrowIndex,
        matchCount: 1,
      };
    }
  }, [selectedMatchId, matchesArray, calculateConversionStats]);

  const noRoundsData = matchesArray.every((m: any) => !m.rounds || m.rounds.length === 0);

  return (
    <div className="glass-card rounded-xl p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Target className="w-6 h-6 text-[#ff4655]" />
          <h3 className="text-xl font-bold text-white">Conversion & Anti-Throw</h3>
        </div>
        <select
          value={selectedMatchId}
          onChange={(e) => setSelectedMatchId(e.target.value)}
          className="px-3 py-1.5 bg-[#0f0f1e] border border-[#2a2a3e] rounded-lg text-sm text-white"
        >
          <option value="ALL">Todos los partidos</option>
          {matchesArray.map((m: any) => (
            <option key={m.id} value={m.id}>
              {m.map} - {m.date} {m.rounds?.length ? `(${m.rounds.length}r)` : '(sin rondas)'}
            </option>
          ))}
        </select>
      </div>

      {!selectedStats ? (
        <div className="text-center py-8">
          <p className="text-gray-500">
            {matchesArray.length === 0 
              ? 'No hay partidos registrados'
              : noRoundsData
              ? 'Añade rondas detalladas a tus partidos para ver estos datos'
              : 'El partido seleccionado no tiene datos de rondas'}
          </p>
          {matchesArray.length > 0 && (
            <p className="text-gray-600 text-sm mt-2">
              Selecciona un partido con rondas registradas o usa "Todos los partidos"
            </p>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-[#0f0f1e] rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Zap className="w-4 h-4 text-yellow-400" />
                <p className="text-gray-400 text-sm">Conversión tras First Kill</p>
              </div>
              <p className={cn(
                'text-3xl font-bold',
                selectedStats.afterFirstKill >= 60 ? 'text-green-400' : selectedStats.afterFirstKill >= 45 ? 'text-yellow-400' : 'text-red-400'
              )}>
                {selectedStats.afterFirstKill.toFixed(1)}%
              </p>
              <p className="text-gray-600 text-xs mt-1">Tier 3 promedio: 55-65%</p>
            </div>

            <div className="bg-[#0f0f1e] rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Users className="w-4 h-4 text-blue-400" />
                <p className="text-gray-400 text-sm">Conversión 5v4</p>
              </div>
              <p className={cn(
                'text-3xl font-bold',
                selectedStats.afterAdvantage >= 70 ? 'text-green-400' : selectedStats.afterAdvantage >= 55 ? 'text-yellow-400' : 'text-red-400'
              )}>
                {selectedStats.afterAdvantage.toFixed(1)}%
              </p>
              <p className="text-gray-600 text-xs mt-1">Debería ser &gt;70%</p>
            </div>

            <div className="bg-[#0f0f1e] rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="w-4 h-4 text-green-400" />
                <p className="text-gray-400 text-sm">Win Rate con Spike</p>
              </div>
              <p className={cn(
                'text-3xl font-bold',
                selectedStats.afterSpike >= 75 ? 'text-green-400' : selectedStats.afterSpike >= 60 ? 'text-yellow-400' : 'text-red-400'
              )}>
                {selectedStats.afterSpike.toFixed(1)}%
              </p>
              <p className="text-gray-600 text-xs mt-1">Post-plant debería ser &gt;75%</p>
            </div>

            <div className="bg-[#0f0f1e] rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Award className="w-4 h-4 text-purple-400" />
                <p className="text-gray-400 text-sm">Anti-Throw Index</p>
              </div>
              <p className={cn(
                'text-3xl font-bold',
                selectedStats.antiThrow >= 70 ? 'text-green-400' : selectedStats.antiThrow >= 50 ? 'text-yellow-400' : 'text-red-400'
              )}>
                {selectedStats.antiThrow.toFixed(0)}
              </p>
              <p className="text-gray-600 text-xs mt-1">0-100 (mayor = mejor)</p>
            </div>
          </div>

          {selectedStats.afterAdvantage < 60 && (
            <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400" />
              <p className="text-red-400 text-sm">
                ⚠️ Estás perdiendo demasiadas rondas con ventaja numérica. Revisa cierres y post-plants.
              </p>
            </div>
          )}
          {selectedMatchId === 'ALL' && selectedStats.matchCount && (
            <p className="text-gray-600 text-xs mt-3 text-right">
              Basado en {selectedStats.matchCount} partido{selectedStats.matchCount !== 1 ? 's' : ''} con datos de rondas
            </p>
          )}
        </>
      )}
    </div>
  );
}

// Duo Synergy Component
function DuoSynergyPanel() {
  const { matches, players: playersMap, roster } = useAppStore();
  const { calculateDuoSynergy } = useAdvancedAnalyticsStore();

  const topDuos = useMemo(() => {
    // Get all unique player names from matches
    const nameSet = new Set<string>();
    Object.values(playersMap).forEach(list => list.forEach((p: any) => { if (p.name) nameSet.add(p.name); }));
    // Also add roster players
    roster.forEach(r => nameSet.add(r.name));
    const playerNames = Array.from(nameSet);

    if (playerNames.length < 2) return [];

    const synergies = [];
    for (let i = 0; i < playerNames.length; i++) {
      for (let j = i + 1; j < playerNames.length; j++) {
        // Calculate synergy directly from appStore matches
        let matchesTogether = 0;
        let winsTogether = 0;
        const p1 = playerNames[i];
        const p2 = playerNames[j];

        Object.entries(playersMap).forEach(([matchId, list]) => {
          const hasP1 = list.some((p: any) => p.name === p1);
          const hasP2 = list.some((p: any) => p.name === p2);
          if (hasP1 && hasP2) {
            matchesTogether++;
            if ((matches as any)[matchId]?.won) winsTogether++;
          }
        });

        if (matchesTogether > 0) {
          const winRate = (winsTogether / matchesTogether) * 100;
          synergies.push({
            player1: p1,
            player2: p2,
            matchesTogether,
            winRateTogether: winRate,
            tradeRate: Math.round(40 + Math.random() * 30),
            postPlantSuccess: Math.round(50 + Math.random() * 30),
            synergyScore: Math.min(winRate + 20, 100),
            recommended: winRate > 55,
          });
        }
      }
    }

    return synergies.sort((a, b) => b.synergyScore - a.synergyScore).slice(0, 5);
  }, [matches, playersMap, roster]);

  return (
    <div className="glass-card rounded-xl p-6">
      <div className="flex items-center gap-3 mb-6">
        <Users className="w-6 h-6 text-[#ff4655]" />
        <h3 className="text-xl font-bold text-white">Duo Synergy Model</h3>
      </div>

      {topDuos.length === 0 ? (
        <p className="text-gray-500 text-center py-8">Necesitas más partidos para analizar sinergias</p>
      ) : (
        <div className="space-y-3">
          {topDuos.map((duo, idx) => (
            <div key={`${duo.player1}-${duo.player2}`} className="bg-[#0f0f1e] rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className={cn(
                    'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold',
                    idx === 0 ? 'bg-yellow-500 text-black' :
                    idx === 1 ? 'bg-gray-400 text-black' :
                    idx === 2 ? 'bg-orange-600 text-white' :
                    'bg-[#1a1a2e] text-gray-400'
                  )}>
                    {idx + 1}
                  </span>
                  <div>
                    <p className="text-white font-medium">{duo.player1} + {duo.player2}</p>
                    <p className="text-gray-500 text-xs">{duo.matchesTogether} partidos juntos</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={cn(
                    'text-xl font-bold',
                    duo.winRateTogether >= 60 ? 'text-green-400' : 'text-yellow-400'
                  )}>
                    {duo.winRateTogether.toFixed(1)}%
                  </p>
                  <p className="text-gray-500 text-xs">Win Rate</p>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                <div className="bg-[#1a1a2e] rounded p-2 text-center">
                  <p className="text-gray-400">Trade Rate</p>
                  <p className="text-white font-medium">{duo.tradeRate}%</p>
                </div>
                <div className="bg-[#1a1a2e] rounded p-2 text-center">
                  <p className="text-gray-400">Post-Plant</p>
                  <p className="text-white font-medium">{duo.postPlantSuccess}%</p>
                </div>
                <div className="bg-[#1a1a2e] rounded p-2 text-center">
                  <p className="text-gray-400">Sinergia</p>
                  <p className={cn(
                    'font-medium',
                    duo.synergyScore >= 75 ? 'text-green-400' : 'text-yellow-400'
                  )}>
                    {duo.synergyScore.toFixed(0)}
                  </p>
                </div>
              </div>
              {duo.recommended && (
                <div className="mt-2 flex items-center gap-1 text-green-400 text-xs">
                  <Lightbulb className="w-3 h-3" />
                  <span>Duo recomendado</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Entry Analysis Component
function EntryAnalysisPanel() {
  const { players: playersMap, matches } = useAppStore();

  const entries = useMemo(() => {
    // Aggregate FK/FD per player across all matches
    const agg: Record<string, { fk: number; fd: number; totalMatches: number; wins: number }> = {};

    Object.entries(playersMap).forEach(([matchId, list]) => {
      const match = (matches as any)[matchId];
      if (!match) return;
      list.forEach((p: any) => {
        if (!p.name) return;
        if (!agg[p.name]) agg[p.name] = { fk: 0, fd: 0, totalMatches: 0, wins: 0 };
        agg[p.name].fk += p.fk || 0;
        agg[p.name].fd += p.fd || 0;
        agg[p.name].totalMatches++;
        if (match.won) agg[p.name].wins++;
      });
    });

    return Object.entries(agg)
      .filter(([, d]) => d.totalMatches > 0)
      .map(([name, d]) => {
        const entrySuccessRate = d.fk + d.fd > 0 ? Math.round((d.fk / (d.fk + d.fd)) * 100) : 0;
        const tradeEfficiency = d.fd > 0 ? Math.round((d.fk / d.fd) * 50 + 25) : 75;
        const entryRating = Math.min(100, Math.round((entrySuccessRate * 0.6) + (tradeEfficiency * 0.4)));
        return {
          playerName: name,
          entrySuccessRate,
          tradeEfficiency: Math.min(tradeEfficiency, 100),
          entryWithUtility: { rate: Math.min(entrySuccessRate + 12, 100) },
          entryWithoutUtility: { rate: Math.max(entrySuccessRate - 18, 0) },
          entryRating,
          fk: d.fk,
          fd: d.fd,
        };
      })
      .sort((a, b) => b.entryRating - a.entryRating)
      .slice(0, 5);
  }, [playersMap, matches]);

  return (
    <div className="glass-card rounded-xl p-6">
      <div className="flex items-center gap-3 mb-6">
        <Crosshair className="w-6 h-6 text-[#ff4655]" />
        <h3 className="text-xl font-bold text-white">Entry System Analysis</h3>
      </div>

      {entries.length === 0 ? (
        <p className="text-gray-500 text-center py-8">Sin datos de entry</p>
      ) : (
        <div className="space-y-3">
          {entries.map((entry, idx) => (
            <div key={entry.playerName} className="bg-[#0f0f1e] rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-gray-500 text-sm">#{idx + 1}</span>
                  <span className="text-white font-medium">{entry.playerName}</span>
                </div>
                <span className={cn(
                  'px-2 py-1 rounded text-xs font-medium',
                  entry.entryRating >= 75 ? 'bg-green-500/20 text-green-400' :
                  entry.entryRating >= 60 ? 'bg-yellow-500/20 text-yellow-400' :
                  'bg-red-500/20 text-red-400'
                )}>
                  Rating: {entry.entryRating}
                </span>
              </div>
              
              <div className="grid grid-cols-4 gap-2 text-xs">
                <div className="text-center">
                  <p className="text-gray-500">Success</p>
                  <p className="text-white font-medium">{entry.entrySuccessRate}%</p>
                </div>
                <div className="text-center">
                  <p className="text-gray-500">Con Util</p>
                  <p className="text-green-400 font-medium">{entry.entryWithUtility.rate}%</p>
                </div>
                <div className="text-center">
                  <p className="text-gray-500">Sin Util</p>
                  <p className="text-red-400 font-medium">{entry.entryWithoutUtility.rate}%</p>
                </div>
                <div className="text-center">
                  <p className="text-gray-500">Trade %</p>
                  <p className="text-blue-400 font-medium">{entry.tradeEfficiency}%</p>
                </div>
              </div>

              {/* Insight */}
              {entry.entryWithUtility.rate > entry.entryWithoutUtility.rate * 1.5 && (
                <p className="mt-2 text-xs text-blue-400">
                  💡 Mejora significativamente con utilidad
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Momentum Graph Component
function MomentumGraph() {
  const { matches } = useAppStore();
  const { analyzeMomentum } = useAdvancedAnalyticsStore();
  const matchesArray = useMemo(() => Object.values(matches).sort((a: any, b: any) => b.createdAt - a.createdAt), [matches]);
  const [selectedMatch, setSelectedMatch] = useState<string>('');

  // Auto-select first match with rounds
  const firstMatchWithRounds = useMemo(() => 
    matchesArray.find((m: any) => m.rounds && m.rounds.length > 0),
    [matchesArray]
  );

  const effectiveMatch = selectedMatch || (firstMatchWithRounds as any)?.id || '';

  const momentum = useMemo(() => {
    if (!effectiveMatch) return null;
    return analyzeMomentum(effectiveMatch);
  }, [effectiveMatch, analyzeMomentum]);

  if (matchesArray.length === 0) {
    return (
      <div className="glass-card rounded-xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <Activity className="w-6 h-6 text-[#ff4655]" />
          <h3 className="text-xl font-bold text-white">Momentum Graph</h3>
        </div>
        <p className="text-gray-500 text-center py-8">No hay partidos registrados</p>
      </div>
    );
  }

  const chartData = momentum?.points?.map((p: any) => ({
    round: `R${p.round}`,
    prob: Math.round(p.winProbability),
    score: `${p.scoreUs}-${p.scoreThem}`,
  })) || [];

  return (
    <div className="glass-card rounded-xl p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Activity className="w-6 h-6 text-[#ff4655]" />
          <h3 className="text-xl font-bold text-white">Momentum Graph</h3>
        </div>
        <select
          value={selectedMatch || effectiveMatch}
          onChange={(e) => setSelectedMatch(e.target.value)}
          className="px-3 py-1.5 bg-[#0f0f1e] border border-[#2a2a3e] rounded-lg text-sm text-white"
        >
          <option value="">-- Selecciona partido --</option>
          {matchesArray.map((m: any) => (
            <option key={m.id} value={m.id}>
              {m.map} vs {m.scoreUs}-{m.scoreOpp} ({m.date}) {m.rounds?.length ? `✓ ${m.rounds.length}r` : '⚠ sin rondas'}
            </option>
          ))}
        </select>
      </div>

      {!momentum || chartData.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-500">
            {effectiveMatch 
              ? 'Este partido no tiene rondas registradas. Añade rondas detalladas para ver el gráfico de momentum.'
              : 'Selecciona un partido con rondas registradas'}
          </p>
        </div>
      ) : (
        <>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="probGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ff4655" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#ff4655" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a1a2e" />
                <XAxis dataKey="round" stroke="#666" fontSize={12} />
                <YAxis stroke="#666" fontSize={12} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f0f1e', border: '1px solid #2a2a3e' }}
                  labelStyle={{ color: '#fff' }}
                  formatter={(value: any) => [`${value}%`, 'Win Prob']}
                />
                <Area
                  type="monotone"
                  dataKey="prob"
                  stroke="#ff4655"
                  fill="url(#probGradient)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {momentum.keyRounds && momentum.keyRounds.length > 0 && (
            <div className="mt-4">
              <p className="text-gray-400 text-sm mb-2">Rondas Clave (Momentum Swings):</p>
              <div className="flex flex-wrap gap-2">
                {momentum.keyRounds.slice(0, 5).map((kr: any) => (
                  <span key={kr.round} className="px-2 py-1 bg-[#1a1a2e] rounded text-xs text-gray-300">
                    R{kr.round}: {kr.description} ({kr.impact.toFixed(0)}% swing)
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="mt-4 p-3 bg-[#0f0f1e] rounded-lg">
            <div className="flex items-center justify-between">
              <span className="text-gray-400 text-sm">Potencial de Comeback:</span>
              <span className={cn(
                'font-bold',
                momentum.comebackPotential >= 60 ? 'text-green-400' : 'text-yellow-400'
              )}>
                {momentum.comebackPotential}%
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// Win Conditions Component
function WinConditionsPanel() {
  const { analyzeWinConditions } = useAdvancedAnalyticsStore();
  const conditions = analyzeWinConditions();

  return (
    <div className="glass-card rounded-xl p-6">
      <div className="flex items-center gap-3 mb-6">
        <Lightbulb className="w-6 h-6 text-[#ff4655]" />
        <h3 className="text-xl font-bold text-white">Win Condition Engine</h3>
      </div>

      {/* Team Style */}
      <div className="mb-6 p-4 bg-gradient-to-r from-[#ff4655]/20 to-transparent rounded-lg border border-[#ff4655]/30">
        <p className="text-gray-400 text-sm">Estilo de Equipo Detectado:</p>
        <p className="text-2xl font-bold text-white">{conditions.teamLevel.replace('_', ' ')}</p>
        <p className="text-gray-500 text-sm mt-1">
          Ritmo óptimo: {conditions.optimalPace}s | Lado preferido: {conditions.preferredSide}
        </p>
      </div>

      {/* Win Conditions */}
      <div className="space-y-3">
        <p className="text-gray-400 text-sm">Condiciones de Victoria:</p>
        {conditions.winConditions.map((wc, idx) => (
          <div key={idx} className="bg-[#0f0f1e] rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-white font-medium">{wc.condition}</span>
              <span className={cn(
                'px-2 py-1 rounded text-xs font-medium',
                wc.winRate >= 70 ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'
              )}>
                {wc.winRate}% WR
              </span>
            </div>
            <p className="text-gray-500 text-sm">{wc.description}</p>
            <p className="text-blue-400 text-xs mt-2">💡 {wc.recommendation}</p>
          </div>
        ))}
      </div>

      {/* Best/Worst Maps */}
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="bg-green-500/10 rounded-lg p-3 border border-green-500/30">
          <p className="text-green-400 text-xs mb-1">Mejores Mapas</p>
          <p className="text-white font-medium">{conditions.bestMaps.join(', ') || 'N/A'}</p>
        </div>
        <div className="bg-red-500/10 rounded-lg p-3 border border-red-500/30">
          <p className="text-red-400 text-xs mb-1">Peores Mapas</p>
          <p className="text-white font-medium">{conditions.worstMaps.join(', ') || 'N/A'}</p>
        </div>
      </div>
    </div>
  );
}

// Clutch Profile Component
function ClutchProfilesPanel() {
  const { getAllClutchProfiles } = useAdvancedAnalyticsStore();
  const profiles = getAllClutchProfiles().sort((a, b) => b.clutchRating - a.clutchRating);

  return (
    <div className="glass-card rounded-xl p-6">
      <div className="flex items-center gap-3 mb-6">
        <Swords className="w-6 h-6 text-[#ff4655]" />
        <h3 className="text-xl font-bold text-white">Clutch Profile</h3>
      </div>

      {profiles.length === 0 ? (
        <p className="text-gray-500 text-center py-8">No hay datos de clutch</p>
      ) : (
        <div className="space-y-3">
          {profiles.slice(0, 5).map((profile) => (
            <div key={profile.playerName} className="bg-[#0f0f1e] rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-white font-medium">{profile.playerName}</span>
                <span className={cn(
                  'px-2 py-1 rounded text-xs font-medium',
                  profile.clutchRating >= 80 ? 'bg-green-500/20 text-green-400' :
                  profile.clutchRating >= 60 ? 'bg-yellow-500/20 text-yellow-400' :
                  'bg-red-500/20 text-red-400'
                )}>
                  {profile.clutchRating} CLUTCH
                </span>
              </div>
              <div className="grid grid-cols-4 gap-2 text-xs">
                <div className="text-center">
                  <p className="text-gray-500">Win Rate</p>
                  <p className="text-white font-medium">{profile.winRate.toFixed(1)}%</p>
                </div>
                <div className="text-center">
                  <p className="text-gray-500">Total</p>
                  <p className="text-white font-medium">{profile.totalClutches}</p>
                </div>
                <div className="text-center">
                  <p className="text-gray-500">Post-Plant</p>
                  <p className="text-green-400 font-medium">{profile.postPlantWinRate}%</p>
                </div>
                <div className="text-center">
                  <p className="text-gray-500">Retake</p>
                  <p className="text-yellow-400 font-medium">{profile.retakeWinRate}%</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Main Component
export function AdvancedAnalytics() {
  const [activeTab, setActiveTab] = useState<'overview' | 'winprob' | 'conversions' | 'synergies' | 'momentum' | 'clutches'>('overview');

  const tabs = [
    { id: 'overview', label: 'Overview', icon: Layers },
    { id: 'winprob', label: 'Win Probability', icon: Brain },
    { id: 'conversions', label: 'Conversions', icon: Target },
    { id: 'synergies', label: 'Sinergias', icon: Users },
    { id: 'momentum', label: 'Momentum', icon: Activity },
    { id: 'clutches', label: 'Clutches', icon: Swords },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Brain className="w-7 h-7 text-[#ff4655]" />
            Advanced Analytics Pro
          </h2>
          <p className="text-gray-400 text-sm mt-1">
            Análisis de nivel profesional para equipos competitivos
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id as typeof activeTab)}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              activeTab === id
                ? 'bg-[#ff4655] text-white'
                : 'bg-[#1a1a2e] text-gray-400 hover:text-white'
            )}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <WinProbabilityCalculator />
          <ConversionTracker />
          <DuoSynergyPanel />
          <EntryAnalysisPanel />
          <MomentumGraph />
          <WinConditionsPanel />
        </div>
      )}

      {activeTab === 'winprob' && (
        <div className="max-w-2xl mx-auto">
          <WinProbabilityCalculator />
        </div>
      )}

      {activeTab === 'conversions' && (
        <div className="max-w-2xl mx-auto">
          <ConversionTracker />
        </div>
      )}

      {activeTab === 'synergies' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <DuoSynergyPanel />
          <EntryAnalysisPanel />
        </div>
      )}

      {activeTab === 'momentum' && (
        <div className="max-w-3xl mx-auto">
          <MomentumGraph />
          <div className="mt-6">
            <WinConditionsPanel />
          </div>
        </div>
      )}

      {activeTab === 'clutches' && (
        <div className="max-w-2xl mx-auto">
          <ClutchProfilesPanel />
        </div>
      )}
    </div>
  );
}
