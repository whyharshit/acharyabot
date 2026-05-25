-- Farmer Acharya admin/CMS/tools expansion.
-- Apply after 001_farmer_initial_schema.sql.

create table if not exists public.farmer_admin_accounts (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text not null,
  role text not null default 'admin' check (role in ('founder', 'admin', 'editor')),
  is_active boolean not null default true,
  created_by text,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.farmer_quiz_bank (
  id uuid primary key default gen_random_uuid(),
  module_id uuid references public.farmer_modules(id) on delete cascade,
  question_en text not null,
  question_hi text,
  question_bn text,
  options_en jsonb not null default '[]'::jsonb,
  options_hi jsonb not null default '[]'::jsonb,
  options_bn jsonb not null default '[]'::jsonb,
  correct_index int not null default 0,
  explanation_en text,
  explanation_hi text,
  explanation_bn text,
  status text not null default 'draft' check (status in ('draft', 'review', 'published')),
  sort_order int not null default 1,
  is_deleted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.farmer_diary_entries (
  id uuid primary key default gen_random_uuid(),
  learner_id uuid not null references public.farmer_users(id) on delete cascade,
  entry_date date not null default current_date,
  crop text,
  activity text not null,
  expense numeric not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.farmer_videos
  add column if not exists status text not null default 'published'
    check (status in ('draft', 'review', 'published'));

alter table public.farmer_modules
  add column if not exists status text not null default 'published'
    check (status in ('draft', 'review', 'published'));

create index if not exists farmer_admin_accounts_email_idx on public.farmer_admin_accounts(email);
create index if not exists farmer_quiz_bank_module_idx on public.farmer_quiz_bank(module_id, sort_order);
create index if not exists farmer_diary_entries_learner_date_idx on public.farmer_diary_entries(learner_id, entry_date desc);

alter table public.farmer_admin_accounts enable row level security;
alter table public.farmer_quiz_bank enable row level security;
alter table public.farmer_diary_entries enable row level security;
