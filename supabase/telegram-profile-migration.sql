-- Add the public Telegram profile fields used by the internal follow-up dashboard.
-- Safe to run more than once in Supabase SQL Editor.

alter table public.user_profiles add column if not exists telegram_username text;
alter table public.user_profiles add column if not exists telegram_first_name text;
alter table public.user_profiles add column if not exists telegram_last_name text;
