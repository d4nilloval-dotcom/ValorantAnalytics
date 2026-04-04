import { useState, useMemo, useRef } from 'react';
import {
  Plus,
  Target,
  Crosshair,
  Flame,
  Navigation,
  Users,
  Layers,
} from 'lucide-react';
import { useHeatmapStore } from '@/store/heatmapStore';
import { useAppStore } from '@/store/appStore';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { VALORANT_MAPS } from '@/types';
import type { HeatmapType, HeatmapPoint } from '@/types/heatmap';

const HEATMAP_TYPES: { type: HeatmapType; label: string; icon: typeof Target; color: string }[] = [
  { type: 'KILLS', label: 'Kills', icon: Crosshair, color: '#ef4444' },
  { type: 'DEATHS', label: 'Muertes', icon: Target, color: '#f97316' },
  { type: 'UTILITY', label: 'Utilidad', icon: Flame, color: '#eab308' },
  { type: 'POSITIONING', label: 'Posicionamiento', icon: Users, color: '#22c55e' },
  { type: 'ROTATIONS', label: 'Rotaciones', icon: Navigation, color: '#3b82f6' },
];

const MAP_IMAGES: Record<string, string> = {
  Ascent: '/maps/ascent.png',
  Bind: '/maps/bind.png',
  Haven: '/maps/haven.png',
  Split: '/maps/split.png',
  Pearl: '/maps/pearl.png',
  Breeze: '/maps/breeze.png',
  Abyss: '/maps/abyss.png',
  Corrode: '/maps/corrode.png',
  Lotus: '/maps/lotus.png',
  Fracture: '/maps/fracture.png',
  Icebox: '/maps/icebox.png',
  Sunset: '/maps/sunset.png',
};

