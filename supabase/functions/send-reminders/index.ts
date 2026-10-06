// Kinetix: manda notifiche push per gli eventi con promemoria in scadenza.
// Va eseguita periodicamente (es. ogni 5 minuti) tramite il Cron di Supabase Edge Functions.
import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY')!
const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY')!

webpush.setVapidDetails('mailto:kinetix@example.com', vapidPublicKey, vapidPrivateKey)

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

    const { data: subs } = await supabase
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth')
      .eq('user_id', ev.user_id)

    for (const sub of subs ?? []) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify({
            title: 'Kinetix',
            body: `${ev.title} inizia tra ${ev.reminder_minutes} minuti`,
            url: '/',
          })
        )
        sent++
      } catch (err) {
        console.error('push fallito:', err)
        if (err?.statusCode === 404 || err?.statusCode === 410) {
          await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
        }
      }
    }

    await supabase.from('events').update({ reminder_sent_at: now.toISOString() }).eq('id', ev.id)
  }

  return new Response(JSON.stringify({ checked: events?.length ?? 0, due, sent }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
