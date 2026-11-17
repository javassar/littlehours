-- Milestone 3.3: Scheduled hourly job to trigger send-reminders Edge Function

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

-- Function to trigger send-reminders via net.http_post
create or replace function public.trigger_send_reminders()
returns void
language plpgsql
security definer
as $$
declare
  project_url text := 'https://ncpmzcqrfkbgbsvjiokt.supabase.co';
  anon_key text := 'sb_publishable_4qonrly7ikvAxEyda6o0sw_seGylVXL';
begin
  perform net.http_post(
    url := project_url || '/functions/v1/send-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', anon_key,
      'Authorization', 'Bearer ' || anon_key
    ),
    body := '{}'::jsonb
  );
end;
$$;

-- Remove existing scheduled job if present
do $$
begin
  perform cron.unschedule('hourly-send-reminders')
  where exists (
    select 1 from cron.job where jobname = 'hourly-send-reminders'
  );
exception
  when others then null;
end $$;

-- Schedule the job to run at the top of every hour (0 * * * *, UTC)
select cron.schedule(
  'hourly-send-reminders',
  '0 * * * *',
  'select public.trigger_send_reminders();'
);
