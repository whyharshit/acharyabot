-- Remove the earlier Telegram OTP table now that Telegram login is phone-only.

drop table if exists public.farmer_telegram_login_otps;
