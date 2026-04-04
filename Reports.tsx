import { useRef, useState } from 'react';
import { 
  FileText, 
  Download, 
  FileSpreadsheet,
  FileJson,
  TrendingUp,
  Users,
  Map as MapIcon,
  Target
} from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export function Reports() {
  const { 
    matches, 
    players, 
    getFilteredMatches, 
    getPlayerStats, 
    getMapStats,
    filters 
  } = useAppStore();
  
  const [generating, setGenerating] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  const matchList = getFilteredMatches();
  const playerStats = getPlayerStats(filters.matchType);
  const mapStats = getMapStats(filters.matchType);

  const handleExportJSON = () => {
    const data = { matches, players, exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `valoanalytics_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportCSV = () => {
    // Matches CSV
    const matchHeaders = ['match_id', 'map', 'type', 'date', 'score_us', 'score_opp', 'won', 'atk', 'def', 'pistol_atk_win', 'pistol_def_win', 'post_win', 'post_loss', 'retake_win', 'retake_loss'];
    const matchRows = matchList.map(m => [
      m.id, m.map, m.type, m.date, m.scoreUs, m.scoreOpp, m.won ? 1 : 0,
      m.atk, m.def, m.pistolAtkWin ? 1 : 0, m.pistolDefWin ? 1 : 0,
      m.postWin, m.postLoss, m.retakeWin, m.retakeLoss
    ]);
    
    const matchesCSV = [matchHeaders, ...matchRows].map(row => 
      row.map(cell => `"${cell}"`).join(',')
    ).join('\n');

    // Players CSV
    const playerHeaders = ['player', 'matches', 'k', 'd', 'a', 'kd', 'kast_avg', 'acs_avg', 'fk', 'fd', 'plants', 'defuses', 'rating'];
    const playerRows = playerStats.map(p => [
      p.name, p.matches, p.k, p.d, p.a, p.kd.toFixed(2), p.kastAvg.toFixed(0),
      p.acsAvg.toFixed(0), p.fk, p.fd, p.plants, p.defuses, p.rating.toFixed(3)
    ]);
    
    const playersCSV = [playerHeaders, ...playerRows].map(row => 
      row.map(cell => `"${cell}"`).join(',')
    ).join('\n');

    // Download both
    const downloadCSV = (content: string, filename: string) => {
      const blob = new Blob([content], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    };

    downloadCSV(matchesCSV, `valo_matches_${new Date().toISOString().split('T')[0]}.csv`);
    downloadCSV(playersCSV, `valo_players_${new Date().toISOString().split('T')[0]}.csv`);
  };

  const handleExportPDF = async () => {
    if (!reportRef.current) return;
    
    setGenerating(true);
    try {
      const canvas = await html2canvas(reportRef.current, {
        scale: 2,
        backgroundColor: '#0a0e17',
        logging: false
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgWidth = 210;
      const pageHeight = 297;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      pdf.save(`valoanalytics_report_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (error) {
      console.error('Error generating PDF:', error);
    }
    setGenerating(false);
  };

  const totalMatches = matchList.length;
  const wins = matchList.filter(m => m.won).length;
  const winRate = totalMatches > 0 ? ((wins / totalMatches) * 100).toFixed(1) : '0.0';

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Export Actions */}
      <div className="glass-card p-5">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <Download className="w-5 h-5 text-red-400" />
          Exportar Datos
        </h3>
        <div className="flex flex-wrap gap-3">
          <Button onClick={handleExportJSON} variant="outline" className="flex items-center gap-2">
            <FileJson className="w-4 h-4" />
            Exportar JSON (Backup)
          </Button>
          <Button onClick={handleExportCSV} variant="outline" className="flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4" />
            Exportar CSV (Excel)
          </Button>
          <Button 
            onClick={handleExportPDF} 
            className="btn-primary"
            disabled={generating}
          >
            <FileText className="w-4 h-4" />
            {generating ? 'Generando...' : 'Generar Informe PDF'}
          </Button>
        </div>
      </div>

      {/* Report Preview */}
      <div ref={reportRef} className="space-y-6 p-8 rounded-xl" style={{ background: '#0a0e17' }}>
        {/* Header */}
        <div className="text-center border-b pb-6" style={{ borderColor: 'hsl(220 15% 20%)' }}>
          <h1 className="text-3xl font-bold mb-2">ValoAnalytics Pro</h1>
          <p className="text-muted-foreground">Informe de Rendimiento</p>
          <p className="text-sm text-muted-foreground mt-1">
            Generado el {new Date().toLocaleDateString('es-ES', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}
          </p>
        </div>

        {/* Summary */}
        <div>
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-green-400" />
            Resumen General
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-lg border" style={{ borderColor: 'hsl(220 15% 20%)' }}>
              <p className="text-sm text-muted-foreground">Partidos Totales</p>
              <p className="text-2xl font-bold">{totalMatches}</p>
            </div>
            <div className="p-4 rounded-lg border" style={{ borderColor: 'hsl(220 15% 20%)' }}>
              <p className="text-sm text-muted-foreground">Victorias</p>
              <p className="text-2xl font-bold text-green-400">{wins}</p>
            </div>
            <div className="p-4 rounded-lg border" style={{ borderColor: 'hsl(220 15% 20%)' }}>
              <p className="text-sm text-muted-foreground">Win Rate</p>
              <p className="text-2xl font-bold">{winRate}%</p>
            </div>
            <div className="p-4 rounded-lg border" style={{ borderColor: 'hsl(220 15% 20%)' }}>
              <p className="text-sm text-muted-foreground">Jugadores</p>
              <p className="text-2xl font-bold">{playerStats.length}</p>
            </div>
          </div>
        </div>

        {/* Top Performers */}
        <div>
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-400" />
            Mejores Jugadores
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-sm" style={{ borderBottom: '1px solid hsl(220 15% 20%)' }}>
                  <th className="pb-2">#</th>
                  <th className="pb-2">Jugador</th>
                  <th className="pb-2">Partidos</th>
                  <th className="pb-2">ACS</th>
                  <th className="pb-2">K/D</th>
                  <th className="pb-2">KAST</th>
                  <th className="pb-2">Rating</th>
                </tr>
              </thead>
              <tbody>
                {playerStats.slice(0, 5).map((player, i) => (
                  <tr key={player.name} style={{ borderBottom: '1px solid hsl(220 15% 15%)' }}>
                    <td className="py-2">{i + 1}</td>
                    <td className="py-2 font-medium">{player.name}</td>
                    <td className="py-2">{player.matches}</td>
                    <td className="py-2 font-mono">{player.acsAvg.toFixed(0)}</td>
                    <td className={cn(
                      "py-2 font-mono",
                      player.kd >= 1.2 ? "text-green-400" :
                      player.kd >= 1.0 ? "text-yellow-400" :
                      "text-red-400"
                    )}>
                      {player.kd.toFixed(2)}
                    </td>
                    <td className="py-2 font-mono">{player.kastAvg.toFixed(0)}%</td>
                    <td className="py-2 font-mono">{player.rating.toFixed(3)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Map Stats */}
        <div>
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <MapIcon className="w-5 h-5 text-purple-400" />
            Estadísticas por Mapa
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-sm" style={{ borderBottom: '1px solid hsl(220 15% 20%)' }}>
                  <th className="pb-2">Mapa</th>
                  <th className="pb-2">Partidos</th>
                  <th className="pb-2">Win Rate</th>
                  <th className="pb-2">Pist ATK</th>
                  <th className="pb-2">Pist DEF</th>
                  <th className="pb-2">Postplant</th>
                  <th className="pb-2">Retake</th>
                </tr>
              </thead>
              <tbody>
                {mapStats.sort((a, b) => b.matches - a.matches).map((map) => (
                  <tr key={map.map} style={{ borderBottom: '1px solid hsl(220 15% 15%)' }}>
                    <td className="py-2 font-medium">{map.map}</td>
                    <td className="py-2">{map.matches}</td>
                    <td className={cn(
                      "py-2 font-mono",
                      map.winPct >= 60 ? "text-green-400" :
                      map.winPct >= 45 ? "text-yellow-400" :
                      "text-red-400"
                    )}>
                      {map.winPct.toFixed(1)}%
                    </td>
                    <td className="py-2 font-mono">{map.pistAtkPct.toFixed(0)}%</td>
                    <td className="py-2 font-mono">{map.pistDefPct.toFixed(0)}%</td>
                    <td className="py-2 font-mono">{map.postPct.toFixed(0)}%</td>
                    <td className="py-2 font-mono">{map.rtPct.toFixed(0)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Matches */}
        <div>
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Target className="w-5 h-5 text-red-400" />
            Partidos Recientes
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-sm" style={{ borderBottom: '1px solid hsl(220 15% 20%)' }}>
                  <th className="pb-2">Fecha</th>
                  <th className="pb-2">Mapa</th>
                  <th className="pb-2">Tipo</th>
                  <th className="pb-2">Score</th>
                  <th className="pb-2">Resultado</th>
                </tr>
              </thead>
              <tbody>
                {matchList.slice(0, 10).map((match) => (
                  <tr key={match.id} style={{ borderBottom: '1px solid hsl(220 15% 15%)' }}>
                    <td className="py-2 text-sm">{match.date}</td>
                    <td className="py-2">{match.map}</td>
                    <td className="py-2">{match.type}</td>
                    <td className="py-2 font-mono">{match.scoreUs} - {match.scoreOpp}</td>
                    <td className={cn(
                      "py-2 font-medium",
                      match.won ? "text-green-400" : "text-red-400"
                    )}>
                      {match.won ? 'VICTORIA' : 'DERROTA'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-sm text-muted-foreground pt-6 border-t" style={{ borderColor: 'hsl(220 15% 20%)' }}>
          <p>ValoAnalytics Pro - Herramienta de análisis para equipos de Valorant</p>
          <p className="mt-1">Datos almacenados localmente en el navegador</p>
        </div>
      </div>
    </div>
  );
}
