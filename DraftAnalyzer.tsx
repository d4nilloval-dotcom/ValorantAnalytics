import { useState, useMemo } from 'react';
import {
  Shield,
  Plus,
  Map as MapIcon,
  Check,
  X,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useDraftStore } from '@/store/draftStore';
import { useAppStore } from '@/store/appStore';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { VALORANT_AGENTS, AGENT_ROLES } from '@/types';
import type { TeamComposition } from '@/types/draft';

const ROLE_COLORS: Record<string, string> = {
  Duelist: 'bg-red-500',
  Controller: 'bg-purple-500',
  Initiator: 'bg-green-500',
  Sentinel: 'bg-blue-500',
};

const ROLE_ICONS: Record<string, string> = {
  Duelist: '⚔️',
  Controller: '☁️',
  Initiator: '👁️',
  Sentinel: '🛡️',
};

export function DraftAnalyzer() {
  const [showCompDialog, setShowCompDialog] = useState(false);
  const [editingComp, setEditingComp] = useState<TeamComposition | null>(null);
  const [selectedMap, setSelectedMap] = useState<string>('ALL');
  const [expandedSection, setExpandedSection] = useState<string>('picks');

  const { compositions, addComposition, updateComposition, deleteComposition, getDraftAnalysis } = useDraftStore();
  const { getFilteredMatches, getPlayersForMatch } = useAppStore();
  const [autoImported, setAutoImported] = useState(false);
  const [importMsg, setImportMsg] = useState('');

  // Auto-importar composiciones desde partidos
  const autoImportFromMatches = () => {
    const matches = getFilteredMatches();
    if (matches.length === 0) { setImportMsg('Sin partidos para importar'); return; }
    let added = 0;
    matches.forEach(match => {
      const players = getPlayersForMatch(match.id);
      if (!players || players.length < 2) return;
      const agents = players.map((p: any) => p.agent).filter(Boolean);
      if (agents.length === 0) return;
      const alreadyExists = compositions.some(c => c.matchId === match.id);
      if (alreadyExists) return;
      addComposition({
        matchId: match.id,
        map: match.map,
        side: 'ATK',
        ourAgents: agents.slice(0, 5),
        theirAgents: [],
        ourBans: [],
        theirBans: [],
        won: match.won,
        roundsWon: match.scoreUs || 0,
        roundsLost: match.scoreOpp || 0,
        notes: `Auto-importado · ${match.date}`,
      });
      added++;
    });
    const msg = added > 0 ? `✓ ${added} composiciones importadas` : 'No hay composiciones nuevas';
    setImportMsg(msg);
    setTimeout(() => setImportMsg(''), 3000);
    setAutoImported(true);
  };

  const analysis = useMemo(() => getDraftAnalysis(), [getDraftAnalysis, compositions]);

  const filteredCompositions = useMemo(() => {
    if (selectedMap === 'ALL') return compositions;
    return compositions.filter((c) => c.map === selectedMap);
  }, [compositions, selectedMap]);

  const maps = useMemo(() => {
    const uniqueMaps = new Set(compositions.map((c) => c.map));
    return Array.from(uniqueMaps);
  }, [compositions]);

  const handleAddComp = () => {
    setEditingComp(null);
    setShowCompDialog(true);
  };

  const handleEditComp = (comp: TeamComposition) => {
    setEditingComp(comp);
    setShowCompDialog(true);
  };

  const handleSaveComp = (formData: FormData) => {
    const ourAgents = formData.getAll('ourAgents') as string[];
    const theirAgents = formData.getAll('theirAgents') as string[];
    const ourBans = formData.getAll('ourBans') as string[];
    const theirBans = formData.getAll('theirBans') as string[];

    const compData = {
      matchId: (formData.get('matchId') as string) || '',
      map: formData.get('map') as string,
      side: (formData.get('side') as 'ATK' | 'DEF') || 'ATK',
      ourAgents: ourAgents.slice(0, 5),
      theirAgents: theirAgents.slice(0, 5),
      ourBans: ourBans,
      theirBans: theirBans,
      won: formData.get('won') === 'true',
      roundsWon: parseInt(formData.get('roundsWon') as string) || 0,
      roundsLost: parseInt(formData.get('roundsLost') as string) || 0,
      notes: formData.get('notes') as string,
    };

    if (editingComp) {
      updateComposition(editingComp.id, compData);
    } else {
      addComposition(compData);
    }
    setShowCompDialog(false);
  };

  const Section = ({ title, id, children }: { title: string; id: string; children: React.ReactNode }) => (
    <div className="glass-card rounded-xl overflow-hidden">
      <button
        onClick={() => setExpandedSection(expandedSection === id ? '' : id)}
        className="w-full flex items-center justify-between p-4 hover:bg-[#1a1a2e] transition-colors"
      >
        <span className="font-semibold text-white">{title}</span>
        {expandedSection === id ? (
          <ChevronUp className="w-5 h-5 text-gray-400" />
        ) : (
          <ChevronDown className="w-5 h-5 text-gray-400" />
        )}
      </button>
      {expandedSection === id && <div className="p-4 pt-0">{children}</div>}
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Shield className="w-6 h-6 text-[#ff4655]" />
            Analizador de Draft
          </h2>
          <p className="text-gray-400 text-sm mt-1">
            Analiza pick/ban y composiciones de agentes
          </p>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          {importMsg && <span className="text-xs text-green-400 bg-green-500/10 border border-green-500/20 px-3 py-1.5 rounded-xl">{importMsg}</span>}
          <button onClick={autoImportFromMatches}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border transition-all"
            style={{background:'hsl(220 15% 12%)',borderColor:'hsl(220 15% 22%)',color:'hsl(215 15% 65%)'}}>
            ⬇ Auto-importar desde Partidos
          </button>
          <Button onClick={handleAddComp} className="bg-[#ff4655] hover:bg-[#ff6b7a] text-white">
            <Plus className="w-4 h-4 mr-1" />
            Añadir Composición
          </Button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass-card rounded-xl p-4">
          <p className="text-gray-400 text-sm">Total Composiciones</p>
          <p className="text-2xl font-bold text-white mt-1">{compositions.length}</p>
        </div>
        <div className="glass-card rounded-xl p-4">
          <p className="text-gray-400 text-sm">Win Rate Global</p>
          <p className="text-2xl font-bold text-green-400 mt-1">
            {compositions.length > 0
              ? ((compositions.filter((c) => c.won).length / compositions.length) * 100).toFixed(1)
              : 0}
            %
          </p>
        </div>
        <div className="glass-card rounded-xl p-4">
          <p className="text-gray-400 text-sm">Agente Más Pickeado</p>
          <p className="text-lg font-bold text-white mt-1">
            {analysis.mostPickedAgents[0]?.agent || 'N/A'}
          </p>
        </div>
        <div className="glass-card rounded-xl p-4">
          <p className="text-gray-400 text-sm">Mejor Compo</p>
          <p className="text-lg font-bold text-white mt-1">
            {analysis.bestCompositions[0]?.map || 'N/A'}
          </p>
        </div>
      </div>

      {/* Agent Picks */}
      <Section title="Estadísticas de Picks" id="picks">
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
          {analysis.mostPickedAgents.map(({ agent, picks, winRate }) => {
            const role = AGENT_ROLES[agent] || 'Unknown';
            return (
              <div
                key={agent}
                className="bg-[#0f0f1e] rounded-lg p-3 text-center hover:bg-[#1a1a2e] transition-colors"
              >
                <div className={cn('w-8 h-1 rounded-full mx-auto mb-2', ROLE_COLORS[role])} />
                <p className="text-white font-medium text-sm">{agent}</p>
                <p className="text-gray-500 text-xs mt-1">{picks} picks</p>
                <p className={cn('text-xs mt-1', winRate >= 50 ? 'text-green-400' : 'text-red-400')}>
                  {winRate.toFixed(0)}% WR
                </p>
              </div>
            );
          })}
        </div>
      </Section>

      {/* Best Compositions */}
      <Section title="Mejores Composiciones" id="best">
        <div className="space-y-3">
          {compositions.filter(c => c.won).slice(0, 5).map((comp) => (
            <div
              key={comp.id}
              onClick={() => handleEditComp(comp)}
              className="flex items-center gap-4 p-3 bg-[#0f0f1e] rounded-lg cursor-pointer hover:bg-[#1a1a2e] transition-colors"
            >
              <div className="flex items-center gap-2">
                <MapIcon className="w-4 h-4 text-gray-500" />
                <span className="text-white font-medium">{comp.map}</span>
              </div>
              <div className="flex items-center gap-1">
                {comp.ourAgents.map((agent) => (
                  <span
                    key={agent}
                    className="px-2 py-0.5 bg-[#1a1a2e] rounded text-xs text-gray-300"
                  >
                    {agent}
                  </span>
                ))}
              </div>
              <div className="flex items-center gap-2 ml-auto">
                <span className="text-green-400 font-medium">{comp.roundsWon}</span>
                <span className="text-gray-500">-</span>
                <span className="text-red-400 font-medium">{comp.roundsLost}</span>
                <Check className="w-4 h-4 text-green-500 ml-2" />
              </div>
            </div>
          ))}
          {compositions.filter(c => c.won).length === 0 && (
            <p className="text-gray-500 text-center py-4">No hay composiciones ganadoras registradas</p>
          )}
        </div>
      </Section>

      {/* Agent Synergies */}
      <Section title="Sinergias de Agentes" id="synergies">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {analysis.agentSynergies.slice(0, 6).map(({ agents, matches, winRate }) => (
            <div key={agents.join('-')} className="bg-[#0f0f1e] rounded-lg p-3">
              <div className="flex items-center justify-center gap-2 mb-2">
                <span className="px-2 py-1 bg-[#1a1a2e] rounded text-sm text-white">{agents[0]}</span>
                <span className="text-gray-500">+</span>
                <span className="px-2 py-1 bg-[#1a1a2e] rounded text-sm text-white">{agents[1]}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">{matches} partidos</span>
                <span className={winRate >= 50 ? 'text-green-400' : 'text-red-400'}>
                  {winRate.toFixed(0)}% WR
                </span>
              </div>
            </div>
          ))}
          {analysis.agentSynergies.length === 0 && (
            <p className="text-gray-500 text-center py-4 col-span-full">
              Necesitas al menos 3 partidos con las mismas combinaciones
            </p>
          )}
        </div>
      </Section>

      {/* All Compositions */}
      <div className="glass-card rounded-xl p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">Todas las Composiciones</h3>
          <select
            value={selectedMap}
            onChange={(e) => setSelectedMap(e.target.value)}
            className="px-3 py-1.5 bg-[#1a1a2e] border border-[#2a2a3e] rounded-lg text-sm text-white focus:border-[#ff4655] focus:outline-none"
          >
            <option value="ALL">Todos los mapas</option>
            {maps.map((map) => (
              <option key={map} value={map}>
                {map}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          {filteredCompositions.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No hay composiciones registradas</p>
          ) : (
            filteredCompositions.map((comp) => (
              <div
                key={comp.id}
                onClick={() => handleEditComp(comp)}
                className="flex items-center gap-4 p-3 bg-[#0f0f1e] rounded-lg cursor-pointer hover:bg-[#1a1a2e] transition-colors"
              >
                <div className="flex items-center gap-2 min-w-[100px]">
                  <MapIcon className="w-4 h-4 text-gray-500" />
                  <span className="text-white text-sm">{comp.map}</span>
                </div>
                <div className="flex items-center gap-1 flex-wrap">
                  <span className="text-xs text-gray-500 mr-1">Nosotros:</span>
                  {comp.ourAgents.map((agent) => (
                    <span
                      key={agent}
                      className="px-1.5 py-0.5 bg-[#1a1a2e] rounded text-xs text-gray-300"
                    >
                      {agent}
                    </span>
                  ))}
                </div>
                <div className="flex items-center gap-1 flex-wrap">
                  <span className="text-xs text-gray-500 mr-1">Rival:</span>
                  {comp.theirAgents.map((agent) => (
                    <span
                      key={agent}
                      className="px-1.5 py-0.5 bg-[#1a1a2e] rounded text-xs text-gray-400"
                    >
                      {agent}
                    </span>
                  ))}
                </div>
                <div className="flex items-center gap-2 ml-auto">
                  {comp.won ? (
                    <Check className="w-4 h-4 text-green-500" />
                  ) : (
                    <X className="w-4 h-4 text-red-500" />
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Composition Dialog */}
      <Dialog open={showCompDialog} onOpenChange={setShowCompDialog}>
        <DialogContent className="bg-[#0f0f1e] border-[#1a1a2e] text-white max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingComp ? 'Editar Composición' : 'Nueva Composición'}
            </DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSaveComp(new FormData(e.currentTarget));
            }}
            className="space-y-4"
          >
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm text-gray-400">Mapa</label>
                <input
                  name="map"
                  defaultValue={editingComp?.map}
                  required
                  placeholder="Ej: Ascent"
                  className="w-full mt-1 px-3 py-2 bg-[#1a1a2e] border border-[#2a2a3e] rounded-lg text-white focus:border-[#ff4655] focus:outline-none"
                />
              </div>
              <div>
                <label className="text-sm text-gray-400">Lado</label>
                <select
                  name="side"
                  defaultValue={editingComp?.side || 'ATK'}
                  className="w-full mt-1 px-3 py-2 bg-[#1a1a2e] border border-[#2a2a3e] rounded-lg text-white focus:border-[#ff4655] focus:outline-none"
                >
                  <option value="ATK">Ataque</option>
                  <option value="DEF">Defensa</option>
                </select>
              </div>
            </div>

            {/* Our Agents */}
            <div>
              <label className="text-sm text-gray-400 mb-2 block">Nuestros Agentes (selecciona 5)</label>
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 max-h-40 overflow-y-auto p-2 bg-[#0f0f1e] rounded-lg">
                {VALORANT_AGENTS.map((agent) => {
                  const role = AGENT_ROLES[agent] || 'Unknown';
                  const isSelected = editingComp?.ourAgents.includes(agent);
                  return (
                    <label
                      key={`our-${agent}`}
                      className={cn(
                        'flex items-center gap-1 p-2 rounded cursor-pointer transition-colors',
                        isSelected ? 'bg-[#ff4655]/30 border border-[#ff4655]' : 'hover:bg-[#1a1a2e]'
                      )}
                    >
                      <input
                        type="checkbox"
                        name="ourAgents"
                        value={agent}
                        defaultChecked={isSelected}
                        className="hidden"
                      />
                      <span className="text-lg">{ROLE_ICONS[role]}</span>
                      <span className="text-xs text-white">{agent}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Their Agents */}
            <div>
              <label className="text-sm text-gray-400 mb-2 block">Agentes Rivales (selecciona 5)</label>
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 max-h-40 overflow-y-auto p-2 bg-[#0f0f1e] rounded-lg">
                {VALORANT_AGENTS.map((agent) => {
                  const role = AGENT_ROLES[agent] || 'Unknown';
                  const isSelected = editingComp?.theirAgents.includes(agent);
                  return (
                    <label
                      key={`their-${agent}`}
                      className={cn(
                        'flex items-center gap-1 p-2 rounded cursor-pointer transition-colors',
                        isSelected ? 'bg-blue-500/30 border border-blue-500' : 'hover:bg-[#1a1a2e]'
                      )}
                    >
                      <input
                        type="checkbox"
                        name="theirAgents"
                        value={agent}
                        defaultChecked={isSelected}
                        className="hidden"
                      />
                      <span className="text-lg">{ROLE_ICONS[role]}</span>
                      <span className="text-xs text-white">{agent}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm text-gray-400">Rondas Ganadas</label>
                <input
                  name="roundsWon"
                  type="number"
                  defaultValue={editingComp?.roundsWon || 0}
                  min={0}
                  max={24}
                  className="w-full mt-1 px-3 py-2 bg-[#1a1a2e] border border-[#2a2a3e] rounded-lg text-white focus:border-[#ff4655] focus:outline-none"
                />
              </div>
              <div>
                <label className="text-sm text-gray-400">Rondas Perdidas</label>
                <input
                  name="roundsLost"
                  type="number"
                  defaultValue={editingComp?.roundsLost || 0}
                  min={0}
                  max={24}
                  className="w-full mt-1 px-3 py-2 bg-[#1a1a2e] border border-[#2a2a3e] rounded-lg text-white focus:border-[#ff4655] focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="text-sm text-gray-400 flex items-center gap-2">
                <input
                  type="checkbox"
                  name="won"
                  value="true"
                  defaultChecked={editingComp?.won}
                  className="rounded border-gray-600"
                />
                Victoria
              </label>
            </div>

            <div>
              <label className="text-sm text-gray-400">Notas</label>
              <textarea
                name="notes"
                defaultValue={editingComp?.notes}
                rows={2}
                className="w-full mt-1 px-3 py-2 bg-[#1a1a2e] border border-[#2a2a3e] rounded-lg text-white focus:border-[#ff4655] focus:outline-none resize-none"
              />
            </div>

            <div className="flex gap-2">
              {editingComp && (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => {
                    deleteComposition(editingComp.id);
                    setShowCompDialog(false);
                  }}
                  className="flex-1"
                >
                  Eliminar
                </Button>
              )}
              <Button type="submit" className="flex-1 bg-[#ff4655] hover:bg-[#ff6b7a]">
                {editingComp ? 'Guardar' : 'Crear'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
