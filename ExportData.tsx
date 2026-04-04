import { useState } from 'react';
import { Download, FileText, Table, Check } from 'lucide-react';
import { useAppStore } from '@/store/appStore';

function toCSV(headers: string[], rows: (string|number)[][]): string {
  const esc = (v: string|number) => typeof v === 'string' && v.includes(',') ? `"${v}"` : String(v);
  return [headers.join(','), ...rows.map(r => r.map(esc).join(','))].join('\n');
}

function download(content: string, filename: string, mime = 'text/csv;charset=utf-8;') {
  const blob = new Blob(['\uFEFF' + content], { type: mime });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export function ExportData() {
  const { getFilteredMatches, getPlayerStats, getMapStats, getPlayersForMatch } = useAppStore();
  const [done, setDone] = useState<string | null>(null);

  const flash = (key: string) => {
    setDone(key);
    setTimeout(() => setDone(null), 2000);
  };

  const exportMatches = () => {
    const matches = getFilteredMatches();
    const headers = ['Fecha','Mapa','Tipo','Resultado','Score Nosotros','Score Rival','Rondas Totales','Pistola ATK','Pistola DEF'];
    const rows = matches.map(m => [
      m.date, m.map, m.type,
      m.won ? 'Victoria' : 'Derrota',
      m.scoreUs, m.scoreOpp,
      m.scoreUs + m.scoreOpp,
      m.pistolAtkWin ? 'Sí' : 'No',
      m.pistolDefWin ? 'Sí' : 'No',
    ]);
    download(toCSV(headers, rows), `partidos_${new Date().toISOString().split('T')[0]}.csv`);
    flash('matches');
  };

  const exportPlayers = () => {
    const stats = getPlayerStats('ALL');
    const headers = ['Jugador','Partidos','Rondas','K','D','A','K/D','KAST%','ACS','FK','FD','FK Net','Rating','Win Rate%','Agente Principal','Rol'];
    const rows = stats.map(s => [
      s.name, s.matches, s.rounds,
      s.k, s.d, s.a,
      s.kd.toFixed(2),
      s.kastAvg.toFixed(1),
      s.acsAvg.toFixed(0),
      s.fk, s.fd, s.fkNet,
      s.rating.toFixed(2),
      s.winRate.toFixed(1),
      s.dominantAgent,
      s.dominantRole,
    ]);
    download(toCSV(headers, rows), `jugadores_${new Date().toISOString().split('T')[0]}.csv`);
    flash('players');
  };

  const exportMaps = () => {
    const stats = getMapStats('ALL');
    const headers = ['Mapa','Partidos','Victorias','Derrotas','WR%','Rondas ATK promedio','Rondas DEF promedio'];
    const rows = stats.map(s => [
      s.map, s.matches, s.wins, s.losses,
      s.winPct.toFixed(1),
      s.atkAvg?.toFixed(1) ?? '-',
      s.defAvg?.toFixed(1) ?? '-',
    ]);
    download(toCSV(headers, rows), `mapas_${new Date().toISOString().split('T')[0]}.csv`);
    flash('maps');
  };

  const exportFull = () => {
    const matches = getFilteredMatches();
    const headers = ['Fecha','Mapa','Tipo','Resultado','Jugador','K','D','A','ACS','KAST%','FK','FD','Plantas','Defuses','Agente'];
    const rows: (string|number)[][] = [];
    matches.forEach(m => {
      const players = getPlayersForMatch(m.id);
      if (players.length === 0) {
        rows.push([m.date, m.map, m.type, m.won?'Victoria':'Derrota', '-','-','-','-','-','-','-','-','-','-','-']);
      } else {
        players.forEach((p: any) => {
          rows.push([
            m.date, m.map, m.type, m.won?'Victoria':'Derrota',
            p.name, p.k, p.d, p.a,
            p.acs ?? '-', p.kast ?? '-', p.fk ?? '-', p.fd ?? '-',
            p.plants ?? '-', p.defuses ?? '-', p.agent ?? '-',
          ]);
        });
      }
    });
    download(toCSV(headers, rows), `completo_${new Date().toISOString().split('T')[0]}.csv`);
    flash('full');
  };

  const exports = [
    { key: 'matches', icon: Table,    label: 'Exportar Partidos',             desc: 'Todos los partidos con resultado, mapa y tipo',          fn: exportMatches },
    { key: 'players', icon: FileText, label: 'Exportar Estadísticas Jugadores', desc: 'K/D, ACS, KAST, Rating y más por jugador',           fn: exportPlayers },
    { key: 'maps',    icon: Table,    label: 'Exportar Estadísticas Mapas',   desc: 'Win rate, pistola y promedios por mapa',                fn: exportMaps    },
    { key: 'full',    icon: Download, label: 'Exportar Datos Completos',      desc: 'Un CSV con todos los partidos y stats por jugador',     fn: exportFull    },
  ];

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="glass-card p-5">
        <h2 className="font-bold text-lg flex items-center gap-2 mb-1">
          <Download className="w-5 h-5 text-red-400"/> Exportar Datos
        </h2>
        <p className="text-sm text-muted-foreground">Descarga todos tus datos en formato CSV compatible con Excel</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {exports.map(e => {
          const Icon = e.icon;
          const isDone = done === e.key;
          return (
            <button key={e.key} onClick={e.fn}
              className="glass-card p-5 text-left rounded-2xl transition-all hover:border-red-500/30 group flex items-start gap-4"
              style={{ border: '1px solid hsl(220 15% 18%)' }}>
              <div className={cn(
                'w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-all',
                isDone ? 'bg-green-500/20' : 'bg-red-500/15 group-hover:bg-red-500/25'
              )}>
                {isDone
                  ? <Check className="w-6 h-6 text-green-400"/>
                  : <Icon className="w-6 h-6 text-red-400"/>}
              </div>
              <div>
                <p className="font-semibold">{isDone ? '¡Descargado!' : e.label}</p>
                <p className="text-sm text-muted-foreground mt-0.5">{e.desc}</p>
              </div>
            </button>
          );
        })}
      </div>

      <div className="glass-card p-4 rounded-xl text-sm text-muted-foreground">
        <p>💡 Los archivos CSV se abren directamente en Excel o Google Sheets. El encoding es UTF-8 con BOM para compatibilidad con Excel.</p>
      </div>
    </div>
  );
}

function cn(...c: (string|boolean|undefined)[]) { return c.filter(Boolean).join(' '); }
