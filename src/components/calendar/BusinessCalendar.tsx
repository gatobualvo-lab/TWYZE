import React, { useMemo, useState } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Trophy, CheckSquare, Package, FileText } from 'lucide-react';
import { getMonthGrid } from '../../utils/dateRange';
import { useCalendarEvents } from '../../services/calendar/useCalendarEvents';
import type { CalendarEvent, CalendarEventType } from '../../services/calendar/calendarEvents';
import { formatDate } from '../../utils/format';
import { PageHeader } from '../ui';

interface BusinessCalendarProps {
  onNavigate: (tab: string) => void;
}

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const TYPE_META: Record<CalendarEventType, { icon: React.ComponentType<{ className?: string }>; dot: string }> = {
  revenue: { icon: TrendingUp, dot: 'bg-green-500' },
  expense: { icon: TrendingDown, dot: 'bg-red-400' },
  'goal-deadline': { icon: Trophy, dot: 'bg-purple-500' },
  task: { icon: CheckSquare, dot: 'bg-blue-500' },
  stockout: { icon: Package, dot: 'bg-amber-500' },
  'document-due': { icon: FileText, dot: 'bg-teal-500' },
};

const SEVERITY_STYLE: Record<CalendarEvent['severity'], string> = {
  info: 'bg-gray-50 border-gray-100',
  warning: 'bg-amber-50 border-amber-100',
  critical: 'bg-red-50 border-red-100',
};

function monthLabel(year: number, month: number): string {
  return new Date(year, month, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

const EventRow: React.FC<{ event: CalendarEvent; onNavigate: (tab: string) => void }> = ({ event, onNavigate }) => {
  const Icon = TYPE_META[event.type].icon;
  return (
    <button
      onClick={() => onNavigate(event.actionTab)}
      className={`w-full flex items-start gap-2.5 px-3 py-2 rounded-lg border text-left transition-all duration-150 hover:shadow-sm active:scale-[0.98] ${SEVERITY_STYLE[event.severity]}`}
    >
      <Icon className="w-4 h-4 mt-0.5 flex-shrink-0 text-gray-500" />
      <span className="min-w-0">
        <span className="block text-sm font-medium text-gray-800 truncate">{event.title}</span>
        {event.subtitle && <span className="block text-xs text-gray-500 truncate">{event.subtitle}</span>}
      </span>
    </button>
  );
};

const BusinessCalendar: React.FC<BusinessCalendarProps> = ({ onNavigate }) => {
  const today = useMemo(() => new Date(), []);
  const [cursor, setCursor] = useState({ year: today.getFullYear(), month: today.getMonth() });
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const { events, loading } = useCalendarEvents(cursor.year, cursor.month);
  const grid = useMemo(() => getMonthGrid(cursor.year, cursor.month), [cursor]);

  const goToMonth = (delta: number) => {
    setSelectedDate(null);
    setCursor(prev => {
      const d = new Date(prev.year, prev.month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  };

  const goToToday = () => {
    setCursor({ year: today.getFullYear(), month: today.getMonth() });
    setSelectedDate(null);
  };

  const selectedEvents = selectedDate ? events.get(selectedDate) ?? [] : [];

  return (
    <div className="space-y-6">
      <PageHeader
        icon={CalendarIcon}
        title="Business Calendar"
        description="Sales, expenses, goal deadlines, tasks, restocks, and payment due dates in one place."
        actions={
          <div className="flex items-center gap-2">
            <button onClick={() => goToMonth(-1)} className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 active:scale-95 transition-all duration-150" aria-label="Previous month">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button onClick={goToToday} className="px-3 py-2 text-sm font-medium rounded-lg border border-gray-200 hover:bg-gray-50 active:scale-95 transition-all duration-150">
              Today
            </button>
            <button onClick={() => goToMonth(1)} className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 active:scale-95 transition-all duration-150" aria-label="Next month">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        }
      >
        <p key={`${cursor.year}-${cursor.month}`} className="mt-3 text-sm font-semibold text-gray-700 animate-slide-up">{monthLabel(cursor.year, cursor.month)}</p>
      </PageHeader>

      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fadeIn">
          <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 p-4">
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: 35 }).map((_, i) => <div key={i} className="aspect-square skeleton-shimmer rounded-lg" />)}
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-5 space-y-2">
            <div className="h-5 w-32 skeleton-shimmer rounded" />
            <div className="h-4 w-full skeleton-shimmer rounded" />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fadeIn">
          <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 p-3 sm:p-4">
            <div className="grid grid-cols-7 gap-1 mb-1">
              {WEEKDAY_LABELS.map(d => (
                <div key={d} className="text-center text-[11px] font-semibold text-gray-400 py-1">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {grid.map(day => {
                const dayEvents = events.get(day.date) ?? [];
                const isSelected = selectedDate === day.date;
                return (
                  <button
                    key={day.date}
                    onClick={() => setSelectedDate(day.date)}
                    className={`aspect-square sm:aspect-auto sm:h-20 p-1 sm:p-1.5 rounded-lg border text-left flex flex-col transition-all duration-150 active:scale-95 ${
                      isSelected ? 'border-blue-500 bg-blue-50 shadow-sm' : day.isToday ? 'border-blue-300 bg-blue-50/40' : 'border-gray-100 hover:bg-gray-50 hover:border-gray-200'
                    } ${day.inMonth ? '' : 'opacity-40'}`}
                  >
                    <span className={`text-xs font-medium ${day.isToday ? 'text-blue-600' : 'text-gray-600'}`}>
                      {Number(day.date.slice(-2))}
                    </span>
                    {dayEvents.length > 0 && (
                      <span className="mt-auto flex flex-wrap gap-0.5">
                        {dayEvents.slice(0, 4).map(e => (
                          <span key={e.id} className={`w-1.5 h-1.5 rounded-full ${TYPE_META[e.type].dot}`} />
                        ))}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div key={selectedDate} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 animate-slide-up">
            <h3 className="font-semibold text-gray-800 mb-1">
              {selectedDate ? formatDate(selectedDate, { weekday: 'long', month: 'long', day: 'numeric' }) : 'Select a day'}
            </h3>
            {!selectedDate ? (
              <p className="text-sm text-gray-400 mt-2">Tap a date to see what's happening that day.</p>
            ) : selectedEvents.length === 0 ? (
              <p className="text-sm text-gray-400 mt-2">Nothing recorded or scheduled for this day.</p>
            ) : (
              <div className="space-y-2 mt-3">
                {selectedEvents.map(event => (
                  <EventRow key={event.id} event={event} onNavigate={onNavigate} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default BusinessCalendar;
