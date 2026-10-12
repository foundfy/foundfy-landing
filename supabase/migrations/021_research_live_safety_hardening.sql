-- Foundfy RESEARCH live-safety hardening.
-- Does not recreate RESEARCH tables. Does not modify 020_research_v0.sql.
-- Adds execution generation fencing, closed lifecycle, atomic request
-- start/result RPCs, idea uniqueness, and service_role-only grants.
-- Provider HTTP must never run inside these transactions.

alter table public.research_runs
  add column if not exists last_progress_at timestamptz;

alter table public.research_runs
  add column if not exists execution_generation bigint not null default 1;

alter table public.research_runs
  add column if not exists closed_at timestamptz;

update public.research_runs
   set last_progress_at = coalesce(last_progress_at, updated_at, created_at)
 where last_progress_at is null;

alter table public.research_runs
  drop constraint if exists research_runs_status_check;

alter table public.research_runs
  add constraint research_runs_status_check
  check (status in (
    'requested',
    'running',
    'completed',
    'partial',
    'failed',
    'interrupted',
    'closed'
  ));

alter table public.research_runs
  drop constraint if exists research_runs_execution_generation_check;

alter table public.research_runs
  add constraint research_runs_execution_generation_check
  check (execution_generation >= 1);

alter table public.research_ideas
  add column if not exists request_key text;

alter table public.research_ideas
  drop constraint if exists research_ideas_request_key_format_check;

alter table public.research_ideas
  add constraint research_ideas_request_key_format_check
  check (
    request_key is null
    or (
      char_length(request_key) = 64
      and request_key ~ '^[a-f0-9]{64}$'
    )
  );

create unique index if not exists research_ideas_run_request_compact_uidx
  on public.research_ideas (run_id, request_key, compact_key)
  where request_key is not null;

drop index if exists public.research_runs_blocking_fingerprint_uidx;

create unique index if not exists research_runs_blocking_fingerprint_uidx
  on public.research_runs (website_id, request_fingerprint)
  where status in ('requested', 'running', 'interrupted', 'partial', 'failed');

