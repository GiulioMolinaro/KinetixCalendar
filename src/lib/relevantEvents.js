const MONTHS_IT = [
  'gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno',
  'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre',
]

function addDays(date, days) {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

// Prossima occorrenza di quel giorno/mese: se è già passata quest'anno, assume l'anno prossimo.
function nextOccurrence(now, monthIdx, day = 1) {
  let year = now.getFullYear()
  const passed = monthIdx < now.getMonth() || (monthIdx === now.getMonth() && day < now.getDate())
  if (passed) year += 1
  return new Date(year, monthIdx, day)
}

// Analizza il testo dell'utente cercando riferimenti a mesi o date specifiche,
// per capire quali eventi (anche lontani nel tempo) potrebbero servire all'IA.
function extractRanges(text, now) {
  const ranges = []
  const lower = text.toLowerCase()
  const monthsPattern = MONTHS_IT.join('|')

  // "15 dicembre" -> data specifica, ±15 giorni
  const dayMonthRegex = new RegExp(`\\b(\\d{1,2})\\s+(${monthsPattern})\\b`, 'gi')
  let m
  while ((m = dayMonthRegex.exec(lower))) {
    const day = parseInt(m[1], 10)
    const monthIdx = MONTHS_IT.indexOf(m[2].toLowerCase())
    if (day >= 1 && day <= 31) {
      const center = nextOccurrence(now, monthIdx, day)
      ranges.push({ start: addDays(center, -15), end: addDays(center, 15) })
    }
  }

  // "15/12" o "15.12.2026" -> data specifica, ±15 giorni
  const numericRegex = /\b(\d{1,2})[/.](\d{1,2})(?:[/.](\d{2,4}))?\b/g
  while ((m = numericRegex.exec(text))) {
    const day = parseInt(m[1], 10)
    const monthIdx = parseInt(m[2], 10) - 1
    if (day >= 1 && day <= 31 && monthIdx >= 0 && monthIdx <= 11) {
      let year
      if (m[3]) year = m[3].length === 2 ? 2000 + parseInt(m[3], 10) : parseInt(m[3], 10)
      const center = m[3] ? new Date(year, monthIdx, day) : nextOccurrence(now, monthIdx, day)
      ranges.push({ start: addDays(center, -15), end: addDays(center, 15) })
    }
  }

  // Solo nome del mese, senza giorno -> tutto il mese
  for (let i = 0; i < MONTHS_IT.length; i++) {
    if (new RegExp(`\\b${MONTHS_IT[i]}\\b`, 'i').test(lower)) {
      const start = nextOccurrence(now, i, 1)
      const end = new Date(start.getFullYear(), start.getMonth() + 1, 0, 23, 59, 59)
      ranges.push({ start, end })
    }
  }

  return ranges
}

// Riduce la lista di eventi a quelli davvero rilevanti per il messaggio corrente,
// invece di mandare sempre l'intero calendario all'IA.
export function getRelevantEvents(events, userText, now = new Date()) {
  const defaultWindow = { start: addDays(now, -3), end: addDays(now, 45) }
  const ranges = [defaultWindow, ...extractRanges(userText, now)]

  return events.filter((ev) => {
    const t = new Date(ev.start_time)
    return ranges.some((r) => t >= r.start && t <= r.end)
  })
}
