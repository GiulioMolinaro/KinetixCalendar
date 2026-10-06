// Kinetix: endpoint pubblico (autenticato via token personale) per i widget
// di sistema (Scriptable su iPhone, Übersicht su Mac). Ritorna l'agenda dei
// prossimi giorni e l'energia residua stimata di oggi.
import { createClient } from 'npm:@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const TIMEZONE = 'Europe/Zurich'
const MAX_DAILY_ENERGY = 20
const UPCOMING_DAYS_WINDOW = 7
const UPCOMING_DAY_GROUPS_LIMIT = 3
const UPCOMING_EVENTS_LIMIT = 5

// Deve corrispondere ai colori di src/lib/theme.js (palette "Impulso").
const COLOR_HEX = {
  indigo: '#9a45f2',
  emerald: '#34c266',
  amber: '#e2a22b',
  rose: '#ff6b5b',
  purple: '#e14bd4',
  zinc: '#8a7391',
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Content-Type': 'application/json',
}

function energyTier(pct) {
  if (pct >= 67) return { tier: 'light', color: '#4ade80', label: 'Leggera' }
  if (pct >= 34) return { tier: 'moderate', color: '#f5b942', label: 'Equilibrata' }
  return { tier: 'heavy', color: '#ff6b5b', label: 'Pesante' }
}

// Confini (in UTC) della giornata di "oggi" nel fuso orario dell'utente.
function todayBoundsUtc() {
  const now = new Date()
  const zurichDateStr = now.toLocaleDateString('en-CA', { timeZone: TIMEZONE }) // "2026-09-07"
  const asUtc = new Date(now.toLocaleString('en-US', { timeZone: 'UTC' })).getTime()
  const asZurich = new Date(now.toLocaleString('en-US', { timeZone: TIMEZONE })).getTime()
  const offsetMs = asZurich - asUtc
  const startLocalNaive = new Date(`${zurichDateStr}T00:00:00`).getTime()
  const startUtc = new Date(startLocalNaive - offsetMs)
  const endUtc = new Date(startUtc.getTime() + 24 * 60 * 60 * 1000)
  return { startUtc, endUtc }
}

function timeLabel(dateIso) {
  return new Date(dateIso).toLocaleTimeString('it-IT', { timeZone: TIMEZONE, hour: '2-digit', minute: '2-digit' })
}

function dayGroupLabel(dateIso) {
  const label = new Date(dateIso).toLocaleDateString('it-IT', {
    timeZone: TIMEZONE,
    weekday: 'long',
    day: 'numeric',
    month: 'short',
  })
  return label.toUpperCase()
}

function localDateKey(dateIso) {
  return new Date(dateIso).toLocaleDateString('en-CA', { timeZone: TIMEZONE })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS })

  const token = new URL(req.url).searchParams.get('token')
  if (!token) {
    return new Response(JSON.stringify({ error: 'missing token' }), { status: 400, headers: CORS_HEADERS })
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey)

  const { data: settings, error: settingsError } = await supabase
    .from('user_settings')
    .select('user_id')
    .eq('widget_token', token)
    .maybeSingle()

  if (settingsError || !settings) {
    return new Response(JSON.stringify({ error: 'invalid token' }), { status: 401, headers: CORS_HEADERS })
  }

  const now = new Date()
  const { startUtc, endUtc } = todayBoundsUtc()
  const windowEndUtc = new Date(startUtc.getTime() + UPCOMING_DAYS_WINDOW * 24 * 60 * 60 * 1000)

  const { data: windowEvents } = await supabase
    .from('events')
    .select('title, start_time, end_time, energy_cost, color')
    .eq('user_id', settings.user_id)
    .gte('start_time', startUtc.toISOString())
    .lt('start_time', windowEndUtc.toISOString())
    .order('start_time', { ascending: true })

  const events = windowEvents ?? []
  const todayEvents = events.filter((ev) => new Date(ev.start_time) < endUtc)
  const futureEvents = events.filter((ev) => new Date(ev.start_time) >= endUtc)

  const energyUsed = todayEvents.reduce((sum, ev) => sum + (ev.energy_cost || 0), 0)
  const pct = Math.max(0, Math.min(100, Math.round(100 - (energyUsed / MAX_DAILY_ENERGY) * 100)))
  const energy = { pct, ...energyTier(pct) }

  const today = {
    weekdayLabel: now.toLocaleDateString('it-IT', { timeZone: TIMEZONE, weekday: 'long' }).toUpperCase(),
    dayNumber: Number(now.toLocaleDateString('en-CA', { timeZone: TIMEZONE }).split('-')[2]),
    events: todayEvents.map((ev) => ({
      title: ev.title,
      timeLabel: `${timeLabel(ev.start_time)}–${timeLabel(ev.end_time)}`,
      colorHex: COLOR_HEX[ev.color] || COLOR_HEX.indigo,
    })),
  }

  const upcoming = []
  for (const ev of futureEvents) {
    const key = localDateKey(ev.start_time)
    let group = upcoming.find((g) => g.key === key)
    if (!group) {
      if (upcoming.length >= UPCOMING_DAY_GROUPS_LIMIT) continue
      group = { key, dateLabel: dayGroupLabel(ev.start_time), events: [] }
      upcoming.push(group)
    }
    group.events.push({
      title: ev.title,
      timeLabel: `${timeLabel(ev.start_time)}–${timeLabel(ev.end_time)}`,
      colorHex: COLOR_HEX[ev.color] || COLOR_HEX.indigo,
    })
  }
  const totalUpcomingEvents = upcoming.reduce((sum, g) => sum + g.events.length, 0)
  if (totalUpcomingEvents > UPCOMING_EVENTS_LIMIT) {
    let remaining = UPCOMING_EVENTS_LIMIT
    for (const g of upcoming) {
      g.events = g.events.slice(0, Math.max(0, remaining))
      remaining -= g.events.length
    }
  }
  const upcomingClean = upcoming.filter((g) => g.events.length > 0).map(({ dateLabel, events }) => ({ dateLabel, events }))

  // Compatibilità con il widget Scriptable (iPhone), che mostra solo il prossimo evento.
  const nextRaw = events.find((ev) => new Date(ev.start_time) >= now)
  const nextEvent = nextRaw
    ? {
        title: nextRaw.title,
        startsAt: nextRaw.start_time,
        startsAtLabel: new Date(nextRaw.start_time).toLocaleString('it-IT', {
          timeZone: TIMEZONE,
          weekday: 'short',
          day: 'numeric',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit',
        }),
      }
    : null

  return new Response(
    JSON.stringify({ energy, today, upcoming: upcomingClean, nextEvent, updatedAt: now.toISOString() }),
    { headers: CORS_HEADERS }
  )
})
