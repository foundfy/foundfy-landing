-- Foundfy Targeted OBSERVE claim/finalize (Release B).
-- Additive. Does not modify Migration 025, T1 persistence RPC, robots, or website-delete FKs.
-- Production targeted_observations is empty at apply time.

BEGIN;

-- ---------------------------------------------------------------------------
-- Provenance columns
-- ---------------------------------------------------------------------------

alter table public.targeted_observations
  add column source_inspect_run_id uuid not null
  references public.decision_runs (id)
  on delete restrict;

alter table public.targeted_observations
  add column source_research_idea_id uuid not null;

alter table public.targeted_observations
  add constraint targeted_observations_source_research_idea_website_fk
  foreign key (source_research_idea_id, website_id)
  references public.research_ideas (id, website_id)
  on delete restrict;

-- ---------------------------------------------------------------------------
-- Idea-scoped analyzed reuse unique
-- ---------------------------------------------------------------------------

drop index if exists public.targeted_observations_analyzed_reuse_uidx;

create unique index targeted_observations_analyzed_reuse_uidx
  on public.targeted_observations (
    website_id,
    source_crawl_run_id,
    source_research_idea_id,
    requested_url_key
  )
  where status = 'analyzed';

-- ---------------------------------------------------------------------------
-- Shared Targeted Observe website lifecycle lock
-- Transaction-scoped. Identical in claim and finalize.
-- Does NOT serialize normal site_sample crawl completion.
-- ---------------------------------------------------------------------------

