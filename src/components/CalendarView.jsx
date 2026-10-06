import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Edit2, Trash2, AlertCircle, BatteryCharging, CalendarDays, Upload, Bell } from 'lucide-react'
import { getColorHex, getCategory, getEnergyLevel, getEnergyRemaining } from '../lib/theme'
import MonthGridView from './MonthGridView'
import YearView from './YearView'
import MonthView from './MonthView'
import TodoView from './TodoView'

const HOURS = Array.from({ length: 24 }, (_, i) => i) // 0:00 -> 23:00
const MOBILE_HOUR_H = 64

// Assegna a ogni evento una colonna e il numero totale di colonne del suo "cluster"
// di sovrapposizioni, così eventi che si accavallano nello stesso orario si dividono
// lo spazio orizzontale invece di sovrapporsi visivamente.
function layoutOverlaps(dayEvents) {
  const sorted = [...dayEvents].sort((a, b) => {
    const diff = new Date(a.start_time) - new Date(b.start_time)
    return diff !== 0 ? diff : new Date(a.end_time) - new Date(b.end_time)
  })

  const positioned = []
  let clusterCols = []
  let clusterMaxEnd = -Infinity

  const finalizeCluster = () => {
    const colCount = clusterCols.length
    clusterCols.forEach((col, colIndex) => {
      col.forEach((ev) => positioned.push({ ...ev, col: colIndex, totalCols: colCount }))
    })
  }

  for (const ev of sorted) {
    const start = new Date(ev.start_time).getTime()
    const end = new Date(ev.end_time).getTime()
    if (start >= clusterMaxEnd) {
      if (clusterCols.length) finalizeCluster()
      clusterCols = []
      clusterMaxEnd = -Infinity
    }
    let placed = false
    for (const col of clusterCols) {
      const last = col[col.length - 1]
      if (new Date(last.end_time).getTime() <= start) {
        col.push(ev)
        placed = true
        break
      }
    }
    if (!placed) clusterCols.push([ev])
    clusterMaxEnd = Math.max(clusterMaxEnd, end)
  }
  if (clusterCols.length) finalizeCluster()

  return positioned
}

// Un evento è "a banner" (mostrato sopra la griglia oraria invece che come blocco
// temporizzato) se dura più giorni, oppure se è un promemoria senza durata.
function isMultiDay(ev) {
  return new Date(ev.start_time).toDateString() !== new Date(ev.end_time).toDateString()
}
function isBannerItem(ev) {
  return ev.is_reminder || isMultiDay(ev)
}

