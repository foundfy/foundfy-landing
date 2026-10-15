-- Foundfy RESEARCH filter provenance.
-- Does not recreate RESEARCH tables. Does not modify 020, 021, or 022.
-- Adds filterReasonCounts to persist_research_request_result ledger writes.
-- Historical ledger entries without filterReasonCounts remain readable as unknown.
--
-- Three unique PostgREST signatures, no defaults:
--   12-arg implementation: p_provider_result_count and p_filter_reason_counts are REQUIRED
--   11-arg wrapper: currently deployed app payload; delegates NULL filter counts
--   10-arg wrapper: oldest app payload; delegates NULL provenance
-- Named 10-, 11-, and 12-argument calls cannot be ambiguous.

create or replace function public.persist_research_request_result(
  p_run_id uuid,
  p_website_id uuid,
  p_execution_generation bigint,
  p_request_key text,
  p_status text,
  p_provider_task_id text,
  p_idea_count integer,
  p_provider_cost numeric,
  p_failure_code text,
  p_ideas jsonb,
  p_provider_result_count integer,
  p_filter_reason_counts jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  rec public.research_runs%rowtype;
  fingerprint text;
  idx integer;
  entry jsonb;
  idea jsonb;
  reason_keys text[];
  reason_key text;
  reason_value jsonb;
  reason_sum integer;
begin
  if p_status not in ('succeeded', 'zero_results', 'failed', 'timeout', 'rate_limited') then
    return jsonb_build_object('outcome', 'invalid_state');
  end if;

  if p_provider_result_count is not null and p_provider_result_count < 0 then
    return jsonb_build_object('outcome', 'invalid_state');
  end if;

  if p_provider_result_count is not null
     and p_idea_count is not null
     and p_provider_result_count < p_idea_count then
    return jsonb_build_object('outcome', 'invalid_state');
  end if;

  if p_filter_reason_counts is not null then
    if jsonb_typeof(p_filter_reason_counts) is distinct from 'object' then
      return jsonb_build_object('outcome', 'invalid_state');
    end if;

    select coalesce(array_agg(k order by k), '{}'::text[])
      into reason_keys
      from jsonb_object_keys(p_filter_reason_counts) as k;

    if reason_keys is distinct from array[
      'brandOnlyCount',
      'cappedCount',
      'compactDuplicateCount',
      'emptyCount',
      'invalidCount',
      'seedDuplicateCount'
    ]::text[] then
      return jsonb_build_object('outcome', 'invalid_state');
    end if;

    foreach reason_key in array array[
      'emptyCount',
      'invalidCount',
      'brandOnlyCount',
      'seedDuplicateCount',
      'compactDuplicateCount',
      'cappedCount'
    ]
    loop
      reason_value := p_filter_reason_counts -> reason_key;
      if jsonb_typeof(reason_value) is distinct from 'number' then
        return jsonb_build_object('outcome', 'invalid_state');
      end if;
      if (reason_value #>> '{}') !~ '^[0-9]+$' then
        return jsonb_build_object('outcome', 'invalid_state');
      end if;
    end loop;

    if p_provider_result_count is not null and p_idea_count is not null then
      reason_sum :=
        (p_filter_reason_counts->>'emptyCount')::integer +
        (p_filter_reason_counts->>'invalidCount')::integer +
        (p_filter_reason_counts->>'brandOnlyCount')::integer +
        (p_filter_reason_counts->>'seedDuplicateCount')::integer +
        (p_filter_reason_counts->>'compactDuplicateCount')::integer +
        (p_filter_reason_counts->>'cappedCount')::integer;
      if reason_sum + p_idea_count <> p_provider_result_count then
        return jsonb_build_object('outcome', 'invalid_state');
      end if;
    end if;
  end if;

  select request_fingerprint
    into fingerprint
    from public.research_runs
   where id = p_run_id
     and website_id = p_website_id;
  if fingerprint is null then
    return jsonb_build_object('outcome', 'invalid_state');
  end if;

  perform pg_advisory_xact_lock(
    hashtext(p_website_id::text),
    hashtext(fingerprint)
  );

  select *
    into rec
    from public.research_runs
   where id = p_run_id
     and website_id = p_website_id
     for update;
  if not found then
    return jsonb_build_object('outcome', 'invalid_state');
  end if;
  if rec.execution_generation <> p_execution_generation then
    return jsonb_build_object('outcome', 'superseded');
  end if;
  if rec.status not in ('requested', 'running') then
    return jsonb_build_object('outcome', 'invalid_state');
  end if;

  idx := public.research_ledger_entry_index(rec.request_ledger, p_request_key);
  if idx is null then
    return jsonb_build_object('outcome', 'missing_request');
  end if;
  entry := rec.request_ledger -> idx;
  if not public.research_ledger_entry_attempted(entry) then
    return jsonb_build_object('outcome', 'invalid_state');
  end if;

  if p_status in ('succeeded', 'zero_results') and p_ideas is not null and jsonb_typeof(p_ideas) = 'array' then
    for idea in select value from jsonb_array_elements(p_ideas)
    loop
      insert into public.research_ideas (
        run_id,
        website_id,
        seed_offering,
        language_code,
        provider_task_id,
        keyword,
        compact_key,
        estimated_monthly_searches,
        provider_result_order,
        initial_gsc_sample_status,
        request_key
      ) values (
        p_run_id,
        p_website_id,
        idea->>'seedOffering',
        idea->>'languageCode',
        nullif(idea->>'providerTaskId', ''),
        idea->>'keyword',
        idea->>'compactKey',
        nullif(idea->>'estimatedMonthlySearches', '')::integer,
        coalesce((idea->>'providerResultOrder')::integer, 0),
        idea->>'initialGscSampleStatus',
        p_request_key
      )
      on conflict (run_id, request_key, compact_key)
      where request_key is not null
      do nothing;
    end loop;
  end if;

  entry := entry || jsonb_build_object(
    'status', p_status,
    'providerTaskId', p_provider_task_id,
    'retrievedAt', public.research_utc_iso(now()),
    'ideaCount', coalesce(p_idea_count, 0),
    'providerCost', p_provider_cost,
    'failureCode', p_failure_code
  );
  if p_provider_result_count is not null then
    entry := entry || jsonb_build_object('providerResultCount', p_provider_result_count);
  end if;
  if p_filter_reason_counts is not null then
    entry := entry || jsonb_build_object('filterReasonCounts', p_filter_reason_counts);
  end if;

  update public.research_runs
     set request_ledger = jsonb_set(rec.request_ledger, array[idx::text], entry, false),
         last_progress_at = now(),
         updated_at = now()
   where id = p_run_id
     and website_id = p_website_id
     and execution_generation = p_execution_generation
  returning * into rec;

  if rec.id is null then
    return jsonb_build_object('outcome', 'superseded');
  end if;
  return jsonb_build_object('outcome', 'persisted', 'run', to_jsonb(rec));
end;
$$;

create or replace function public.persist_research_request_result(
  p_run_id uuid,
  p_website_id uuid,
  p_execution_generation bigint,
  p_request_key text,
  p_status text,
  p_provider_task_id text,
  p_idea_count integer,
  p_provider_cost numeric,
  p_failure_code text,
  p_ideas jsonb,
  p_provider_result_count integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  return public.persist_research_request_result(
    p_run_id,
    p_website_id,
    p_execution_generation,
    p_request_key,
    p_status,
    p_provider_task_id,
    p_idea_count,
    p_provider_cost,
    p_failure_code,
    p_ideas,
    p_provider_result_count,
    null::jsonb
  );
end;
$$;

create or replace function public.persist_research_request_result(
  p_run_id uuid,
  p_website_id uuid,
  p_execution_generation bigint,
  p_request_key text,
  p_status text,
  p_provider_task_id text,
  p_idea_count integer,
  p_provider_cost numeric,
  p_failure_code text,
  p_ideas jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  return public.persist_research_request_result(
    p_run_id,
    p_website_id,
    p_execution_generation,
    p_request_key,
    p_status,
    p_provider_task_id,
    p_idea_count,
    p_provider_cost,
    p_failure_code,
    p_ideas,
    null::integer,
    null::jsonb
  );
end;
$$;

revoke all on function public.persist_research_request_result(uuid, uuid, bigint, text, text, text, integer, numeric, text, jsonb) from public;
revoke all on function public.persist_research_request_result(uuid, uuid, bigint, text, text, text, integer, numeric, text, jsonb) from anon;
revoke all on function public.persist_research_request_result(uuid, uuid, bigint, text, text, text, integer, numeric, text, jsonb) from authenticated;
grant execute on function public.persist_research_request_result(uuid, uuid, bigint, text, text, text, integer, numeric, text, jsonb) to service_role;

revoke all on function public.persist_research_request_result(uuid, uuid, bigint, text, text, text, integer, numeric, text, jsonb, integer) from public;
revoke all on function public.persist_research_request_result(uuid, uuid, bigint, text, text, text, integer, numeric, text, jsonb, integer) from anon;
revoke all on function public.persist_research_request_result(uuid, uuid, bigint, text, text, text, integer, numeric, text, jsonb, integer) from authenticated;
grant execute on function public.persist_research_request_result(uuid, uuid, bigint, text, text, text, integer, numeric, text, jsonb, integer) to service_role;

revoke all on function public.persist_research_request_result(uuid, uuid, bigint, text, text, text, integer, numeric, text, jsonb, integer, jsonb) from public;
revoke all on function public.persist_research_request_result(uuid, uuid, bigint, text, text, text, integer, numeric, text, jsonb, integer, jsonb) from anon;
revoke all on function public.persist_research_request_result(uuid, uuid, bigint, text, text, text, integer, numeric, text, jsonb, integer, jsonb) from authenticated;
grant execute on function public.persist_research_request_result(uuid, uuid, bigint, text, text, text, integer, numeric, text, jsonb, integer, jsonb) to service_role;

notify pgrst, 'reload schema';
