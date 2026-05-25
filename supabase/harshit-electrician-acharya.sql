create extension if not exists pgcrypto;

create table if not exists public.learners (
  id uuid primary key default gen_random_uuid(),
  phone text not null unique,
  name text not null default '',
  role text not null default 'learner',
  preferred_lang text not null default 'en',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz
);

create table if not exists public.modules (
  id text primary key,
  title_bn text not null,
  title_hi text not null,
  title_en text not null,
  icon text not null default 'book',
  theory_hours numeric not null default 1,
  practical_hours numeric not null default 1,
  sort_order int not null,
  group_key text not null default 'electrician',
  group_label_bn text,
  group_label_hi text,
  group_label_en text
);

create table if not exists public.sections (
  id text primary key,
  module_id text not null references public.modules(id) on delete cascade,
  title_bn text not null,
  title_hi text not null,
  title_en text not null,
  body_bn text not null,
  body_hi text not null,
  body_en text not null,
  estimated_hours numeric not null default 1,
  sort_order int not null
);

create table if not exists public.videos (
  id text primary key,
  module_id text not null references public.modules(id) on delete cascade,
  youtube_id text not null,
  title_bn text not null,
  title_hi text not null,
  title_en text not null,
  duration text,
  start_seconds int,
  sort_order int not null default 1
);

create table if not exists public.progress (
  id uuid primary key default gen_random_uuid(),
  learner_id uuid not null references public.learners(id) on delete cascade,
  module_id text not null references public.modules(id) on delete cascade,
  sections_completed text[] not null default '{}',
  completed boolean not null default false,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (learner_id, module_id)
);

create table if not exists public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  learner_id uuid not null references public.learners(id) on delete cascade,
  module_id text not null references public.modules(id) on delete cascade,
  score numeric not null,
  total numeric not null,
  questions jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.chat_logs (
  id uuid primary key default gen_random_uuid(),
  learner_id uuid not null references public.learners(id) on delete cascade,
  module_id text references public.modules(id) on delete set null,
  lang text not null default 'en',
  user_message text not null,
  ai_response text not null,
  response_time_ms int,
  created_at timestamptz not null default now()
);

