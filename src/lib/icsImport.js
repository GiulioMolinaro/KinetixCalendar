// Parser minimale per file .ics (RFC 5545), pensato per feed di orari universitari:
// blocchi VEVENT semplici (senza RRULE), un evento per occorrenza.

function unfoldLines(text) {
  const rawLines = text.split(/\r\n|\n|\r/)
  const lines = []
  for (const line of rawLines) {
    if ((line.startsWith(' ') || line.startsWith('\t')) && lines.length > 0) {
      lines[lines.length - 1] += line.slice(1)
    } else {
      lines.push(line)
    }
  }
  return lines
}

function unescapeText(value) {
  return value
    .replace(/\\n/gi, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\')
}

function parseLine(line) {
  const colonIdx = line.indexOf(':')
  if (colonIdx === -1) return null
  const rawKey = line.slice(0, colonIdx)
  const value = line.slice(colonIdx + 1)
  const [name] = rawKey.split(';')
  return { name: name.toUpperCase(), value }
}

// Interpreta la data come orario locale del browser: valido per feed con TZID
// che corrisponde al fuso dell'utente (es. Europe/Zurich per uno studente in Ticino).
function parseIcsDate(value) {
  const m = value.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2}))?(Z)?$/)
  if (!m) return null
  const [, y, mo, d, h = '00', mi = '00', s = '00', z] = m
  if (z) return new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +s))
  return new Date(+y, +mo - 1, +d, +h, +mi, +s)
}

export function parseIcs(text) {
  const lines = unfoldLines(text)
  const events = []
  let current = null
  for (const rawLine of lines) {
    const parsed = parseLine(rawLine)
    if (!parsed) continue
    if (parsed.name === 'BEGIN' && parsed.value === 'VEVENT') {
      current = {}
    } else if (parsed.name === 'END' && parsed.value === 'VEVENT') {
      if (current?.start && current?.end && current?.title) events.push(current)
      current = null
    } else if (current) {
      if (parsed.name === 'SUMMARY') current.title = unescapeText(parsed.value)
      else if (parsed.name === 'LOCATION') current.location = unescapeText(parsed.value)
      else if (parsed.name === 'DESCRIPTION') current.description = unescapeText(parsed.value)
      else if (parsed.name === 'DTSTART') current.start = parseIcsDate(parsed.value)
      else if (parsed.name === 'DTEND') current.end = parseIcsDate(parsed.value)
    }
  }
  return events
}

export function icsEventsToRows(icsEvents, { userId, existingEvents = [], category = 'universita' }) {
  const existingKeys = new Set(existingEvents.map((ev) => `${ev.title}__${ev.start_time}`))
  const rows = []
  let skipped = 0

  for (const ev of icsEvents) {
    const start_time = ev.start.toISOString()
    const key = `${ev.title}__${start_time}`
    if (existingKeys.has(key)) { skipped++; continue }
    existingKeys.add(key)
    rows.push({
      user_id: userId,
      title: ev.title,
      description: ev.location ? `📍 ${ev.location}` : (ev.description || ''),
      category,
      start_time,
      end_time: ev.end.toISOString(),
      is_fixed: true,
      energy_cost: 2,
      importance: 3,
      color: 'indigo',
    })
  }
  return { rows, skipped }
}
