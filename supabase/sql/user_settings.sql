-- Kinetix: impostazioni utente (API key personale, tema, foto profilo)

create table if not exists user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  gemini_api_key text,
  theme text not null default 'dark' check (theme in ('dark', 'light')),
  avatar_url text,
  updated_at timestamptz not null default now()
);

alter table user_settings enable row level security;

create policy "Users manage their own settings"
  on user_settings for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Storage bucket per le foto profilo (pubblico in lettura, scrittura solo nella propria cartella)
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy "Avatar images are publicly accessible"
  on storage.objects for select
  using (bucket_id = 'avatars');

create policy "Users can upload their own avatar"
  on storage.objects for insert
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users can update their own avatar"
  on storage.objects for update
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users can delete their own avatar"
  on storage.objects for delete
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
