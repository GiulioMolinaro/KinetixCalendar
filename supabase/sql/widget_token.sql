alter table user_settings
  add column if not exists widget_token uuid not null default gen_random_uuid() unique;
