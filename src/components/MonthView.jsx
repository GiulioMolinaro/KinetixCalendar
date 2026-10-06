import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { getEnergyRemaining } from '../lib/theme'

function getMonthGrid(year, month) {
  const firstOfMonth = new Date(year, month, 1)
  const startDay = firstOfMonth.getDay()
  const distanceToMonday = startDay === 0 ? 6 : startDay - 1
  const gridStart = new Date(year, month, 1 - distanceToMonday)
  return Array.from({ length: 42 }).map((_, i) => {
    const d = new Date(gridStart)
    d.setDate(d.getDate() + i)
    return d
  })
}

function EnergyRing({ pct, color, size, stroke, children }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const offset = c * (1 - pct / 100)
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="currentColor" className="text-[var(--k-surface-2)]" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none"
          strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  )
}

export default function MonthView({ events, onSelectDay }) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const [monthOffset, setMonthOffset] = useState(0)
  const viewDate = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1)
  const days = getMonthGrid(viewDate.getFullYear(), viewDate.getMonth())

  const energyForDay = (day) => {
    const total = events
      .filter((ev) => new Date(ev.start_time).toDateString() === day.toDateString())
      .reduce((sum, ev) => sum + (ev.energy_cost || 0), 0)
    return getEnergyRemaining(total)
  }

  const todayEnergy = energyForDay(today)
  const weekdayLabels = ['LU', 'MA', 'ME', 'GI', 'VE', 'SA', 'DO']

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-lg mx-auto p-6 flex flex-col items-center">
        <EnergyRing pct={todayEnergy.pct} color={todayEnergy.color} size={148} stroke={12}>
          <div className="flex flex-col items-center">
            <span className="font-display text-4xl font-bold text-[var(--k-text)] tabular-nums">{todayEnergy.pct}%</span>
            <span className="text-xs uppercase tracking-wide text-[var(--k-text-4)] mt-1">energia oggi</span>
          </div>
        </EnergyRing>
        <div className="mt-3 text-sm font-medium" style={{ color: todayEnergy.color }}>
          Giornata {todayEnergy.label.toLowerCase()}
        </div>
      </div>

      <div className="max-w-lg mx-auto px-6 pb-10">
        <div className="flex items-center justify-center gap-4 mb-5">
          <button onClick={() => setMonthOffset((o) => o - 1)} className="p-2 text-[var(--k-text-4)] hover:text-[var(--k-text)] active:text-[var(--k-text)]">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="font-mono text-sm text-[var(--k-text-2)] min-w-[140px] text-center">
            {viewDate.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' }).replace(/^\w/, (c) => c.toUpperCase())}
          </span>
          <button onClick={() => setMonthOffset((o) => o + 1)} className="p-2 text-[var(--k-text-4)] hover:text-[var(--k-text)] active:text-[var(--k-text)]">
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1.5 mb-2">
          {weekdayLabels.map((w) => (
            <div key={w} className="text-center text-[10px] font-mono text-[var(--k-text-5)]">{w}</div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1.5">
          {days.map((d, i) => {
            const inMonth = d.getMonth() === viewDate.getMonth()
            const isToday = d.getTime() === today.getTime()
            const e = energyForDay(d)
            return (
              <button
                key={i}
                onClick={() => onSelectDay(d)}
                className={`flex flex-col items-center gap-1 py-1.5 rounded-xl transition-colors ${inMonth ? 'opacity-100' : 'opacity-25'} ${isToday ? 'bg-[var(--k-surface-2)]/60' : 'hover:bg-[var(--k-surface-2)]/30'}`}
              >
                <EnergyRing pct={e.pct} color={e.color} size={30} stroke={3}>
                  <span className={`text-[10px] font-medium ${isToday ? 'text-[var(--k-text)]' : 'text-[var(--k-text-3)]'}`}>{d.getDate()}</span>
                </EnergyRing>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