create or replace function public.research_utc_iso(p_at timestamptz default now())
returns text
language sql
immutable
as $$
  select to_char(timezone('utc', p_at), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
$$;

create or replace function public.research_ledger_entry_index(p_ledger jsonb, p_request_key text)
returns integer
language sql
immutable
as $$
  select (ordinality - 1)::integer
    from jsonb_array_elements(coalesce(p_ledger, '[]'::jsonb)) with ordinality
   where value->>'requestKey' = p_request_key
   limit 1;
$$;

create or replace function public.research_ledger_entry_attempted(p_entry jsonb)
returns boolean
language sql
immutable
as $$
  select
    coalesce(p_entry->>'attemptedAt', '') <> ''
    or coalesce(p_entry->>'status', '') in (
      'in_flight',
      'succeeded',
      'zero_results',
      'failed',
      'timeout',
      'rate_limited'
    );
$$;

create or replace function public.research_ledger_entry_resumable(p_entry jsonb)
returns boolean
language sql
immutable
as $$
  select
    not public.research_ledger_entry_attempted(p_entry)
    and coalesce(p_entry->>'status', '') in ('pending', 'skipped');
$$;

create or replace function public.claim_research_run(
  p_website_id uuid,
  p_request_fingerprint text,
  p_reuse_since timestamptz,
  p_insert jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  rec public.research_runs%rowtype;
  reuse_completed_run public.research_runs%rowtype;
  active_run public.research_runs%rowtype;
  recovery_run public.research_runs%rowtype;
  created public.research_runs%rowtype;
  progress_at timestamptz;
  abandoned boolean;
begin
  perform pg_advisory_xact_lock(
    hashtext(p_website_id::text),
    hashtext(p_request_fingerprint)
  );

  reuse_completed_run := null;
  active_run := null;
  recovery_run := null;

  for rec in
    select *
      from public.research_runs
     where website_id = p_website_id
       and request_fingerprint = p_request_fingerprint
     order by created_at desc
       for update
  loop
    if rec.status = 'completed'
       and rec.completed_at is not null
       and rec.completed_at >= p_reuse_since then
      if reuse_completed_run.id is null then
        reuse_completed_run := rec;
      end if;
    elsif rec.status in ('requested', 'running') then
      if active_run.id is null then
        active_run := rec;
      end if;
    elsif rec.status in ('interrupted', 'partial', 'failed') then
      if recovery_run.id is null then
        recovery_run := rec;
      end if;
    end if;
  end loop;

  if reuse_completed_run.id is not null then
    return jsonb_build_object('outcome', 'reuse_completed', 'run', to_jsonb(reuse_completed_run));
  end if;

  if active_run.id is not null then
    progress_at := coalesce(active_run.last_progress_at, active_run.updated_at, active_run.created_at);
    abandoned := progress_at <= (now() - interval '30 minutes');
    if abandoned then
      return jsonb_build_object('outcome', 'recovery_required', 'run', to_jsonb(active_run));
    end if;
    return jsonb_build_object('outcome', 'reuse_active', 'run', to_jsonb(active_run));
  end if;

  if recovery_run.id is not null then
    return jsonb_build_object('outcome', 'recovery_required', 'run', to_jsonb(recovery_run));
  end if;

  begin
    insert into public.research_runs (
      website_id,
      site_model_id,
      site_model_confirmed_at,
      requested_by,
      gsc_sync_id,
      gsc_queries_truncated,
      country_key,
      country_name,
      location_code,
      language_codes,
      offering_seeds,
      provider,
      provider_environment,
      status,
      request_fingerprint,
      request_ledger,
      last_progress_at,
      execution_generation
    ) values (
      p_website_id,
      nullif(p_insert->>'site_model_id', '')::uuid,
      (p_insert->>'site_model_confirmed_at')::timestamptz,
      nullif(p_insert->>'requested_by', '')::uuid,
      nullif(p_insert->>'gsc_sync_id', '')::uuid,
      coalesce((p_insert->>'gsc_queries_truncated')::boolean, false),
      p_insert->>'country_key',
      p_insert->>'country_name',
      (p_insert->>'location_code')::integer,
      array(select jsonb_array_elements_text(coalesce(p_insert->'language_codes', '[]'::jsonb))),
      array(select jsonb_array_elements_text(coalesce(p_insert->'offering_seeds', '[]'::jsonb))),
      p_insert->>'provider',
      p_insert->>'provider_environment',
      'requested',
      p_request_fingerprint,
      '[]'::jsonb,
      now(),
      1
    )
    returning * into created;
    return jsonb_build_object('outcome', 'claimed', 'run', to_jsonb(created));
  exception
    when unique_violation then
      reuse_completed_run := null;
      active_run := null;
      recovery_run := null;
      for rec in
        select *
          from public.research_runs
         where website_id = p_website_id
           and request_fingerprint = p_request_fingerprint
         order by created_at desc
           for update
      loop
        if rec.status = 'completed'
           and rec.completed_at is not null
           and rec.completed_at >= p_reuse_since then
          if reuse_completed_run.id is null then
            reuse_completed_run := rec;
          end if;
        elsif rec.status in ('requested', 'running') then
          if active_run.id is null then
            active_run := rec;
          end if;
        elsif rec.status in ('interrupted', 'partial', 'failed') then
          if recovery_run.id is null then
            recovery_run := rec;
          end if;
        end if;
      end loop;

      if reuse_completed_run.id is not null then
        return jsonb_build_object('outcome', 'reuse_completed', 'run', to_jsonb(reuse_completed_run));
      end if;
      if active_run.id is not null then
        progress_at := coalesce(active_run.last_progress_at, active_run.updated_at, active_run.created_at);
        abandoned := progress_at <= (now() - interval '30 minutes');
        if abandoned then
          return jsonb_build_object('outcome', 'recovery_required', 'run', to_jsonb(active_run));
        end if;
        return jsonb_build_object('outcome', 'reuse_active', 'run', to_jsonb(active_run));
      end if;
      if recovery_run.id is not null then
        return jsonb_build_object('outcome', 'recovery_required', 'run', to_jsonb(recovery_run));
      end if;
      raise;
  end;
end;
$$;

create or replace function public.claim_research_recovery(
  p_run_id uuid,
  p_website_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  rec public.research_runs%rowtype;
  progress_at timestamptz;
  abandoned boolean;
begin
  select *
    into rec
    from public.research_runs
   where id = p_run_id
     and website_id = p_website_id;
  if not found then
    return jsonb_build_object('outcome', 'not_found');
  end if;

  perform pg_advisory_xact_lock(
    hashtext(p_website_id::text),
    hashtext(rec.request_fingerprint)
  );

  select *
    into rec
    from public.research_runs
   where id = p_run_id
     and website_id = p_website_id
     for update;
  if not found then
    return jsonb_build_object('outcome', 'not_found');
  end if;

  if rec.status = 'completed' or rec.status = 'closed' then
    return jsonb_build_object('outcome', 'not_recoverable', 'run', to_jsonb(rec));
  end if;

  progress_at := coalesce(rec.last_progress_at, rec.updated_at, rec.created_at);
  abandoned := progress_at <= (now() - interval '30 minutes');

  if rec.status in ('requested', 'running') and not abandoned then
    return jsonb_build_object('outcome', 'recovery_busy', 'run', to_jsonb(rec));
  end if;

  if rec.status not in ('requested', 'running', 'interrupted', 'partial', 'failed') then
    return jsonb_build_object('outcome', 'not_recoverable', 'run', to_jsonb(rec));
  end if;

  update public.research_runs
     set status = 'running',
         completed_at = null,
         last_progress_at = now(),
         started_at = coalesce(started_at, now()),
         updated_at = now(),
         execution_generation = execution_generation + 1
   where id = p_run_id
     and website_id = p_website_id
  returning * into rec;

  return jsonb_build_object('outcome', 'claimed_recovery', 'run', to_jsonb(rec));
end;
$$;

create or replace function public.persist_research_request_plan(
  p_run_id uuid,
  p_website_id uuid,
  p_execution_generation bigint,
  p_request_ledger jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  rec public.research_runs%rowtype;
  fingerprint text;
begin
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

  if jsonb_typeof(rec.request_ledger) = 'array' and jsonb_array_length(rec.request_ledger) > 0 then
    return jsonb_build_object('outcome', 'persisted', 'run', to_jsonb(rec));
  end if;

  update public.research_runs
     set request_ledger = coalesce(p_request_ledger, '[]'::jsonb),
         status = 'running',
         started_at = coalesce(started_at, now()),
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

create or replace function public.claim_research_request(
  p_run_id uuid,
  p_website_id uuid,
  p_execution_generation bigint,
  p_request_key text
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
  attempted_at text;
begin
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
  if not public.research_ledger_entry_resumable(entry) then
    return jsonb_build_object('outcome', 'already_attempted');
  end if;

  attempted_at := public.research_utc_iso(now());
  entry := entry || jsonb_build_object(
    'status', 'in_flight',
    'attemptedAt', attempted_at
  );

  update public.research_runs
     set request_ledger = jsonb_set(rec.request_ledger, array[idx::text], entry, false),
         status = 'running',
         last_progress_at = now(),
         updated_at = now()
   where id = p_run_id
     and website_id = p_website_id
     and execution_generation = p_execution_generation
  returning * into rec;

  if rec.id is null then
    return jsonb_build_object('outcome', 'superseded');
  end if;
  return jsonb_build_object('outcome', 'claimed', 'run', to_jsonb(rec), 'attemptedAt', attempted_at);
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
declare
  rec public.research_runs%rowtype;
  fingerprint text;
  idx integer;
  entry jsonb;
  idea jsonb;
begin
  if p_status not in ('succeeded', 'zero_results', 'failed', 'timeout', 'rate_limited') then
    return jsonb_build_object('outcome', 'invalid_state');
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

create or replace function public.skip_unattempted_research_requests(
  p_run_id uuid,
  p_website_id uuid,
  p_execution_generation bigint,
  p_failure_code text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  rec public.research_runs%rowtype;
  fingerprint text;
  ledger jsonb;
  entry jsonb;
  idx integer;
begin
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

  ledger := coalesce(rec.request_ledger, '[]'::jsonb);
  idx := 0;
  for entry in select value from jsonb_array_elements(ledger)
  loop
    if public.research_ledger_entry_resumable(entry) then
      ledger := jsonb_set(
        ledger,
        array[idx::text],
        entry || jsonb_build_object(
          'status', 'skipped',
          'attemptedAt', null,
          'failureCode', p_failure_code
        ),
        false
      );
    end if;
    idx := idx + 1;
  end loop;

  update public.research_runs
     set request_ledger = ledger,
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

create or replace function public.finalize_research_run(
  p_run_id uuid,
  p_website_id uuid,
  p_execution_generation bigint,
  p_status text,
  p_provider_cost numeric,
  p_failure_code text,
  p_failure_message text,
  p_completed_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  rec public.research_runs%rowtype;
  fingerprint text;
begin
  if p_status not in ('completed', 'partial', 'failed', 'interrupted') then
    return jsonb_build_object('outcome', 'invalid_state');
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

  update public.research_runs
     set status = p_status,
         provider_cost = p_provider_cost,
         failure_code = p_failure_code,
         failure_message = p_failure_message,
         completed_at = p_completed_at,
         last_progress_at = now(),
         updated_at = now()
   where id = p_run_id
     and website_id = p_website_id
     and execution_generation = p_execution_generation
  returning * into rec;

  if rec.id is null then
    return jsonb_build_object('outcome', 'superseded');
  end if;
  return jsonb_build_object('outcome', 'finalized', 'run', to_jsonb(rec));
end;
$$;

create or replace function public.close_research_run(
  p_run_id uuid,
  p_website_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  rec public.research_runs%rowtype;
  progress_at timestamptz;
  abandoned boolean;
begin
  select *
    into rec
    from public.research_runs
   where id = p_run_id
     and website_id = p_website_id;
  if not found then
    return jsonb_build_object('outcome', 'not_found');
  end if;

  perform pg_advisory_xact_lock(
    hashtext(p_website_id::text),
    hashtext(rec.request_fingerprint)
  );

  select *
    into rec
    from public.research_runs
   where id = p_run_id
     and website_id = p_website_id
     for update;
  if not found then
    return jsonb_build_object('outcome', 'not_found');
  end if;

  if rec.status = 'closed' then
    return jsonb_build_object('outcome', 'already_closed', 'run', to_jsonb(rec));
  end if;

  progress_at := coalesce(rec.last_progress_at, rec.updated_at, rec.created_at);
  abandoned := progress_at <= (now() - interval '30 minutes');
  if rec.status in ('requested', 'running') and not abandoned then
    return jsonb_build_object('outcome', 'recovery_busy', 'run', to_jsonb(rec));
  end if;

  if rec.status not in ('interrupted', 'partial', 'failed') then
    return jsonb_build_object('outcome', 'not_closeable', 'run', to_jsonb(rec));
  end if;

  update public.research_runs
     set status = 'closed',
         closed_at = now(),
         last_progress_at = now(),
         updated_at = now(),
         execution_generation = execution_generation + 1
   where id = p_run_id
     and website_id = p_website_id
  returning * into rec;

  return jsonb_build_object('outcome', 'closed', 'run', to_jsonb(rec));
end;
$$;

revoke all on function public.research_utc_iso(timestamptz) from public;
revoke all on function public.research_utc_iso(timestamptz) from anon;
revoke all on function public.research_utc_iso(timestamptz) from authenticated;
grant execute on function public.research_utc_iso(timestamptz) to service_role;

revoke all on function public.research_ledger_entry_index(jsonb, text) from public;
revoke all on function public.research_ledger_entry_index(jsonb, text) from anon;
revoke all on function public.research_ledger_entry_index(jsonb, text) from authenticated;
grant execute on function public.research_ledger_entry_index(jsonb, text) to service_role;

revoke all on function public.research_ledger_entry_attempted(jsonb) from public;
revoke all on function public.research_ledger_entry_attempted(jsonb) from anon;
revoke all on function public.research_ledger_entry_attempted(jsonb) from authenticated;
grant execute on function public.research_ledger_entry_attempted(jsonb) to service_role;

revoke all on function public.research_ledger_entry_resumable(jsonb) from public;
revoke all on function public.research_ledger_entry_resumable(jsonb) from anon;
revoke all on function public.research_ledger_entry_resumable(jsonb) from authenticated;
grant execute on function public.research_ledger_entry_resumable(jsonb) to service_role;

revoke all on function public.claim_research_run(uuid, text, timestamptz, jsonb) from public;
revoke all on function public.claim_research_run(uuid, text, timestamptz, jsonb) from anon;
revoke all on function public.claim_research_run(uuid, text, timestamptz, jsonb) from authenticated;
grant execute on function public.claim_research_run(uuid, text, timestamptz, jsonb) to service_role;

revoke all on function public.claim_research_recovery(uuid, uuid) from public;
revoke all on function public.claim_research_recovery(uuid, uuid) from anon;
revoke all on function public.claim_research_recovery(uuid, uuid) from authenticated;
grant execute on function public.claim_research_recovery(uuid, uuid) to service_role;

revoke all on function public.persist_research_request_plan(uuid, uuid, bigint, jsonb) from public;
revoke all on function public.persist_research_request_plan(uuid, uuid, bigint, jsonb) from anon;
revoke all on function public.persist_research_request_plan(uuid, uuid, bigint, jsonb) from authenticated;
grant execute on function public.persist_research_request_plan(uuid, uuid, bigint, jsonb) to service_role;

revoke all on function public.claim_research_request(uuid, uuid, bigint, text) from public;
revoke all on function public.claim_research_request(uuid, uuid, bigint, text) from anon;
revoke all on function public.claim_research_request(uuid, uuid, bigint, text) from authenticated;
grant execute on function public.claim_research_request(uuid, uuid, bigint, text) to service_role;

revoke all on function public.persist_research_request_result(uuid, uuid, bigint, text, text, text, integer, numeric, text, jsonb) from public;
revoke all on function public.persist_research_request_result(uuid, uuid, bigint, text, text, text, integer, numeric, text, jsonb) from anon;
revoke all on function public.persist_research_request_result(uuid, uuid, bigint, text, text, text, integer, numeric, text, jsonb) from authenticated;
grant execute on function public.persist_research_request_result(uuid, uuid, bigint, text, text, text, integer, numeric, text, jsonb) to service_role;

revoke all on function public.skip_unattempted_research_requests(uuid, uuid, bigint, text) from public;
revoke all on function public.skip_unattempted_research_requests(uuid, uuid, bigint, text) from anon;
revoke all on function public.skip_unattempted_research_requests(uuid, uuid, bigint, text) from authenticated;
grant execute on function public.skip_unattempted_research_requests(uuid, uuid, bigint, text) to service_role;

revoke all on function public.finalize_research_run(uuid, uuid, bigint, text, numeric, text, text, timestamptz) from public;
revoke all on function public.finalize_research_run(uuid, uuid, bigint, text, numeric, text, text, timestamptz) from anon;
revoke all on function public.finalize_research_run(uuid, uuid, bigint, text, numeric, text, text, timestamptz) from authenticated;
grant execute on function public.finalize_research_run(uuid, uuid, bigint, text, numeric, text, text, timestamptz) to service_role;

revoke all on function public.close_research_run(uuid, uuid) from public;
revoke all on function public.close_research_run(uuid, uuid) from anon;
revoke all on function public.close_research_run(uuid, uuid) from authenticated;
grant execute on function public.close_research_run(uuid, uuid) to service_role;

notify pgrst, 'reload schema';
