import { X, Trash2, Bell, CalendarClock } from 'lucide-react'

const REMINDER_OPTIONS = [
  { value: '', label: 'Nessuno' },
  { value: '0', label: 'Alla scadenza' },
  { value: '15', label: '15 minuti prima' },
  { value: '30', label: '30 minuti prima' },
  { value: '60', label: '1 ora prima' },
  { value: '180', label: '3 ore prima' },
  { value: '1440', label: '1 giorno prima' },
  { value: '2880', label: '2 giorni prima' },
  { value: '10080', label: '1 settimana prima' },
]

const fieldClasses = "w-full bg-[var(--k-surface-2)] text-[var(--k-text)] rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/60 [color-scheme:var(--k-scheme)]"

export default function TodoSheet({ isOpen, editingId, draft, setDraft, isSubmitting, onSubmit, onClose, onDelete }) {
  if (!isOpen) return null

  const hasDue = !!draft.dueDate

  return (
    <div className="fixed inset-0 z-[100] flex items-end lg:items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-backdrop-in" onClick={onClose}></div>

      <div
        className="relative w-full lg:max-w-lg bg-[var(--k-surface)] lg:rounded-3xl rounded-t-3xl overflow-hidden shadow-2xl animate-sheet-up lg:animate-modal-in max-h-[92vh] flex flex-col"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex justify-center pt-2.5 pb-1 lg:hidden shrink-0">
          <div className="w-10 h-1.5 rounded-full bg-[var(--k-surface-3)]" />
        </div>

        <div className="px-6 py-4 lg:py-6 flex justify-between items-center shrink-0">
          <h3 className="font-display text-lg font-semibold text-[var(--k-text)]">{editingId ? 'Modifica to-do' : 'Nuovo to-do'}</h3>
          <div className="flex items-center gap-1">
            {editingId && (
              <button type="button" onClick={() => onDelete(editingId)} className="p-2 text-[var(--k-text-4)] hover:text-rose-400" aria-label="Elimina">
                <Trash2 className="w-5 h-5" />
              </button>
            )}
            <button onClick={onClose} className="p-2 text-[var(--k-text-4)] hover:text-[var(--k-text-2)]" aria-label="Chiudi"><X className="w-5 h-5" /></button>
          </div>
        </div>

        <form onSubmit={onSubmit} className="p-6 pt-0 space-y-5 overflow-y-auto">
          <div>
            <label className="block text-sm font-medium text-[var(--k-text-3)] mb-1.5">Cosa devi fare</label>
            <input required autoFocus type="text" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} className={fieldClasses} />
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--k-text-3)] mb-1.5">Note</label>
            <textarea value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} rows={2} className={`${fieldClasses} resize-none`} />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="flex items-center gap-2 text-sm font-medium text-[var(--k-text-3)]"><CalendarClock className="w-4 h-4" /> Scadenza</label>
              {hasDue && (
                <button type="button" onClick={() => setDraft({ ...draft, dueDate: '', dueTime: '', reminder_minutes: null })} className="text-xs text-[var(--k-text-4)] hover:text-rose-400">
                  Rimuovi
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <input
                type="date" value={draft.dueDate}
                onChange={(e) => setDraft({ ...draft, dueDate: e.target.value, dueTime: draft.dueTime || '09:00' })}
                className={fieldClasses}
              />
              <input
                type="time" required={hasDue} disabled={!hasDue} value={draft.dueTime}
                onChange={(e) => setDraft({ ...draft, dueTime: e.target.value })}
                className={`${fieldClasses} disabled:opacity-40`}
              />
            </div>
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-[var(--k-text-3)] mb-1.5"><Bell className="w-4 h-4" /> Notifica</label>
            <select
              value={draft.reminder_minutes ?? ''}
              disabled={!hasDue}
              onChange={(e) => setDraft({ ...draft, reminder_minutes: e.target.value === '' ? null : parseInt(e.target.value) })}
              className={`${fieldClasses} text-sm disabled:opacity-40`}
            >
              {REMINDER_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            {!hasDue && <p className="text-xs text-[var(--k-text-5)] mt-1.5">Imposta una scadenza per ricevere una notifica.</p>}
          </div>

          <div className="pt-2 flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 py-3 px-4 rounded-xl font-medium text-[var(--k-text-3)] bg-[var(--k-surface-2)]/50 hover:bg-[var(--k-surface-2)] transition-colors">Annulla</button>
            <button type="submit" disabled={isSubmitting} className="flex-1 py-3 px-4 rounded-xl font-medium text-white bg-indigo-600 hover:bg-indigo-500 transition-all">{isSubmitting ? 'Salvataggio...' : 'Salva'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
