-- Milestone 1.2: Initial Schema & Row Level Security
-- Tables: entries, segments, settings, push_subscriptions

-- 1. Entries table
create table if not exists public.entries (
  id uuid primary key,                       -- generated on the phone so offline retries never duplicate
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  raw_text text not null,                    -- exactly what was typed, never modified
  window_start timestamptz not null,
  window_end timestamptz not null,
  parse_status text not null default 'pending'
    check (parse_status in ('pending','parsed','needs_clarification','failed')),
  clarification_question text,
  follow_ups jsonb not null default '[]'::jsonb,    -- [{question, answer, answered_at}]
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (window_end > window_start)
);

-- Index for newest entries first
create index if not exists entries_window_end_idx on public.entries (window_end desc);
create index if not exists entries_user_id_idx on public.entries (user_id);

-- 2. Segments table
create table if not exists public.segments (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.entries(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  start_time timestamptz not null,
  end_time timestamptz not null,
  activity_label text not null,              -- specific, such as 'doom scrolling'
  category text not null,                    -- broad, from the category list
  confirmed boolean not null default false,
  model text,
  prompt_version text,
  check (end_time > start_time)
);

-- Index for chronological ordering and lookups
create index if not exists segments_start_time_idx on public.segments (start_time);
create index if not exists segments_entry_id_idx on public.segments (entry_id);
create index if not exists segments_user_id_idx on public.segments (user_id);

-- 3. Settings table
create table if not exists public.settings (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  timezone text not null default 'America/Phoenix',
  reminders_enabled boolean not null default true,
  reminder_start_hour int not null default 8,   -- first reminder, local time
  reminder_end_hour int not null default 23,    -- last reminder, local time
  snooze_until timestamptz,
  categories jsonb not null                     -- the editable category list
);

-- 4. Push subscriptions table
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

create index if not exists push_subscriptions_user_id_idx on public.push_subscriptions (user_id);

-- ==========================================
-- ROW LEVEL SECURITY (RLS)
-- Every table allows rows only where user_id = auth.uid()
-- ==========================================

-- Entries RLS
alter table public.entries enable row level security;

create policy "Users can select their own entries"
  on public.entries for select
  using (auth.uid() = user_id);

create policy "Users can insert their own entries"
  on public.entries for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own entries"
  on public.entries for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own entries"
  on public.entries for delete
  using (auth.uid() = user_id);

-- Segments RLS
alter table public.segments enable row level security;

create policy "Users can select their own segments"
  on public.segments for select
  using (auth.uid() = user_id);

create policy "Users can insert their own segments"
  on public.segments for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own segments"
  on public.segments for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own segments"
  on public.segments for delete
  using (auth.uid() = user_id);

-- Settings RLS
alter table public.settings enable row level security;

create policy "Users can select their own settings"
  on public.settings for select
  using (auth.uid() = user_id);

create policy "Users can insert their own settings"
  on public.settings for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own settings"
  on public.settings for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own settings"
  on public.settings for delete
  using (auth.uid() = user_id);

-- Push subscriptions RLS
alter table public.push_subscriptions enable row level security;

create policy "Users can select their own push subscriptions"
  on public.push_subscriptions for select
  using (auth.uid() = user_id);

create policy "Users can insert their own push subscriptions"
  on public.push_subscriptions for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own push subscriptions"
  on public.push_subscriptions for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own push subscriptions"
  on public.push_subscriptions for delete
  using (auth.uid() = user_id);