// Converte un offset in pixel (dall'alto della griglia oraria) in un orario "HH:MM",
// arrotondato al quarto d'ora più vicino — usato per la creazione rapida di un evento.
function minutesToTimeStr(totalMinutes) {
  let m = Math.round(Math.max(0, Math.min(23 * 60 + 59, totalMinutes)) / 15) * 15
  let h = Math.floor(m / 60)
  m = m % 60
  if (h > 23) { h = 23; m = 45 }
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function startOfWeekFor(baseDate, weekOffset) {
  const d = new Date(baseDate)
  const currentDay = d.getDay()
  const distanceToMonday = currentDay === 0 ? 6 : currentDay - 1
  d.setDate(d.getDate() - distanceToMonday + weekOffset * 7)
  d.setHours(0, 0, 0, 0)
  return d
}

export default function CalendarView({ events, weekOffset, setWeekOffset, onEdit, onDelete, onImportFile, onCreateAtTime, todos, onTodoQuickAdd, onTodoToggle, onTodoEdit, onTodoOpenForm }) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const startOfWeek = startOfWeekFor(today, weekOffset)
  const weekDays = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date(startOfWeek)
    d.setDate(d.getDate() + i)
    return d
  })

  const [selectedDayIndex, setSelectedDayIndex] = useState(() => {
    const idx = weekDays.findIndex((d) => d.getTime() === today.getTime())
    return idx === -1 ? 0 : idx
  })

  const [viewMode, setViewMode] = useState('week') // 'week' | 'month' | 'year' | 'todo' | 'energy'
  const [monthOffset, setMonthOffset] = useState(0)
  const [yearOffset, setYearOffset] = useState(0)
  const monthCursor = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1)
  const yearCursor = today.getFullYear() + yearOffset

  const handleSelectMonthDay = (day) => {
    const currentDay = today.getDay()
    const thisMonday = new Date(today)
    thisMonday.setDate(thisMonday.getDate() - (currentDay === 0 ? 6 : currentDay - 1))

    const dayOfWeek = day.getDay()
    const targetMonday = new Date(day)
    targetMonday.setDate(targetMonday.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1))

    setWeekOffset(Math.round((targetMonday - thisMonday) / (7 * 24 * 60 * 60 * 1000)))
    setSelectedDayIndex(dayOfWeek === 0 ? 6 : dayOfWeek - 1)
    setViewMode('week')
  }

  const handleSelectYearDay = (day) => {
    const monthDiff = (day.getFullYear() - today.getFullYear()) * 12 + (day.getMonth() - today.getMonth())
    setMonthOffset(monthDiff)
    setViewMode('month')
  }

  const pendingTodoCount = todos.filter((t) => !t.done).length
  const overdueTodoCount = todos.filter((t) => !t.done && t.due_at && new Date(t.due_at) < new Date()).length

  const TabButton = ({ mode, children }) => (
    <button
      onClick={() => setViewMode(mode)}
      className={`relative pb-2 text-sm font-medium transition-colors ${viewMode === mode ? 'text-[var(--k-text)]' : 'text-[var(--k-text-4)] hover:text-[var(--k-text-2)]'}`}
    >
      {children}
      {viewMode === mode && <span className="absolute left-0 right-0 -bottom-px h-[2px] rounded-full bg-indigo-500" />}
    </button>
  )

  const ViewToggle = () => (
    <div className="flex items-center gap-5 border-b border-[var(--k-line)]/60">
      <TabButton mode="week">Settimana</TabButton>
      <TabButton mode="month">Mese</TabButton>
      <TabButton mode="year">Anno</TabButton>
      <TabButton mode="todo">
        To-do
        {pendingTodoCount > 0 && (
          <span className={`ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full tabular-nums ${overdueTodoCount > 0 ? 'bg-rose-500/20 text-rose-400' : 'bg-[var(--k-surface-2)] text-[var(--k-text-3)]'}`}>
            {pendingTodoCount}
          </span>
        )}
      </TabButton>
    </div>
  )

  const mobileScrollRef = useRef(null)
  const desktopScrollRef = useRef(null)
  useEffect(() => {
    const now = new Date()
    const targetHour = Math.max(now.getHours() - 2, 0) // un po' di contesto sopra l'ora attuale
    if (mobileScrollRef.current) mobileScrollRef.current.scrollTop = targetHour * MOBILE_HOUR_H
    if (desktopScrollRef.current) desktopScrollRef.current.scrollTop = targetHour * 60
  }, [])

  // Scroll orizzontale (trackpad/mouse) sulla griglia desktop -> cambia settimana.
  const wheelLockRef = useRef(false)
  const handleDesktopWheel = (e) => {
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY) && Math.abs(e.deltaX) > 20) {
      if (wheelLockRef.current) return
      wheelLockRef.current = true
      setWeekOffset((p) => p + (e.deltaX > 0 ? 1 : -1))
      setTimeout(() => { wheelLockRef.current = false }, 450)
    }
  }

  const pendingDayIndexRef = useRef(null)
  useEffect(() => {
    if (pendingDayIndexRef.current !== null) {
      setSelectedDayIndex(pendingDayIndexRef.current)
      pendingDayIndexRef.current = null
      return
    }
    const idx = weekDays.findIndex((d) => d.getTime() === today.getTime())
    setSelectedDayIndex(idx === -1 ? 0 : idx)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekOffset])

  const goToDay = (delta) => {
    const newIndex = selectedDayIndex + delta
    if (newIndex < 0) {
      pendingDayIndexRef.current = 6
      setWeekOffset((p) => p - 1)
    } else if (newIndex > 6) {
      pendingDayIndexRef.current = 0
      setWeekOffset((p) => p + 1)
    } else {
      setSelectedDayIndex(newIndex)
    }
  }

  // Swipe orizzontale per cambiare giorno + tocco prolungato per creare un evento
  // al punto esatto della timeline (come su Apple Calendario).
  const timelineRef = useRef(null)
  const touchStartRef = useRef(null)
  const longPressTimerRef = useRef(null)
  const longPressFiredRef = useRef(false)

  const handleTouchStart = (e) => {
    const t = e.touches[0]
    touchStartRef.current = { x: t.clientX, y: t.clientY }
    longPressFiredRef.current = false
    if (e.target.closest('[data-event-block]') || !timelineRef.current) return
    const rect = timelineRef.current.getBoundingClientRect()
    const offsetY = t.clientY - rect.top
    if (offsetY < 0 || offsetY > rect.height) return
    longPressTimerRef.current = setTimeout(() => {
      longPressFiredRef.current = true
      onCreateAtTime?.(selectedDay, minutesToTimeStr((offsetY / MOBILE_HOUR_H) * 60))
    }, 500)
  }
  // Annulla il tocco prolungato appena lo scroll nativo parte davvero (evento
  // passivo: a differenza di un listener su touchmove non blocca l'ottimizzazione
  // dello scroll fatta dal browser, quindi il trascinamento resta fluido).
  const handleScroll = () => clearTimeout(longPressTimerRef.current)

  const handleTouchEnd = (e) => {
    clearTimeout(longPressTimerRef.current)
    const start = touchStartRef.current
    touchStartRef.current = null
    if (longPressFiredRef.current) { longPressFiredRef.current = false; return }
    if (!start) return
    const t = e.changedTouches[0]
    const dx = t.clientX - start.x
    const dy = t.clientY - start.y
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      goToDay(dx < 0 ? 1 : -1)
    }
  }

  const endOfWeek = new Date(startOfWeek)
  endOfWeek.setDate(endOfWeek.getDate() + 7)
  // Include anche eventi multi-giorno iniziati prima di questa settimana ma ancora in corso.
  const weeklyEvents = events.filter((ev) => new Date(ev.end_time) >= startOfWeek && new Date(ev.start_time) < endOfWeek)

  const selectedDay = weekDays[selectedDayIndex]
  const selectedDayEnd = new Date(selectedDay)
  selectedDayEnd.setDate(selectedDayEnd.getDate() + 1)

  const dayEventsMobile = weeklyEvents
    .filter((ev) => !isBannerItem(ev) && new Date(ev.start_time).toDateString() === selectedDay.toDateString())
    .sort((a, b) => new Date(a.start_time) - new Date(b.start_time))

  const mobileBannerItems = weeklyEvents.filter((ev) => {
    if (!isBannerItem(ev)) return false
    return new Date(ev.start_time) < selectedDayEnd && new Date(ev.end_time) >= selectedDay
  })

  const weekBannerItems = weeklyEvents.filter(isBannerItem).sort((a, b) => new Date(a.start_time) - new Date(b.start_time))
  const weekLastDay = new Date(startOfWeek)
  weekLastDay.setDate(weekLastDay.getDate() + 6)
  const bannerRange = (ev) => {
    let evStart = new Date(ev.start_time); evStart.setHours(0, 0, 0, 0)
    let evEnd = new Date(ev.end_time); evEnd.setHours(0, 0, 0, 0)
    if (evStart < startOfWeek) evStart = startOfWeek
    if (evEnd > weekLastDay) evEnd = weekLastDay
    const startIdx = Math.round((evStart - startOfWeek) / (24 * 60 * 60 * 1000))
    const endIdx = Math.round((evEnd - startOfWeek) / (24 * 60 * 60 * 1000))
    return { startIdx, endIdx }
  }

  const energyTotalByDay = weekDays.map((day) =>
    weeklyEvents
      .filter((ev) => !ev.is_reminder && new Date(ev.start_time).toDateString() === day.toDateString())
      .reduce((sum, ev) => sum + (ev.energy_cost || 0), 0)
  )
  const energyByDay = energyTotalByDay.map(getEnergyLevel)
  const selectedDayEnergy = getEnergyRemaining(energyTotalByDay[selectedDayIndex] || 0)

  const now = new Date()
  const nowMinutes = now.getHours() * 60 + now.getMinutes()
  const showNowLine = now >= startOfWeek && now < endOfWeek
  const showNowLineMobile = selectedDay.toDateString() === now.toDateString()

  const jumpInputRefMobile = useRef(null)
  const jumpInputRefDesktop = useRef(null)
  const openJumpPicker = (ref) => {
    if (ref.current?.showPicker) ref.current.showPicker()
    else ref.current?.click()
  }
  const handleJumpToDate = (e) => {
    if (!e.target.value) return
    const picked = new Date(`${e.target.value}T00:00:00`)
    const pickedMonday = startOfWeekFor(picked, 0)
    const thisMonday = startOfWeekFor(today, 0)
    const diffWeeks = Math.round((pickedMonday - thisMonday) / (7 * 24 * 60 * 60 * 1000))
    setWeekOffset(diffWeeks)
  }
  const jumpDateValue = `${selectedDay?.getFullYear() ?? today.getFullYear()}-${String((selectedDay ?? today).getMonth() + 1).padStart(2, '0')}-${String((selectedDay ?? today).getDate()).padStart(2, '0')}`

  const importInputRefDesktop = useRef(null)
  const handleImportChange = (e) => {
    const file = e.target.files?.[0]
    if (file) onImportFile(file)
    e.target.value = ''
  }

  if (viewMode === 'todo') {
    return (
      <div className="flex-1 overflow-hidden flex flex-col">
        <div className="px-4 lg:px-6 pt-3 shrink-0">
          <ViewToggle />
        </div>
        <TodoView
          todos={todos}
          onQuickAdd={onTodoQuickAdd}
          onToggle={onTodoToggle}
          onEdit={onTodoEdit}
          onOpenFullForm={onTodoOpenForm}
        />
      </div>
    )
  }

  if (viewMode === 'energy') {
    return (
      <div className="flex-1 overflow-hidden flex flex-col">
        <div className="px-4 lg:px-6 pt-3 shrink-0">
          <ViewToggle />
        </div>
        <MonthView events={events} onSelectDay={handleSelectMonthDay} />
      </div>
    )
  }

  if (viewMode === 'year') {
    return (
      <div className="flex-1 overflow-hidden flex flex-col">
        <div className="flex items-center gap-3 px-4 lg:px-6 pt-3 pb-3 shrink-0">
          <button onClick={() => setYearOffset((p) => p - 1)} className="p-1 text-[var(--k-text-4)] hover:text-[var(--k-text)]"><ChevronLeft className="w-4 h-4" /></button>
          <div className="font-display font-semibold text-lg text-[var(--k-text)] min-w-[52px] text-center">{yearCursor}</div>
          <button onClick={() => setYearOffset((p) => p + 1)} className="p-1 text-[var(--k-text-4)] hover:text-[var(--k-text)]"><ChevronRight className="w-4 h-4" /></button>
          {yearOffset !== 0 && (
            <button onClick={() => setYearOffset(0)} className="text-xs font-medium text-indigo-400 hover:text-indigo-300">Oggi</button>
          )}
        </div>
        <div className="px-4 lg:px-6">
          <ViewToggle />
        </div>
        <YearView events={events} year={yearCursor} onSelectDay={handleSelectYearDay} />
      </div>
    )
  }

  if (viewMode === 'month') {
    return (
      <div className="flex-1 overflow-hidden flex flex-col">
        <div className="flex items-center gap-3 px-4 lg:px-6 pt-3 pb-3 shrink-0">
          <button onClick={() => setMonthOffset((p) => p - 1)} className="p-1 text-[var(--k-text-4)] hover:text-[var(--k-text)]"><ChevronLeft className="w-4 h-4" /></button>
          <div className="font-display font-semibold text-lg text-[var(--k-text)] min-w-[150px] text-center">
            {monthCursor.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' }).replace(/^\w/, (c) => c.toUpperCase())}
          </div>
          <button onClick={() => setMonthOffset((p) => p + 1)} className="p-1 text-[var(--k-text-4)] hover:text-[var(--k-text)]"><ChevronRight className="w-4 h-4" /></button>
          {monthOffset !== 0 && (
            <button onClick={() => setMonthOffset(0)} className="text-xs font-medium text-indigo-400 hover:text-indigo-300">Oggi</button>
          )}
        </div>
        <div className="px-4 lg:px-6">
          <ViewToggle />
        </div>
        <MonthGridView events={events} monthCursor={monthCursor} onSelectDay={handleSelectMonthDay} />
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-hidden flex flex-col">
      {/* --- MOBILE: agenda giornaliera --- */}
      <div className="lg:hidden flex-1 flex flex-col overflow-hidden">
        <div className="flex items-end justify-between px-4 pt-3 pb-3 shrink-0">
          <button onClick={() => openJumpPicker(jumpInputRefMobile)} className="relative text-left">
            <div className="text-[11px] uppercase tracking-wider text-[var(--k-text-4)]">
              {selectedDay.toLocaleDateString('it-IT', { weekday: 'long' })}
            </div>
            <div className="font-display text-5xl font-bold text-[var(--k-text)] leading-none mt-1">{selectedDay.getDate()}</div>
            <input ref={jumpInputRefMobile} type="date" value={jumpDateValue} onChange={handleJumpToDate} className="absolute inset-0 opacity-0 [color-scheme:dark]" tabIndex={-1} />
          </button>
          <button
            onClick={() => setViewMode('energy')}
            className="flex items-center gap-2 bg-[var(--k-surface)] rounded-full pl-1.5 pr-3.5 py-1.5"
            aria-label="Apri energia"
          >
            <svg viewBox="0 0 26 26" className="w-6 h-6 -rotate-90">
              <circle cx="13" cy="13" r="10.5" strokeWidth="3" fill="none" className="stroke-[var(--k-surface-3)]" />
              <circle
                cx="13" cy="13" r="10.5" strokeWidth="3" fill="none" strokeLinecap="round"
                stroke={selectedDayEnergy.color}
                strokeDasharray={2 * Math.PI * 10.5}
                strokeDashoffset={2 * Math.PI * 10.5 * (1 - selectedDayEnergy.pct / 100)}
              />
            </svg>
            <span className="text-sm font-bold text-[var(--k-text-2)] tabular-nums">{selectedDayEnergy.pct}%</span>
          </button>
        </div>

        <div className="px-4">
          <ViewToggle />
        </div>

        <div className="flex items-center gap-1 px-2 py-2.5 shrink-0">
          <button onClick={() => setWeekOffset((p) => p - 1)} className="p-1.5 text-[var(--k-text-5)] active:text-[var(--k-text-2)] shrink-0">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="flex-1 grid grid-cols-7">
            {weekDays.map((date, i) => {
              const isToday = date.getTime() === today.getTime()
              const isSelected = i === selectedDayIndex
              return (
                <button key={i} onClick={() => setSelectedDayIndex(i)} className="flex flex-col items-center gap-1.5 py-1">
                  <span className="text-[10px] uppercase font-medium text-[var(--k-text-5)]">
                    {date.toLocaleDateString('it-IT', { weekday: 'short' }).slice(0, 2)}
                  </span>
                  <span
                    className={`text-sm w-8 h-8 rounded-full flex items-center justify-center font-semibold transition-colors ${
                      isSelected ? 'bg-indigo-600 text-white' : isToday ? 'text-indigo-400' : 'text-[var(--k-text-2)]'
                    }`}
                  >
                    {date.getDate()}
                  </span>
                  <span className={`w-4 h-[3px] rounded-full ${energyByDay[i]?.dot || 'bg-transparent'}`} />
                </button>
              )
            })}
          </div>
          <button onClick={() => setWeekOffset((p) => p + 1)} className="p-1.5 text-[var(--k-text-5)] active:text-[var(--k-text-2)] shrink-0">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {mobileBannerItems.length > 0 && (
          <div className="px-4 py-2 flex flex-col gap-1.5 shrink-0">
            {mobileBannerItems.map((ev) => {
              const hex = getColorHex(ev.color)
              return (
                <div
                  key={ev.id}
                  onClick={() => onEdit(ev)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-[var(--k-surface)] shadow-sm overflow-hidden active:brightness-110"
                  style={{ borderLeft: `3px solid ${hex}`, color: hex }}
                >
                  {ev.is_reminder && <Bell className="w-3.5 h-3.5 shrink-0" />}
                  <span className="truncate">{ev.title}</span>
                </div>
              )
            })}
          </div>
        )}

        <div
          ref={mobileScrollRef}
          className="flex-1 overflow-y-auto overscroll-y-contain"
          style={{ WebkitOverflowScrolling: 'touch' }}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onScroll={handleScroll}
        >
          <div className="flex relative" style={{ height: `${HOURS.length * MOBILE_HOUR_H}px` }}>
            <div className="w-14 shrink-0">
              {HOURS.map((h) => (
                <div key={h} className="relative" style={{ height: `${MOBILE_HOUR_H}px` }}>
                  <span className="absolute -top-2.5 right-3 text-[11px] text-[var(--k-text-5)] tabular-nums">{String(h).padStart(2, '0')}:00</span>
                </div>
              ))}
            </div>
            <div ref={timelineRef} className="flex-1 relative">
              <div className="absolute inset-0 flex flex-col pointer-events-none">
                {HOURS.map((h) => <div key={h} className="border-t border-[var(--k-line)]/25 w-full" style={{ height: `${MOBILE_HOUR_H}px` }} />)}
              </div>
              {showNowLineMobile && (
                <div className="absolute left-0 right-0 z-20 pointer-events-none flex items-center" style={{ top: `${(nowMinutes / 60) * MOBILE_HOUR_H}px` }}>
                  <div className="w-2 h-2 rounded-full bg-rose-500 -ml-1 shadow-[0_0_6px_rgba(255,107,91,0.7)]" />
                  <div className="flex-1 h-px bg-rose-500/70" />
                </div>
              )}
              {layoutOverlaps(dayEventsMobile).map((ev) => {
                const start = new Date(ev.start_time)
                const end = new Date(ev.end_time)
                const startMins = start.getHours() * 60 + start.getMinutes()
                const durMins = (end - start) / (1000 * 60)
                const top = (startMins / 60) * MOBILE_HOUR_H
                const height = Math.max((durMins / 60) * MOBILE_HOUR_H, 40)
                const leftPct = (ev.col / ev.totalCols) * 100
                const widthPct = 100 / ev.totalCols
                const cat = getCategory(ev.category)
                const hex = getColorHex(ev.color)
                return (
                  <div
                    key={ev.id}
                    data-event-block
                    onClick={() => onEdit(ev)}
                    className="absolute p-2.5 rounded-xl bg-[var(--k-surface)] shadow-md shadow-black/10 overflow-hidden active:brightness-110"
                    style={{
                      top: `${top}px`,
                      height: `${height}px`,
                      left: `calc(${leftPct}% + 3px)`,
                      width: `calc(${widthPct}% - 6px)`,
                      borderLeft: `3px solid ${hex}`,
                    }}
                  >
                    <div className="flex items-center gap-1.5">
                      <cat.icon className="w-3 h-3 shrink-0" style={{ color: hex }} />
                      <span className="font-semibold text-xs truncate" style={{ color: hex }}>{ev.title}</span>
                      {ev.importance === 5 && <AlertCircle className="w-3 h-3 text-rose-400 shrink-0" />}
                    </div>
                    {height > 44 && (
                      <div className="text-[10px] text-[var(--k-text-4)] mt-0.5 tabular-nums">
                        {start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} – {end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    )}
                    {height > 68 && ev.description && (
                      <div className="text-[10px] text-[var(--k-text-4)] mt-0.5 line-clamp-2">{ev.description}</div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* --- DESKTOP: griglia settimanale --- */}
      <div className="hidden lg:flex lg:flex-col flex-1 overflow-hidden">
        <div className="flex items-center justify-between px-6 pt-3 pb-2 shrink-0">
          <div className="flex items-baseline gap-3">
            <span className="font-display text-2xl font-bold text-[var(--k-text)]">
              {startOfWeek.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' }).replace(/^\w/, (c) => c.toUpperCase())}
            </span>
            {weekOffset !== 0 && (
              <button onClick={() => setWeekOffset(0)} className="text-xs font-medium text-indigo-400 hover:text-indigo-300">Oggi</button>
            )}
            <button onClick={() => setWeekOffset((p) => p - 1)} className="p-1 text-[var(--k-text-4)] hover:text-[var(--k-text)]"><ChevronLeft className="w-4 h-4" /></button>
            <button onClick={() => setWeekOffset((p) => p + 1)} className="p-1 text-[var(--k-text-4)] hover:text-[var(--k-text)]"><ChevronRight className="w-4 h-4" /></button>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode('energy')}
              className="flex items-center gap-2 bg-[var(--k-surface)] rounded-full pl-1.5 pr-3.5 py-1.5"
              aria-label="Apri energia"
            >
              <svg viewBox="0 0 26 26" className="w-6 h-6 -rotate-90">
                <circle cx="13" cy="13" r="10.5" strokeWidth="3" fill="none" className="stroke-[var(--k-surface-3)]" />
                <circle
                  cx="13" cy="13" r="10.5" strokeWidth="3" fill="none" strokeLinecap="round"
                  stroke={selectedDayEnergy.color}
                  strokeDasharray={2 * Math.PI * 10.5}
                  strokeDashoffset={2 * Math.PI * 10.5 * (1 - selectedDayEnergy.pct / 100)}
                />
              </svg>
              <span className="text-sm font-bold text-[var(--k-text-2)] tabular-nums">{selectedDayEnergy.pct}%</span>
            </button>
            <button onClick={() => openJumpPicker(jumpInputRefDesktop)} className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-[var(--k-text-3)] hover:text-[var(--k-text)] hover:bg-[var(--k-surface)]">
              <CalendarDays className="w-4 h-4" /> Vai a data
              <input ref={jumpInputRefDesktop} type="date" value={jumpDateValue} onChange={handleJumpToDate} className="absolute inset-0 opacity-0 [color-scheme:dark]" tabIndex={-1} />
            </button>
            <button onClick={() => importInputRefDesktop.current?.click()} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-[var(--k-text-3)] hover:text-[var(--k-text)] hover:bg-[var(--k-surface)]">
              <Upload className="w-4 h-4" /> Importa .ics
              <input ref={importInputRefDesktop} type="file" accept=".ics,text/calendar" onChange={handleImportChange} className="hidden" />
            </button>
          </div>
        </div>
        <div className="px-6">
          <ViewToggle />
        </div>

        <div ref={desktopScrollRef} className="flex-1 overflow-y-auto" onWheel={handleDesktopWheel}>
          <div className="border-b border-[var(--k-line)]/50">
            <div className="flex pl-16 border-b border-[var(--k-line)]/40 bg-[var(--k-ink)] sticky top-0 z-10">
              {weekDays.map((date, i) => (
                <div key={i} className="flex-1 text-center py-3">
                  <div className="text-xs font-medium text-[var(--k-text-4)] uppercase">{date.toLocaleDateString('it-IT', { weekday: 'short' })}</div>
                  <div className={`font-display text-lg mt-1 ${date.getTime() === today.getTime() ? 'bg-indigo-600 text-white w-8 h-8 rounded-full flex items-center justify-center mx-auto shadow-md' : 'text-[var(--k-text-2)]'}`}>
                    {date.getDate()}
                  </div>
                  <div className="flex justify-center mt-1.5">
                    <span className={`w-4 h-[3px] rounded-full ${energyByDay[i] ? energyByDay[i].dot : 'bg-transparent'}`} title={energyByDay[i]?.level} />
                  </div>
                </div>
              ))}
            </div>

            {weekBannerItems.length > 0 && (
              <div className="flex pl-16 border-b border-[var(--k-line)]/40 bg-[var(--k-ink)]">
                <div className="flex-1 relative" style={{ height: `${weekBannerItems.length * 28 + 6}px` }}>
                  {weekBannerItems.map((ev, i) => {
                    const { startIdx, endIdx } = bannerRange(ev)
                    const leftPct = (startIdx / 7) * 100
                    const widthPct = ((endIdx - startIdx + 1) / 7) * 100
                    const hex = getColorHex(ev.color)
                    return (
                      <div
                        key={ev.id}
                        onClick={() => onEdit(ev)}
                        className="absolute flex items-center gap-1.5 px-2.5 rounded-lg text-[11px] font-semibold bg-[var(--k-surface)] shadow-sm cursor-pointer hover:brightness-110 overflow-hidden"
                        style={{ left: `calc(${leftPct}% + 2px)`, width: `calc(${widthPct}% - 4px)`, top: `${3 + i * 28}px`, height: '23px', borderLeft: `3px solid ${hex}`, color: hex }}
                      >
                        {ev.is_reminder && <Bell className="w-3 h-3 shrink-0" />}
                        <span className="truncate">{ev.title}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            <div className="flex relative" style={{ height: `${HOURS.length * 60}px` }}>
              <div className="w-16 shrink-0 bg-[var(--k-ink)]">
                {HOURS.map((h) => <div key={h} className="h-[60px] relative"><span className="absolute -top-3 right-3 text-xs text-[var(--k-text-5)] tabular-nums">{String(h).padStart(2, '0')}:00</span></div>)}
              </div>
              <div className="flex-1 flex relative">
                <div className="absolute inset-0 flex flex-col pointer-events-none">{HOURS.map((h) => <div key={h} className="h-[60px] border-t border-[var(--k-line)]/25 w-full" />)}</div>
                {showNowLine && (
                  <div className="absolute left-0 right-0 z-20 pointer-events-none flex items-center" style={{ top: `${nowMinutes}px` }}>
                    <div className="w-2 h-2 rounded-full bg-rose-500 -ml-1 shadow-[0_0_6px_rgba(255,107,91,0.7)]" />
                    <div className="flex-1 h-px bg-rose-500/70" />
                  </div>
                )}
                {weekDays.map((day, dayIndex) => {
                  const dayEvents = weeklyEvents.filter((ev) => !isBannerItem(ev) && new Date(ev.start_time).toDateString() === day.toDateString())
                  return (
                    <div
                      key={dayIndex}
                      className="flex-1 border-l border-[var(--k-line)]/20 relative"
                      onDoubleClick={(e) => {
                        if (e.target.closest('[data-event-block]')) return
                        const rect = e.currentTarget.getBoundingClientRect()
                        onCreateAtTime?.(day, minutesToTimeStr(e.clientY - rect.top))
                      }}
                    >
                      {day.getTime() === today.getTime() && <div className="absolute inset-0 bg-indigo-500/5 pointer-events-none"></div>}
                      {layoutOverlaps(dayEvents).map((ev) => {
                        const start = new Date(ev.start_time)
                        const end = new Date(ev.end_time)
                        const startMins = start.getHours() * 60 + start.getMinutes()
                        const durMins = (end - start) / (1000 * 60)
                        const leftPct = (ev.col / ev.totalCols) * 100
                        const widthPct = 100 / ev.totalCols
                        const hex = getColorHex(ev.color)
                        return (
                          <div
                            key={ev.id}
                            data-event-block
                            onClick={() => onEdit(ev)}
                            className="absolute p-1.5 rounded-lg text-xs overflow-hidden cursor-pointer hover:brightness-110 bg-[var(--k-surface)] shadow-md shadow-black/10"
                            style={{
                              top: `${startMins}px`,
                              height: `${Math.max(durMins, 20)}px`,
                              left: `calc(${leftPct}% + 3px)`,
                              width: `calc(${widthPct}% - 6px)`,
                              borderLeft: `3px solid ${hex}`,
                            }}
                          >
                            <div className="font-bold truncate leading-tight" style={{ color: hex }}>{ev.title}</div>
                            {!ev.is_fixed && <div className="text-[9px] uppercase tracking-widest mt-0.5 text-[var(--k-text-4)]">Elastico</div>}
                            {ev.importance >= 4 && <div className="absolute top-1 right-1 w-1.5 h-1.5 bg-rose-500 rounded-full shadow-[0_0_4px_rgba(255,107,91,0.8)]"></div>}
                          </div>
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          <div className="max-w-4xl mx-auto p-6">
            <h3 className="text-xl font-semibold mb-6 text-[var(--k-text)]">Dettaglio Settimana</h3>
            {weeklyEvents.length === 0 ? (
              <p className="text-[var(--k-text-4)] text-center py-8">Nessun impegno programmato.</p>
            ) : (
              <div className="space-y-3">
                {weeklyEvents
                  .slice()
                  .sort((a, b) => new Date(a.start_time) - new Date(b.start_time))
                  .map((ev) => {
                    const evDate = new Date(ev.start_time)
                    const cat = getCategory(ev.category)
                    return (
                      <div key={ev.id} className="flex flex-col sm:flex-row items-center gap-4 p-4 rounded-2xl bg-[var(--k-surface)]/50 border border-[var(--k-line)]/60 hover:border-[var(--k-surface-3)] transition-colors group">
                        <div className="w-24 shrink-0 text-center sm:text-left">
                          <div className="text-[var(--k-text-2)] font-medium">{evDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                          <div className="text-xs text-[var(--k-text-4)] capitalize">{evDate.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric' })}</div>
                        </div>
                        <div className="flex-1 w-full flex items-center justify-between">
                          <div>
                            <h4 className="font-semibold text-[var(--k-text)] flex items-center gap-2">
                              {ev.is_reminder ? <Bell className="w-3.5 h-3.5 opacity-60" /> : <cat.icon className="w-3.5 h-3.5 opacity-60" />}
                              {ev.title} {ev.importance === 5 && <AlertCircle className="w-3.5 h-3.5 text-red-400" />}
                            </h4>
                            <p className="text-sm text-[var(--k-text-4)]">{ev.description}</p>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="flex gap-2 opacity-60">
                              <span className="flex items-center gap-1 text-[10px] uppercase font-bold bg-[var(--k-surface-2)] px-2 py-1 rounded"><BatteryCharging className="w-3 h-3 text-emerald-400" /> {ev.energy_cost}</span>
                              <span className="flex items-center gap-1 text-[10px] uppercase font-bold bg-[var(--k-surface-2)] px-2 py-1 rounded">IMPT: {ev.importance}</span>
                            </div>
                            <div className="flex items-center gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                              <button onClick={() => onEdit(ev)} className="p-2 text-[var(--k-text-3)] hover:text-indigo-400 bg-[var(--k-surface-2)]/50 rounded-lg"><Edit2 className="w-4 h-4" /></button>
                              <button onClick={() => onDelete(ev.id)} className="p-2 text-[var(--k-text-3)] hover:text-red-400 bg-[var(--k-surface-2)]/50 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
