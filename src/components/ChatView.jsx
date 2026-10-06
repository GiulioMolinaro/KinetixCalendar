import { useEffect, useRef, useState } from 'react'
import { Activity, User, Send, Mic, Square } from 'lucide-react'

const MAX_TEXTAREA_HEIGHT = 160

// Formatta il testo dell'IA: interpreta **grassetto** e va a capo prima di ogni
// punto numerato, così un elenco scritto tutto su una riga resta comunque leggibile.
function renderInline(line, keyPrefix) {
  const parts = line.split(/(\*\*[^*]+\*\*)/g)
  return parts.map((part, i) =>
    part.startsWith('**') && part.endsWith('**')
      ? <strong key={`${keyPrefix}-${i}`} className="font-semibold text-[var(--k-text)]">{part.slice(2, -2)}</strong>
      : <span key={`${keyPrefix}-${i}`}>{part}</span>
  )
}

function FormattedMessage({ text }) {
  const withBreaks = text.replace(/([^\n])\s+(\d+\.\s)/g, '$1\n$2')
  const lines = withBreaks.split('\n').map((l) => l.trim()).filter(Boolean)
  return (
    <div className="space-y-1.5">
      {lines.map((line, i) => <p key={i}>{renderInline(line, i)}</p>)}
    </div>
  )
}

export default function ChatView({ messages, isThinking, input, setInput, onSend }) {
  const chatEndRef = useRef(null)
  const textareaRef = useRef(null)
  const recognitionRef = useRef(null)
  const [isListening, setIsListening] = useState(false)
  const [voiceSupported, setVoiceSupported] = useState(false)

  useEffect(() => {
    if (chatEndRef.current) chatEndRef.current.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isThinking])

  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, MAX_TEXTAREA_HEIGHT)}px`
  }, [input])

  // Dettatura vocale: l'API nativa del browser (Chrome/Android/desktop). Su
  // Safari/iOS non è supportata, ma lì la dettatura esiste già a livello di
  // sistema tramite il microfono sulla tastiera — non serve un bottone extra.
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) return
    const recognition = new SpeechRecognition()
    recognition.lang = 'it-IT'
    recognition.continuous = true
    recognition.interimResults = true
    recognition.onresult = (e) => {
      let transcript = ''
      for (let i = 0; i < e.results.length; i++) transcript += e.results[i][0].transcript
      setInput(transcript)
    }
    recognition.onend = () => setIsListening(false)
    recognition.onerror = () => setIsListening(false)
    recognitionRef.current = recognition
    setVoiceSupported(true)
    return () => recognition.stop()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const toggleListening = () => {
    const recognition = recognitionRef.current
    if (!recognition) return
    if (isListening) {
      recognition.stop()
      setIsListening(false)
    } else {
      setInput('')
      recognition.start()
      setIsListening(true)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (input.trim() && !isThinking) onSend(e)
    }
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[var(--k-ink)]">
      <div className="w-full h-full flex flex-col flex-1 overflow-hidden">
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 sm:space-y-6">
          {messages.map((msg, i) => (
            <div key={i} className={`flex gap-3 sm:gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-1 ${msg.role === 'user' ? 'bg-[var(--k-surface-2)] border border-[var(--k-surface-3)]' : 'bg-indigo-500/20 border border-indigo-500/30'}`}>
                {msg.role === 'user' ? <User className="w-4 h-4 text-[var(--k-text-3)]" /> : <Activity className="w-4 h-4 text-indigo-400" />}
              </div>
              <div className={`px-4 sm:px-5 py-3 sm:py-4 text-sm leading-relaxed shadow-sm max-w-[85%] border ${msg.role === 'user' ? 'bg-[var(--k-surface-2)] border-[var(--k-surface-3)] rounded-2xl rounded-tr-none text-[var(--k-text)]' : 'bg-[var(--k-surface)] border-[var(--k-line)]/60 rounded-2xl rounded-tl-none text-[var(--k-text-2)]'}`}>
                {msg.role === 'user' ? msg.text : <FormattedMessage text={msg.text} />}
              </div>
            </div>
          ))}

          {isThinking && (
            <div className="flex gap-4">
              <div className="w-8 h-8 rounded-full bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center shrink-0 mt-1"><Activity className="w-4 h-4 text-indigo-400 animate-pulse" /></div>
              <div className="px-5 py-4 bg-[var(--k-surface)] border border-[var(--k-line)]/60 rounded-2xl rounded-tl-none flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[var(--k-text-4)] animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-2 h-2 rounded-full bg-[var(--k-text-4)] animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-2 h-2 rounded-full bg-[var(--k-text-4)] animate-bounce" style={{ animationDelay: '300ms' }}></div>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        <div className="p-3 sm:p-4 bg-[var(--k-ink)]/80 border-t border-[var(--k-line)]/60 backdrop-blur-md shrink-0">
          <form onSubmit={onSend} className="flex items-end gap-2 max-w-2xl mx-auto">
            {voiceSupported && (
              <button
                type="button"
                onClick={toggleListening}
                disabled={isThinking}
                aria-label={isListening ? 'Ferma la dettatura' : 'Detta il messaggio'}
                className={`shrink-0 p-3.5 sm:p-4 rounded-full transition-colors disabled:opacity-50 ${
                  isListening ? 'bg-rose-500/20 text-rose-400 animate-pulse' : 'bg-[var(--k-surface)] border border-[var(--k-surface-3)] text-[var(--k-text-3)] hover:text-[var(--k-text)]'
                }`}
              >
                {isListening ? <Square className="w-4 h-4 fill-current" /> : <Mic className="w-4 h-4" />}
              </button>
            )}
            <div className="relative flex-1 flex items-end">
              <textarea
                ref={textareaRef}
                rows={1}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isThinking}
                placeholder={isListening ? 'Ti ascolto...' : 'Es. Sposta la lezione di domani pomeriggio a giovedì mattina...'}
                className="w-full bg-[var(--k-surface)] border border-[var(--k-surface-3)] text-[var(--k-text)] text-sm pl-5 sm:pl-6 pr-12 py-3.5 sm:py-4 rounded-3xl focus:outline-none focus:border-indigo-500 focus:bg-[var(--k-surface-2)] transition-all shadow-inner placeholder:text-[var(--k-text-5)] disabled:opacity-50 resize-none leading-relaxed"
                style={{ maxHeight: `${MAX_TEXTAREA_HEIGHT}px` }}
              />
              <button type="submit" disabled={!input.trim() || isThinking} className="absolute right-2 bottom-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-[var(--k-surface-2)] disabled:text-[var(--k-text-4)] text-white p-2.5 rounded-full transition-transform active:scale-90 shrink-0">
                <Send className="w-4 h-4" />
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
