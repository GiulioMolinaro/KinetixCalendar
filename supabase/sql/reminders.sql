-- Kinetix: supporto promemoria + notifiche push
-- Esegui questo script nell'editor SQL di Supabase (Dashboard -> SQL Editor -> New query)

-- Quando avvisare prima dell'evento (in minuti). NULL = nessun promemoria.
alter table events add column if not exists reminder_minutes integer;
-- Evita di mandare due volte lo stesso promemoria.
alter table events add column if not exists reminder_sent_at timestamptz;

-- Iscrizioni alle notifiche push (una riga per dispositivo/browser)
create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz default now()
);

alter table push_subscriptions enable row level security;

create policy "Users manage their own push subscriptions"
  on push_subscriptions
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
