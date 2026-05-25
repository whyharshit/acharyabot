-- Telegram phone login persistence.
-- Apply after 002_farmer_admin_cms_tools.sql.

alter table public.farmer_users
  add column if not exists telegram_user_id bigint unique,
  add column if not exists telegram_chat_id bigint,
  add column if not exists telegram_username text,
  add column if not exists telegram_phone_verified_at timestamptz,
  add column if not exists login_source text not null default 'web';

create index if not exists farmer_users_telegram_user_idx
  on public.farmer_users(telegram_user_id)
  where telegram_user_id is not null;
