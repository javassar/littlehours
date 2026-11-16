-- Milestone 3.7: Hourly pain rating (1 to 5)
-- Creates pain_ratings table with RLS and foreign key to entries (on delete set null)

create table if not exists public.pain_ratings (
  id uuid primary key,                         -- generated on the phone so offline retries never duplicate
  user_id uuid not null default auth.uid() references auth.users(id),
  entry_id uuid references public.entries(id) on delete set null,   -- kept if the entry is deleted
  rating smallint not null check (rating between 1 and 5),
  rated_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists pain_ratings_rated_at_idx on public.pain_ratings (rated_at desc);
create index if not exists pain_ratings_entry_id_idx on public.pain_ratings (entry_id);
create index if not exists pain_ratings_user_id_idx on public.pain_ratings (user_id);

alter table public.pain_ratings enable row level security;

create policy "own ratings" on public.pain_ratings
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