create table if not exists public.apply_logs (
  id uuid primary key default gen_random_uuid(),
  learner_id uuid not null references public.learners(id) on delete cascade,
  module_id text references public.modules(id) on delete set null,
  input text not null,
  score numeric not null,
  feedback text not null,
  next_step text not null,
  has_photo boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.log_ai_usage (
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
  acharya_id uuid,
  has_image boolean not null default false,
  cost_usd numeric not null default 0,
  error_message text
);

alter table public.learners enable row level security;
alter table public.modules enable row level security;
alter table public.sections enable row level security;
alter table public.videos enable row level security;
alter table public.progress enable row level security;
alter table public.quiz_attempts enable row level security;
alter table public.chat_logs enable row level security;
alter table public.apply_logs enable row level security;
alter table public.log_ai_usage enable row level security;

insert into public.modules
  (id, title_bn, title_hi, title_en, icon, theory_hours, practical_hours, sort_order, group_key, group_label_bn, group_label_hi, group_label_en)
values
  ('M01-safety', 'Electrical Safety Basics', 'Electrical Safety Basics', 'Electrical Safety Basics', 'sparkle', 1, 2, 1, 'foundation', 'Foundation', 'Foundation', 'Foundation'),
  ('M02-tools', 'Tools and Testers', 'Tools and Testers', 'Tools and Testers', 'pencil', 1, 2, 2, 'foundation', 'Foundation', 'Foundation', 'Foundation'),
  ('M03-wires', 'Wires and Cable Sizing', 'Wires and Cable Sizing', 'Wires and Cable Sizing', 'wave', 2, 3, 3, 'wiring', 'Wiring', 'Wiring', 'Wiring'),
  ('M04-switchboards', 'Switches, Sockets and Boards', 'Switches, Sockets and Boards', 'Switches, Sockets and Boards', 'stack', 2, 4, 4, 'wiring', 'Wiring', 'Wiring', 'Wiring'),
  ('M05-protection', 'MCB, RCCB and DB Basics', 'MCB, RCCB and DB Basics', 'MCB, RCCB and DB Basics', 'target', 2, 3, 5, 'protection', 'Protection', 'Protection', 'Protection'),
  ('M06-fault-finding', 'Fault Finding', 'Fault Finding', 'Fault Finding', 'bell', 2, 4, 6, 'service', 'Service', 'Service', 'Service'),
  ('M07-earthing', 'Earthing and Testing', 'Earthing and Testing', 'Earthing and Testing', 'pin', 1, 3, 7, 'protection', 'Protection', 'Protection', 'Protection'),
  ('M08-load', 'Load Calculation', 'Load Calculation', 'Load Calculation', 'chart', 1, 2, 8, 'service', 'Service', 'Service', 'Service')
on conflict (id) do update set
  title_en = excluded.title_en,
  sort_order = excluded.sort_order;

insert into public.sections
  (id, module_id, title_bn, title_hi, title_en, body_bn, body_hi, body_en, estimated_hours, sort_order)
values
  ('S01-01', 'M01-safety', 'Main supply off first', 'Main supply off first', 'Main supply off first',
   'Before opening any board, switch off the main supply. Use a tester or multimeter to confirm there is no voltage. Never trust only the switch position.',
   'Before opening any board, switch off the main supply. Use a tester or multimeter to confirm there is no voltage. Never trust only the switch position.',
   'Before opening any board, switch off the main supply. Use a tester or multimeter to confirm there is no voltage. Never trust only the switch position.', 1, 1),
  ('S01-02', 'M01-safety', 'PPE and unsafe signs', 'PPE and unsafe signs', 'PPE and unsafe signs',
   'Use insulated tools, dry footwear, gloves where needed, and proper lighting. Stop work if you see sparking, smoke, burning smell, wet wiring, or damaged insulation.',
   'Use insulated tools, dry footwear, gloves where needed, and proper lighting. Stop work if you see sparking, smoke, burning smell, wet wiring, or damaged insulation.',
   'Use insulated tools, dry footwear, gloves where needed, and proper lighting. Stop work if you see sparking, smoke, burning smell, wet wiring, or damaged insulation.', 1, 2),
  ('S02-01', 'M02-tools', 'Basic electrician tools', 'Basic electrician tools', 'Basic electrician tools',
   'A helper should know screwdriver, combination plier, nose plier, wire stripper, insulation tape, tester, multimeter, clamp meter, drill, rawl plug, screw and ferrule.',
   'A helper should know screwdriver, combination plier, nose plier, wire stripper, insulation tape, tester, multimeter, clamp meter, drill, rawl plug, screw and ferrule.',
   'A helper should know screwdriver, combination plier, nose plier, wire stripper, insulation tape, tester, multimeter, clamp meter, drill, rawl plug, screw and ferrule.', 1, 1),
  ('S03-01', 'M03-wires', 'Wire size basics', 'Wire size basics', 'Wire size basics',
   'Lighting circuits commonly use smaller wire than power sockets. High-load appliances like AC or geyser need suitable wire size, proper MCB rating, and dedicated wiring.',
   'Lighting circuits commonly use smaller wire than power sockets. High-load appliances like AC or geyser need suitable wire size, proper MCB rating, and dedicated wiring.',
   'Lighting circuits commonly use smaller wire than power sockets. High-load appliances like AC or geyser need suitable wire size, proper MCB rating, and dedicated wiring.', 1, 1),
  ('S04-01', 'M04-switchboards', 'Switchboard inspection', 'Switchboard inspection', 'Switchboard inspection',
   'After isolating power, check for loose screws, black marks, melted plastic, wrong wire stripping, exposed copper, and overloaded sockets.',
   'After isolating power, check for loose screws, black marks, melted plastic, wrong wire stripping, exposed copper, and overloaded sockets.',
   'After isolating power, check for loose screws, black marks, melted plastic, wrong wire stripping, exposed copper, and overloaded sockets.', 1, 1),
  ('S05-01', 'M05-protection', 'MCB and RCCB difference', 'MCB and RCCB difference', 'MCB and RCCB difference',
   'An MCB protects mainly against overload and short circuit. An RCCB helps protect against earth leakage. Both must be selected and installed correctly.',
   'An MCB protects mainly against overload and short circuit. An RCCB helps protect against earth leakage. Both must be selected and installed correctly.',
   'An MCB protects mainly against overload and short circuit. An RCCB helps protect against earth leakage. Both must be selected and installed correctly.', 1, 1),
  ('S06-01', 'M06-fault-finding', 'No power complaint', 'No power complaint', 'No power complaint',
   'For no power, first check supply, MCB position, voltage at input, voltage at output, loose neutral, and local switch/socket condition. Confirm each step before replacing parts.',
   'For no power, first check supply, MCB position, voltage at input, voltage at output, loose neutral, and local switch/socket condition. Confirm each step before replacing parts.',
   'For no power, first check supply, MCB position, voltage at input, voltage at output, loose neutral, and local switch/socket condition. Confirm each step before replacing parts.', 1, 1),
  ('S07-01', 'M07-earthing', 'Why earthing matters', 'Why earthing matters', 'Why earthing matters',
   'Earthing gives leakage current a safer path and helps protective devices operate. Poor earthing can make metal appliance bodies dangerous.',
   'Earthing gives leakage current a safer path and helps protective devices operate. Poor earthing can make metal appliance bodies dangerous.',
   'Earthing gives leakage current a safer path and helps protective devices operate. Poor earthing can make metal appliance bodies dangerous.', 1, 1),
  ('S08-01', 'M08-load', 'Avoid overload', 'Avoid overload', 'Avoid overload',
   'Do not run many high-load appliances from one socket or extension board. Estimate load, check wire size and MCB rating, and use dedicated circuits where required.',
   'Do not run many high-load appliances from one socket or extension board. Estimate load, check wire size and MCB rating, and use dedicated circuits where required.',
   'Do not run many high-load appliances from one socket or extension board. Estimate load, check wire size and MCB rating, and use dedicated circuits where required.', 1, 1)
on conflict (id) do update set
  title_en = excluded.title_en,
  body_en = excluded.body_en,
  sort_order = excluded.sort_order;

