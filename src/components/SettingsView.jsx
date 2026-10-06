import { useRef, useState } from 'react'
import { Bell, BellOff, Sun, Moon, LogOut, Upload, Eye, EyeOff, ExternalLink, Copy, Check, RefreshCw, LayoutGrid, CalendarDays } from 'lucide-react'
import Avatar from './Avatar'

const WIDGET_BASE_URL = 'https://oqbjlzfxonypbmbihvlg.supabase.co/functions/v1/widget-data'

export default function SettingsView({
  session,
  userSettings,
  onSaveApiKey,
  onSaveTheme,
  onUploadAvatar,
  onRegenerateWidgetToken,
  pushSubscribed,
  onEnableNotifications,
  onDisableNotifications,
  onImportFile,
  onLogout,
}) {
  const [apiKeyInput, setApiKeyInput] = useState(userSettings.gemini_api_key || '')
  const [showKey, setShowKey] = useState(false)
  const [savingKey, setSavingKey] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [copied, setCopied] = useState(false)
  const fileInputRef = useRef(null)
  const importInputRef = useRef(null)

  const handleImportChange = (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (file) onImportFile(file)
  }

  const widgetUrl = `${WIDGET_BASE_URL}?token=${userSettings.widget_token}`

  const handleCopyWidgetUrl = async () => {
    await navigator.clipboard.writeText(widgetUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleSaveKey = async () => {
    setSavingKey(true)
    await onSaveApiKey(apiKeyInput.trim())
    setSavingKey(false)
  }

  const handleAvatarPick = () => fileInputRef.current?.click()

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setUploadingAvatar(true)
    await onUploadAvatar(file)
    setUploadingAvatar(false)
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-lg mx-auto p-6 space-y-8">

        {/* --- Profilo --- */}
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--k-text-4)] mb-3">Profilo</h3>
          <div className="flex items-center gap-4">
            <button onClick={handleAvatarPick} className="relative shrink-0 group" aria-label="Cambia foto profilo">
              <Avatar url={userSettings.avatar_url} email={session.user.email} size={64} />
              <div className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                <Upload className="w-5 h-5 text-white" />
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
            </button>
            <div className="min-w-0">
              <div className="text-sm text-[var(--k-text)] truncate">{session.user.email}</div>
              <button onClick={handleAvatarPick} disabled={uploadingAvatar} className="text-xs text-indigo-400 hover:text-indigo-300 mt-1">
                {uploadingAvatar ? 'Caricamento...' : 'Cambia foto'}
              </button>
            </div>
          </div>
        </section>

        {/* --- Assistente IA --- */}
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--k-text-4)] mb-3">Assistente IA</h3>
          <div className="bg-[var(--k-surface)] rounded-2xl p-4 shadow-sm shadow-black/10">
            <label className="block text-sm font-medium text-[var(--k-text-2)] mb-1.5">La tua API key Gemini</label>
            <p className="text-xs text-[var(--k-text-4)] mb-3">
              Obbligatoria: senza una tua chiave personale l'assistente non può rispondere.
            </p>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type={showKey ? 'text' : 'password'}
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  placeholder="AIza..."
                  className="w-full bg-[var(--k-ink)] text-[var(--k-text)] rounded-xl pl-4 pr-10 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/60"
                />
                <button type="button" onClick={() => setShowKey((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--k-text-4)] hover:text-[var(--k-text-2)]">
                  {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <button onClick={handleSaveKey} disabled={savingKey} className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors disabled:opacity-50">
                {savingKey ? 'Salvo...' : 'Salva'}
              </button>
            </div>
            <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 mt-3">
              Ottieni una chiave da Google AI Studio <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </section>

        {/* --- Notifiche --- */}
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--k-text-4)] mb-3">Notifiche</h3>
          <button
            onClick={pushSubscribed ? onDisableNotifications : onEnableNotifications}
            className="w-full flex items-center justify-between bg-[var(--k-surface)] rounded-2xl p-4 shadow-sm shadow-black/10 text-left hover:border-[var(--k-surface-3)] transition-colors"
          >
            <div className="flex items-center gap-3">
              {pushSubscribed ? <Bell className="w-5 h-5 text-indigo-400" /> : <BellOff className="w-5 h-5 text-[var(--k-text-4)]" />}
              <div>
                <div className="text-sm font-medium text-[var(--k-text)]">Promemoria push</div>
                <div className="text-xs text-[var(--k-text-4)]">{pushSubscribed ? 'Attive su questo dispositivo' : 'Disattivate'}</div>
              </div>
            </div>
            <div className={`w-11 h-6 rounded-full transition-colors relative shrink-0 ${pushSubscribed ? 'bg-indigo-600' : 'bg-[var(--k-surface-3)]'}`}>
              <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${pushSubscribed ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </div>
          </button>
        </section>

        {/* --- Widget --- */}
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--k-text-4)] mb-3">Widget</h3>
          <div className="bg-[var(--k-surface)] rounded-2xl p-4 shadow-sm shadow-black/10">
            <div className="flex items-center gap-2 mb-1.5">
              <LayoutGrid className="w-4 h-4 text-[var(--k-text-3)]" />
              <label className="text-sm font-medium text-[var(--k-text-2)]">Link dati per widget (iPhone/Mac)</label>
            </div>
            <p className="text-xs text-[var(--k-text-4)] mb-3">
              Usa questo link personale in Scriptable (iPhone) o Übersicht (Mac) per vedere prossimo evento ed energia di oggi sulla home/desktop.
            </p>
            <div className="flex gap-2">
              <input
                readOnly
                value={widgetUrl}
                onFocus={(e) => e.target.select()}
                className="w-full bg-[var(--k-ink)] text-[var(--k-text-3)] rounded-xl px-4 py-2.5 text-xs truncate focus:outline-none"
              />
              <button onClick={handleCopyWidgetUrl} className="px-3.5 py-2.5 rounded-xl bg-[var(--k-surface-2)] hover:bg-[var(--k-surface-3)] text-[var(--k-text-2)] transition-colors shrink-0">
                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
            <button onClick={onRegenerateWidgetToken} className="inline-flex items-center gap-1.5 text-xs text-[var(--k-text-4)] hover:text-rose-400 mt-3">
              <RefreshCw className="w-3.5 h-3.5" /> Rigenera link (invalida quelli vecchi)
            </button>
          </div>
        </section>

        {/* --- Tema --- */}
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--k-text-4)] mb-3">Aspetto</h3>
          <div className="flex gap-3">
            <button
              onClick={() => onSaveTheme('dark')}
              className={`flex-1 flex flex-col items-center gap-2 py-4 rounded-2xl transition-colors ${userSettings.theme === 'dark' ? 'bg-indigo-500/15 text-indigo-300' : 'bg-[var(--k-surface)] text-[var(--k-text-3)] shadow-sm shadow-black/10'}`}
            >
              <Moon className="w-5 h-5" />
              <span className="text-sm font-medium">Scuro</span>
            </button>
            <button
              onClick={() => onSaveTheme('light')}
              className={`flex-1 flex flex-col items-center gap-2 py-4 rounded-2xl transition-colors ${userSettings.theme === 'light' ? 'bg-indigo-500/15 text-indigo-300' : 'bg-[var(--k-surface)] text-[var(--k-text-3)] shadow-sm shadow-black/10'}`}
            >
              <Sun className="w-5 h-5" />
              <span className="text-sm font-medium">Chiaro</span>
            </button>
          </div>
        </section>

        {/* --- Importa calendario --- */}
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--k-text-4)] mb-3">Calendario</h3>
          <button
            onClick={() => importInputRef.current?.click()}
            className="w-full flex items-center gap-3 bg-[var(--k-surface)] rounded-2xl p-4 shadow-sm shadow-black/10 text-left hover:border-[var(--k-surface-3)] transition-colors"
          >
            <CalendarDays className="w-5 h-5 text-[var(--k-text-3)]" />
            <div>
              <div className="text-sm font-medium text-[var(--k-text)]">Importa calendario (.ics)</div>
              <div className="text-xs text-[var(--k-text-4)]">Es. il calendario delle lezioni dell'università</div>
            </div>
            <input ref={importInputRef} type="file" accept=".ics,text/calendar" onChange={handleImportChange} className="hidden" />
          </button>
        </section>

        {/* --- Esci --- */}
        <section className="pt-2">
          <button
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-rose-400 bg-rose-500/10 hover:bg-rose-500/15 transition-colors font-medium text-sm"
          >
            <LogOut className="w-4 h-4" /> Esci
          </button>
        </section>
      </div>
    </div>
  )
}
