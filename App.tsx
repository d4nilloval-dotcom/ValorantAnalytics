import { Layout } from '@/components/Layout';
import { Dashboard } from '@/components/Dashboard';
import { Matches } from '@/components/Matches';
import { Players } from '@/components/Players';
import { PlayerStats } from '@/components/PlayerStats';
import { MapStats } from '@/components/MapStats';
import { Reports } from '@/components/Reports';
import { StrategyBoard } from '@/components/StrategyBoard';
import { Calendar } from '@/components/Calendar';
import { DraftAnalyzer } from '@/components/DraftAnalyzer';
import { AdvancedAnalytics } from '@/components/AdvancedAnalytics';
import { RiotMatchViewer } from '@/components/RiotMatchViewer';
import { HenrikPlayerLookup } from '@/components/HenrikPlayerLookup';
import { MapComposition } from '@/components/MapComposition';
import { NotificationCenter } from '@/components/NotificationCenter';
import { ExportData } from '@/components/ExportData';
import { GoalTracker } from '@/components/GoalTracker';
import { TeamTimeline } from '@/components/TeamTimeline';
import { ScrimNotes } from '@/components/ScrimNotes';
import { InflectionAnalysis } from '@/components/InflectionAnalysis';
import { EcoPatterns } from '@/components/EcoPatterns';
import { RoundStats } from '@/components/RoundStats';
import { AnalyticsDashboard } from '@/components/AnalyticsDashboard';
import { PistolTracker } from '@/components/PistolTracker';
import { RivalAnalysis } from '@/components/RivalAnalysis';
import { StratbookManager } from '@/components/StratbookManager';
import { DeathTracker } from '@/components/DeathTracker';
import { useAppStore } from '@/store/appStore';

function App() {
  const { activeTab } = useAppStore();

  return (
    <Layout>
      {activeTab === 'dashboard'          && <Dashboard />}
      {activeTab === 'matches'            && <Matches />}
      {activeTab === 'players'            && <Players />}
      {activeTab === 'player-stats'       && <PlayerStats />}
      {activeTab === 'maps'               && <MapStats />}
      {activeTab === 'draft'              && <DraftAnalyzer />}
      {activeTab === 'calendar'           && <Calendar />}
      {activeTab === 'advanced'           && <AdvancedAnalytics />}
      {activeTab === 'inflection'         && <InflectionAnalysis />}
      {activeTab === 'eco-patterns'       && <EcoPatterns />}
      {activeTab === 'reports'            && <Reports />}
      {activeTab === 'round-stats'        && <RoundStats />}
      {activeTab === 'analytics-dashboard'&& <AnalyticsDashboard />}
      {activeTab === 'pistol-tracker'     && <PistolTracker />}
      {activeTab === 'rival-analysis'     && <RivalAnalysis />}
      {activeTab === 'stratbook'          && <StratbookManager />}
      {activeTab === 'death-tracker'      && <DeathTracker />}
      {activeTab === 'riot-api'           && <RiotMatchViewer />}
      {activeTab === 'player-lookup'      && <HenrikPlayerLookup />}
      {activeTab === 'map-composition'    && <MapComposition />}
      {activeTab === 'notifications'      && <NotificationCenter />}
      {activeTab === 'export'             && <ExportData />}
      {activeTab === 'goals'              && <GoalTracker />}
      {activeTab === 'team-timeline'      && <TeamTimeline />}
      {activeTab === 'scrim-notes'        && <ScrimNotes />}
    </Layout>
  );
}

export default App;
