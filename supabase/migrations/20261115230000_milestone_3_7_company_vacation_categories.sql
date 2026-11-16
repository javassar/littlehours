-- Milestone 3.7: Categories, company field, and vacation mode
-- Adds company on segments, on_vacation on entries, vacation_mode on settings,
-- updates apply_segments_with_adjustments RPC, renames legacy categories,
-- and updates settings.categories to 25 objects with names and descriptions.

-- 1. Segments company column & GIN index
alter table public.segments add column if not exists company text[] not null default '{}';
create index if not exists segments_company_idx on public.segments using gin (company);

-- 2. Entries on_vacation column
alter table public.entries add column if not exists on_vacation boolean not null default false;

-- 3. Settings vacation_mode column
alter table public.settings add column if not exists vacation_mode boolean not null default false;

-- 4. Update apply_segments_with_adjustments RPC function to preserve company
create or replace function public.apply_segments_with_adjustments(
  p_entry_id uuid,
  p_new_segments jsonb,
  p_adjustments jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security invoker
as $$
declare
  v_user_id uuid := auth.uid();
  v_seg jsonb;
  v_upd jsonb;
  v_del_id text;
  v_inserted_count int := 0;
  v_company text[];
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  -- 1. Apply adjustments to earlier overlapping segments:
  -- A. Deletes (completely swallowed earlier segments)
  if p_adjustments ? 'to_delete' then
    for v_del_id in select jsonb_array_elements_text(p_adjustments->'to_delete') loop
      delete from public.segments
      where id = v_del_id::uuid and user_id = v_user_id;
    end loop;
  end if;

  -- B. Updates (trimmed earlier segments)
  if p_adjustments ? 'to_update' then
    for v_upd in select * from jsonb_array_elements(p_adjustments->'to_update') loop
      update public.segments
      set
        start_time = (v_upd->>'start_time')::timestamptz,
        end_time = (v_upd->>'end_time')::timestamptz
      where id = (v_upd->>'id')::uuid and user_id = v_user_id;
    end loop;
  end if;

  -- C. Inserts (split halves from earlier segments)
  if p_adjustments ? 'to_insert' then
    for v_seg in select * from jsonb_array_elements(p_adjustments->'to_insert') loop
      if v_seg ? 'company' and jsonb_typeof(v_seg->'company') = 'array' then
        select coalesce(array_agg(x), '{}'::text[]) into v_company from jsonb_array_elements_text(v_seg->'company') as x;
      else
        v_company := '{}'::text[];
      end if;

      insert into public.segments (
        id,
        entry_id,
        user_id,
        start_time,
        end_time,
        activity_label,
        category,
        confirmed,
        model,
        prompt_version,
        company
      ) values (
        coalesce((v_seg->>'id')::uuid, gen_random_uuid()),
        (v_seg->>'entry_id')::uuid,
        v_user_id,
        (v_seg->>'start_time')::timestamptz,
        (v_seg->>'end_time')::timestamptz,
        v_seg->>'activity_label',
        v_seg->>'category',
        coalesce((v_seg->>'confirmed')::boolean, true),
        v_seg->>'model',
        coalesce(v_seg->>'prompt_version', 'v2'),
        v_company
      );
    end loop;
  end if;

  -- 2. Delete any existing segments for the entry being confirmed
  delete from public.segments
  where entry_id = p_entry_id and user_id = v_user_id;

  -- 3. Insert new segments for p_entry_id
  for v_seg in select * from jsonb_array_elements(p_new_segments) loop
    if v_seg ? 'company' and jsonb_typeof(v_seg->'company') = 'array' then
      select coalesce(array_agg(x), '{}'::text[]) into v_company from jsonb_array_elements_text(v_seg->'company') as x;
    else
      v_company := '{}'::text[];
    end if;

    insert into public.segments (
      id,
      entry_id,
      user_id,
      start_time,
      end_time,
      activity_label,
      category,
      confirmed,
      model,
      prompt_version,
      company
    ) values (
      coalesce((v_seg->>'id')::uuid, gen_random_uuid()),
      p_entry_id,
      v_user_id,
      (v_seg->>'start_time')::timestamptz,
      (v_seg->>'end_time')::timestamptz,
      v_seg->>'activity_label',
      v_seg->>'category',
      coalesce((v_seg->>'confirmed')::boolean, true),
      v_seg->>'model',
      coalesce(v_seg->>'prompt_version', 'v2'),
      v_company
    );
    v_inserted_count := v_inserted_count + 1;
  end loop;

  -- 4. Update entry parse_status to 'parsed'
  update public.entries
  set
    parse_status = 'parsed',
    clarification_question = null,
    updated_at = now()
  where id = p_entry_id and user_id = v_user_id;

  return jsonb_build_object(
    'success', true,
    'inserted_segments', v_inserted_count
  );
end;
$$;

-- 5. Rename existing category names in segments
update public.segments
set category = 'social media'
where lower(trim(category)) = 'digital media time';

update public.segments
set category = 'hobbies'
where lower(trim(category)) = 'misc hobby';

-- 6. Update settings.categories to the new 25 categories with descriptions
update public.settings
set categories = '[
  {"name": "work", "description": "Paid or assigned work, including freelance work and work for family."},
  {"name": "job search", "description": "Applications, resumes, cover letters, job boards, and interview prep."},
  {"name": "networking", "description": "Conversations or messages with career contacts, including informational chats and follow-ups."},
  {"name": "professional development", "description": "Learning and building skills for my field: courses, tutorials, reading about my field, and portfolio or skill-building projects."},
  {"name": "admin", "description": "Paperwork, money, accounts, scheduling, and inbox upkeep: bills, taxes, forms, passwords, booking and rescheduling. Paperwork that serves one other category belongs to that category (an insurance claim is healthcare, application forms are job search). Never use for tasks that are not paperwork or logistics."},
  {"name": "doomscrolling", "description": "Scrolling any app or site mindlessly or compulsively. Only when the text signals it."},
  {"name": "social media", "description": "Chosen use of apps like Pinterest and BeReal, including browsing, posting, and commenting."},
  {"name": "entertainment", "description": "Chosen content or routine viewing, alone or with others: TV, movies, YouTube videos, podcasts, music, and games. Not a ticketed or invited occasion."},
  {"name": "events", "description": "Ticketed, invited, or formally scheduled occasions: ballet, concerts, theater, weddings, parties, games. Outranks entertainment, social time, and social meals."},
  {"name": "texting", "description": "Messaging with friends and family. Career messages go to networking or job search."},
  {"name": "social time", "description": "Time where interacting with people is the activity: visits, talking, calls and video calls, hanging out."},
  {"name": "sleep", "description": "Sleeping, and lying in bed trying to fall asleep."},
  {"name": "exercise", "description": "Workouts, walks for fitness, sports, and stretching."},
  {"name": "functional meals", "description": "Preparing and eating ordinary meals, alone or with the people I live with. Dishes and cleanup are chores."},
  {"name": "social meals", "description": "Meals out or hosted where the meal is also the social occasion. Formally invited meals are events."},
  {"name": "chores", "description": "Housework inside the home: cleaning, laundry, dishes, tidying."},
  {"name": "errands", "description": "Necessary tasks outside the home: groceries, bank, post office, returns."},
  {"name": "shopping", "description": "Browsing or buying things I want, in store or online."},
  {"name": "reading", "description": "Reading books or long-form pieces for pleasure. Reading about my field is professional development."},
  {"name": "piano", "description": "Playing, practicing, or learning piano."},
  {"name": "hobbies", "description": "Hobbies without their own category: crafts, baking for fun, writing, journaling. Specifics go in the label."},
  {"name": "hygiene", "description": "Daily basics: showering, brushing teeth, getting dressed, skincare routine."},
  {"name": "personal care", "description": "Occasional or discretionary care: hair, nails, spa, massage, self-care sessions."},
  {"name": "healthcare", "description": "Appointments, medication, therapy, and related pharmacy trips."},
  {"name": "vacation", "description": "Everything while on a trip, from leaving home until returning. Overrides all other categories."}
]'::jsonb;
