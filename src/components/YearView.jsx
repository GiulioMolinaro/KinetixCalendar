const WEEKDAY_INITIALS = ['L', 'M', 'M', 'G', 'V', 'S', 'D']
const MONTH_NAMES = [
  'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre',
]

function buildMonthGrid(year, month) {
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

export default function YearView({ events, year, onSelectDay }) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Un evento multi-giorno marca ogni giorno che copre, non solo quello di inizio.
  const eventDatesSet = new Set()
  for (const ev of events) {
    const start = new Date(ev.start_time); start.setHours(0, 0, 0, 0)
    const end = new Date(ev.end_time); end.setHours(0, 0, 0, 0)
    for (const d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      eventDatesSet.add(d.toDateString())
    }
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 lg:p-8">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6 lg:gap-8 max-w-5xl mx-auto">
        {MONTH_NAMES.map((name, month) => {
          const days = buildMonthGrid(year, month)
          return (
            <div key={month}>
              <div className="text-sm font-semibold text-[var(--k-text)] mb-2 text-center">{name}</div>
              <div className="grid grid-cols-7 gap-y-1.5 text-center">
                {WEEKDAY_INITIALS.map((w, i) => (
                  <div key={i} className="text-[9px] text-[var(--k-text-5)] font-medium">{w}</div>
                ))}
                {days.map((d, i) => {
                  const inMonth = d.getMonth() === month
                  const isToday = d.getTime() === today.getTime()
                  const hasEvents = inMonth && eventDatesSet.has(d.toDateString())
                  return (
                    <button
                      key={i}
                      onClick={() => onSelectDay(d)}
                      className={`text-[10px] w-5 h-5 mx-auto rounded-full flex items-center justify-center relative transition-colors ${
                        !inMonth
                          ? 'text-[var(--k-text-5)]/40'
                          : isToday
                          ? 'bg-indigo-600 text-white font-semibold'
                          : 'text-[var(--k-text-3)] hover:bg-[var(--k-surface-2)]'
                      }`}
                    >
                      {d.getDate()}
                      {hasEvents && !isToday && <span className="absolute -bottom-0.5 w-1 h-1 rounded-full bg-indigo-400" />}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
