import { useState } from 'react'
import { Check, Plus, Bell, CalendarClock, ChevronDown, SlidersHorizontal } from 'lucide-react'

// Etichetta compatta per la scadenza: "Oggi 18:00", "Domani 09:00", "lun 12 ott 09:00".
function formatDue(dueAt) {
  const due = new Date(dueAt)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const dueDay = new Date(due)
  dueDay.setHours(0, 0, 0, 0)
  const diffDays = Math.round((dueDay - today) / (24 * 60 * 60 * 1000))
  const time = due.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
  if (diffDays === 0) return `Oggi ${time}`
  if (diffDays === 1) return `Domani ${time}`
  if (diffDays === -1) return `Ieri ${time}`
  const sameYear = due.getFullYear() === today.getFullYear()
  const date = due.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }) })
  return `${date} ${time}`
}

// Prima le cose con scadenza (dalla più vicina), poi quelle senza, dalla più recente.
function sortPending(a, b) {
  if (a.due_at && b.due_at) return new Date(a.due_at) - new Date(b.due_at)
  if (a.due_at) return -1
  if (b.due_at) return 1
  return new Date(b.created_at) - new Date(a.created_at)
}

function TodoRow({ todo, onToggle, onEdit }) {
  const overdue = !todo.done && todo.due_at && new Date(todo.due_at) < new Date()
  return (
    <div className="flex items-start gap-3 px-3 py-3 rounded-2xl bg-[var(--k-surface)] hover:brightness-110 transition">
      <button
        onClick={() => onToggle(todo)}
        className={`mt-0.5 w-6 h-6 shrink-0 rounded-full border-2 flex items-center justify-center transition-colors ${
          todo.done ? 'bg-indigo-600 border-indigo-600' : overdue ? 'border-rose-400 hover:bg-rose-400/15' : 'border-[var(--k-text-5)] hover:border-indigo-400'
        }`}
        aria-label={todo.done ? 'Segna come da fare' : 'Segna come fatto'}
      >
        {todo.done && <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />}
      </button>
      <button onClick={() => onEdit(todo)} className="flex-1 min-w-0 text-left">
        <div className={`text-sm font-medium break-words ${todo.done ? 'line-through text-[var(--k-text-5)]' : 'text-[var(--k-text)]'}`}>{todo.title}</div>
        {todo.notes && !todo.done && <div className="text-xs text-[var(--k-text-4)] mt-0.5 line-clamp-2">{todo.notes}</div>}
        {todo.due_at && (
          <div className={`flex items-center gap-1.5 text-[11px] mt-1 tabular-nums ${todo.done ? 'text-[var(--k-text-5)]' : overdue ? 'text-rose-400 font-semibold' : 'text-[var(--k-text-4)]'}`}>
            <CalendarClock className="w-3 h-3" />
            {formatDue(todo.due_at)}
            {todo.reminder_minutes != null && !todo.done && <Bell className="w-3 h-3 ml-1 text-amber-400" />}
          </div>
        )}
      </button>
    </div>
  )
}

function Section({ label, items, accent, onToggle, onEdit }) {
  if (items.length === 0) return null
  return (
    <div>
      <div className={`text-[11px] uppercase tracking-wider font-semibold mb-2 px-1 ${accent || 'text-[var(--k-text-4)]'}`}>
        {label} <span className="opacity-60">· {items.length}</span>
      </div>
      <div className="space-y-2">
        {items.map((t) => <TodoRow key={t.id} todo={t} onToggle={onToggle} onEdit={onEdit} />)}
      </div>
    </div>
  )
}

export default function TodoView({ todos, onQuickAdd, onToggle, onEdit, onOpenFullForm }) {
  const [title, setTitle] = useState('')
  const [showDone, setShowDone] = useState(false)

  const now = new Date()
  const pending = todos.filter((t) => !t.done).sort(sortPending)
  const overdue = pending.filter((t) => t.due_at && new Date(t.due_at) < now)
  const upcoming = pending.filter((t) => !(t.due_at && new Date(t.due_at) < now))
  const done = todos.filter((t) => t.done).sort((a, b) => new Date(b.done_at || 0) - new Date(a.done_at || 0))

  const handleSubmit = async (e) => {
    e.preventDefault()
    const trimmed = title.trim()
    if (!trimmed) return
    setTitle('')
    await onQuickAdd(trimmed)
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-2xl mx-auto px-4 lg:px-6 py-4 space-y-6 pb-28">
        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Aggiungi una cosa da fare…"
            className="flex-1 bg-[var(--k-surface)] text-[var(--k-text)] text-sm rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/60 placeholder:text-[var(--k-text-5)]"
          />
          <button type="submit" disabled={!title.trim()} className="p-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white transition-colors" aria-label="Aggiungi">
            <Plus className="w-5 h-5" />
          </button>
          <button type="button" onClick={() => onOpenFullForm(title.trim())} className="p-3 rounded-2xl bg-[var(--k-surface)] text-[var(--k-text-3)] hover:text-[var(--k-text)]" aria-label="Aggiungi con scadenza" title="Con scadenza e promemoria">
            <SlidersHorizontal className="w-5 h-5" />
          </button>
        </form>

        {pending.length === 0 && done.length === 0 && (
          <p className="text-center text-sm text-[var(--k-text-4)] py-10">Niente in lista. Aggiungi la prima cosa da fare qui sopra.</p>
        )}
        {pending.length === 0 && done.length > 0 && (
          <p className="text-center text-sm text-[var(--k-text-4)] py-6">Tutto fatto 🎉</p>
        )}

        <Section label="In ritardo" items={overdue} accent="text-rose-400" onToggle={onToggle} onEdit={onEdit} />
        <Section label="Da fare" items={upcoming} onToggle={onToggle} onEdit={onEdit} />

        {done.length > 0 && (
          <div>
            <button onClick={() => setShowDone((s) => !s)} className="flex items-center gap-1 text-[11px] uppercase tracking-wider font-semibold mb-2 px-1 text-[var(--k-text-4)] hover:text-[var(--k-text-2)]">
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showDone ? '' : '-rotate-90'}`} />
              Completate <span className="opacity-60">· {done.length}</span>
            </button>
            {showDone && (
              <div className="space-y-2">
                {done.map((t) => <TodoRow key={t.id} todo={t} onToggle={onToggle} onEdit={onEdit} />)}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
