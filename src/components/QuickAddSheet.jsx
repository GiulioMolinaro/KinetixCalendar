import { useEffect, useRef, useState } from 'react'
import { Sparkles } from 'lucide-react'

export default function QuickAddSheet({ isOpen, onClose, onSubmit, onOpenFullForm }) {
  const [text, setText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const inputRef = useRef(null)

  useEffect(() => {
    if (isOpen) {
      setText('')
      setSubmitting(false)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [isOpen])

  if (!isOpen) return null

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!text.trim() || submitting) return
    setSubmitting(true)
    const success = await onSubmit(text)
    setSubmitting(false)
    if (success) onClose()
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) handleSubmit(e)
  }

  return (
    <div className="fixed inset-0 z-[95] flex items-end lg:items-center lg:justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-backdrop-in" onClick={onClose} />
      <div
        className="relative w-full lg:max-w-lg bg-[var(--k-surface)] border border-[var(--k-line)] rounded-t-3xl lg:rounded-3xl overflow-hidden shadow-2xl animate-sheet-up lg:animate-modal-in"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex justify-center pt-2.5 pb-1 lg:hidden">
          <div className="w-10 h-1.5 rounded-full bg-[var(--k-surface-3)]" />
        </div>

        <form onSubmit={handleSubmit} className="p-5">
          <h3 className="font-display font-semibold text-lg text-[var(--k-text)] mb-1 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-400" /> Nuovo, al volo
          </h3>
          <p className="text-xs text-[var(--k-text-4)] mb-3">Scrivi come lo diresti a un amico, ci pensa l'assistente.</p>
          <textarea
            ref={inputRef}
            rows={2}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={submitting}
            placeholder="Es. Domani judo alle 19, o esame giovedì alle 9 per due ore"
            className="w-full bg-[var(--k-ink)] border border-[var(--k-line)] text-[var(--k-text)] text-sm rounded-2xl px-4 py-3.5 focus:outline-none focus:border-indigo-500 resize-none placeholder:text-[var(--k-text-5)] disabled:opacity-50 leading-relaxed"
          />
          <div className="flex items-center justify-between mt-4">
            <button type="button" onClick={onOpenFullForm} className="text-sm text-[var(--k-text-4)] hover:text-[var(--k-text-2)] transition-colors">
              Preferisci il modulo completo?
            </button>
            <button
              type="submit"
              disabled={!text.trim() || submitting}
              className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:hover:bg-indigo-600 text-white px-5 py-2.5 rounded-full text-sm font-semibold transition-transform active:scale-95 shrink-0"
            >
              {submitting ? 'Un attimo...' : 'Crea'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
