import { lazy, Suspense } from 'react';
import { ErrorBoundary, SkeletonCard, ThemeProvider } from '@/components/ErrorBoundary';
import { Layout } from '@/components/Layout';
import { useAppStore } from '@/store/appStore';

// ── Lazy-loaded components (solo carga el componente activo) ─────────────────
const Dashboard          = lazy(() => import('@/components/Dashboard').then(m => ({ default: m.Dashboard })));
const Matches            = lazy(() => import('@/components/Matches').then(m => ({ default: m.Matches })));
const Players            = lazy(() => import('@/components/Players').then(m => ({ default: m.Players })));
const PlayerStats        = lazy(() => import('@/components/PlayerStats').then(m => ({ default: m.PlayerStats })));
const MapStats           = lazy(() => import('@/components/MapStats').then(m => ({ default: m.MapStats })));
const Reports            = lazy(() => import('@/components/Reports').then(m => ({ default: m.Reports })));
const StrategyBoard      = lazy(() => import('@/components/StrategyBoard').then(m => ({ default: m.StrategyBoard })));
const Calendar           = lazy(() => import('@/components/Calendar').then(m => ({ default: m.Calendar })));
const DraftAnalyzer      = lazy(() => import('@/components/DraftAnalyzer').then(m => ({ default: m.DraftAnalyzer })));
const AdvancedAnalytics  = lazy(() => import('@/components/AdvancedAnalytics').then(m => ({ default: m.AdvancedAnalytics })));
const RiotMatchViewer    = lazy(() => import('@/components/RiotMatchViewer').then(m => ({ default: m.RiotMatchViewer })));
const HenrikPlayerLookup = lazy(() => import('@/components/HenrikPlayerLookup').then(m => ({ default: m.HenrikPlayerLookup })));
const MapComposition     = lazy(() => import('@/components/MapComposition').then(m => ({ default: m.MapComposition })));
const NotificationCenter = lazy(() => import('@/components/NotificationCenter').then(m => ({ default: m.NotificationCenter })));
const ExportData         = lazy(() => import('@/components/ExportData').then(m => ({ default: m.ExportData })));
const GoalTracker        = lazy(() => import('@/components/GoalTracker').then(m => ({ default: m.GoalTracker })));
const TeamTimeline       = lazy(() => import('@/components/TeamTimeline').then(m => ({ default: m.TeamTimeline })));
const ScrimNotes         = lazy(() => import('@/components/ScrimNotes').then(m => ({ default: m.ScrimNotes })));
const InflectionAnalysis = lazy(() => import('@/components/InflectionAnalysis').then(m => ({ default: m.InflectionAnalysis })));
const EcoPatterns        = lazy(() => import('@/components/EcoPatterns').then(m => ({ default: m.EcoPatterns })));
const RoundStats         = lazy(() => import('@/components/RoundStats').then(m => ({ default: m.RoundStats })));
const AnalyticsDashboard = lazy(() => import('@/components/AnalyticsDashboard').then(m => ({ default: m.AnalyticsDashboard })));
const PistolTracker      = lazy(() => import('@/components/PistolTracker').then(m => ({ default: m.PistolTracker })));
const RivalAnalysis      = lazy(() => import('@/components/RivalAnalysis').then(m => ({ default: m.RivalAnalysis })));
const StratbookManager   = lazy(() => import('@/components/StratbookManager').then(m => ({ default: m.StratbookManager })));
const DeathTracker       = lazy(() => import('@/components/DeathTracker').then(m => ({ default: m.DeathTracker })));
const MatchCompare       = lazy(() => import('@/components/MatchCompare').then(m => ({ default: m.MatchCompare })));

// ── Mapa tab → componente ────────────────────────────────────────────────────
const TAB_MAP: Record<string, React.LazyExoticComponent<any>> = {
  'dashboard':           Dashboard,
  'matches':             Matches,
  'players':             Players,
  'player-stats':        PlayerStats,
  'maps':                MapStats,
  'draft':               DraftAnalyzer,
  'calendar':            Calendar,
  'advanced':            AdvancedAnalytics,
  'inflection':          InflectionAnalysis,
  'eco-patterns':        EcoPatterns,
  'reports':             Reports,
  'round-stats':         RoundStats,
  'analytics-dashboard': AnalyticsDashboard,
  'pistol-tracker':      PistolTracker,
  'rival-analysis':      RivalAnalysis,
  'stratbook':           StratbookManager,
  'death-tracker':       DeathTracker,
  'riot-api':            RiotMatchViewer,
  'player-lookup':       HenrikPlayerLookup,
  'map-composition':     MapComposition,
  'notifications':       NotificationCenter,
  'export':              ExportData,
  'goals':               GoalTracker,
  'team-timeline':       TeamTimeline,
  'scrim-notes':         ScrimNotes,
  'match-compare':       MatchCompare,
  'strategy':            StrategyBoard,
};

function LoadingFallback() {
  return (
    <div className="p-6 space-y-4 animate-in fade-in duration-300">
      <SkeletonCard />
      <SkeletonCard />
    </div>
  );
}

function App() {
  const { activeTab } = useAppStore();
  const ActiveComponent = TAB_MAP[activeTab] || Dashboard;

  return (
    <ThemeProvider>
      <Layout>
        <ErrorBoundary fallbackLabel={activeTab}>
          <Suspense fallback={<LoadingFallback />}>
            <ActiveComponent />
          </Suspense>
        </ErrorBoundary>
      </Layout>
    </ThemeProvider>
  );
}

export default App;
