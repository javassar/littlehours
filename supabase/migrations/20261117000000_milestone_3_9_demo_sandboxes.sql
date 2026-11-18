-- Milestone 3.9: Demo mode with per-visitor sandboxes

-- 1. Usage counter tables (RLS enabled, accessible ONLY by service role)
create table if not exists public.demo_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  usage_date date not null,
  parse_count int not null default 0,
  reset_count int not null default 0,
  primary key (user_id, usage_date)
);

create table if not exists public.demo_global_usage (
  usage_date date primary key,
  parse_count int not null default 0
);

alter table public.demo_usage enable row level security;
alter table public.demo_global_usage enable row level security;

-- 2. Atomic increment function for demo parses, callable only by service_role
create or replace function public.increment_demo_usage(
  p_user uuid,
  p_user_cap int,
  p_global_cap int
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := (now() at time zone 'utc')::date;
  v_user_count int := 0;
  v_global_count int := 0;
begin
  -- 1. Lock and check global usage
  insert into public.demo_global_usage (usage_date, parse_count)
  values (v_today, 0)
  on conflict (usage_date) do nothing;

  select parse_count into v_global_count
  from public.demo_global_usage
  where usage_date = v_today
  for update;

  if v_global_count >= p_global_cap then
    return jsonb_build_object(
      'allowed', false,
      'scope', 'global',
      'user_count', v_user_count,
      'global_count', v_global_count
    );
  end if;

  -- 2. Lock and check user usage
  insert into public.demo_usage (user_id, usage_date, parse_count, reset_count)
  values (p_user, v_today, 0, 0)
  on conflict (user_id, usage_date) do nothing;

  select parse_count into v_user_count
  from public.demo_usage
  where user_id = p_user and usage_date = v_today
  for update;

  if v_user_count >= p_user_cap then
    return jsonb_build_object(
      'allowed', false,
      'scope', 'user',
      'user_count', v_user_count,
      'global_count', v_global_count
    );
  end if;

  -- 3. Increment both counters
  update public.demo_global_usage
  set parse_count = parse_count + 1
  where usage_date = v_today
  returning parse_count into v_global_count;

  update public.demo_usage
  set parse_count = parse_count + 1
  where user_id = p_user and usage_date = v_today
  returning parse_count into v_user_count;

  return jsonb_build_object(
    'allowed', true,
    'scope', null,
    'user_count', v_user_count,
    'global_count', v_global_count
  );
end;
$$;

revoke all on function public.increment_demo_usage(uuid, int, int) from public, anon, authenticated;
grant execute on function public.increment_demo_usage(uuid, int, int) to service_role;

-- 3. Delete expired demo users and cleanup old usage data
create or replace function public.delete_expired_demo_users(
  retention interval default interval '7 days'
)
returns int
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_ids uuid[];
  v_deleted_count int := 0;
begin
  -- Identify anonymous users older than retention period
  select coalesce(array_agg(id), '{}')
  into v_user_ids
  from auth.users
  where coalesce(is_anonymous, false) = true
    and created_at < (now() - retention);

  v_deleted_count := cardinality(v_user_ids);

  if v_deleted_count > 0 then
    -- Delete in exact specified order:
    -- pain_ratings, segments, entries, push_subscriptions, settings, demo_usage, auth.users
    delete from public.pain_ratings where user_id = any(v_user_ids);
    delete from public.segments where user_id = any(v_user_ids);
    delete from public.entries where user_id = any(v_user_ids);
    delete from public.push_subscriptions where user_id = any(v_user_ids);
    delete from public.settings where user_id = any(v_user_ids);
    delete from public.demo_usage where user_id = any(v_user_ids);
    delete from auth.users where id = any(v_user_ids);
  end if;

  -- Clean up stale usage rows:
  -- demo_usage older than 14 days, demo_global_usage older than 30 days
  delete from public.demo_usage
  where usage_date < ((now() at time zone 'utc')::date - 14);

  delete from public.demo_global_usage
  where usage_date < ((now() at time zone 'utc')::date - 30);

  return v_deleted_count;
end;
$$;

revoke all on function public.delete_expired_demo_users(interval) from public, anon, authenticated;
grant execute on function public.delete_expired_demo_users(interval) to service_role, postgres;

-- 4. Replace push_subscriptions insert policy to disallow anonymous users
drop policy if exists "Users can insert their own push subscriptions" on public.push_subscriptions;

create policy "Users can insert their own push subscriptions"
  on public.push_subscriptions for insert
  with check (
    auth.uid() = user_id
    and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
  );

-- 5. Schedule daily cleanup job at 03:00 UTC with pg_cron
do $$
begin
  perform cron.unschedule('daily-cleanup-demo-users')
  where exists (
    select 1 from cron.job where jobname = 'daily-cleanup-demo-users'
  );
exception
  when others then null;
end $$;

select cron.schedule(
  'daily-cleanup-demo-users',
  '0 3 * * *',
  'select public.delete_expired_demo_users();'
);
