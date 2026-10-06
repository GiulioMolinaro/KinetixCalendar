import { X, Repeat, Trash2, Bell } from 'lucide-react'
import { palette, categories } from '../lib/theme'

const REMINDER_OPTIONS = [
  { value: '', label: 'Nessuno' },
  { value: '5', label: '5 minuti prima' },
  { value: '15', label: '15 minuti prima' },
  { value: '30', label: '30 minuti prima' },
  { value: '60', label: '1 ora prima' },
  { value: '1440', label: '1 giorno prima' },
]

const fieldClasses = "w-full bg-[var(--k-surface-2)] text-[var(--k-text)] rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/60 [color-scheme:var(--k-scheme)]"

export default function EventSheet({ isOpen, editingId, newEvent, setNewEvent, isSubmitting, onSubmit, onClose, onDelete }) {
  if (!isOpen) return null

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
          <h3 className="font-display text-lg font-semibold text-[var(--k-text)]">{editingId ? 'Modifica blocco' : 'Aggiungi blocco'}</h3>
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
            <label className="block text-sm font-medium text-[var(--k-text-3)] mb-1.5">Titolo</label>
            <input required type="text" value={newEvent.title} onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })} className={fieldClasses} />
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--k-text-3)] mb-2">Categoria</label>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {categories.map((c) => (
                <button
                  key={c.id} type="button" onClick={() => setNewEvent({ ...newEvent, category: c.id })}
                  className={`flex flex-col items-center gap-1.5 py-2.5 rounded-xl transition-colors ${newEvent.category === c.id ? 'bg-indigo-500/15 text-indigo-300' : 'bg-[var(--k-surface-2)]/50 text-[var(--k-text-4)] hover:text-[var(--k-text-2)]'}`}
                >
                  <c.icon className="w-4 h-4" />
                  <span className="text-[10px] font-medium leading-none">{c.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--k-text-3)] mb-1.5">Descrizione</label>
            <textarea value={newEvent.description} onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })} rows={2} className={`${fieldClasses} resize-none`} />
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--k-text-3)] mb-2">Colore Blocco</label>
            <div className="flex gap-3">
              {palette.map((c) => (
                <button key={c.id} type="button" onClick={() => setNewEvent({ ...newEvent, color: c.id })} style={{ backgroundColor: c.hex }} className={`w-7 h-7 rounded-full border-2 transition-transform ${newEvent.color === c.id ? 'border-white scale-110 shadow-lg' : 'border-transparent opacity-60 hover:opacity-100'}`} />
              ))}
            </div>
          </div>

          <div className="pt-2">
            <div className="grid grid-cols-3 gap-2">
              <button type="button" onClick={() => setNewEvent({ ...newEvent, is_fixed: true, is_reminder: false })} className={`py-2 text-sm rounded-lg transition-colors ${newEvent.is_fixed && !newEvent.is_reminder ? 'bg-rose-500/15 text-rose-400' : 'bg-[var(--k-surface-2)]/50 text-[var(--k-text-4)]'}`}>Fisso</button>
              <button type="button" onClick={() => setNewEvent({ ...newEvent, is_fixed: false, is_reminder: false, recurrence: 'none' })} className={`py-2 text-sm rounded-lg transition-colors ${!newEvent.is_fixed && !newEvent.is_reminder ? 'bg-indigo-500/15 text-indigo-400' : 'bg-[var(--k-surface-2)]/50 text-[var(--k-text-4)]'}`}>Elastico</button>
              <button type="button" onClick={() => setNewEvent({ ...newEvent, is_reminder: true, recurrence: 'none' })} className={`py-2 text-sm rounded-lg transition-colors flex items-center justify-center gap-1.5 ${newEvent.is_reminder ? 'bg-amber-500/15 text-amber-400' : 'bg-[var(--k-surface-2)]/50 text-[var(--k-text-4)]'}`}>
                <Bell className="w-3.5 h-3.5" /> Promemoria
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[var(--k-text-3)] mb-1.5">{newEvent.is_reminder ? 'Data' : 'Data inizio'}</label>
              <input
                type="date" required value={newEvent.date}
                onChange={(e) => {
                  const val = e.target.value
                  setNewEvent({ ...newEvent, date: val, endDate: newEvent.endDate < val ? val : newEvent.endDate })
                }}
                className={fieldClasses}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--k-text-3)] mb-1.5">{newEvent.is_reminder ? 'Ora' : 'Ora inizio'}</label>
              <input type="time" required value={newEvent.startTime} onChange={(e) => setNewEvent({ ...newEvent, startTime: e.target.value })} className={fieldClasses} />
            </div>
          </div>

          {!newEvent.is_reminder && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[var(--k-text-3)] mb-1.5">Data fine</label>
                <input type="date" required min={newEvent.date} value={newEvent.endDate} onChange={(e) => setNewEvent({ ...newEvent, endDate: e.target.value })} className={fieldClasses} />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--k-text-3)] mb-1.5">Ora fine</label>
                <input type="time" required value={newEvent.endTime} onChange={(e) => setNewEvent({ ...newEvent, endTime: e.target.value })} className={fieldClasses} />
              </div>
            </div>
          )}

          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-[var(--k-text-3)] mb-1.5"><Bell className="w-4 h-4" /> Promemoria</label>
            <select
              value={newEvent.reminder_minutes ?? ''}
              onChange={(e) => setNewEvent({ ...newEvent, reminder_minutes: e.target.value === '' ? null : parseInt(e.target.value) })}
              className={`${fieldClasses} text-sm`}
            >
              {REMINDER_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          {!newEvent.is_reminder && (
            <div className="grid grid-cols-2 gap-4 bg-[var(--k-surface-2)]/50 rounded-xl p-4 mt-2">
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold tracking-wide text-[var(--k-text-3)] flex justify-between">COSTO ENERGIA <span className="text-emerald-400">{newEvent.energy_cost}</span></label>
                <input type="range" min="1" max="5" value={newEvent.energy_cost} onChange={(e) => setNewEvent({ ...newEvent, energy_cost: parseInt(e.target.value) })} className="w-full accent-emerald-500" />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold tracking-wide text-[var(--k-text-3)] flex justify-between">IMPORTANZA (IA) <span className="text-rose-400">{newEvent.importance}</span></label>
                <input type="range" min="1" max="5" value={newEvent.importance} onChange={(e) => setNewEvent({ ...newEvent, importance: parseInt(e.target.value) })} className="w-full accent-rose-500" />
              </div>
            </div>
          )}

          {!editingId && newEvent.is_fixed && !newEvent.is_reminder && (
            <div className="bg-[var(--k-surface-2)]/50 rounded-xl p-4">
              <label className="flex items-center gap-2 text-sm font-medium text-[var(--k-text-3)] mb-3"><Repeat className="w-4 h-4" /> Ripetizione</label>
              <select value={newEvent.recurrence} onChange={(e) => setNewEvent({ ...newEvent, recurrence: e.target.value })} className="w-full bg-[var(--k-surface)] text-[var(--k-text)] rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/60 [color-scheme:var(--k-scheme)]">
                <option value="none">Evento Singolo</option>
                <option value="weekly">Ripeti ogni settimana</option>
                <option value="daily">Ripeti tutti i giorni</option>
              </select>
              {newEvent.recurrence !== 'none' && (
                <div className="mt-4 pt-4 border-t border-[var(--k-line)]/60">
                  <label className="block text-sm font-medium text-[var(--k-text-3)] mb-1.5">Ripeti fino al (incluso):</label>
                  <input type="date" required value={newEvent.recurrenceEndDate} onChange={(e) => setNewEvent({ ...newEvent, recurrenceEndDate: e.target.value })} className="w-full bg-[var(--k-surface)] text-[var(--k-text)] rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/60 [color-scheme:var(--k-scheme)]" />
                </div>
              )}
            </div>
          )}

          <div className="pt-2 flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 py-3 px-4 rounded-xl font-medium text-[var(--k-text-3)] bg-[var(--k-surface-2)]/50 hover:bg-[var(--k-surface-2)] transition-colors">Annulla</button>
            <button type="submit" disabled={isSubmitting} className="flex-1 py-3 px-4 rounded-xl font-medium text-white bg-indigo-600 hover:bg-indigo-500 transition-all">{isSubmitting ? 'Salvataggio...' : 'Salva'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
