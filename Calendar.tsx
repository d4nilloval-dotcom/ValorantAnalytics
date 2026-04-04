import { useState, useMemo } from 'react';
import {
  Calendar as CalendarIcon,
  Plus,
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  Users,
  Video,
  CheckCircle,
  XCircle,
  AlertCircle,
} from 'lucide-react';
import { useCalendarStore } from '@/store/calendarStore';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { CalendarEvent } from '@/types/calendar';

const DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const EVENT_TYPE_COLORS: Record<CalendarEvent['type'], string> = {
  MATCH: 'bg-red-500',
  SCRIM: 'bg-blue-500',
  TRAINING: 'bg-green-500',
  TOURNAMENT: 'bg-purple-500',
  OTHER: 'bg-gray-500',
};

const EVENT_TYPE_LABELS: Record<CalendarEvent['type'], string> = {
  MATCH: 'Partido',
  SCRIM: 'Scrim',
  TRAINING: 'Entreno',
  TOURNAMENT: 'Torneo',
  OTHER: 'Otro',
};

const STATUS_ICONS = {
  SCHEDULED: Clock,
  COMPLETED: CheckCircle,
  CANCELLED: XCircle,
  POSTPONED: AlertCircle,
};

export function Calendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showEventDialog, setShowEventDialog] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [viewMode, setViewMode] = useState<'month' | 'list'>('month');

  const { events, addEvent, updateEvent, deleteEvent, getUpcomingEvents } = useCalendarStore();

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = new Date(year, month, 1).getDay();

  const monthEvents = useMemo(() => {
    return events.filter((e) => {
      const date = new Date(e.date);
      return date.getFullYear() === year && date.getMonth() === month;
    });
  }, [events, year, month]);

  const upcomingEvents = useMemo(() => getUpcomingEvents(5), [getUpcomingEvents]);

  const getEventsForDay = (day: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return monthEvents.filter((e) => e.date === dateStr);
  };

  const navigateMonth = (direction: number) => {
    setCurrentDate(new Date(year, month + direction, 1));
  };

  const handleAddEvent = (date?: string) => {
    setEditingEvent(null);
    setSelectedDate(date || new Date().toISOString().split('T')[0]);
    setShowEventDialog(true);
  };

  const handleEditEvent = (event: CalendarEvent) => {
    setEditingEvent(event);
    setSelectedDate(event.date);
    setShowEventDialog(true);
  };

  const handleSaveEvent = (formData: FormData) => {
    const eventData = {
      title: formData.get('title') as string,
      date: formData.get('date') as string,
      time: formData.get('time') as string,
      type: formData.get('type') as CalendarEvent['type'],
      status: (formData.get('status') as CalendarEvent['status']) || 'SCHEDULED',
      opponent: formData.get('opponent') as string,
      map: formData.get('map') as string,
      notes: formData.get('notes') as string,
      vodLink: formData.get('vodLink') as string,
    };

    if (editingEvent) {
      updateEvent(editingEvent.id, eventData);
    } else {
      addEvent(eventData);
    }
    setShowEventDialog(false);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <CalendarIcon className="w-6 h-6 text-[#ff4655]" />
            Calendario
          </h2>
          <p className="text-gray-400 text-sm mt-1">
            Gestiona partidos, scrims y entrenamientos
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-[#1a1a2e] rounded-lg p-1">
            <button
              onClick={() => setViewMode('month')}
              className={cn(
                'px-3 py-1.5 text-sm rounded-md transition-colors',
                viewMode === 'month' ? 'bg-[#ff4655] text-white' : 'text-gray-400 hover:text-white'
              )}
            >
              Mes
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={cn(
                'px-3 py-1.5 text-sm rounded-md transition-colors',
                viewMode === 'list' ? 'bg-[#ff4655] text-white' : 'text-gray-400 hover:text-white'
              )}
            >
              Lista
            </button>
          </div>
          <Button
            onClick={() => handleAddEvent()}
            className="bg-[#ff4655] hover:bg-[#ff6b7a] text-white"
          >
            <Plus className="w-4 h-4 mr-1" />
            Nuevo Evento
          </Button>
        </div>
      </div>

      {/* Upcoming Events */}
      <div className="glass-card rounded-xl p-4">
        <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
          <Clock className="w-5 h-5 text-[#ff4655]" />
          Próximos Eventos
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {upcomingEvents.length === 0 ? (
            <p className="text-gray-500 text-sm col-span-full">No hay eventos programados</p>
          ) : (
            upcomingEvents.map((event) => {
              const StatusIcon = STATUS_ICONS[event.status];
              return (
                <div
                  key={event.id}
                  onClick={() => handleEditEvent(event)}
                  className="bg-[#0f0f1e] rounded-lg p-3 cursor-pointer hover:bg-[#1a1a2e] transition-colors"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className={cn('w-2 h-2 rounded-full', EVENT_TYPE_COLORS[event.type])} />
                    <span className="text-xs text-gray-400">{EVENT_TYPE_LABELS[event.type]}</span>
                  </div>
                  <p className="text-white font-medium text-sm truncate">{event.title}</p>
                  <p className="text-gray-500 text-xs mt-1">
                    {new Date(event.date).toLocaleDateString('es-ES', {
                      day: 'numeric',
                      month: 'short',
                    })}
                    {event.time && ` · ${event.time}`}
                  </p>
                  <div className="flex items-center gap-1 mt-2">
                    <StatusIcon className="w-3 h-3 text-gray-500" />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Calendar View */}
      {viewMode === 'month' ? (
        <div className="glass-card rounded-xl p-4">
          {/* Calendar Header */}
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => navigateMonth(-1)}
              className="p-2 hover:bg-[#1a1a2e] rounded-lg transition-colors"
            >
              <ChevronLeft className="w-5 h-5 text-gray-400" />
            </button>
            <h3 className="text-lg font-semibold text-white">
              {MONTHS[month]} {year}
            </h3>
            <button
              onClick={() => navigateMonth(1)}
              className="p-2 hover:bg-[#1a1a2e] rounded-lg transition-colors"
            >
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </button>
          </div>

          {/* Days Header */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {DAYS.map((day) => (
              <div key={day} className="text-center text-xs text-gray-500 font-medium py-2">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: firstDayOfMonth }).map((_, i) => (
              <div key={`empty-${i}`} className="aspect-square" />
            ))}
            {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
              const dayEvents = getEventsForDay(day);
              const isToday =
                new Date().toDateString() === new Date(year, month, day).toDateString();

              return (
                <div
                  key={day}
                  onClick={() => handleAddEvent(`${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`)}
                  className={cn(
                    'aspect-square p-1 rounded-lg cursor-pointer transition-colors hover:bg-[#1a1a2e]',
                    isToday && 'bg-[#ff4655]/20 border border-[#ff4655]/50'
                  )}
                >
                  <span className={cn('text-sm', isToday ? 'text-[#ff4655] font-bold' : 'text-gray-300')}>
                    {day}
                  </span>
                  <div className="flex flex-wrap gap-0.5 mt-1">
                    {dayEvents.slice(0, 3).map((event, idx) => (
                      <div
                        key={idx}
                        className={cn('w-1.5 h-1.5 rounded-full', EVENT_TYPE_COLORS[event.type])}
                      />
                    ))}
                    {dayEvents.length > 3 && (
                      <span className="text-[8px] text-gray-500">+{dayEvents.length - 3}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* List View */
        <div className="glass-card rounded-xl p-4">
          <h3 className="text-lg font-semibold text-white mb-4">Todos los Eventos</h3>
          <div className="space-y-2">
            {events.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No hay eventos registrados</p>
            ) : (
              events
                .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                .map((event) => {
                  const StatusIcon = STATUS_ICONS[event.status];
                  return (
                    <div
                      key={event.id}
                      onClick={() => handleEditEvent(event)}
                      className="flex items-center gap-4 p-3 bg-[#0f0f1e] rounded-lg cursor-pointer hover:bg-[#1a1a2e] transition-colors"
                    >
                      <div className={cn('w-1 h-12 rounded-full', EVENT_TYPE_COLORS[event.type])} />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-white font-medium">{event.title}</span>
                          <StatusIcon className="w-4 h-4 text-gray-500" />
                        </div>
                        <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
                          <span className="flex items-center gap-1">
                            <CalendarIcon className="w-3 h-3" />
                            {new Date(event.date).toLocaleDateString('es-ES')}
                          </span>
                          {event.time && (
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {event.time}
                            </span>
                          )}
                          {event.opponent && (
                            <span className="flex items-center gap-1">
                              <Users className="w-3 h-3" />
                              vs {event.opponent}
                            </span>
                          )}
                          {event.map && (
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {event.map}
                            </span>
                          )}
                          {event.vodLink && (
                            <span className="flex items-center gap-1 text-blue-400">
                              <Video className="w-3 h-3" />
                              VOD
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
            )}
          </div>
        </div>
      )}

      {/* Event Dialog */}
      <Dialog open={showEventDialog} onOpenChange={setShowEventDialog}>
        <DialogContent className="bg-[#0f0f1e] border-[#1a1a2e] text-white max-w-md">
          <DialogHeader>
            <DialogTitle>{editingEvent ? 'Editar Evento' : 'Nuevo Evento'}</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSaveEvent(new FormData(e.currentTarget));
            }}
            className="space-y-4"
          >
            <div>
              <label className="text-sm text-gray-400">Título</label>
              <input
                name="title"
                defaultValue={editingEvent?.title}
                required
                className="w-full mt-1 px-3 py-2 bg-[#1a1a2e] border border-[#2a2a3e] rounded-lg text-white focus:border-[#ff4655] focus:outline-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm text-gray-400">Fecha</label>
                <input
                  name="date"
                  type="date"
                  defaultValue={editingEvent?.date || selectedDate || ''}
                  required
                  className="w-full mt-1 px-3 py-2 bg-[#1a1a2e] border border-[#2a2a3e] rounded-lg text-white focus:border-[#ff4655] focus:outline-none"
                />
              </div>
              <div>
                <label className="text-sm text-gray-400">Hora</label>
                <input
                  name="time"
                  type="time"
                  defaultValue={editingEvent?.time}
                  className="w-full mt-1 px-3 py-2 bg-[#1a1a2e] border border-[#2a2a3e] rounded-lg text-white focus:border-[#ff4655] focus:outline-none"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm text-gray-400">Tipo</label>
                <select
                  name="type"
                  defaultValue={editingEvent?.type || 'SCRIM'}
                  className="w-full mt-1 px-3 py-2 bg-[#1a1a2e] border border-[#2a2a3e] rounded-lg text-white focus:border-[#ff4655] focus:outline-none"
                >
                  <option value="MATCH">Partido</option>
                  <option value="SCRIM">Scrim</option>
                  <option value="TRAINING">Entreno</option>
                  <option value="TOURNAMENT">Torneo</option>
                  <option value="OTHER">Otro</option>
                </select>
              </div>
              <div>
                <label className="text-sm text-gray-400">Estado</label>
                <select
                  name="status"
                  defaultValue={editingEvent?.status || 'SCHEDULED'}
                  className="w-full mt-1 px-3 py-2 bg-[#1a1a2e] border border-[#2a2a3e] rounded-lg text-white focus:border-[#ff4655] focus:outline-none"
                >
                  <option value="SCHEDULED">Programado</option>
                  <option value="COMPLETED">Completado</option>
                  <option value="CANCELLED">Cancelado</option>
                  <option value="POSTPONED">Aplazado</option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-sm text-gray-400">Oponente</label>
              <input
                name="opponent"
                defaultValue={editingEvent?.opponent}
                placeholder="Nombre del equipo rival"
                className="w-full mt-1 px-3 py-2 bg-[#1a1a2e] border border-[#2a2a3e] rounded-lg text-white focus:border-[#ff4655] focus:outline-none"
              />
            </div>
            <div>
              <label className="text-sm text-gray-400">Mapa</label>
              <input
                name="map"
                defaultValue={editingEvent?.map}
                placeholder="Ej: Ascent, Bind..."
                className="w-full mt-1 px-3 py-2 bg-[#1a1a2e] border border-[#2a2a3e] rounded-lg text-white focus:border-[#ff4655] focus:outline-none"
              />
            </div>
            <div>
              <label className="text-sm text-gray-400">Link VOD</label>
              <input
                name="vodLink"
                type="url"
                defaultValue={editingEvent?.vodLink}
                placeholder="https://..."
                className="w-full mt-1 px-3 py-2 bg-[#1a1a2e] border border-[#2a2a3e] rounded-lg text-white focus:border-[#ff4655] focus:outline-none"
              />
            </div>
            <div>
              <label className="text-sm text-gray-400">Notas</label>
              <textarea
                name="notes"
                defaultValue={editingEvent?.notes}
                rows={2}
                className="w-full mt-1 px-3 py-2 bg-[#1a1a2e] border border-[#2a2a3e] rounded-lg text-white focus:border-[#ff4655] focus:outline-none resize-none"
              />
            </div>
            <div className="flex gap-2">
              {editingEvent && (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => {
                    deleteEvent(editingEvent.id);
                    setShowEventDialog(false);
                  }}
                  className="flex-1"
                >
                  Eliminar
                </Button>
              )}
              <Button type="submit" className="flex-1 bg-[#ff4655] hover:bg-[#ff6b7a]">
                {editingEvent ? 'Guardar' : 'Crear'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
