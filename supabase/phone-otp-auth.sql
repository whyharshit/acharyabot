create table if not exists public.phone_otps (
  id uuid primary key default gen_random_uuid(),
  phone text not null,
  otp_hash text not null,
  attempts int not null default 0,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists phone_otps_phone_created_at_idx
on public.phone_otps(phone, created_at desc);

create index if not exists phone_otps_cleanup_idx
on public.phone_otps(expires_at)
where consumed_at is null;

alter table public.phone_otps enable row level security;
