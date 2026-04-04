import { RivalTeamProfiles } from './RivalTeamProfiles';
import { useState } from 'react';
import { 
  Trophy, 
  Plus, 
  Search, 
  Star, 
  Trash2, 
  Calendar,
  User,
  ExternalLink,
  ChevronDown
} from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface NoteForm {
  playerName: string;
  teamName: string;
  isExternal: boolean;
  content: string;
  tags: string;
  rating: number;
  externalAcs: string;
  externalKd: string;
  externalHs: string;
  externalAdr: string;
  externalAgent: string;
}

const defaultForm: NoteForm = {
  playerName: '',
  teamName: '',
  isExternal: false,
  content: '',
  tags: '',
  rating: 3,
  externalAcs: '',
  externalKd: '',
  externalHs: '',
  externalAdr: '',
  externalAgent: '',
};

const commonTags = [
  'Mecánica', 'Game Sense', 'Comms', 'Liderazgo', 
  'Entry', 'Support', 'Clutch', 'Consistency',
  'Reclutamiento', 'Rival', 'Referencia'
];

export function Scouting() {
  const { scoutingNotes, addScoutingNote, deleteScoutingNote, getPlayerStats } = useAppStore();
  const [mainTab, setMainTab] = useState<'notas' | 'rivales'>('notas');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState<NoteForm>(defaultForm);
  const [search, setSearch] = useState('');
  const [filterTag, setFilterTag] = useState('');
  const [viewMode, setViewMode] = useState<'all' | 'internal' | 'external'>('all');
  const [expandedNote, setExpandedNote] = useState<string | null>(null);

  const players = getPlayerStats('ALL');
  const playerNames = players.map(p => p.name);

  const filteredNotes = scoutingNotes.filter(note => {
    const matchesSearch = note.playerName.toLowerCase().includes(search.toLowerCase()) ||
                         note.content.toLowerCase().includes(search.toLowerCase()) ||
                         ((note as any).teamName || '').toLowerCase().includes(search.toLowerCase());
    const matchesTag = !filterTag || note.tags.includes(filterTag);
    const matchesView = viewMode === 'all' || 
      (viewMode === 'external' && (note as any).isExternal) ||
      (viewMode === 'internal' && !(note as any).isExternal);
    return matchesSearch && matchesTag && matchesView;
  }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const allTags = Array.from(new Set(scoutingNotes.flatMap(n => n.tags)));
  const externalCount = scoutingNotes.filter(n => (n as any).isExternal).length;
  const internalCount = scoutingNotes.filter(n => !(n as any).isExternal).length;

  const handleSave = () => {
    const note: any = {
      id: crypto.randomUUID(),
      playerName: formData.playerName,
      teamName: formData.isExternal ? formData.teamName : undefined,
      isExternal: formData.isExternal,
      content: formData.content,
      tags: formData.tags.split(',').map(t => t.trim()).filter(Boolean),
      rating: formData.rating,
      date: new Date().toISOString().split('T')[0],
      matchId: undefined,
      externalStats: formData.isExternal ? {
        agent: formData.externalAgent || undefined,
        acs: formData.externalAcs ? parseFloat(formData.externalAcs) : undefined,
        kd: formData.externalKd ? parseFloat(formData.externalKd) : undefined,
        hs: formData.externalHs ? parseFloat(formData.externalHs) : undefined,
        adr: formData.externalAdr ? parseFloat(formData.externalAdr) : undefined,
      } : undefined,
    };
    addScoutingNote(note);
    setFormData(defaultForm);
    setIsDialogOpen(false);
  };

  const getRatingColor = (rating: number) => {
    if (rating >= 4) return 'text-green-400';
    if (rating >= 3) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getRatingBg = (rating: number) => {
    if (rating >= 4) return 'bg-green-500/10';
    if (rating >= 3) return 'bg-yellow-500/10';
    return 'bg-red-500/10';
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Main tab selector */}
      <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'hsl(220 15% 12%)' }}>
        <button onClick={() => setMainTab('notas')}
          className={cn("flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all",
            mainTab === 'notas' ? 'text-white' : 'text-muted-foreground hover:text-foreground'
          )}
          style={mainTab === 'notas' ? { background: 'hsl(355 85% 58% / 0.15)', border: '1px solid hsl(355 85% 58% / 0.3)' } : {}}>
          📋 Notas de Scouting
        </button>
        <button onClick={() => setMainTab('rivales')}
          className={cn("flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all",
            mainTab === 'rivales' ? 'text-white' : 'text-muted-foreground hover:text-foreground'
          )}
          style={mainTab === 'rivales' ? { background: 'hsl(355 85% 58% / 0.15)', border: '1px solid hsl(355 85% 58% / 0.3)' } : {}}>
          🎯 Perfiles de Equipos Rivales
        </button>
      </div>

      {mainTab === 'rivales' && <RivalTeamProfiles />}

      {mainTab === 'notas' && <>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap gap-3">
          {/* View mode toggle */}
          <div className="flex rounded-lg overflow-hidden border border-white/10">
            {(['all', 'internal', 'external'] as const).map(mode => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={cn(
                  'px-3 py-1.5 text-xs font-medium transition-colors',
                  viewMode === mode ? 'bg-[#ff4655] text-white' : 'text-muted-foreground hover:text-white'
                )}
              >
                {mode === 'all' ? 'Todos' : mode === 'internal' ? `Mi Equipo (${internalCount})` : `Externos (${externalCount})`}
              </button>
            ))}
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar notas..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-pro pl-10 w-64"
            />
          </div>
          
          <select
            value={filterTag}
            onChange={(e) => setFilterTag(e.target.value)}
            className="input-pro"
          >
            <option value="">Todas las etiquetas</option>
            {allTags.map(tag => (
              <option key={tag} value={tag}>{tag}</option>
            ))}
          </select>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="btn-primary">
              <Plus className="w-4 h-4" />
              Nueva Nota
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto"
            style={{ background: 'hsl(220 22% 8%)', border: '1px solid hsl(220 15% 20%)' }}
          >
            <DialogHeader>
              <DialogTitle>Nueva Nota de Scouting</DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4 mt-4">
              {/* Player type selector */}
              <div className="flex gap-2">
                <button
                  onClick={() => setFormData({ ...formData, isExternal: false })}
                  className={cn(
                    'flex-1 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2',
                    !formData.isExternal ? 'bg-[#ff4655] text-white' : 'bg-white/5 text-muted-foreground hover:bg-white/10'
                  )}
                >
                  <User className="w-4 h-4" />
                  Mi Equipo
                </button>
                <button
                  onClick={() => setFormData({ ...formData, isExternal: true })}
                  className={cn(
                    'flex-1 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2',
                    formData.isExternal ? 'bg-blue-600 text-white' : 'bg-white/5 text-muted-foreground hover:bg-white/10'
                  )}
                >
                  <ExternalLink className="w-4 h-4" />
                  Jugador Externo
                </button>
              </div>

              {/* Player selection */}
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">
                  {formData.isExternal ? 'Nombre del Jugador' : 'Jugador del Equipo'}
                </label>
                {formData.isExternal ? (
                  <input
                    type="text"
                    value={formData.playerName}
                    onChange={(e) => setFormData({ ...formData, playerName: e.target.value })}
                    className="input-pro w-full"
                    placeholder="Nombre del jugador rival..."
                  />
                ) : (
                  <select
                    value={formData.playerName}
                    onChange={(e) => setFormData({ ...formData, playerName: e.target.value })}
                    className="input-pro w-full"
                  >
                    <option value="">Seleccionar jugador</option>
                    {playerNames.map(name => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                )}
              </div>

              {/* Team name (only for external) */}
              {formData.isExternal && (
                <div>
                  <label className="text-sm text-muted-foreground mb-1 block">Equipo / Organización</label>
                  <input
                    type="text"
                    value={formData.teamName}
                    onChange={(e) => setFormData({ ...formData, teamName: e.target.value })}
                    className="input-pro w-full"
                    placeholder="Nombre del equipo rival..."
                  />
                </div>
              )}

              {/* External stats */}
              {formData.isExternal && (
                <div>
                  <label className="text-sm text-muted-foreground mb-2 block">Estadísticas Observadas (opcional)</label>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-muted-foreground">Agente Principal</label>
                      <input type="text" value={formData.externalAgent}
                        onChange={e => setFormData({ ...formData, externalAgent: e.target.value })}
                        className="input-pro w-full text-sm" placeholder="ej: Jett" />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">ACS</label>
                      <input type="number" value={formData.externalAcs}
                        onChange={e => setFormData({ ...formData, externalAcs: e.target.value })}
                        className="input-pro w-full text-sm" placeholder="ej: 245" />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">K/D</label>
                      <input type="number" step="0.01" value={formData.externalKd}
                        onChange={e => setFormData({ ...formData, externalKd: e.target.value })}
                        className="input-pro w-full text-sm" placeholder="ej: 1.35" />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">HS%</label>
                      <input type="number" step="0.1" value={formData.externalHs}
                        onChange={e => setFormData({ ...formData, externalHs: e.target.value })}
                        className="input-pro w-full text-sm" placeholder="ej: 28.5" />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">ADR</label>
                      <input type="number" value={formData.externalAdr}
                        onChange={e => setFormData({ ...formData, externalAdr: e.target.value })}
                        className="input-pro w-full text-sm" placeholder="ej: 142" />
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Observaciones</label>
                <textarea
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  className="input-pro w-full h-32 resize-none"
                  placeholder={formData.isExternal 
                    ? "Observaciones sobre el jugador rival (tendencias, puntos débiles, mecánicas destacadas...)" 
                    : "Observaciones sobre el jugador..."}
                />
              </div>

              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Etiquetas (separadas por coma)</label>
                <input
                  type="text"
                  value={formData.tags}
                  onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                  className="input-pro w-full"
                  placeholder="ej: Mecánica, Entry, Clutch"
                />
                <div className="flex flex-wrap gap-2 mt-2">
                  {commonTags.map(tag => (
                    <button
                      key={tag}
                      onClick={() => {
                        const current = formData.tags ? formData.tags.split(',').map(t => t.trim()) : [];
                        if (!current.includes(tag)) {
                          setFormData({ ...formData, tags: [...current, tag].join(', ') });
                        }
                      }}
                      className="px-2 py-1 rounded-full text-xs bg-white/5 hover:bg-white/10 transition-colors"
                    >
                      + {tag}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Valoración</label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      onClick={() => setFormData({ ...formData, rating: star })}
                      className={cn(
                        "p-2 rounded-lg transition-colors",
                        formData.rating >= star ? "text-yellow-400" : "text-muted-foreground"
                      )}
                    >
                      <Star className={cn(
                        "w-6 h-6",
                        formData.rating >= star && "fill-current"
                      )} />
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button onClick={() => setIsDialogOpen(false)} variant="outline">
                  Cancelar
                </Button>
                <Button 
                  onClick={handleSave} 
                  className="btn-primary"
                  disabled={!formData.playerName || !formData.content}
                >
                  Guardar Nota
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-4 gap-4">
        <div className="glass-card p-4 text-center">
          <p className="text-xs text-muted-foreground mb-1">Total Notas</p>
          <p className="text-2xl font-bold">{scoutingNotes.length}</p>
        </div>
        <div className="glass-card p-4 text-center">
          <p className="text-xs text-muted-foreground mb-1">Mi Equipo</p>
          <p className="text-2xl font-bold text-green-400">{internalCount}</p>
        </div>
        <div className="glass-card p-4 text-center">
          <p className="text-xs text-muted-foreground mb-1">Jugadores Externos</p>
          <p className="text-2xl font-bold text-blue-400">{externalCount}</p>
        </div>
        <div className="glass-card p-4 text-center">
          <p className="text-xs text-muted-foreground mb-1">Valoración Media</p>
          <p className="text-2xl font-bold text-yellow-400">
            {scoutingNotes.length > 0 
              ? (scoutingNotes.reduce((a, b) => a + b.rating, 0) / scoutingNotes.length).toFixed(1)
              : '-'}
          </p>
        </div>
      </div>

      {/* Notes Grid */}
      {filteredNotes.length === 0 ? (
        <div className="glass-card p-12 text-center text-muted-foreground">
          <Trophy className="w-16 h-16 mx-auto mb-4 opacity-50" />
          <p className="text-lg">No hay notas de scouting</p>
          <p className="text-sm mt-1">Crea una nota para tu equipo o de jugadores rivales</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredNotes.map((note) => {
            const isExt = (note as any).isExternal;
            const extStats = (note as any).externalStats;
            const teamName = (note as any).teamName;
            return (
              <div key={note.id} className={cn(
                "glass-card p-5 group transition-colors",
                isExt ? "hover:border-blue-500/30" : "hover:border-red-500/30"
              )}>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    {isExt ? (
                      <ExternalLink className="w-4 h-4 text-blue-400 shrink-0" />
                    ) : (
                      <User className="w-4 h-4 text-muted-foreground shrink-0" />
                    )}
                    <div>
                      <span className="font-medium">{note.playerName}</span>
                      {teamName && (
                        <p className="text-xs text-blue-400">{teamName}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "px-2 py-0.5 rounded-full text-xs font-medium",
                      getRatingBg(note.rating),
                      getRatingColor(note.rating)
                    )}>
                      {note.rating}/5
                    </span>
                    <button
                      onClick={() => deleteScoutingNote(note.id)}
                      className="p-1.5 rounded-lg hover:bg-red-500/20 text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* External stats mini display */}
                {isExt && extStats && Object.values(extStats).some(v => v !== undefined) && (
                  <div className="mb-3 p-2 bg-blue-500/10 rounded-lg">
                    {extStats.agent && <p className="text-xs text-blue-400 text-center mb-1">{extStats.agent}</p>}
                    <div className="grid grid-cols-4 gap-1">
                      {extStats.acs !== undefined && (
                        <div className="text-center"><p className="text-xs text-muted-foreground">ACS</p><p className="text-xs font-bold text-white">{extStats.acs}</p></div>
                      )}
                      {extStats.kd !== undefined && (
                        <div className="text-center"><p className="text-xs text-muted-foreground">K/D</p><p className="text-xs font-bold text-white">{extStats.kd}</p></div>
                      )}
                      {extStats.hs !== undefined && (
                        <div className="text-center"><p className="text-xs text-muted-foreground">HS%</p><p className="text-xs font-bold text-white">{extStats.hs}%</p></div>
                      )}
                      {extStats.adr !== undefined && (
                        <div className="text-center"><p className="text-xs text-muted-foreground">ADR</p><p className="text-xs font-bold text-white">{extStats.adr}</p></div>
                      )}
                    </div>
                  </div>
                )}
                
                <p className={cn(
                  "text-sm text-muted-foreground mb-4",
                  expandedNote === note.id ? "" : "line-clamp-3"
                )}>
                  {note.content}
                </p>
                {note.content.length > 120 && (
                  <button
                    onClick={() => setExpandedNote(expandedNote === note.id ? null : note.id)}
                    className="text-xs text-muted-foreground hover:text-white flex items-center gap-1 mb-3 -mt-2"
                  >
                    <ChevronDown className={cn("w-3 h-3 transition-transform", expandedNote === note.id && "rotate-180")} />
                    {expandedNote === note.id ? 'Ver menos' : 'Ver más'}
                  </button>
                )}
                
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {note.tags.map((tag, i) => (
                    <span 
                      key={i}
                      className={cn(
                        "px-2 py-0.5 rounded-full text-xs",
                        isExt ? "bg-blue-500/10 text-blue-400" : "bg-white/5 text-muted-foreground"
                      )}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
                
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Calendar className="w-3 h-3" />
                  {note.date}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>}
    </div>
  );
}
