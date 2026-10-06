import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import Auth from './Auth'
import CalendarView from './components/CalendarView'
import ChatView from './components/ChatView'
import EventSheet from './components/EventSheet'
import QuickAddSheet from './components/QuickAddSheet'
import TodoSheet from './components/TodoSheet'
import SettingsView from './components/SettingsView'
import ApiKeyGate from './components/ApiKeyGate'
import Avatar from './components/Avatar'
import { Plus, Sparkles, X } from 'lucide-react'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { parseIcs, icsEventsToRows } from './lib/icsImport'
import { getRelevantEvents } from './lib/relevantEvents'

// Formatta una Data come orario locale "naive" (senza offset/Z), così l'IA
// ragiona sempre in ora locale invece di dover fare aritmetica di fuso orario.
function toLocalNaive(date) {
  const pad = (n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

// Converte un orario locale "naive" scritto dall'IA nell'UTC corretto per il salvataggio.
function localNaiveToUtcIso(value) {
  const cleaned = value.replace(/Z$/i, '')
  const date = new Date(cleaned)
  if (isNaN(date)) throw new Error(`Data non valida ricevuta dall'IA: ${value}`)
  return date.toISOString()
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)))
}

export default function App() {
  const [session, setSession] = useState(null)
  const [events, setEvents] = useState([])

  const [currentView, setCurrentView] = useState('calendar')
  const [weekOffset, setWeekOffset] = useState(0)

  const [isAssistantOpen, setIsAssistantOpen] = useState(false)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [editingId, setEditingId] = useState(null)

  const [chatMessages, setChatMessages] = useState([
    { role: 'model', text: 'Ciao! Sono sincronizzato con il tuo calendario. Dimmi cosa vuoi creare, spostare o eliminare e me ne occupo io.' }
  ])
  const [chatInput, setChatInput] = useState('')
  const [isThinking, setIsThinking] = useState(false)
  const [toast, setToast] = useState(null)
  const [pushSubscribed, setPushSubscribed] = useState(false)
  const [userSettings, setUserSettings] = useState({ gemini_api_key: '', theme: 'dark', avatar_url: null })
  const [settingsLoaded, setSettingsLoaded] = useState(false)

  const showToast = (message) => {
    setToast(message)
    setTimeout(() => setToast((t) => (t === message ? null : t)), 4500)
  }

  const emptyEvent = {
    title: '', description: '', category: 'universita',
    date: new Date().toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    startTime: '09:00', endTime: '11:00',
    is_fixed: true, is_reminder: false, energy_cost: 3, importance: 3, color: 'indigo', recurrence: 'none', recurrenceEndDate: '', reminder_minutes: null
  }
  const [newEvent, setNewEvent] = useState(emptyEvent)

  const [todos, setTodos] = useState([])
  const emptyTodo = { title: '', notes: '', dueDate: '', dueTime: '', reminder_minutes: null }
  const [todoDraft, setTodoDraft] = useState(emptyTodo)
  const [editingTodoId, setEditingTodoId] = useState(null)
  const [isTodoSheetOpen, setIsTodoSheetOpen] = useState(false)
  const [isSubmittingTodo, setIsSubmittingTodo] = useState(false)

  const fetchEvents = async (userId) => {
    const { data, error } = await supabase.from('events').select('*').eq('user_id', userId).order('start_time', { ascending: true })
    if (!error) setEvents(data)
  }

  const fetchTodos = async (userId) => {
    const { data, error } = await supabase.from('todos').select('*').eq('user_id', userId).order('created_at', { ascending: false })
    if (error) console.error('Errore caricamento to-do:', error)
    else setTodos(data)
  }

  const fetchUserSettings = async (userId) => {
    const { data, error } = await supabase.from('user_settings').select('*').eq('user_id', userId).maybeSingle()
    if (!error && data) {
      setUserSettings(data)
    } else {
      const { data: created } = await supabase.from('user_settings').insert({ user_id: userId }).select().single()
      if (created) setUserSettings(created)
    }
    setSettingsLoaded(true)
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) { fetchEvents(session.user.id); fetchTodos(session.user.id); fetchUserSettings(session.user.id) }
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session) {
        fetchEvents(session.user.id); fetchTodos(session.user.id); fetchUserSettings(session.user.id)
      } else {
        setSettingsLoaded(false)
        setUserSettings({ gemini_api_key: '', theme: 'dark', avatar_url: null })
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    const isLight = userSettings.theme === 'light'
    document.documentElement.setAttribute('data-theme', isLight ? 'light' : 'dark')
    document.getElementById('theme-color-meta')?.setAttribute('content', isLight ? '#fbf7fc' : '#1b0f1f')
  }, [userSettings.theme])

  useEffect(() => {
    if (!session || !('serviceWorker' in navigator) || !('PushManager' in window)) return
    navigator.serviceWorker.ready.then(async (reg) => {
      const sub = await reg.pushManager.getSubscription()
      setPushSubscribed(!!sub)
    })
  }, [session])

  const handleLogout = async () => {
    await supabase.auth.signOut()
  }

  // --- IMPOSTAZIONI UTENTE ---
  const handleSaveApiKey = async (apiKey) => {
    const { error } = await supabase.from('user_settings').update({ gemini_api_key: apiKey || null }).eq('user_id', session.user.id)
    if (error) { showToast('Errore salvataggio chiave: ' + error.message); return }
    setUserSettings((s) => ({ ...s, gemini_api_key: apiKey || null }))
    showToast('Chiave API salvata.')
  }

  const handleSaveTheme = async (theme) => {
    setUserSettings((s) => ({ ...s, theme }))
    const { error } = await supabase.from('user_settings').update({ theme }).eq('user_id', session.user.id)
    if (error) showToast('Errore salvataggio tema: ' + error.message)
  }

  const handleRegenerateWidgetToken = async () => {
    const newToken = crypto.randomUUID()
    const { error } = await supabase.from('user_settings').update({ widget_token: newToken }).eq('user_id', session.user.id)
    if (error) { showToast('Errore rigenerazione token: ' + error.message); return }
    setUserSettings((s) => ({ ...s, widget_token: newToken }))
    showToast('Nuovo link widget generato. Aggiorna i widget con il nuovo link.')
  }

  const handleUploadAvatar = async (file) => {
    const ext = file.name.split('.').pop()
    const path = `${session.user.id}/avatar-${Date.now()}.${ext}`
    const { error: uploadError } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
    if (uploadError) { showToast('Errore caricamento foto: ' + uploadError.message); return }
    const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)
    const { error } = await supabase.from('user_settings').update({ avatar_url: publicUrl }).eq('user_id', session.user.id)
    if (error) { showToast('Errore salvataggio foto: ' + error.message); return }
    setUserSettings((s) => ({ ...s, avatar_url: publicUrl }))
    showToast('Foto profilo aggiornata.')
  }

  // --- NOTIFICHE PUSH ---
  const enableNotifications = async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      showToast('Le notifiche non sono supportate su questo browser.')
      return
    }
    if (!import.meta.env.VITE_VAPID_PUBLIC_KEY) {
      showToast('Notifiche non ancora configurate lato server.')
      return
    }
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') {
      showToast('Permesso notifiche negato.')
      return
    }
    try {
      const reg = await navigator.serviceWorker.ready
      let sub = await reg.pushManager.getSubscription()
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(import.meta.env.VITE_VAPID_PUBLIC_KEY),
        })
      }
      const subJson = sub.toJSON()
      const { error } = await supabase.from('push_subscriptions').upsert(
        { user_id: session.user.id, endpoint: subJson.endpoint, p256dh: subJson.keys.p256dh, auth: subJson.keys.auth },
        { onConflict: 'endpoint' }
      )
      if (error) throw error
      setPushSubscribed(true)
      showToast('Notifiche attivate.')
    } catch (err) {
      showToast('Errore attivazione notifiche: ' + err.message)
    }
  }

  const disableNotifications = async () => {
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
        await sub.unsubscribe()
      }
      setPushSubscribed(false)
      showToast('Notifiche disattivate.')
    } catch (err) {
      showToast('Errore disattivazione notifiche: ' + err.message)
    }
  }

  // --- IMPORT CALENDARIO .ICS ---
  const importIcsEvents = async (icsEvents) => {
    const { rows, skipped } = icsEventsToRows(icsEvents, { userId: session.user.id, existingEvents: events })
    if (rows.length === 0) {
      showToast(skipped > 0 ? `Nessun evento nuovo da importare (${skipped} già presenti).` : 'Nessun evento trovato nel file.')
      return
    }
    const { error } = await supabase.from('events').insert(rows)
    if (error) { showToast('Errore importazione: ' + error.message); return }
    await fetchEvents(session.user.id)
    showToast(`Importati ${rows.length} eventi${skipped ? ` (${skipped} già presenti, saltati)` : ''}.`)
  }

  const handleImportFile = async (file) => {
    try {
      const text = await file.text()
      const icsEvents = parseIcs(text)
      if (icsEvents.length === 0) { showToast('Il file non contiene eventi validi.'); return }
      await importIcsEvents(icsEvents)
    } catch (err) {
      showToast('Errore lettura file: ' + err.message)
    }
  }

  // --- MOTORE IA (GEMINI) ---
  // Logica condivisa tra la chat dell'assistente e la creazione rapida dal "+":
  // manda il testo dell'utente a Gemini, esegue le azioni JSON che propone,
  // e ritorna il testo di risposta pronto per essere mostrato (bolla di chat o toast).
  const processAssistantMessage = async (userText) => {
    const urlMatch = userText.match(/https?:\/\/\S+/i)
    const isIcsLink = urlMatch && /\.ics(\?|$)|\/ics(\?|$)/i.test(urlMatch[0])
    if (isIcsLink) {
      try {
        const res = await fetch(urlMatch[0])
        if (!res.ok) throw new Error('fetch-failed')
        const text = await res.text()
        const icsEvents = parseIcs(text)
        if (icsEvents.length === 0) throw new Error('no-events')
        const { rows, skipped } = icsEventsToRows(icsEvents, { userId: session.user.id, existingEvents: events })
        if (rows.length > 0) {
          const { error } = await supabase.from('events').insert(rows)
          if (error) throw error
          await fetchEvents(session.user.id)
        }
        return { replyText: `Fatto! Ho importato ${rows.length} eventi dal link.${skipped ? ` (${skipped} già presenti, saltati)` : ''}`, actionCount: rows.length }
      } catch {
        return {
          replyText: "Non riesco a scaricare questo link direttamente: il server blocca l'accesso da altri siti (succede spesso con i calendari universitari). Apri il link nel browser, tocca \"Salva file\" per scaricare il .ics sul telefono, poi vai su Calendario → Importa e selezionalo: importerò tutte le lezioni in un colpo solo.",
          actionCount: 0,
        }
      }
    }

    if (!userSettings.gemini_api_key) {
      return { replyText: "Devi impostare la tua API key Gemini nelle Impostazioni prima di usare l'assistente.", actionCount: 0 }
    }

    try {
      const genAI = new GoogleGenerativeAI(userSettings.gemini_api_key)
      const model = genAI.getGenerativeModel({ model: "gemini-3.6-flash" })

      const now = new Date()
      const relevantEvents = getRelevantEvents(events, userText, now)
      const compactEvents = relevantEvents.map(ev => ({
        id: ev.id,
        title: ev.title,
        start: toLocalNaive(new Date(ev.start_time)),
        end: toLocalNaive(new Date(ev.end_time)),
        fixed: ev.is_fixed,
        energy: ev.energy_cost
      }))

      const recentHistory = chatMessages
        .slice(-8)
        .map((m) => `${m.role === 'user' ? 'Utente' : 'Tu'}: ${m.text}`)
        .join('\n')

      const nowLocal = toLocalNaive(now)
      const userName = session.user.email?.split('@')[0] || 'utente'
      const prompt = `
Sei il motore logistico di Kinetix. Il tuo utente si chiama ${userName}.
Data e ora attuali (ora locale del suo dispositivo): ${nowLocal}.
Per risparmiare contesto, qui sotto NON c'è tutto il calendario ma solo gli eventi vicini a oggi e a eventuali date/mesi citati nella richiesta (orari già in ora locale dell'utente, "energy" = costo energetico da 1 a 5 di quell'evento). Potrebbero esserci altri eventi nel database non mostrati qui, quindi NON dire mai che il calendario è vuoto solo perché questa lista è corta o vuota — semplicemente non hai eventi rilevanti da mostrare per questa richiesta.
${JSON.stringify(compactEvents)}

Conversazione recente (per capire riferimenti come "la seconda opzione" o conferme a proposte che hai fatto tu):
${recentHistory}

Nuovo messaggio dell'utente: "${userText}"

REGOLE OPERATIVE ASSOLUTE:
1. Se la richiesta riguarda un ID che non vedi in questa lista (evento troppo lontano nel tempo o non ancora mostrato), dillo all'utente e chiedi di specificare meglio la data invece di inventare un'azione.
2. Se l'utente chiede di CREARE/AGGIUNGERE un nuovo evento, se SPOSTA un evento esistente, o se ELIMINA un evento, devi OBBLIGATORIAMENTE includere alla fine della tua risposta un blocco di codice JSON con le azioni da eseguire, nel formato sotto.
3. Per "update" e "delete" usa solo l'ID reale fornito nel JSON sopra (non inventare ID). TUTTI gli orari che scrivi (start, end, new_start, new_end) DEVONO essere in ora locale di Lugano, formato "YYYY-MM-DDTHH:MM:SS" — SENZA la "Z" finale e SENZA alcuna conversione a UTC: scrivi l'ora esattamente come la direbbe l'utente (es. "le 10 di mattina" -> "10:00:00").
4. Per "create" NON serve un ID (viene generato automaticamente dal database). Campi obbligatori: title, start, end. Campi opzionali (usa valori di default sensati se non specificati): description, category (una tra: universita, sport, studio, lavoro, personale, spostamento), is_fixed (true/false), energy_cost (1-5), importance (1-5), color (una tra: indigo, emerald, amber, rose, purple, zinc).
5. Se l'utente chiede un promemoria/avviso ("avvisami X minuti prima", "ricordamelo un'ora prima"), includi "reminder_minutes" (numero di minuti prima dell'inizio) nell'azione "create" o "update". Valori tipici: 5, 15, 30, 60, 1440 (un giorno). Per "update" puoi mandare SOLO "reminder_minutes" senza new_start/new_end se l'utente vuole solo aggiungere/cambiare il promemoria senza spostare l'evento.
6. Se non devi eseguire nessuna azione, NON includere alcun blocco JSON.
7. GESTIONE ENERGIA — quando l'utente chiede di aggiungere un evento ELASTICO (is_fixed: false, tipicamente attività flessibili come studio, sport libero, commissioni) SENZA specificare un orario preciso (es. "trovami spazio per studiare questa settimana", "aggiungimi un allenamento quando c'è posto"): NON creare subito l'evento. Analizza i giorni vicini, calcola il carico energetico totale (somma di "energy") per ciascuno usando gli eventi che vedi, e rispondi in testo con 2-3 fasce orarie candidate libere, preferendo i giorni con carico energetico più basso e evitando di affiancare troppi eventi ad alta energia. Chiedi all'utente quale preferisce. NON includere blocco JSON in questo messaggio: aspetta che l'utente scelga in un messaggio successivo (userai la "Conversazione recente" per capire quale ha scelto), poi crea l'evento con quell'orario specifico.
8. Se l'utente dà già un orario preciso (anche per un evento elastico), o se l'evento è "fisso", crea subito senza proporre alternative.
9. Dopo aver creato o spostato un evento (fisso o elastico, con orario noto), controlla il carico energetico totale di quel giorno sommando "energy" di tutti gli eventi in quel giorno incluso il nuovo. Se supera 14 punti, aggiungi un breve avviso nella tua risposta testuale (es. "Attenzione: giovedì hai già un carico energetico alto"). Non bloccare l'azione, avvisa soltanto.
10. FORMATTAZIONE DELLA RISPOSTA TESTUALE: vai a capo (riga vuota) tra un punto e l'altro quando elenchi più eventi/azioni — non scrivere mai due punti di un elenco sulla stessa riga. Usa il grassetto **così** solo per nomi di eventi, orari o parole chiave importanti, con moderazione. Se aggiungi una nota/avviso energetico, mettila come paragrafo separato, non attaccata al resto.

\`\`\`json
[
  { "action": "create", "title": "Titolo evento", "description": "", "category": "universita", "start": "2026-08-20T09:00:00", "end": "2026-08-20T11:00:00", "is_fixed": true, "energy_cost": 3, "importance": 3, "color": "indigo", "reminder_minutes": 15 },
  { "action": "update", "id": "ID_REALE_DELL_EVENTO", "new_start": "2026-08-20T10:00:00", "new_end": "2026-08-20T12:00:00" },
  { "action": "update", "id": "ID_REALE_DELL_EVENTO", "reminder_minutes": 30 },
  { "action": "delete", "id": "ID_REALE_DELL_EVENTO" }
]
\`\`\`
`
      const result = await model.generateContent(prompt)
      const responseText = result.response.text()

      const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/i)
      let actionCount = 0

      if (jsonMatch) {
        try {
          const actions = JSON.parse(jsonMatch[1])

          for (const action of actions) {
            try {
              if (action.action === 'create') {
                const { error: createError } = await supabase.from('events').insert({
                  user_id: session.user.id,
                  title: action.title,
                  description: action.description || '',
                  category: action.category || 'universita',
                  start_time: localNaiveToUtcIso(action.start),
                  end_time: localNaiveToUtcIso(action.end),
                  is_fixed: action.is_fixed !== undefined ? action.is_fixed : true,
                  energy_cost: action.energy_cost || 3,
                  importance: action.importance || 3,
                  color: action.color || 'indigo',
                  reminder_minutes: action.reminder_minutes ?? null
                })
                if (createError) console.error("Errore creazione evento IA:", createError)
                else actionCount++
              } else if (action.action === 'update') {
                const updatePayload = {}
                if (action.new_start) updatePayload.start_time = localNaiveToUtcIso(action.new_start)
                if (action.new_end) updatePayload.end_time = localNaiveToUtcIso(action.new_end)
                if (action.reminder_minutes !== undefined) {
                  updatePayload.reminder_minutes = action.reminder_minutes
                  updatePayload.reminder_sent_at = null
                }
                const { error: updateError } = await supabase.from('events').update(updatePayload).eq('id', action.id)
                if (updateError) console.error("Errore modifica evento IA:", updateError)
                else actionCount++
              } else if (action.action === 'delete') {
                const { error: deleteError } = await supabase.from('events').delete().eq('id', action.id)
                if (deleteError) console.error("Errore eliminazione evento IA:", deleteError)
                else actionCount++
              }
            } catch (actionErr) {
              console.error("Errore azione IA:", action, actionErr)
            }
          }
          if (actionCount > 0) fetchEvents(session.user.id)
        } catch (jsonErr) {
          console.error("Errore parsing JSON dell'IA:", jsonErr)
        }
      }

      const cleanText = responseText.replace(/```json\s*[\s\S]*?\s*```/i, '').trim()
      return { replyText: cleanText, actionCount }

    } catch (err) {
      console.error("Errore IA:", err)
      return { replyText: "Connessione interrotta.", actionCount: 0 }
    }
  }

  const handleSendChatMessage = async (e) => {
    e.preventDefault()
    if (!chatInput.trim()) return
    const userText = chatInput
    setChatMessages(prev => [...prev, { role: 'user', text: userText }])
    setChatInput('')
    setIsThinking(true)
    const { replyText } = await processAssistantMessage(userText)
    setChatMessages(prev => [...prev, { role: 'model', text: replyText }])
    setIsThinking(false)
  }

  // Creazione rapida dal "+": stesso motore della chat, ma con una singola
  // frase e un toast invece di aprire tutta la conversazione.
  const handleQuickAdd = async (text) => {
    const trimmed = text.trim()
    if (!trimmed) return false
    setChatMessages(prev => [...prev, { role: 'user', text: trimmed }])
    const { replyText, actionCount } = await processAssistantMessage(trimmed)
    setChatMessages(prev => [...prev, { role: 'model', text: replyText }])
    showToast(replyText.split('\n').find((l) => l.trim()) || (actionCount > 0 ? 'Fatto.' : 'Non ho capito, riprova.'))
    return actionCount > 0
  }

  // --- CRUD MANUALE ---
  const handleSaveEvent = async (e) => {
    e.preventDefault()
    setIsSubmitting(true)

    const start_time = new Date(`${newEvent.date}T${newEvent.startTime}:00`).toISOString()
    const end_time = newEvent.is_reminder
      ? start_time
      : new Date(`${newEvent.endDate}T${newEvent.endTime}:00`).toISOString()

    if (editingId) {
      const { error } = await supabase.from('events').update({
        title: newEvent.title, description: newEvent.description,
        category: newEvent.category, start_time, end_time,
        is_fixed: newEvent.is_fixed, is_reminder: newEvent.is_reminder, energy_cost: newEvent.energy_cost, importance: newEvent.importance, color: newEvent.color,
        reminder_minutes: newEvent.reminder_minutes, reminder_sent_at: null
      }).eq('id', editingId)
      if (error) alert("Errore modifica: " + error.message)
    } else {
      const eventsToInsert = []
      let currentStart = new Date(start_time)
      let currentEnd = new Date(end_time)

      if (newEvent.is_fixed && newEvent.recurrence !== 'none' && newEvent.recurrenceEndDate) {
        const limitDate = new Date(`${newEvent.recurrenceEndDate}T23:59:59`)
        let safetyCounter = 0

        while (currentStart <= limitDate && safetyCounter < 150) {
          eventsToInsert.push({
            user_id: session.user.id, title: newEvent.title, description: newEvent.description,
            category: newEvent.category, start_time: currentStart.toISOString(), end_time: currentEnd.toISOString(),
            is_fixed: newEvent.is_fixed, is_reminder: newEvent.is_reminder, energy_cost: newEvent.energy_cost, importance: newEvent.importance, color: newEvent.color,
            reminder_minutes: newEvent.reminder_minutes
          })
          if (newEvent.recurrence === 'weekly') { currentStart.setDate(currentStart.getDate() + 7); currentEnd.setDate(currentEnd.getDate() + 7) }
          else if (newEvent.recurrence === 'daily') { currentStart.setDate(currentStart.getDate() + 1); currentEnd.setDate(currentEnd.getDate() + 1) }
          safetyCounter++
        }
      } else {
        eventsToInsert.push({
          user_id: session.user.id, title: newEvent.title, description: newEvent.description, category: newEvent.category,
          start_time: currentStart.toISOString(), end_time: currentEnd.toISOString(), is_fixed: newEvent.is_fixed, is_reminder: newEvent.is_reminder,
          energy_cost: newEvent.energy_cost, importance: newEvent.importance, color: newEvent.color,
          reminder_minutes: newEvent.reminder_minutes
        })
      }
      const { error } = await supabase.from('events').insert(eventsToInsert)
      if (error) alert("Errore salvataggio: " + error.message)
    }

    setIsSubmitting(false); setIsAddModalOpen(false); setEditingId(null); setNewEvent(emptyEvent); fetchEvents(session.user.id)
  }

  const handleDeleteEvent = async (id) => {
    if (!window.confirm("Sicuro di voler eliminare questo blocco?")) return
    const { error } = await supabase.from('events').delete().eq('id', id)
    if (error) { alert("Errore: " + error.message); return }
    if (id === editingId) closeModal()
    fetchEvents(session.user.id)
  }

  const toDateInputValue = (d) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, '0') + "-" + String(d.getDate()).padStart(2, '0')

  const openEditModal = (ev) => {
    const startDate = new Date(ev.start_time)
    const endDate = new Date(ev.end_time)
    setNewEvent({
      title: ev.title, description: ev.description || '', category: ev.category || 'universita',
      date: toDateInputValue(startDate), endDate: toDateInputValue(endDate),
      startTime: startDate.toTimeString().slice(0, 5), endTime: endDate.toTimeString().slice(0, 5),
      is_fixed: ev.is_fixed, is_reminder: ev.is_reminder || false, energy_cost: ev.energy_cost, importance: ev.importance || 3, color: ev.color || 'indigo', recurrence: 'none', recurrenceEndDate: '',
      reminder_minutes: ev.reminder_minutes ?? null
    })
    setEditingId(ev.id); setIsAddModalOpen(true)
  }

  const openAddModal = () => { setNewEvent(emptyEvent); setEditingId(null); setIsAddModalOpen(true) }
  const closeModal = () => { setIsAddModalOpen(false); setEditingId(null); setNewEvent(emptyEvent) }

  // Creazione rapida: tocco prolungato (mobile) o doppio click (desktop) su un punto del calendario.
  const openAddModalAt = (date, timeStr) => {
    const [h, m] = timeStr.split(':').map(Number)
    const endTotalMinutes = Math.min(h * 60 + m + 60, 23 * 60 + 45)
    const endTime = `${String(Math.floor(endTotalMinutes / 60)).padStart(2, '0')}:${String(endTotalMinutes % 60).padStart(2, '0')}`
    const dateStr = toDateInputValue(date)
    setNewEvent({ ...emptyEvent, date: dateStr, endDate: dateStr, startTime: timeStr, endTime })
    setEditingId(null)
    setIsAddModalOpen(true)
  }

  // --- TO-DO ---
  const handleQuickAddTodo = async (title) => {
    const { data, error } = await supabase.from('todos').insert({ user_id: session.user.id, title }).select().single()
    if (error) { showToast('Errore salvataggio to-do: ' + error.message); return }
    setTodos((prev) => [data, ...prev])
  }

  // Aggiornamento ottimistico: la spunta risponde subito, si ripristina se il salvataggio fallisce.
  const handleToggleTodo = async (todo) => {
    const done = !todo.done
    const patch = { done, done_at: done ? new Date().toISOString() : null }
    setTodos((prev) => prev.map((t) => (t.id === todo.id ? { ...t, ...patch } : t)))
    const { error } = await supabase.from('todos').update(patch).eq('id', todo.id)
    if (error) {
      setTodos((prev) => prev.map((t) => (t.id === todo.id ? todo : t)))
      showToast('Errore aggiornamento to-do: ' + error.message)
    }
  }

  const openTodoSheet = (title = '') => { setTodoDraft({ ...emptyTodo, title }); setEditingTodoId(null); setIsTodoSheetOpen(true) }
  const openEditTodo = (todo) => {
    const due = todo.due_at ? new Date(todo.due_at) : null
    setTodoDraft({
      title: todo.title, notes: todo.notes || '',
      dueDate: due ? toDateInputValue(due) : '', dueTime: due ? due.toTimeString().slice(0, 5) : '',
      reminder_minutes: todo.reminder_minutes ?? null,
    })
    setEditingTodoId(todo.id); setIsTodoSheetOpen(true)
  }
  const closeTodoSheet = () => { setIsTodoSheetOpen(false); setEditingTodoId(null); setTodoDraft(emptyTodo) }

  const handleSaveTodo = async (e) => {
    e.preventDefault()
    setIsSubmittingTodo(true)
    const due_at = todoDraft.dueDate ? new Date(`${todoDraft.dueDate}T${todoDraft.dueTime || '09:00'}:00`).toISOString() : null
    const payload = {
      title: todoDraft.title.trim(), notes: todoDraft.notes,
      due_at, reminder_minutes: due_at ? todoDraft.reminder_minutes : null, reminder_sent_at: null,
    }
    const { error } = editingTodoId
      ? await supabase.from('todos').update(payload).eq('id', editingTodoId)
      : await supabase.from('todos').insert({ ...payload, user_id: session.user.id })
    setIsSubmittingTodo(false)
    if (error) { showToast('Errore salvataggio to-do: ' + error.message); return }
    if (payload.reminder_minutes != null && !pushSubscribed) showToast('Salvato. Attiva le notifiche nelle Impostazioni per ricevere il promemoria.')
    closeTodoSheet(); fetchTodos(session.user.id)
  }

  const handleDeleteTodo = async (id) => {
    if (!window.confirm('Eliminare questo to-do?')) return
    const { error } = await supabase.from('todos').delete().eq('id', id)
    if (error) { showToast('Errore eliminazione to-do: ' + error.message); return }
    setTodos((prev) => prev.filter((t) => t.id !== id))
    if (id === editingTodoId) closeTodoSheet()
  }

  if (!session) return <Auth />
  if (!settingsLoaded) return null
  if (!userSettings.gemini_api_key) return <ApiKeyGate onSave={handleSaveApiKey} onLogout={handleLogout} />

  const pageTitle = currentView === 'settings' ? 'Impostazioni' : 'Calendario'

  return (
    <div className="h-[100dvh] bg-[var(--k-ink)] text-[var(--k-text)] font-sans flex relative selection:bg-indigo-500/30 overflow-hidden">
      <main className="flex-1 flex flex-col h-full overflow-hidden relative">
        <header
          className="px-4 lg:px-6 pb-3 lg:py-4 flex items-center justify-between border-b border-[var(--k-line)]/50 bg-[var(--k-ink)]/70 backdrop-blur-md shrink-0"
          style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}
        >
          <h2 className="font-display font-semibold text-lg text-[var(--k-text)]">{pageTitle}</h2>
          <div className="flex items-center gap-2">
            {currentView === 'calendar' && (
              <button onClick={() => setIsQuickAddOpen(true)} className="hidden lg:flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-full text-sm font-medium transition-transform shadow-lg">
                Nuovo
              </button>
            )}
            {currentView === 'calendar' && (
              <button onClick={() => setIsQuickAddOpen(true)} className="lg:hidden p-2 bg-indigo-600 active:bg-indigo-500 text-white rounded-full shadow-md shadow-indigo-950/40 active:scale-95 transition-transform" aria-label="Nuovo evento">
                <Plus className="w-5 h-5" />
              </button>
            )}
            <button
              onClick={() => setCurrentView(currentView === 'settings' ? 'calendar' : 'settings')}
              className={`rounded-full transition-all ${currentView === 'settings' ? 'ring-2 ring-indigo-500' : 'opacity-90 hover:opacity-100'}`}
              aria-label="Impostazioni"
              title="Impostazioni"
            >
              <Avatar url={userSettings.avatar_url} email={session.user.email} size={34} />
            </button>
          </div>
        </header>

        {currentView === 'calendar' && (
          <CalendarView
            events={events}
            weekOffset={weekOffset}
            setWeekOffset={setWeekOffset}
            onEdit={openEditModal}
            onDelete={handleDeleteEvent}
            onImportFile={handleImportFile}
            onCreateAtTime={openAddModalAt}
            todos={todos}
            onTodoQuickAdd={handleQuickAddTodo}
            onTodoToggle={handleToggleTodo}
            onTodoEdit={openEditTodo}
            onTodoOpenForm={openTodoSheet}
          />
        )}

        {currentView === 'settings' && (
          <SettingsView
            session={session}
            userSettings={userSettings}
            onSaveApiKey={handleSaveApiKey}
            onSaveTheme={handleSaveTheme}
            onUploadAvatar={handleUploadAvatar}
            onRegenerateWidgetToken={handleRegenerateWidgetToken}
            pushSubscribed={pushSubscribed}
            onEnableNotifications={enableNotifications}
            onDisableNotifications={disableNotifications}
            onImportFile={handleImportFile}
            onLogout={handleLogout}
          />
        )}
      </main>

      {/* Assistente IA: azione fluttuante sempre raggiungibile, non una scheda a parte. */}
      {!isAssistantOpen && (
        <button
          onClick={() => setIsAssistantOpen(true)}
          className="fixed right-4 lg:right-6 bottom-[calc(1.25rem+env(safe-area-inset-bottom))] lg:bottom-6 z-40 w-14 h-14 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white shadow-2xl shadow-indigo-950/50 flex items-center justify-center active:scale-95 transition-transform"
          aria-label="Apri assistente Kinetix"
        >
          <Sparkles className="w-6 h-6" />
        </button>
      )}

      {isAssistantOpen && (
        <div className="fixed inset-0 z-[90] flex items-end lg:items-center lg:justify-end">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-backdrop-in" onClick={() => setIsAssistantOpen(false)} />
          <div
            className="relative w-full lg:w-[420px] lg:m-6 h-[85vh] lg:h-[min(720px,85vh)] bg-[var(--k-ink)] border border-[var(--k-line)] rounded-t-3xl lg:rounded-3xl overflow-hidden shadow-2xl animate-sheet-up lg:animate-modal-in flex flex-col"
            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--k-line)]/60 shrink-0">
              <h3 className="font-display font-semibold text-[var(--k-text)]">Assistente Kinetix</h3>
              <button onClick={() => setIsAssistantOpen(false)} className="p-1.5 text-[var(--k-text-4)] hover:text-[var(--k-text-2)]" aria-label="Chiudi assistente">
                <X className="w-5 h-5" />
              </button>
            </div>
            <ChatView
              messages={chatMessages}
              isThinking={isThinking}
              input={chatInput}
              setInput={setChatInput}
              onSend={handleSendChatMessage}
            />
          </div>
        </div>
      )}

      <QuickAddSheet
        isOpen={isQuickAddOpen}
        onClose={() => setIsQuickAddOpen(false)}
        onSubmit={handleQuickAdd}
        onOpenFullForm={() => { setIsQuickAddOpen(false); openAddModal() }}
      />

      <EventSheet
        isOpen={isAddModalOpen}
        editingId={editingId}
        newEvent={newEvent}
        setNewEvent={setNewEvent}
        isSubmitting={isSubmitting}
        onSubmit={handleSaveEvent}
        onClose={closeModal}
        onDelete={handleDeleteEvent}
      />

      <TodoSheet
        isOpen={isTodoSheetOpen}
        editingId={editingTodoId}
        draft={todoDraft}
        setDraft={setTodoDraft}
        isSubmitting={isSubmittingTodo}
        onSubmit={handleSaveTodo}
        onClose={closeTodoSheet}
        onDelete={handleDeleteTodo}
      />

      {toast && (
        <div
          className="fixed inset-x-4 z-[200] flex justify-center pointer-events-none"
          style={{ top: 'max(1rem, env(safe-area-inset-top))' }}
        >
          <div className="max-w-md px-4 py-3 rounded-2xl bg-[var(--k-surface)] border border-[var(--k-line)] shadow-2xl text-sm text-[var(--k-text)] text-center animate-backdrop-in">
            {toast}
          </div>
        </div>
      )}
    </div>
  )
}
