// Kinetix: manda notifiche push per gli eventi e i to-do con promemoria in scadenza.
// Va eseguita periodicamente (es. ogni 5 minuti) tramite il Cron di Supabase Edge Functions.
import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY')!
const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY')!

webpush.setVapidDetails('mailto:kinetix@example.com', vapidPublicKey, vapidPrivateKey)

// "15 minuti", "1 ora", "2 giorni"... per il testo della notifica.
function formatLead(minutes: number) {
  if (minutes % 1440 === 0) return minutes === 1440 ? '1 giorno' : `${minutes / 1440} giorni`
  if (minutes % 60 === 0) return minutes === 60 ? '1 ora' : `${minutes / 60} ore`
  return `${minutes} minuti`
}

// Manda una notifica a tutti i dispositivi dell'utente, ripulendo le iscrizioni scadute.
// deno-lint-ignore no-explicit-any
async function sendToUser(supabase: any, userId: string, body: string) {
  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .eq('user_id', userId)

  let sent = 0
  for (const sub of subs ?? []) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify({ title: 'Kinetix', body, url: '/' })
      )
      sent++
    } catch (err) {
      console.error('push fallito:', err)
      if (err?.statusCode === 404 || err?.statusCode === 410) {
        await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
      }
    }
  }
  return sent
}

Deno.serve(async () => {
  const supabase = createClient(supabaseUrl, serviceRoleKey)
  const now = new Date()

  // Eventi futuri con promemoria non ancora inviato.
  const { data: events, error } = await supabase
    .from('events')
    .select('id, user_id, title, start_time, reminder_minutes')
    .not('reminder_minutes', 'is', null)
    .is('reminder_sent_at', null)
    .gte('start_time', now.toISOString())

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }

  let sent = 0
  let due = 0

  for (const ev of events ?? []) {
    const reminderTime = new Date(new Date(ev.start_time).getTime() - ev.reminder_minutes * 60000)
    if (reminderTime > now) continue // non è ancora il momento
    due++

    sent += await sendToUser(supabase, ev.user_id, `${ev.title} inizia tra ${ev.reminder_minutes} minuti`)

    await supabase.from('events').update({ reminder_sent_at: now.toISOString() }).eq('id', ev.id)
  }

  // To-do non completati con scadenza futura e promemoria non ancora inviato.
  const { data: todos, error: todosError } = await supabase
    .from('todos')
    .select('id, user_id, title, due_at, reminder_minutes')
    .not('reminder_minutes', 'is', null)
    .is('reminder_sent_at', null)
    .eq('done', false)
    // Margine di 15 minuti: con "alla scadenza" il cron gira quasi sempre un po' dopo due_at.
    .gte('due_at', new Date(now.getTime() - 15 * 60000).toISOString())

  if (todosError) {
    return new Response(JSON.stringify({ error: todosError.message }), { status: 500 })
  }

  for (const todo of todos ?? []) {
    const reminderTime = new Date(new Date(todo.due_at).getTime() - todo.reminder_minutes * 60000)
    if (reminderTime > now) continue
    due++

    const body = todo.reminder_minutes === 0
      ? `Scade ora: ${todo.title}`
      : `${todo.title} scade tra ${formatLead(todo.reminder_minutes)}`
    sent += await sendToUser(supabase, todo.user_id, body)

    await supabase.from('todos').update({ reminder_sent_at: now.toISOString() }).eq('id', todo.id)
  }

  return new Response(JSON.stringify({ checked: (events?.length ?? 0) + (todos?.length ?? 0), due, sent }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
