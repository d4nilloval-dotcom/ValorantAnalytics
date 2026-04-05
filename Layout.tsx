import { useState } from 'react';
import { 
  LayoutDashboard, 
  Calendar, 
  Users, 
  BarChart3, 
  Map, 
  Target,
  FileText,
  ChevronLeft,
  ChevronRight,
  Trophy,
  CalendarDays,
  Swords,
  Video,
  Eye,
  Bot,
  Shield,
  Flame,
  Brain,
  Zap,
  UserSearch,
  BookOpen,
  Camera,
  Monitor,
  Bell,
  Download,
  GitCompare,
  TrendingUp,
  StickyNote,
  Percent,
  Crosshair,
  MapPin,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/store/appStore';
const NGU_LOGO = "data:image/png;base64,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";


const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'matches', label: 'Partidos', icon: Calendar },
  { id: 'players', label: 'Jugadores', icon: Users },
  { id: 'player-stats', label: 'Estadísticas', icon: BarChart3 },
  { id: 'maps', label: 'Mapas', icon: Map },
  { id: 'draft', label: 'Draft Analyzer', icon: Shield },
  { id: 'calendar', label: 'Calendario', icon: CalendarDays },
  { id: 'advanced', label: 'Advanced Pro', icon: Brain },
  { id: 'inflection', label: 'Inflexión', icon: Zap },
  { id: 'eco-patterns', label: 'Eco Patterns', icon: BarChart3 },
  { id: 'reports',      label: 'Informes',     icon: FileText },
  { id: 'round-stats',          label: 'Análisis Rondas',    icon: Percent },
  { id: 'analytics-dashboard', label: 'Analytics Pro',      icon: TrendingUp },
  { id: 'pistol-tracker',      label: 'Pistol Tracker',     icon: Crosshair },
  { id: 'rival-analysis',      label: 'Análisis Rival',     icon: Swords },
  { id: 'stratbook',           label: 'Stratbook',          icon: BookOpen },
  { id: 'death-tracker',        label: 'Death Tracker',      icon: MapPin },
  { id: 'riot-api',     label: 'Match Viewer', icon: Zap },
  { id: 'player-lookup', label: 'Player Lookup', icon: UserSearch },
  { id: 'map-composition', label: 'Composición', icon: Users },
  { id: 'notifications',   label: 'Notificaciones',    icon: Bell },
  { id: 'export',          label: 'Exportar Datos',    icon: Download },
  { id: 'goals',           label: 'Objetivos',         icon: Target },
  { id: 'team-timeline',   label: 'Timeline Equipo',   icon: TrendingUp },
  { id: 'scrim-notes',     label: 'Scrim Notes',        icon: StickyNote },
  { id: 'match-compare',   label: 'Comparador',         icon: GitCompare },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const { activeTab, setActiveTab } = useAppStore();

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside 
        className={cn(
          "flex flex-col border-r transition-all duration-300",
          collapsed ? 'w-20' : 'w-64'
        )}
        style={{ 
          borderColor: 'hsl(220 15% 15%)',
          background: 'linear-gradient(180deg, hsl(220 22% 8%) 0%, hsl(220 25% 6%) 100%)'
        }}
      >
        {/* Logo */}
        <div className="p-4 border-b" style={{ borderColor: 'hsl(220 15% 15%)' }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden"
              style={{ background: '#0a0b12', padding: '2px' }}
            >
              <img src={NGU_LOGO} alt="NGU eSports" className="w-full h-full object-contain"/>
            </div>
            {!collapsed && (
              <div>
                <h1 className="font-bold text-lg leading-tight">ValoAnalytics</h1>
                <p className="text-xs" style={{ color: 'hsl(215 15% 55%)' }}>Pro Edition</p>
              </div>
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                  activeTab === item.id 
                    ? 'text-white' 
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                )}
                style={activeTab === item.id ? {
                  background: 'hsl(355 85% 58% / 0.1)',
                  border: '1px solid hsl(355 85% 58% / 0.3)'
                } : {}}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </button>
            );
          })}
        </nav>

        {/* Collapse button */}
        <div className="p-3 border-t" style={{ borderColor: 'hsl(220 15% 15%)' }}>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="w-full flex items-center justify-center p-2 rounded-lg hover:bg-secondary transition-colors"
          >
            {collapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-hidden flex flex-col">
        {/* Header */}
        <header 
          className="h-16 border-b flex items-center justify-between px-6"
          style={{ 
            borderColor: 'hsl(220 15% 15%)',
            background: 'linear-gradient(90deg, hsl(220 22% 8%) 0%, hsl(220 25% 6%) 100%)'
          }}
        >
          <div>
            <h2 className="text-xl font-semibold">
              {navItems.find(n => n.id === activeTab)?.label || 'Dashboard'}
            </h2>
            <p className="text-xs text-muted-foreground">
              {activeTab === 'dashboard' && 'Visión general del rendimiento'}
              {activeTab === 'matches' && 'Gestión de partidos y resultados'}
              {activeTab === 'players' && 'Estadísticas por partido'}
              {activeTab === 'player-stats' && 'Análisis global de jugadores'}
              {activeTab === 'maps' && 'Rendimiento por mapa'}
              {activeTab === 'draft' && 'Analizador de pick/ban y composiciones'}
              {activeTab === 'calendar' && 'Calendario de partidos y eventos'}
              {activeTab === 'advanced' && 'Análisis avanzado: Win Probability, Synergies, Momentum'}
              {activeTab === 'reports'     && 'Exportación de informes'}
              {activeTab === 'round-stats'        && 'ATK · DEF · Post-plant · Retake · Plantas recibidas'}
              {activeTab === 'analytics-dashboard' && 'Pistolas · OT · Mapa de calor · Progresión · Alertas'}
              {activeTab === 'pistol-tracker'      && 'Registro y análisis de pistolas por torneo y equipo'}
              {activeTab === 'rival-analysis'      && 'Fichas · Scout jugadores · Estrategias por mapa · Comparativa NGU'}
              {activeTab === 'stratbook'           && 'Teorizar · Crear · Iterar — Framework coachsenny'}
              {activeTab === 'death-tracker'        && 'Heatmap manual de muertes sobre el minimapa'}
              {activeTab === 'riot-api'    && 'Match Viewer vía HenrikDev API'}
              {activeTab === 'player-lookup' && 'Perfil, rango y partidas de cualquier jugador'}
              {activeTab === 'map-composition' && 'Agentes más efectivos por mapa en tu historial'}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs"
              style={{ 
                background: 'hsl(220 15% 15%)',
                border: '1px solid hsl(220 15% 22%)'
              }}
            >
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-muted-foreground">localStorage</span>
            </div>
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {children}
        </div>
      </main>
    </div>
  );
}