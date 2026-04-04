import { useState } from 'react';
import {
  Bot,
  Copy,
  Check,
  Terminal,
  Settings,
  Webhook,
  RefreshCw,
  Send,
  Users,
  BarChart3,
  Calendar,
  Trophy,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const BOT_COMMANDS = [
  {
    command: '/stats [jugador]',
    description: 'Muestra estadísticas de un jugador',
    example: '/stats Player1',
    icon: BarChart3,
  },
  {
    command: '/match [id]',
    description: 'Muestra detalles de un partido',
    example: '/match abc123',
    icon: Trophy,
  },
  {
    command: '/upcoming',
    description: 'Muestra próximos partidos programados',
    example: '/upcoming',
    icon: Calendar,
  },
  {
    command: '/roster',
    description: 'Muestra el roster actual del equipo',
    example: '/roster',
    icon: Users,
  },
  {
    command: '/compare [jugador1] [jugador2]',
    description: 'Compara estadísticas entre dos jugadores',
    example: '/compare Player1 Player2',
    icon: BarChart3,
  },
  {
    command: '/lastmatch',
    description: 'Muestra el último partido registrado',
    example: '/lastmatch',
    icon: Trophy,
  },
];

const WEBHOOK_EVENTS = [
  { event: 'Nuevo partido registrado', enabled: true },
  { event: 'Partido actualizado', enabled: true },
  { event: 'Nuevo jugador añadido', enabled: false },
  { event: 'Estadísticas semanales', enabled: true },
  { event: 'Alerta de rendimiento', enabled: true },
  { event: 'Próximo partido (24h antes)', enabled: true },
];

export function DiscordBot() {
  const [webhookUrl, setWebhookUrl] = useState('');
  const [botToken, setBotToken] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [copiedCommand, setCopiedCommand] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'commands' | 'config' | 'webhooks'>('commands');

  const handleCopyCommand = (command: string) => {
    navigator.clipboard.writeText(command);
    setCopiedCommand(command);
    setTimeout(() => setCopiedCommand(null), 2000);
  };

  const handleConnect = () => {
    // Simulate connection
    setIsConnected(!isConnected);
  };

  const handleTestWebhook = () => {
    // Simulate webhook test
    alert('Webhook de prueba enviado a Discord');
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Bot className="w-6 h-6 text-[#5865F2]" />
            Discord Bot
          </h2>
          <p className="text-gray-400 text-sm mt-1">
            Integra tu análisis con Discord para consultas rápidas
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div
            className={cn(
              'px-3 py-1.5 rounded-lg text-sm font-medium',
              isConnected
                ? 'bg-green-500/20 text-green-400 border border-green-500/50'
                : 'bg-gray-500/20 text-gray-400 border border-gray-500/50'
            )}
          >
            {isConnected ? '● Conectado' : '○ Desconectado'}
          </div>
        </div>
      </div>

      {/* Status Card */}
      <div className="glass-card rounded-xl p-4">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-[#5865F2]/20 rounded-xl flex items-center justify-center">
            <Bot className="w-8 h-8 text-[#5865F2]" />
          </div>
          <div className="flex-1">
            <h3 className="text-white font-semibold">Valorant Analytics Bot</h3>
            <p className="text-gray-500 text-sm">
              {isConnected
                ? 'El bot está activo y respondiendo en tu servidor de Discord'
                : 'Configura el bot para empezar a usar comandos en Discord'}
            </p>
          </div>
          <Button
            onClick={handleConnect}
            className={cn(
              isConnected
                ? 'bg-red-500 hover:bg-red-600'
                : 'bg-[#5865F2] hover:bg-[#4752C4]'
            )}
          >
            {isConnected ? 'Desconectar' : 'Conectar'}
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {[
          { id: 'commands', label: 'Comandos', icon: Terminal },
          { id: 'config', label: 'Configuración', icon: Settings },
          { id: 'webhooks', label: 'Webhooks', icon: Webhook },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id as typeof activeTab)}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              activeTab === id
                ? 'bg-[#5865F2] text-white'
                : 'bg-[#1a1a2e] text-gray-400 hover:text-white'
            )}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Commands Tab */}
      {activeTab === 'commands' && (
        <div className="space-y-3">
          <p className="text-gray-400 text-sm">
            Usa estos comandos en cualquier canal de tu servidor de Discord:
          </p>
          {BOT_COMMANDS.map(({ command, description, example, icon: Icon }) => (
            <div
              key={command}
              className="glass-card rounded-xl p-4 hover:bg-[#1a1a2e] transition-colors"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-[#5865F2]/20 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Icon className="w-5 h-5 text-[#5865F2]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <code className="px-2 py-1 bg-[#0f0f1e] rounded text-[#5865F2] font-mono text-sm">
                      {command}
                    </code>
                    <button
                      onClick={() => handleCopyCommand(command)}
                      className="p-1 hover:bg-[#1a1a2e] rounded transition-colors"
                    >
                      {copiedCommand === command ? (
                        <Check className="w-4 h-4 text-green-400" />
                      ) : (
                        <Copy className="w-4 h-4 text-gray-500" />
                      )}
                    </button>
                  </div>
                  <p className="text-gray-400 text-sm mt-2">{description}</p>
                  <p className="text-gray-600 text-xs mt-1">
                    Ejemplo: <span className="text-[#5865F2]">{example}</span>
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Config Tab */}
      {activeTab === 'config' && (
        <div className="glass-card rounded-xl p-6 space-y-4">
          <h3 className="text-lg font-semibold text-white">Configuración del Bot</h3>
          
          <div>
            <label className="text-sm text-gray-400 mb-2 block">
              Bot Token <span className="text-red-400">*</span>
            </label>
            <div className="flex gap-2">
              <input
                type="password"
                value={botToken}
                onChange={(e) => setBotToken(e.target.value)}
                placeholder="Introduce tu bot token de Discord"
                className="flex-1 px-3 py-2 bg-[#0f0f1e] border border-[#2a2a3e] rounded-lg text-white focus:border-[#5865F2] focus:outline-none"
              />
              <Button variant="outline" onClick={() => setBotToken('')}>
                Limpiar
              </Button>
            </div>
            <p className="text-gray-600 text-xs mt-1">
              Crea un bot en{' '}
              <a
                href="https://discord.com/developers/applications"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#5865F2] hover:underline"
              >
                Discord Developer Portal
              </a>
            </p>
          </div>

          <div>
            <label className="text-sm text-gray-400 mb-2 block">Prefijo de Comandos</label>
            <input
              type="text"
              defaultValue="/"
              disabled
              className="w-full px-3 py-2 bg-[#0f0f1e] border border-[#2a2a3e] rounded-lg text-white opacity-50"
            />
            <p className="text-gray-600 text-xs mt-1">
              Usamos comandos slash de Discord (no configurable)
            </p>
          </div>

          <div>
            <label className="text-sm text-gray-400 mb-2 block">Canal por Defecto</label>
            <select className="w-full px-3 py-2 bg-[#0f0f1e] border border-[#2a2a3e] rounded-lg text-white focus:border-[#5865F2] focus:outline-none">
              <option value="">Todos los canales</option>
              <option value="stats">#estadísticas</option>
              <option value="matches">#partidos</option>
              <option value="general">#general</option>
            </select>
          </div>

          <div className="pt-4 border-t border-[#1a1a2e]">
            <h4 className="text-white font-medium mb-3">Permisos Requeridos</h4>
            <div className="space-y-2">
              {[
                'Send Messages',
                'Embed Links',
                'Read Message History',
                'Use Slash Commands',
              ].map((perm) => (
                <div key={perm} className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-green-400" />
                  <span className="text-gray-400 text-sm">{perm}</span>
                </div>
              ))}
            </div>
          </div>

          <Button className="w-full bg-[#5865F2] hover:bg-[#4752C4]">
            <RefreshCw className="w-4 h-4 mr-2" />
            Sincronizar Comandos
          </Button>
        </div>
      )}

      {/* Webhooks Tab */}
      {activeTab === 'webhooks' && (
        <div className="space-y-4">
          <div className="glass-card rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Webhook URL</h3>
            <div className="flex gap-2">
              <input
                type="url"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                placeholder="https://discord.com/api/webhooks/..."
                className="flex-1 px-3 py-2 bg-[#0f0f1e] border border-[#2a2a3e] rounded-lg text-white focus:border-[#5865F2] focus:outline-none"
              />
              <Button onClick={handleTestWebhook} variant="outline">
                <Send className="w-4 h-4 mr-1" />
                Probar
              </Button>
            </div>
            <p className="text-gray-600 text-xs mt-2">
              Crea un webhook en tu servidor de Discord: Configuración del Servidor → Integraciones → Webhooks
            </p>
          </div>

          <div className="glass-card rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Eventos Automáticos</h3>
            <p className="text-gray-500 text-sm mb-4">
              Selecciona qué eventos quieres que se envíen automáticamente a Discord:
            </p>
            <div className="space-y-2">
              {WEBHOOK_EVENTS.map(({ event, enabled }) => (
                <label
                  key={event}
                  className="flex items-center justify-between p-3 bg-[#0f0f1e] rounded-lg cursor-pointer hover:bg-[#1a1a2e] transition-colors"
                >
                  <span className="text-gray-300 text-sm">{event}</span>
                  <input
                    type="checkbox"
                    defaultChecked={enabled}
                    className="w-4 h-4 rounded border-gray-600 text-[#5865F2] focus:ring-[#5865F2]"
                  />
                </label>
              ))}
            </div>
          </div>

          <div className="glass-card rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Formato de Mensajes</h3>
            <div className="bg-[#0f0f1e] rounded-lg p-4">
              <p className="text-gray-500 text-xs mb-2">Vista previa:</p>
              <div className="border-l-4 border-[#5865F2] pl-4 py-2">
                <p className="text-white font-semibold">Nuevo Partido Registrado</p>
                <p className="text-gray-400 text-sm mt-1">
                  Ascent (13-11) vs Team Liquid
                </p>
                <p className="text-gray-500 text-xs mt-1">
                  Ver detalles en: https://analytics.example.com/matches/abc123
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Setup Guide */}
      <div className="glass-card rounded-xl p-6">
        <h3 className="text-lg font-semibold text-white mb-4">
          Guía de Configuración Rápida
        </h3>
        <div className="space-y-3">
          {[
            'Ve a Discord Developer Portal y crea una nueva aplicación',
            'En la sección "Bot", haz clic en "Add Bot"',
            'Copia el token y pégalo en la configuración de arriba',
            'Invita el bot a tu servidor con el scope "bot" y "applications.commands"',
            'Vuelve aquí y haz clic en "Conectar"',
            'Usa /stats en Discord para probar',
          ].map((step, idx) => (
            <div key={idx} className="flex items-start gap-3">
              <span className="w-6 h-6 bg-[#5865F2] rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                {idx + 1}
              </span>
              <span className="text-gray-400 text-sm">{step}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