export function HeatmapViewer() {
  const [selectedMap, setSelectedMap] = useState<string>(VALORANT_MAPS[0]);
  const [selectedType, setSelectedType] = useState<HeatmapType>('KILLS');
  const [selectedMatchId, setSelectedMatchId] = useState<string>('ALL');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [isAddingPoint, setIsAddingPoint] = useState(false);
  const [newPointData, setNewPointData] = useState<Partial<HeatmapPoint>>({});
  const mapRef = useRef<HTMLDivElement>(null);

  const { heatmaps, addHeatmap, addPoint, aggregateHeatmap } = useHeatmapStore();
  
  const { matches: matchStore } = useAppStore();
  const matchesArray = Object.values(matchStore).sort((a: any, b: any) => b.createdAt - a.createdAt);

  const currentHeatmap = useMemo(() => {
    if (selectedMatchId === 'ALL') {
      return aggregateHeatmap(selectedMap, selectedType);
    }
    // Filter to match-specific heatmap
    const matchSpecific = heatmaps.filter(h => h.map === selectedMap && h.type === selectedType && h.matchIds?.includes(selectedMatchId));
    if (matchSpecific.length === 0) return null;
    // Aggregate points from match-specific heatmaps and wrap in HeatmapData shape
    const allPoints = matchSpecific.flatMap(h => h.points);
    return { ...matchSpecific[0], points: allPoints };
  }, [selectedMap, selectedType, selectedMatchId, aggregateHeatmap, heatmaps]);

  const handleMapClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isAddingPoint || !mapRef.current) return;

    const rect = mapRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;

    setNewPointData({ x, y, intensity: 0.5 });
    setShowAddDialog(true);
    setIsAddingPoint(false);
  };

  const handleSavePoint = (formData: FormData) => {
    if (!newPointData.x || !newPointData.y) return;

    const point: Omit<HeatmapPoint, 'count'> = {
      x: newPointData.x,
      y: newPointData.y,
      intensity: parseFloat(formData.get('intensity') as string) || 0.5,
      details: {
        player: (formData.get('player') as string) || undefined,
        agent: (formData.get('agent') as string) || undefined,
        round: parseInt(formData.get('round') as string) || undefined,
        description: (formData.get('description') as string) || undefined,
      },
    };

    // Find or create heatmap for this map/type
    const existingHeatmap = heatmaps.find((h) => {
      const mapTypeMatch = h.map === selectedMap && h.type === selectedType;
      if (selectedMatchId === 'ALL') return mapTypeMatch;
      return mapTypeMatch && h.matchIds?.includes(selectedMatchId);
    });

    if (existingHeatmap) {
      addPoint(existingHeatmap.id, point);
    } else {
      addHeatmap({
        map: selectedMap,
        type: selectedType,
        points: [{ ...point, count: 1 }],
        matchIds: selectedMatchId !== 'ALL' ? [selectedMatchId] : [],
      });
    }

    setShowAddDialog(false);
    setNewPointData({});
  };

  const getHeatColor = (intensity: number) => {
    const colors = HEATMAP_TYPES.find((t) => t.type === selectedType);
    const baseColor = colors?.color || '#ef4444';
    return `${baseColor}${Math.round(intensity * 255)
      .toString(16)
      .padStart(2, '0')}`;
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Layers className="w-6 h-6 text-[#ff4655]" />
            Heatmaps
          </h2>
          <p className="text-gray-400 text-sm mt-1">
            Visualiza zonas calientes de kills, utilidad y posicionamiento
          </p>
        </div>
        <Button
          onClick={() => setIsAddingPoint(!isAddingPoint)}
          className={cn(
            'text-white',
            isAddingPoint ? 'bg-green-500 hover:bg-green-600' : 'bg-[#ff4655] hover:bg-[#ff6b7a]'
          )}
        >
          <Plus className="w-4 h-4 mr-1" />
          {isAddingPoint ? 'Haz click en el mapa' : 'Añadir Punto'}
        </Button>
      </div>

      {/* Controls */}
      <div className="glass-card rounded-xl p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Match Selector */}
          <div className="flex-1">
            <label className="text-sm text-gray-400 mb-2 block">Partido</label>
            <select
              value={selectedMatchId}
              onChange={(e) => setSelectedMatchId(e.target.value)}
              className="w-full px-3 py-2 bg-[#0f0f1e] border border-[#2a2a3e] rounded-lg text-white focus:border-[#ff4655] focus:outline-none"
            >
              <option value="ALL">Todos los partidos</option>
              {matchesArray.map((m: any) => (
                <option key={m.id} value={m.id}>
                  {m.map} - {m.date} ({m.scoreUs}-{m.scoreOpp})
                </option>
              ))}
            </select>
          </div>

          {/* Map Selector */}
          <div className="flex-1">
            <label className="text-sm text-gray-400 mb-2 block">Mapa</label>
            <select
              value={selectedMap}
              onChange={(e) => setSelectedMap(e.target.value)}
              className="w-full px-3 py-2 bg-[#0f0f1e] border border-[#2a2a3e] rounded-lg text-white focus:border-[#ff4655] focus:outline-none"
            >
              {VALORANT_MAPS.map((map) => (
                <option key={map} value={map}>
                  {map}
                </option>
              ))}
            </select>
          </div>

          {/* Type Selector */}
          <div className="flex-1">
            <label className="text-sm text-gray-400 mb-2 block">Tipo de Heatmap</label>
            <div className="flex flex-wrap gap-2">
              {HEATMAP_TYPES.map(({ type, label, icon: Icon, color }) => (
                <button
                  key={type}
                  onClick={() => setSelectedType(type)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm transition-colors',
                    selectedType === type
                      ? 'text-white'
                      : 'bg-[#0f0f1e] text-gray-400 hover:text-white'
                  )}
                  style={
                    selectedType === type
                      ? { backgroundColor: color }
                      : undefined
                  }
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Map Viewer */}
      <div className="glass-card rounded-xl p-4">
        <div
          ref={mapRef}
          onClick={handleMapClick}
          className={cn(
            'relative w-full aspect-video bg-[#0f0f1e] rounded-lg overflow-hidden',
            isAddingPoint && 'cursor-crosshair'
          )}
        >
          {/* Map Background */}
          <img
            src={MAP_IMAGES[selectedMap] || MAP_IMAGES['Ascent']}
            alt={selectedMap}
            className="w-full h-full object-contain"
            onError={(e) => {
              (e.target as HTMLImageElement).src = MAP_IMAGES['Ascent'];
            }}
          />

          {/* Heatmap Points */}
          {currentHeatmap?.points.map((point, idx) => (
            <div
              key={idx}
              className="absolute transform -translate-x-1/2 -translate-y-1/2 pointer-events-none"
              style={{
                left: `${point.x * 100}%`,
                top: `${point.y * 100}%`,
              }}
            >
              <div
                className="rounded-full animate-pulse"
                style={{
                  width: `${20 + point.count * 5}px`,
                  height: `${20 + point.count * 5}px`,
                  backgroundColor: getHeatColor(point.intensity),
                  opacity: 0.6,
                }}
              />
              {point.count > 1 && (
                <span className="absolute inset-0 flex items-center justify-center text-white text-xs font-bold">
                  {point.count}
                </span>
              )}
            </div>
          ))}

          {/* Click Indicator */}
          {isAddingPoint && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 pointer-events-none">
              <div className="bg-[#0f0f1e] px-4 py-2 rounded-lg text-white">
                Haz click en el mapa para añadir un punto
              </div>
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="flex items-center justify-between mt-4">
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-400">Intensidad:</span>
            <div className="flex items-center gap-2">
              <div
                className="w-4 h-4 rounded-full"
                style={{ backgroundColor: getHeatColor(0.3) }}
              />
              <span className="text-xs text-gray-500">Baja</span>
              <div
                className="w-4 h-4 rounded-full"
                style={{ backgroundColor: getHeatColor(0.6) }}
              />
              <span className="text-xs text-gray-500">Media</span>
              <div
                className="w-4 h-4 rounded-full"
                style={{ backgroundColor: getHeatColor(1) }}
              />
              <span className="text-xs text-gray-500">Alta</span>
            </div>
          </div>
          <div className="text-sm text-gray-500">
            {currentHeatmap?.points.length || 0} puntos registrados
          </div>
        </div>
      </div>

      {/* Points List */}
      <div className="glass-card rounded-xl p-4">
        <h3 className="text-lg font-semibold text-white mb-4">Puntos Registrados</h3>
        {currentHeatmap?.points.length === 0 ? (
          <p className="text-gray-500 text-center py-8">
            No hay puntos registrados para este mapa y tipo
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {currentHeatmap?.points.map((point, idx) => (
              <div key={idx} className="bg-[#0f0f1e] rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: getHeatColor(point.intensity) }}
                    />
                    <span className="text-white text-sm">
                      ({(point.x * 100).toFixed(0)}%, {(point.y * 100).toFixed(0)}%)
                    </span>
                  </div>
                  <span className="text-gray-500 text-xs">x{point.count}</span>
                </div>
                {point.details && (
                  <div className="mt-2 text-xs text-gray-500">
                    {point.details.player && <p>Jugador: {point.details.player}</p>}
                    {point.details.agent && <p>Agente: {point.details.agent}</p>}
                    {point.details.round && <p>Ronda: {point.details.round}</p>}
                    {point.details.description && <p>{point.details.description}</p>}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Point Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="bg-[#0f0f1e] border-[#1a1a2e] text-white max-w-md">
          <DialogHeader>
            <DialogTitle>Añadir Punto al Heatmap</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSavePoint(new FormData(e.currentTarget));
            }}
            className="space-y-4"
          >
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm text-gray-400">X (%)</label>
                <input
                  type="text"
                  value={((newPointData.x || 0) * 100).toFixed(1)}
                  disabled
                  className="w-full mt-1 px-3 py-2 bg-[#1a1a2e] border border-[#2a2a3e] rounded-lg text-white opacity-50"
                />
              </div>
              <div>
                <label className="text-sm text-gray-400">Y (%)</label>
                <input
                  type="text"
                  value={((newPointData.y || 0) * 100).toFixed(1)}
                  disabled
                  className="w-full mt-1 px-3 py-2 bg-[#1a1a2e] border border-[#2a2a3e] rounded-lg text-white opacity-50"
                />
              </div>
            </div>
            <div>
              <label className="text-sm text-gray-400">Intensidad</label>
              <input
                name="intensity"
                type="range"
                min="0.1"
                max="1"
                step="0.1"
                defaultValue="0.5"
                className="w-full mt-1"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>Baja</span>
                <span>Alta</span>
              </div>
            </div>
            <div>
              <label className="text-sm text-gray-400">Jugador (opcional)</label>
              <input
                name="player"
                placeholder="Nombre del jugador"
                className="w-full mt-1 px-3 py-2 bg-[#1a1a2e] border border-[#2a2a3e] rounded-lg text-white focus:border-[#ff4655] focus:outline-none"
              />
            </div>
            <div>
              <label className="text-sm text-gray-400">Agente (opcional)</label>
              <input
                name="agent"
                placeholder="Ej: Jett, Omen..."
                className="w-full mt-1 px-3 py-2 bg-[#1a1a2e] border border-[#2a2a3e] rounded-lg text-white focus:border-[#ff4655] focus:outline-none"
              />
            </div>
            <div>
              <label className="text-sm text-gray-400">Ronda (opcional)</label>
              <input
                name="round"
                type="number"
                min={1}
                max={24}
                placeholder="5"
                className="w-full mt-1 px-3 py-2 bg-[#1a1a2e] border border-[#2a2a3e] rounded-lg text-white focus:border-[#ff4655] focus:outline-none"
              />
            </div>
            <div>
              <label className="text-sm text-gray-400">Descripción</label>
              <textarea
                name="description"
                rows={2}
                placeholder="Detalles del evento..."
                className="w-full mt-1 px-3 py-2 bg-[#1a1a2e] border border-[#2a2a3e] rounded-lg text-white focus:border-[#ff4655] focus:outline-none resize-none"
              />
            </div>
            <Button type="submit" className="w-full bg-[#ff4655] hover:bg-[#ff6b7a]">
              Añadir Punto
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
