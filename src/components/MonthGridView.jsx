import { Bell } from 'lucide-react'
import { getColorHex } from '../lib/theme'

const WEEKDAY_LABELS = ['LU', 'MA', 'ME', 'GI', 'VE', 'SA', 'DO']
const MAX_CHIPS = 3

// Genera tutte le celle della griglia mensile (incluse code del mese prima/dopo),
// sempre un numero di righe multiplo di 7 giorni, a partire da lunedì.
function buildMonthGrid(monthCursor) {
  const year = monthCursor.getFullYear()
  const month = monthCursor.getMonth()
  const firstOfMonth = new Date(year, month, 1)
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstWeekday = firstOfMonth.getDay()
  const leadingDays = firstWeekday === 0 ? 6 : firstWeekday - 1
  const totalCells = Math.ceil((leadingDays + daysInMonth) / 7) * 7
  const gridStart = new Date(year, month, 1 - leadingDays)

  return Array.from({ length: totalCells }, (_, i) => {
    const d = new Date(gridStart)
    d.setDate(gridStart.getDate() + i)
    return d
  })
}

export default function MonthGridView({ events, monthCursor, onSelectDay }) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const days = buildMonthGrid(monthCursor)
  const currentMonth = monthCursor.getMonth()

  // Un evento multi-giorno compare in ogni giorno che copre, non solo quello di inizio.
  const eventsByDate = new Map()
  for (const ev of events) {
    const start = new Date(ev.start_time); start.setHours(0, 0, 0, 0)
    const end = new Date(ev.end_time); end.setHours(0, 0, 0, 0)
    for (const d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const key = d.toDateString()
      if (!eventsByDate.has(key)) eventsByDate.set(key, [])
      eventsByDate.get(key).push(ev)
    }
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="grid grid-cols-7 border-b border-[var(--k-line)]/50 sticky top-0 bg-[var(--k-ink)] z-10">
        {WEEKDAY_LABELS.map((l) => (
          <div key={l} className="text-center py-2 text-[10px] lg:text-xs font-medium text-[var(--k-text-4)] uppercase">{l}</div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day, i) => {
          const inMonth = day.getMonth() === currentMonth
          const isToday = day.getTime() === today.getTime()
          const dayEvents = (eventsByDate.get(day.toDateString()) || [])
            .sort((a, b) => new Date(a.start_time) - new Date(b.start_time))
          const visible = dayEvents.slice(0, MAX_CHIPS)
          const extra = dayEvents.length - visible.length

          return (
            <button
              key={i}
              onClick={() => onSelectDay(day)}
              className={`border-b border-r border-[var(--k-line)]/30 p-1.5 lg:p-2 flex flex-col items-stretch text-left min-h-[64px] lg:min-h-[110px] transition-colors hover:bg-[var(--k-surface-2)]/30 ${inMonth ? '' : 'opacity-40'}`}
            >
              <span
                className={`text-xs lg:text-sm font-medium self-start mb-1 w-6 h-6 flex items-center justify-center rounded-full shrink-0 ${
                  isToday ? 'bg-indigo-600 text-white' : 'text-[var(--k-text-2)]'
                }`}
              >
                {day.getDate()}
              </span>

              {/* Mobile: solo puntini colorati (poco spazio per il testo) */}
              <div className="flex lg:hidden flex-wrap gap-0.5 mt-auto">
                {dayEvents.slice(0, 4).map((ev, j) => (
                  <span key={j} className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: getColorHex(ev.color) }} />
                ))}
              </div>

              {/* Desktop: box con titolo, come Apple Calendario */}
              <div className="hidden lg:flex flex-col gap-1 overflow-hidden">
                {visible.map((ev) => (
                  <div
                    key={ev.id}
                    className="flex items-center gap-1.5 text-[11px] px-1.5 py-1 rounded-md truncate"
                    style={{ backgroundColor: `${getColorHex(ev.color)}20` }}
                  >
                    {ev.is_reminder ? (
                      <Bell className="w-2.5 h-2.5 shrink-0" style={{ color: getColorHex(ev.color) }} />
                    ) : (
                      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: getColorHex(ev.color) }} />
                    )}
                    <span className="truncate text-[var(--k-text-2)] font-medium">{ev.title}</span>
                  </div>
                ))}
                {extra > 0 && <div className="text-[10px] text-[var(--k-text-4)] px-1.5">+{extra} altri</div>}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
