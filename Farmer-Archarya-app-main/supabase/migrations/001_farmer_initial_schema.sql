-- Farmer Acharya standalone schema for a fresh Supabase project.
-- Run this in Supabase SQL Editor or through scripts/apply-sql.js with a Supabase PAT.

create extension if not exists pgcrypto;

create table if not exists public.farmer_users (
  id uuid primary key default gen_random_uuid(),
  phone text not null unique,
  name text,
  role text not null default 'learner',
  is_admin boolean not null default false,
  preferred_lang text not null default 'en' check (preferred_lang in ('en', 'hi', 'bn')),
  farm_profile jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  is_deleted boolean not null default false,
  last_seen_on timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.farmer_modules (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title_en text not null,
  title_hi text,
  title_bn text,
  icon text not null default 'leaf',
  theory_hours numeric not null default 1,
  practical_hours numeric not null default 1,
  sort_order int not null,
  group_key text not null default 'core',
  group_label_en text,
  group_label_hi text,
  group_label_bn text,
  is_deleted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.farmer_sections (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.farmer_modules(id) on delete cascade,
  slug text,
  title_en text not null,
  title_hi text,
  title_bn text,
  body_en text,
  body_hi text,
  body_bn text,
  status text not null default 'published' check (status in ('draft', 'review', 'published')),
  sort_order int not null default 1,
  estimated_hours numeric not null default 1,
  is_deleted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.farmer_videos (
  id uuid primary key default gen_random_uuid(),
  module_id uuid references public.farmer_modules(id) on delete cascade,
  youtube_id text not null,
  title_en text not null,
  title_hi text,
  title_bn text,
  duration text,
  start_seconds int,
  sort_order int not null default 1,
  is_deleted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.farmer_progress (
  id uuid primary key default gen_random_uuid(),
  learner_id uuid not null references public.farmer_users(id) on delete cascade,
  module_id uuid not null references public.farmer_modules(id) on delete cascade,
  sections_completed text[] not null default '{}',
  completed boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (learner_id, module_id)
);

create table if not exists public.farmer_quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  learner_id uuid not null references public.farmer_users(id) on delete cascade,
  module_id uuid references public.farmer_modules(id) on delete set null,
  score int not null,
  total int not null,
  questions jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.farmer_chat_logs (
  id uuid primary key default gen_random_uuid(),
  learner_id uuid references public.farmer_users(id) on delete set null,
  module_id uuid references public.farmer_modules(id) on delete set null,
  lang text check (lang in ('en', 'hi', 'bn')),
  user_message text,
  ai_response text,
  response_time_ms int,
  created_at timestamptz not null default now()
);

create table if not exists public.farmer_events (
  id uuid primary key default gen_random_uuid(),
  learner_id uuid references public.farmer_users(id) on delete set null,
  event_type text not null,
  event_data jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.farmer_apply_logs (
  id uuid primary key default gen_random_uuid(),
  learner_id uuid references public.farmer_users(id) on delete set null,
  module_id uuid references public.farmer_modules(id) on delete set null,
  log_type text not null default 'self_assessment',
  data jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.farmer_ai_usage (
  id uuid primary key default gen_random_uuid(),
  ts timestamptz not null default now(),
  service text not null,
  model text not null,
  status text not null,
  duration_ms int,
  input_tokens int,
  output_tokens int,
  cached_input_tokens int,
  chars int,
  lang text,
  acharya_slug text not null default 'farmer',
  has_image boolean not null default false,
  cost_usd numeric not null default 0,
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists farmer_modules_sort_idx on public.farmer_modules(sort_order);
create index if not exists farmer_sections_module_sort_idx on public.farmer_sections(module_id, sort_order);
create index if not exists farmer_progress_learner_idx on public.farmer_progress(learner_id);
create index if not exists farmer_chat_logs_learner_created_idx on public.farmer_chat_logs(learner_id, created_at desc);
create index if not exists farmer_events_learner_created_idx on public.farmer_events(learner_id, created_at desc);

alter table public.farmer_users enable row level security;
alter table public.farmer_modules enable row level security;
alter table public.farmer_sections enable row level security;
alter table public.farmer_videos enable row level security;
alter table public.farmer_progress enable row level security;
alter table public.farmer_quiz_attempts enable row level security;
alter table public.farmer_chat_logs enable row level security;
alter table public.farmer_events enable row level security;
alter table public.farmer_apply_logs enable row level security;
alter table public.farmer_ai_usage enable row level security;

-- Seed starter modules. Hindi/Bengali titles can be improved later by a human reviewer.
insert into public.farmer_modules (slug, title_en, title_hi, title_bn, icon, theory_hours, practical_hours, sort_order, group_key, group_label_en)
values
('M00-welcome', 'Welcome to Farmer Acharya', 'Farmer Acharya में आपका स्वागत है', 'Farmer Acharya-তে স্বাগতম', 'leaf', 0.5, 0.5, 0, 'orientation', 'Orientation'),
('M01-know-your-farm', 'Know Your Farm', 'अपने खेत को समझें', 'নিজের খামারকে জানুন', 'pin', 1, 1, 1, 'foundation', 'Foundation'),
('M02-soil-health', 'Soil Health Basics', 'मिट्टी स्वास्थ्य की बुनियाद', 'মাটির স্বাস্থ্য', 'leaf', 1, 1, 2, 'foundation', 'Foundation'),
('M03-soil-testing', 'Soil Testing and Soil Health Card', 'मिट्टी जांच और सॉयल हेल्थ कार्ड', 'মাটি পরীক্ষা ও সয়েল হেলথ কার্ড', 'quiz', 1, 1, 3, 'foundation', 'Foundation'),
('M04-seed-selection', 'Seed Selection', 'बीज चयन', 'বীজ নির্বাচন', 'sparkle', 1, 1, 4, 'crop-start', 'Crop Start'),
('M05-seed-treatment-nursery', 'Seed Treatment and Nursery Raising', 'बीज उपचार और नर्सरी', 'বীজ শোধন ও নার্সারি', 'leaf', 1, 1.5, 5, 'crop-start', 'Crop Start'),
('M06-land-preparation', 'Land Preparation', 'खेत की तैयारी', 'জমি প্রস্তুতি', 'stack', 1, 1.5, 6, 'crop-start', 'Crop Start'),
('M07-sowing-transplanting', 'Sowing and Transplanting', 'बुवाई और रोपाई', 'বপন ও চারা রোপণ', 'hand', 1, 1.5, 7, 'crop-start', 'Crop Start'),
('M08-irrigation-basics', 'Irrigation Basics', 'सिंचाई की बुनियाद', 'সেচের বুনিয়াদ', 'wave', 1, 1, 8, 'crop-care', 'Crop Care'),
('M09-water-saving', 'Drip, Sprinkler, and Water Saving', 'ड्रिप, स्प्रिंकलर और पानी बचत', 'ড্রিপ, স্প্রিঙ্কলার ও জল সাশ্রয়', 'wave', 1, 1, 9, 'crop-care', 'Crop Care'),
('M10-fertilizer-basics', 'Fertilizer Basics', 'उर्वरक की बुनियाद', 'সারের বুনিয়াদ', 'stack', 1, 1, 10, 'crop-care', 'Crop Care'),
('M11-organic-manures', 'Compost, FYM, and Vermicompost', 'कम्पोस्ट, गोबर खाद और वर्मी कम्पोस्ट', 'কম্পোস্ট, গোবর সার ও ভার্মি কম্পোস্ট', 'leaf', 1, 1, 11, 'crop-care', 'Crop Care'),
('M12-weed-management', 'Weed Management', 'खरपतवार प्रबंधन', 'আগাছা ব্যবস্থাপনা', 'hand', 1, 1, 12, 'crop-care', 'Crop Care'),
('M13-pest-identification', 'Pest Identification', 'कीट पहचान', 'পোকা শনাক্তকরণ', 'target', 1, 1, 13, 'protection', 'Protection'),
('M14-disease-identification', 'Disease Identification', 'रोग पहचान', 'রোগ শনাক্তকরণ', 'target', 1, 1, 14, 'protection', 'Protection'),
('M15-ipm', 'Integrated Pest Management', 'समेकित कीट प्रबंधन', 'সমন্বিত পোকা ব্যবস্থাপনা', 'target', 1, 1, 15, 'protection', 'Protection'),
('M16-pesticide-safety', 'Safe Pesticide Use and PPE', 'सुरक्षित कीटनाशक उपयोग और पीपीई', 'নিরাপদ কীটনাশক ব্যবহার ও পিপিই', 'check', 1, 1, 16, 'protection', 'Protection'),
('M17-crop-calendar', 'Crop Calendar Planning', 'फसल कैलेंडर योजना', 'ফসল ক্যালেন্ডার পরিকল্পনা', 'calendar', 1, 1, 17, 'planning', 'Planning'),
('M18-vegetables', 'Vegetable Farming Basics', 'सब्जी खेती की बुनियाद', 'সবজি চাষের বুনিয়াদ', 'leaf', 1, 1, 18, 'crops', 'Crops'),
('M19-paddy', 'Paddy/Rice Basics', 'धान की बुनियाद', 'ধান চাষের বুনিয়াদ', 'leaf', 1, 1, 19, 'crops', 'Crops'),
('M20-field-crops', 'Wheat, Maize, and Pulses', 'गेहूं, मक्का और दालें', 'গম, ভুট্টা ও ডাল', 'leaf', 1, 1, 20, 'crops', 'Crops'),
('M21-horticulture', 'Horticulture and Fruit Crops', 'बागवानी और फल फसलें', 'উদ্যানপালন ও ফল ফসল', 'leaf', 1, 1, 21, 'crops', 'Crops'),
('M22-post-harvest', 'Post-Harvest Handling', 'कटाई के बाद प्रबंधन', 'ফসল কাটার পর ব্যবস্থাপনা', 'stack', 1, 1, 22, 'market', 'Market'),
('M23-market-linkage', 'Market Linkage and Better Selling', 'बाजार जुड़ाव और बेहतर बिक्री', 'বাজার সংযোগ ও ভালো বিক্রি', 'rupee', 1, 1, 23, 'market', 'Market'),
('M24-records-profit', 'Farm Records, Costing, and Profit', 'रिकॉर्ड, लागत और लाभ', 'রেকর্ড, খরচ ও লাভ', 'chart', 1, 1, 24, 'market', 'Market')
on conflict (slug) do update set
  title_en = excluded.title_en,
  title_hi = excluded.title_hi,
  title_bn = excluded.title_bn,
  sort_order = excluded.sort_order,
  updated_at = now();

insert into public.farmer_sections (module_id, slug, title_en, title_hi, title_bn, body_en, body_hi, body_bn, sort_order, estimated_hours)
select
  m.id,
  m.slug || '-basics',
  m.title_en || ' - Field Notes',
  coalesce(m.title_hi, m.title_en) || ' - Field Notes',
  coalesce(m.title_bn, m.title_en) || ' - Field Notes',
  'This starter lesson gives practical field guidance for ' || lower(m.title_en) || '. Observe your crop, note soil and water conditions, record what you did, and ask Farmer Acharya when you need a crop-specific next step. For chemical or fertilizer decisions, follow the product label and local agriculture officer or KVK guidance.',
  'यह शुरुआती पाठ ' || coalesce(m.title_hi, m.title_en) || ' पर व्यावहारिक मार्गदर्शन देता है। फसल देखें, मिट्टी और पानी की स्थिति नोट करें, अपना काम रिकॉर्ड करें, और जरूरत हो तो Farmer Acharya से अगला कदम पूछें। रसायन या उर्वरक के लिए लेबल और स्थानीय कृषि अधिकारी/KVK की सलाह मानें।',
  'এই প্রাথমিক পাঠটি ' || coalesce(m.title_bn, m.title_en) || ' নিয়ে ব্যবহারিক মাঠের নির্দেশনা দেয়। ফসল দেখুন, মাটি ও জলের অবস্থা লিখুন, কী কাজ করেছেন রেকর্ড করুন, এবং দরকার হলে Farmer Acharya-কে পরের পদক্ষেপ জিজ্ঞাসা করুন। রাসায়নিক বা সারের ক্ষেত্রে লেবেল ও স্থানীয় কৃষি আধিকারিক/KVK-এর পরামর্শ অনুসরণ করুন।',
  1,
  1
from public.farmer_modules m
where not exists (
  select 1 from public.farmer_sections s where s.module_id = m.id
);

