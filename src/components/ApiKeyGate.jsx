import { useState } from 'react'
import { Activity, Eye, EyeOff, ExternalLink, LogOut } from 'lucide-react'

export default function ApiKeyGate({ onSave, onLogout }) {
  const [apiKey, setApiKey] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!apiKey.trim()) return
    setSaving(true)
    await onSave(apiKey.trim())
    setSaving(false)
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[var(--k-ink)] text-[var(--k-text)] px-4">
      <div className="w-full max-w-md p-8 bg-[var(--k-surface)] border border-[var(--k-line)] rounded-3xl shadow-2xl">
        <h1 className="font-display text-2xl font-bold mb-1 text-[var(--k-text)] text-center flex items-center justify-center gap-2">
          <Activity className="w-6 h-6 text-indigo-400" /> Kinetix
        </h1>
        <p className="text-[var(--k-text-4)] text-center mb-6 text-sm">
          Per usare l'assistente ti serve una tua API key Gemini, gratuita e personale.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="relative">
            <input
              type={showKey ? 'text' : 'password'}
              placeholder="AIza..."
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              autoFocus
              className="w-full p-3 pr-11 rounded-xl bg-[var(--k-ink)] text-[var(--k-text)] focus:outline-none focus:ring-2 focus:ring-indigo-500/60"
            />
            <button type="button" onClick={() => setShowKey((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--k-text-4)] hover:text-[var(--k-text-2)]">
              {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          <button
            type="submit"
            disabled={saving || !apiKey.trim()}
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 px-4 rounded-xl transition-colors disabled:opacity-50"
          >
            {saving ? 'Salvataggio...' : 'Continua'}
          </button>
        </form>

        <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-1 text-sm text-indigo-400 hover:text-indigo-300 mt-5">
          Ottieni una chiave gratuita da Google AI Studio <ExternalLink className="w-3.5 h-3.5" />
        </a>

        <button onClick={onLogout} className="w-full flex items-center justify-center gap-1.5 text-center text-xs text-[var(--k-text-5)] hover:text-[var(--k-text-3)] mt-6">
          <LogOut className="w-3.5 h-3.5" /> Esci da questo account
        </button>
      </div>
    </div>
  )
}
