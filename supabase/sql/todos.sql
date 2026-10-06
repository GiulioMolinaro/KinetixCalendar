-- Kinetix: lista di cose da fare (to-do) con scadenza e promemoria opzionali
-- Esegui questo script nell'editor SQL di Supabase (Dashboard -> SQL Editor -> New query)

create table if not exists todos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null,
  notes text,
  -- Scadenza opzionale. NULL = nessuna scadenza.
  due_at timestamptz,
  done boolean not null default false,
  done_at timestamptz,
  -- Quanto prima della scadenza avvisare (in minuti). NULL = nessun promemoria.
  reminder_minutes integer,
  -- Evita di mandare due volte lo stesso promemoria.
  reminder_sent_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists todos_user_id_idx on todos (user_id);
create index if not exists todos_pending_reminders_idx on todos (due_at)
  where reminder_minutes is not null and reminder_sent_at is null and done = false;

alter table todos enable row level security;

create policy "Users manage their own todos"
  on todos for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