create or replace function public.claim_targeted_observation(
  p_website_id uuid,
  p_source_crawl_run_id uuid,
  p_source_queue_id uuid,
  p_source_inspect_run_id uuid,
  p_requested_url_key text,
  p_requested_by uuid,
  p_selection_mode text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_website_id uuid;
  v_source_queue_url text;
  v_source_queue_crawl_id uuid;
  v_inspect_engine text;
  v_inspect_status text;
  v_inspect_targeted_observation_id uuid;
  v_inspect_website_id uuid;
  v_inspect_crawl_id uuid;
  v_source_research_idea_id uuid;
  v_decision_type text;
  v_inspection_state text;
  v_latest_usable_id uuid;
  v_reused public.targeted_observations%rowtype;
  v_running public.targeted_observations%rowtype;
  v_targeted_crawl_id uuid;
  v_observation_id uuid;
  v_started_at timestamptz;
begin
  if p_website_id is null
     or p_source_crawl_run_id is null
     or p_source_queue_id is null
     or p_source_inspect_run_id is null
     or p_requested_by is null then
    raise exception 'targeted observe claim requires website, source crawl, source queue, inspect run, and owner';
  end if;

  if p_requested_url_key is null
     or char_length(btrim(p_requested_url_key)) < 1
     or char_length(p_requested_url_key) > 2048 then
    raise exception 'targeted observe requested_url_key is invalid';
  end if;

  if p_selection_mode is null
     or p_selection_mode not in ('owner_selected', 'auto_candidate') then
    raise exception 'targeted observe selection_mode is invalid';
  end if;

  if not exists (
    select 1
      from public.websites w
     where w.id = p_website_id
  ) then
    raise exception 'targeted observe website was not found';
  end if;

  v_website_id := p_website_id;

  -- Website-scoped Targeted Observe lifecycle lock. Identical key in finalize.
  -- Does not serialize site_sample crawl completion.
  perform pg_advisory_xact_lock(
    hashtext('targeted_observe_lifecycle'),
    hashtext(v_website_id::text)
  );

  if not exists (
    select 1
      from public.crawl_runs cr
     where cr.id = p_source_crawl_run_id
       and cr.website_id = v_website_id
       and cr.purpose = 'site_sample'
  ) then
    raise exception 'targeted observe source crawl does not belong to the website';
  end if;

  select q.url, q.crawl_run_id
    into v_source_queue_url, v_source_queue_crawl_id
    from public.crawl_queue q
   where q.id = p_source_queue_id;

  if v_source_queue_url is null then
    raise exception 'targeted observe source queue was not found';
  end if;

  if v_source_queue_crawl_id <> p_source_crawl_run_id then
    raise exception 'targeted observe source queue does not belong to the source crawl';
  end if;

  if not exists (
    select 1
      from public.gsc_observe_owners o
     where o.id = p_requested_by
       and o.website_id = v_website_id
       and o.status = 'google_connected'
  ) then
    raise exception 'targeted observe owner does not belong to the website';
  end if;

  select
    dr.engine_version,
    dr.status,
    dr.targeted_observation_id,
    dr.website_id,
    dr.crawl_run_id,
    dr.research_idea_id
    into
      v_inspect_engine,
      v_inspect_status,
      v_inspect_targeted_observation_id,
      v_inspect_website_id,
      v_inspect_crawl_id,
      v_source_research_idea_id
    from public.decision_runs dr
   where dr.id = p_source_inspect_run_id;

  if v_inspect_engine is null then
    raise exception 'targeted observe inspect run was not found';
  end if;

  if v_inspect_engine <> 'decision_research_inspect_v0'
     or v_inspect_status <> 'completed'
     or v_inspect_targeted_observation_id is not null
     or v_inspect_website_id <> v_website_id
     or v_inspect_crawl_id <> p_source_crawl_run_id
     or v_source_research_idea_id is null then
    raise exception 'targeted observe inspect run is not a valid T0 inspect';
  end if;

  select d.decision_type, d.inspection_state
    into v_decision_type, v_inspection_state
    from public.decisions d
   where d.decision_run_id = p_source_inspect_run_id
     and d.decision_type = 'inspect_related_demand_against_pages';

  if v_decision_type is null or v_inspection_state is null then
    raise exception 'targeted observe inspect decision was not found';
  end if;

  if v_inspection_state <> 'no_obvious_match_in_current_crawl' then
    raise exception 'targeted observe inspect decision is not no_obvious_match_in_current_crawl';
  end if;

  select cr.id
    into v_latest_usable_id
    from public.crawl_runs cr
   where cr.website_id = v_website_id
     and cr.purpose = 'site_sample'
     and cr.status = 'completed'
     and cr.pages_crawled > 0
   order by cr.completed_at desc nulls last,
            cr.created_at desc
   limit 1;

  if v_latest_usable_id is null or v_latest_usable_id <> p_source_crawl_run_id then
    return jsonb_build_object('status', 'stale_source');
  end if;

  select *
    into v_reused
    from public.targeted_observations obs
   where obs.website_id = v_website_id
     and obs.source_crawl_run_id = p_source_crawl_run_id
     and obs.source_research_idea_id = v_source_research_idea_id
     and obs.requested_url_key = p_requested_url_key
     and obs.status = 'analyzed'
   order by obs.completed_at desc nulls last
   limit 1;

  if v_reused.id is not null then
    return jsonb_build_object(
      'status', 'reused',
      'observation_id', v_reused.id,
      'targeted_crawl_run_id', v_reused.targeted_crawl_run_id,
      'started_at', v_reused.started_at,
      'completed_at', v_reused.completed_at
    );
  end if;

  select *
    into v_running
    from public.targeted_observations obs
   where obs.website_id = v_website_id
     and obs.status = 'running'
   order by obs.started_at desc
   limit 1;

  if v_running.id is not null then
    return jsonb_build_object(
      'status', 'already_running',
      'observation_id', v_running.id,
      'targeted_crawl_run_id', v_running.targeted_crawl_run_id,
      'started_at', v_running.started_at
    );
  end if;

  begin
    insert into public.crawl_runs (
      website_id,
      seed_url,
      purpose,
      max_pages,
      status,
      started_at,
      pages_crawled,
      pages_discovered
    )
    values (
      v_website_id,
      v_source_queue_url,
      'targeted_observe',
      1,
      'running',
      timezone('utc', now()),
      0,
      0
    )
    returning id into v_targeted_crawl_id;

    insert into public.targeted_observations (
      website_id,
      requested_url,
      requested_url_key,
      source_crawl_run_id,
      source_queue_id,
      source_inspect_run_id,
      source_research_idea_id,
      targeted_crawl_run_id,
      requested_by,
      selection_mode,
      status,
      started_at
    )
    values (
      v_website_id,
      v_source_queue_url,
      p_requested_url_key,
      p_source_crawl_run_id,
      p_source_queue_id,
      p_source_inspect_run_id,
      v_source_research_idea_id,
      v_targeted_crawl_id,
      p_requested_by,
      p_selection_mode,
      'running',
      timezone('utc', now())
    )
    returning id, started_at into v_observation_id, v_started_at;

    return jsonb_build_object(
      'status', 'claimed',
      'observation_id', v_observation_id,
      'targeted_crawl_run_id', v_targeted_crawl_id,
      'started_at', v_started_at
    );
  exception
    when unique_violation then
      select cr.id
        into v_latest_usable_id
        from public.crawl_runs cr
       where cr.website_id = v_website_id
         and cr.purpose = 'site_sample'
         and cr.status = 'completed'
         and cr.pages_crawled > 0
       order by cr.completed_at desc nulls last,
                cr.created_at desc
       limit 1;

      if v_latest_usable_id is null or v_latest_usable_id <> p_source_crawl_run_id then
        return jsonb_build_object('status', 'stale_source');
      end if;

      select *
        into v_reused
        from public.targeted_observations obs
       where obs.website_id = v_website_id
         and obs.source_crawl_run_id = p_source_crawl_run_id
         and obs.source_research_idea_id = v_source_research_idea_id
         and obs.requested_url_key = p_requested_url_key
         and obs.status = 'analyzed'
       order by obs.completed_at desc nulls last
       limit 1;

      if v_reused.id is not null then
        return jsonb_build_object(
          'status', 'reused',
          'observation_id', v_reused.id,
          'targeted_crawl_run_id', v_reused.targeted_crawl_run_id,
          'started_at', v_reused.started_at,
          'completed_at', v_reused.completed_at
        );
      end if;

      select *
        into v_running
        from public.targeted_observations obs
       where obs.website_id = v_website_id
         and obs.status = 'running'
       order by obs.started_at desc
       limit 1;

      if v_running.id is not null then
        return jsonb_build_object(
          'status', 'already_running',
          'observation_id', v_running.id,
          'targeted_crawl_run_id', v_running.targeted_crawl_run_id,
          'started_at', v_running.started_at
        );
      end if;

      raise exception 'targeted observe claim could not be resolved';
  end;
end;
$$;

create or replace function public.finalize_targeted_observation(
  p_observation_id uuid,
  p_status text,
  p_result_page_id uuid,
  p_failure_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_website_id uuid;
  v_observation public.targeted_observations%rowtype;
  v_crawl public.crawl_runs%rowtype;
  v_page_crawl_id uuid;
  v_completed_at timestamptz;
begin
  if p_observation_id is null then
    raise exception 'targeted observe finalize requires an observation';
  end if;

  if p_status is null or p_status not in ('analyzed', 'fetch_failed') then
    raise exception 'targeted observe finalize status is invalid';
  end if;

  select obs.website_id
    into v_website_id
    from public.targeted_observations obs
   where obs.id = p_observation_id;

  if v_website_id is null then
    raise exception 'targeted observe observation was not found';
  end if;

  -- Website-scoped Targeted Observe lifecycle lock. Identical key in claim.
  -- Does not serialize site_sample crawl completion.
  perform pg_advisory_xact_lock(
    hashtext('targeted_observe_lifecycle'),
    hashtext(v_website_id::text)
  );

  select *
    into v_observation
    from public.targeted_observations obs
   where obs.id = p_observation_id
   for update;

  if v_observation.id is null then
    raise exception 'targeted observe observation was not found';
  end if;

  select *
    into v_crawl
    from public.crawl_runs cr
   where cr.id = v_observation.targeted_crawl_run_id
   for update;

  if v_crawl.id is null then
    raise exception 'targeted observe targeted crawl was not found';
  end if;

  if v_crawl.purpose <> 'targeted_observe' then
    raise exception 'targeted observe targeted crawl is not targeted_observe';
  end if;

  if p_status = 'analyzed' then
    if p_result_page_id is null or p_failure_reason is not null then
      raise exception 'targeted observe analyzed finalize requires a result page and no failure reason';
    end if;

    select p.crawl_run_id
      into v_page_crawl_id
      from public.pages p
     where p.id = p_result_page_id
       and p.website_id = v_observation.website_id;

    if v_page_crawl_id is null or v_page_crawl_id <> v_observation.targeted_crawl_run_id then
      raise exception 'targeted observe result page does not belong to the targeted crawl';
    end if;

    if v_observation.status = 'analyzed'
       and v_crawl.status = 'completed'
       and v_observation.result_page_id = p_result_page_id
       and v_crawl.pages_crawled = 1 then
      return jsonb_build_object(
        'status', 'analyzed',
        'observation_id', v_observation.id,
        'targeted_crawl_run_id', v_observation.targeted_crawl_run_id,
        'result_page_id', v_observation.result_page_id,
        'completed_at', v_observation.completed_at
      );
    end if;

    if v_observation.status <> 'running' or v_crawl.status <> 'running' then
      raise exception 'targeted observe terminal state is split or mismatched';
    end if;

    v_completed_at := timezone('utc', now());

    update public.targeted_observations
       set status = 'analyzed',
           result_page_id = p_result_page_id,
           failure_reason = null,
           completed_at = v_completed_at,
           updated_at = v_completed_at
     where id = v_observation.id;

    update public.crawl_runs
       set status = 'completed',
           pages_crawled = 1,
           pages_discovered = 0,
           completed_at = v_completed_at
     where id = v_crawl.id;

    return jsonb_build_object(
      'status', 'analyzed',
      'observation_id', v_observation.id,
      'targeted_crawl_run_id', v_observation.targeted_crawl_run_id,
      'result_page_id', p_result_page_id,
      'completed_at', v_completed_at
    );
  end if;

  if p_result_page_id is not null
     or p_failure_reason is null
     or char_length(btrim(p_failure_reason)) < 1
     or char_length(p_failure_reason) > 500 then
    raise exception 'targeted observe fetch_failed finalize requires a bounded failure reason and no result page';
  end if;

  if v_observation.status = 'fetch_failed'
     and v_crawl.status = 'failed' then
    return jsonb_build_object(
      'status', 'fetch_failed',
      'observation_id', v_observation.id,
      'targeted_crawl_run_id', v_observation.targeted_crawl_run_id,
      'failure_reason', v_observation.failure_reason,
      'completed_at', v_observation.completed_at
    );
  end if;

  if v_observation.status <> 'running' or v_crawl.status <> 'running' then
    raise exception 'targeted observe terminal state is split or mismatched';
  end if;

  v_completed_at := timezone('utc', now());

  update public.targeted_observations
     set status = 'fetch_failed',
         result_page_id = null,
         failure_reason = btrim(p_failure_reason),
         completed_at = v_completed_at,
         updated_at = v_completed_at
   where id = v_observation.id;

  update public.crawl_runs
     set status = 'failed',
         pages_crawled = 0,
         pages_discovered = 0,
         error_message = left(btrim(p_failure_reason), 1000),
         completed_at = v_completed_at
   where id = v_crawl.id;

  return jsonb_build_object(
    'status', 'fetch_failed',
    'observation_id', v_observation.id,
    'targeted_crawl_run_id', v_observation.targeted_crawl_run_id,
    'failure_reason', btrim(p_failure_reason),
    'completed_at', v_completed_at
  );
end;
$$;

revoke all on function public.claim_targeted_observation(uuid, uuid, uuid, uuid, text, uuid, text) from public;
revoke all on function public.claim_targeted_observation(uuid, uuid, uuid, uuid, text, uuid, text) from anon;
revoke all on function public.claim_targeted_observation(uuid, uuid, uuid, uuid, text, uuid, text) from authenticated;
grant execute on function public.claim_targeted_observation(uuid, uuid, uuid, uuid, text, uuid, text) to service_role;

revoke all on function public.finalize_targeted_observation(uuid, text, uuid, text) from public;
revoke all on function public.finalize_targeted_observation(uuid, text, uuid, text) from anon;
revoke all on function public.finalize_targeted_observation(uuid, text, uuid, text) from authenticated;
grant execute on function public.finalize_targeted_observation(uuid, text, uuid, text) to service_role;

COMMIT;
