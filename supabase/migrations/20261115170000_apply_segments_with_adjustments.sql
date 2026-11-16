-- Milestone 2.5: Overlapping entries atomic transaction RPC
-- Applies confirmed segments and adjusts earlier overlapping segments in one transaction.
-- Earlier entries' raw_text remains strictly untouched.

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
        prompt_version
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
        coalesce(v_seg->>'prompt_version', 'v2')
      );
    end loop;
  end if;

  -- 2. Delete any existing segments for the entry being confirmed
  delete from public.segments
  where entry_id = p_entry_id and user_id = v_user_id;

  -- 3. Insert new segments for p_entry_id
  for v_seg in select * from jsonb_array_elements(p_new_segments) loop
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
      prompt_version
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
      coalesce(v_seg->>'prompt_version', 'v2')
    );
    v_inserted_count := v_inserted_count + 1;
  end loop;

  -- 4. Update the entry's parse_status to 'parsed' and clear clarification_question
  -- Notice: raw_text is completely untouched!
  update public.entries
  set
    parse_status = 'parsed',
    clarification_question = null,
    updated_at = now()
  where id = p_entry_id and user_id = v_user_id;

  return jsonb_build_object(
    'success', true,
    'entry_id', p_entry_id,
    'inserted_segments_count', v_inserted_count
  );
end;
$$;
