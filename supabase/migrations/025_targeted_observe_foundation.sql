-- Foundfy Targeted OBSERVE foundation (Release A).
-- Additive. Does not create targeted_observe rows or owner-facing observe routes.
-- Historical crawl_runs become purpose = site_sample.
-- Migration 024 RPC identity is preserved; body only adds T0 targeted_observation_id IS NULL.

BEGIN;

-- ---------------------------------------------------------------------------
-- crawl_runs.purpose
-- ---------------------------------------------------------------------------

alter table public.crawl_runs
  add column if not exists purpose text not null default 'site_sample';

update public.crawl_runs
  set purpose = 'site_sample'
  where purpose is distinct from 'site_sample';

alter table public.crawl_runs
  drop constraint if exists crawl_runs_purpose_check;

alter table public.crawl_runs
  add constraint crawl_runs_purpose_check
  check (purpose in ('site_sample', 'targeted_observe'));

alter table public.crawl_runs
  drop constraint if exists crawl_runs_targeted_observe_max_pages_check;

alter table public.crawl_runs
  add constraint crawl_runs_targeted_observe_max_pages_check
  check (purpose <> 'targeted_observe' or max_pages = 1);

alter table public.crawl_runs
  drop constraint if exists crawl_runs_targeted_observe_not_queued_check;

alter table public.crawl_runs
  add constraint crawl_runs_targeted_observe_not_queued_check
  check (purpose <> 'targeted_observe' or status <> 'queued');

create index if not exists crawl_runs_website_purpose_status_completed_at_idx
  on public.crawl_runs (website_id, purpose, status, completed_at desc);

-- ---------------------------------------------------------------------------
-- targeted_observations
-- ---------------------------------------------------------------------------

create table if not exists public.targeted_observations (
  id uuid primary key default gen_random_uuid(),
  website_id uuid not null references public.websites (id) on delete cascade,
  requested_url text not null,
  requested_url_key text not null,
  source_crawl_run_id uuid not null references public.crawl_runs (id) on delete restrict,
  source_queue_id uuid not null references public.crawl_queue (id) on delete restrict,
  targeted_crawl_run_id uuid not null references public.crawl_runs (id) on delete restrict,
  result_page_id uuid references public.pages (id) on delete restrict,
  requested_by uuid not null references public.gsc_observe_owners (id) on delete restrict,
  selection_mode text not null,
  status text not null,
  failure_reason text,
  created_at timestamptz not null default now(),
  started_at timestamptz not null,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint targeted_observations_requested_url_length_check
    check (char_length(requested_url) <= 2048),
  constraint targeted_observations_requested_url_key_length_check
    check (char_length(requested_url_key) <= 2048),
  constraint targeted_observations_failure_reason_length_check
    check (failure_reason is null or char_length(failure_reason) <= 500),
  constraint targeted_observations_selection_mode_check
    check (selection_mode in ('owner_selected', 'auto_candidate')),
  constraint targeted_observations_status_check
    check (status in ('running', 'analyzed', 'fetch_failed')),
  constraint targeted_observations_row_semantics_check
    check (
      (
        status = 'running'
        and started_at is not null
        and completed_at is null
        and result_page_id is null
        and failure_reason is null
        and targeted_crawl_run_id is not null
      )
      or (
        status = 'analyzed'
        and started_at is not null
        and completed_at is not null
        and result_page_id is not null
        and failure_reason is null
        and targeted_crawl_run_id is not null
      )
      or (
        status = 'fetch_failed'
        and started_at is not null
        and completed_at is not null
        and result_page_id is null
        and failure_reason is not null
        and targeted_crawl_run_id is not null
      )
    )
);

create unique index if not exists targeted_observations_active_website_uidx
  on public.targeted_observations (website_id)
  where status = 'running';

create unique index if not exists targeted_observations_analyzed_reuse_uidx
  on public.targeted_observations (website_id, source_crawl_run_id, requested_url_key)
  where status = 'analyzed';

create index if not exists targeted_observations_website_created_at_idx
  on public.targeted_observations (website_id, created_at desc);

create index if not exists targeted_observations_source_crawl_run_id_idx
  on public.targeted_observations (source_crawl_run_id);

create index if not exists targeted_observations_targeted_crawl_run_id_idx
  on public.targeted_observations (targeted_crawl_run_id);

alter table public.targeted_observations enable row level security;

grant all on public.targeted_observations to service_role;

-- ---------------------------------------------------------------------------
-- decision_runs.targeted_observation_id
-- ---------------------------------------------------------------------------

alter table public.decision_runs
  add column if not exists targeted_observation_id uuid;

alter table public.decision_runs
  drop constraint if exists decision_runs_targeted_observation_id_fkey;

alter table public.decision_runs
  add constraint decision_runs_targeted_observation_id_fkey
  foreign key (targeted_observation_id)
  references public.targeted_observations (id)
  on delete restrict;

create index if not exists decision_runs_targeted_observation_id_idx
  on public.decision_runs (targeted_observation_id)
  where targeted_observation_id is not null;

alter table public.decision_runs
  drop constraint if exists decision_runs_engine_evidence_check;

alter table public.decision_runs
  add constraint decision_runs_engine_evidence_check
  check (
    (
      engine_version = 'decision_v1'
      and site_model_id is not null
      and crawl_run_id is not null
      and gsc_search_sync_id is not null
      and goal_id is not null
      and research_idea_id is null
      and targeted_observation_id is null
    )
    or (
      engine_version = 'decision_research_inspect_v0'
      and site_model_id is not null
      and crawl_run_id is not null
      and research_idea_id is not null
      and goal_id is null
      and targeted_observation_id is null
    )
    or (
      engine_version = 'decision_research_inspect_v0'
      and site_model_id is not null
      and crawl_run_id is not null
      and research_idea_id is not null
      and goal_id is null
      and targeted_observation_id is not null
    )
  );

drop index if exists public.decision_runs_inspect_identity_gsc_uidx;
drop index if exists public.decision_runs_inspect_identity_no_gsc_uidx;
drop index if exists public.decision_runs_inspect_identity_t1_gsc_uidx;
drop index if exists public.decision_runs_inspect_identity_t1_no_gsc_uidx;

create unique index if not exists decision_runs_inspect_identity_gsc_uidx
  on public.decision_runs (website_id, research_idea_id, crawl_run_id, gsc_search_sync_id)
  where engine_version = 'decision_research_inspect_v0'
    and status = 'completed'
    and targeted_observation_id is null
    and gsc_search_sync_id is not null;

create unique index if not exists decision_runs_inspect_identity_no_gsc_uidx
  on public.decision_runs (website_id, research_idea_id, crawl_run_id)
  where engine_version = 'decision_research_inspect_v0'
    and status = 'completed'
    and targeted_observation_id is null
    and gsc_search_sync_id is null;

create unique index if not exists decision_runs_inspect_identity_t1_gsc_uidx
  on public.decision_runs (website_id, research_idea_id, crawl_run_id, gsc_search_sync_id, targeted_observation_id)
  where engine_version = 'decision_research_inspect_v0'
    and status = 'completed'
    and targeted_observation_id is not null
    and gsc_search_sync_id is not null;

create unique index if not exists decision_runs_inspect_identity_t1_no_gsc_uidx
  on public.decision_runs (website_id, research_idea_id, crawl_run_id, targeted_observation_id)
  where engine_version = 'decision_research_inspect_v0'
    and status = 'completed'
    and targeted_observation_id is not null
    and gsc_search_sync_id is null;

-- ---------------------------------------------------------------------------
-- inspection_state + evidence kinds
-- ---------------------------------------------------------------------------

alter table public.decisions
  drop constraint if exists decisions_row_semantics_check;

alter table public.decisions
  add constraint decisions_row_semantics_check
  check (
    (
      decision_type in (
        'existing_demand_page_issue',
        'inspect_unanalyzed_page',
        'multi_page_issue_with_visibility'
      )
      and rank is not null
      and priority_band is not null
      and confidence is not null
      and scoring is not null
      and inspection_state is null
    )
    or (
      decision_type = 'inspect_related_demand_against_pages'
      and rank is null
      and priority_band is null
      and confidence is null
      and scoring is null
      and inspection_state is not null
      and inspection_state in (
        'clear_existing_page_evidence',
        'no_obvious_match_in_current_crawl',
        'no_obvious_match_after_targeted_observation',
        'ambiguous'
      )
    )
  );

alter table public.decision_evidence_refs
  drop constraint if exists decision_evidence_refs_kind_check;

alter table public.decision_evidence_refs
  add constraint decision_evidence_refs_kind_check
  check (kind in (
    'observation',
    'gsc_evidence',
    'page',
    'crawl_run',
    'gsc_sync',
    'site_model',
    'goal',
    'research_run',
    'research_idea',
    'targeted_observation'
  ));

-- ---------------------------------------------------------------------------
-- T0 RPC: same 11-arg identity, body requires targeted_observation_id IS NULL
-- ---------------------------------------------------------------------------

create or replace function public.persist_research_inspect_decision(
  p_research_idea_id uuid,
  p_site_model_id uuid,
  p_crawl_run_id uuid,
  p_gsc_search_sync_id uuid,
  p_title text,
  p_explanation text,
  p_page_url text,
  p_page_id uuid,
  p_inspection_state text,
  p_gsc_truncated boolean,
  p_evidence_refs jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c_engine constant text := 'decision_research_inspect_v0';
  c_decision_type constant text := 'inspect_related_demand_against_pages';
  v_website_id uuid;
  v_research_run_id uuid;
  v_existing_run_id uuid;
  v_existing_decision_id uuid;
  v_run_id uuid;
  v_decision_id uuid;
  v_ref jsonb;
  v_kind text;
  v_record_id text;
  v_has_idea boolean := false;
  v_has_run boolean := false;
  v_has_model boolean := false;
  v_has_crawl boolean := false;
  v_has_gsc boolean := false;
  v_page_website_id uuid;
  v_page_crawl_id uuid;
begin
  if p_research_idea_id is null
     or p_site_model_id is null
     or p_crawl_run_id is null then
    raise exception 'inspect persistence requires research idea, site model, and crawl';
  end if;

  if p_title is null or char_length(btrim(p_title)) < 1 or char_length(p_title) > 2000 then
    raise exception 'inspect title is invalid';
  end if;

  if p_explanation is null
     or char_length(btrim(p_explanation)) < 1
     or char_length(p_explanation) > 8000 then
    raise exception 'inspect explanation is invalid';
  end if;

  if p_inspection_state is null
     or p_inspection_state not in (
       'clear_existing_page_evidence',
       'no_obvious_match_in_current_crawl',
       'ambiguous'
     ) then
    raise exception 'inspect inspection_state is invalid';
  end if;

  if p_evidence_refs is null or jsonb_typeof(p_evidence_refs) <> 'array' then
    raise exception 'inspect evidence refs must be an array';
  end if;

  select ri.website_id, ri.run_id
    into v_website_id, v_research_run_id
    from public.research_ideas ri
   where ri.id = p_research_idea_id;

  if v_website_id is null or v_research_run_id is null then
    raise exception 'inspect research idea was not found';
  end if;

  if not exists (
    select 1
      from public.research_runs rr
     where rr.id = v_research_run_id
       and rr.website_id = v_website_id
  ) then
    raise exception 'inspect research run does not belong to the idea website';
  end if;

  if not exists (
    select 1
      from public.site_models sm
     where sm.id = p_site_model_id
       and sm.website_id = v_website_id
  ) then
    raise exception 'inspect site model does not belong to the idea website';
  end if;

  if not exists (
    select 1
      from public.crawl_runs cr
     where cr.id = p_crawl_run_id
       and cr.website_id = v_website_id
  ) then
    raise exception 'inspect crawl does not belong to the idea website';
  end if;

  if p_gsc_search_sync_id is not null and not exists (
    select 1
      from public.gsc_search_syncs gs
     where gs.id = p_gsc_search_sync_id
       and gs.website_id = v_website_id
  ) then
    raise exception 'inspect GSC sync does not belong to the idea website';
  end if;

  if p_page_id is not null then
    select p.website_id, p.crawl_run_id
      into v_page_website_id, v_page_crawl_id
      from public.pages p
     where p.id = p_page_id;
    if v_page_website_id is null
       or v_page_website_id <> v_website_id
       or v_page_crawl_id <> p_crawl_run_id then
      raise exception 'inspect page does not belong to the idea website crawl';
    end if;
  end if;

  for v_ref in
    select value
      from jsonb_array_elements(p_evidence_refs)
  loop
    v_kind := v_ref->>'kind';
    v_record_id := v_ref->>'record_id';
    if v_kind is null or v_record_id is null or btrim(v_record_id) = '' then
      raise exception 'inspect evidence refs must include kind and record_id';
    end if;
    if v_kind not in (
      'page',
      'crawl_run',
      'gsc_sync',
      'site_model',
      'research_run',
      'research_idea'
    ) then
      raise exception 'inspect evidence kind is invalid';
    end if;
    if v_kind = 'research_idea' then
      if v_record_id <> p_research_idea_id::text then
        raise exception 'inspect research idea evidence does not match';
      end if;
      v_has_idea := true;
    elsif v_kind = 'research_run' then
      if v_record_id <> v_research_run_id::text then
        raise exception 'inspect research run evidence does not match';
      end if;
      v_has_run := true;
    elsif v_kind = 'site_model' then
      if v_record_id <> p_site_model_id::text then
        raise exception 'inspect site model evidence does not match';
      end if;
      v_has_model := true;
    elsif v_kind = 'crawl_run' then
      if v_record_id <> p_crawl_run_id::text then
        raise exception 'inspect crawl evidence does not match';
      end if;
      v_has_crawl := true;
    elsif v_kind = 'gsc_sync' then
      if p_gsc_search_sync_id is null or v_record_id <> p_gsc_search_sync_id::text then
        raise exception 'inspect GSC evidence does not match';
      end if;
      v_has_gsc := true;
    elsif v_kind = 'page' then
      if not exists (
        select 1
          from public.pages p
         where p.id = v_record_id::uuid
           and p.website_id = v_website_id
           and p.crawl_run_id = p_crawl_run_id
      ) then
        raise exception 'inspect page evidence does not belong to the idea website crawl';
      end if;
    end if;
  end loop;

  if not v_has_idea or not v_has_run or not v_has_model or not v_has_crawl then
    raise exception 'inspect evidence must include idea, run, site model, and crawl';
  end if;

  if p_gsc_search_sync_id is not null and not v_has_gsc then
    raise exception 'inspect GSC identity requires GSC evidence';
  end if;

  if p_gsc_search_sync_id is null and v_has_gsc then
    raise exception 'inspect NULL-GSC identity cannot include GSC evidence';
  end if;

  perform pg_advisory_xact_lock(
    hashtext('decision_research_inspect_v0:' || v_website_id::text),
    hashtext(
      p_research_idea_id::text || ':' ||
      p_crawl_run_id::text || ':' ||
      coalesce(p_gsc_search_sync_id::text, 'no-gsc')
    )
  );

  select dr.id
    into v_existing_run_id
    from public.decision_runs dr
   where dr.website_id = v_website_id
     and dr.research_idea_id = p_research_idea_id
     and dr.crawl_run_id = p_crawl_run_id
     and dr.engine_version = c_engine
     and dr.status = 'completed'
     and dr.targeted_observation_id is null
     and (
       (p_gsc_search_sync_id is null and dr.gsc_search_sync_id is null)
       or dr.gsc_search_sync_id = p_gsc_search_sync_id
     )
   order by dr.completed_at desc nulls last
   limit 1
   for update;

  if v_existing_run_id is not null then
    select d.id
      into v_existing_decision_id
      from public.decisions d
     where d.decision_run_id = v_existing_run_id
       and d.decision_type = c_decision_type
     limit 1;
    if v_existing_decision_id is null then
      raise exception 'inspect completed run is missing its decision';
    end if;
    return jsonb_build_object(
      'reused', true,
      'run_id', v_existing_run_id,
      'decision_id', v_existing_decision_id
    );
  end if;

  begin
    insert into public.decision_runs (
      website_id,
      site_model_id,
      crawl_run_id,
      gsc_search_sync_id,
      engine_version,
      status,
      goal_id,
      goal_snapshot,
      gsc_truncated,
      research_idea_id,
      targeted_observation_id,
      completed_at
    )
    values (
      v_website_id,
      p_site_model_id,
      p_crawl_run_id,
      p_gsc_search_sync_id,
      c_engine,
      'completed',
      null,
      '{}'::jsonb,
      coalesce(p_gsc_truncated, false),
      p_research_idea_id,
      null,
      timezone('utc', now())
    )
    returning id into v_run_id;

    insert into public.decisions (
      decision_run_id,
      website_id,
      decision_type,
      title,
      explanation,
      page_url,
      page_id,
      priority_band,
      rank,
      scoring,
      confidence,
      inspection_state
    )
    values (
      v_run_id,
      v_website_id,
      c_decision_type,
      p_title,
      p_explanation,
      nullif(btrim(coalesce(p_page_url, '')), ''),
      p_page_id,
      null,
      null,
      null,
      null,
      p_inspection_state
    )
    returning id into v_decision_id;

    insert into public.decision_evidence_refs (decision_id, kind, record_id, snapshot)
    select
      v_decision_id,
      ref->>'kind',
      ref->>'record_id',
      coalesce(ref->'snapshot', '{}'::jsonb)
    from jsonb_array_elements(p_evidence_refs) as ref;

    return jsonb_build_object(
      'reused', false,
      'run_id', v_run_id,
      'decision_id', v_decision_id
    );
  exception
    when unique_violation then
      select dr.id
        into v_existing_run_id
        from public.decision_runs dr
       where dr.website_id = v_website_id
         and dr.research_idea_id = p_research_idea_id
         and dr.crawl_run_id = p_crawl_run_id
         and dr.engine_version = c_engine
         and dr.status = 'completed'
         and dr.targeted_observation_id is null
         and (
           (p_gsc_search_sync_id is null and dr.gsc_search_sync_id is null)
           or dr.gsc_search_sync_id = p_gsc_search_sync_id
         )
       order by dr.completed_at desc nulls last
       limit 1;

      if v_existing_run_id is null then
        raise;
      end if;

      select d.id
        into v_existing_decision_id
        from public.decisions d
       where d.decision_run_id = v_existing_run_id
         and d.decision_type = c_decision_type
       limit 1;

      if v_existing_decision_id is null then
        raise;
      end if;

      return jsonb_build_object(
        'reused', true,
        'run_id', v_existing_run_id,
        'decision_id', v_existing_decision_id
      );
  end;
end;
$$;

-- ---------------------------------------------------------------------------
-- T1 RPC: unused by Release A application routes
-- ---------------------------------------------------------------------------

create or replace function public.persist_research_inspect_decision_with_observation(
  p_research_idea_id uuid,
  p_site_model_id uuid,
  p_crawl_run_id uuid,
  p_gsc_search_sync_id uuid,
  p_targeted_observation_id uuid,
  p_title text,
  p_explanation text,
  p_page_url text,
  p_page_id uuid,
  p_inspection_state text,
  p_gsc_truncated boolean,
  p_evidence_refs jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c_engine constant text := 'decision_research_inspect_v0';
  c_decision_type constant text := 'inspect_related_demand_against_pages';
  v_website_id uuid;
  v_research_run_id uuid;
  v_existing_run_id uuid;
  v_existing_decision_id uuid;
  v_run_id uuid;
  v_decision_id uuid;
  v_ref jsonb;
  v_kind text;
  v_record_id text;
  v_has_idea boolean := false;
  v_has_run boolean := false;
  v_has_model boolean := false;
  v_has_crawl boolean := false;
  v_has_gsc boolean := false;
  v_has_observation boolean := false;
  v_obs_website_id uuid;
  v_obs_status text;
  v_obs_source_crawl_id uuid;
  v_obs_source_queue_id uuid;
  v_obs_targeted_crawl_id uuid;
  v_obs_result_page_id uuid;
  v_obs_requested_url text;
  v_obs_requested_url_key text;
  v_obs_selection_mode text;
  v_obs_completed_at timestamptz;
  v_targeted_crawl_website_id uuid;
  v_targeted_crawl_purpose text;
  v_page_website_id uuid;
  v_page_crawl_id uuid;
  v_result_page_website_id uuid;
  v_result_page_crawl_id uuid;
  v_observation_snapshot jsonb;
begin
  if p_research_idea_id is null
     or p_site_model_id is null
     or p_crawl_run_id is null
     or p_targeted_observation_id is null then
    raise exception 'inspect persistence requires research idea, site model, crawl, and targeted observation';
  end if;

  if p_title is null or char_length(btrim(p_title)) < 1 or char_length(p_title) > 2000 then
    raise exception 'inspect title is invalid';
  end if;

  if p_explanation is null
     or char_length(btrim(p_explanation)) < 1
     or char_length(p_explanation) > 8000 then
    raise exception 'inspect explanation is invalid';
  end if;

  if p_inspection_state is null
     or p_inspection_state not in (
       'clear_existing_page_evidence',
       'no_obvious_match_after_targeted_observation',
       'ambiguous'
     ) then
    raise exception 'inspect inspection_state is invalid';
  end if;

  if p_evidence_refs is null or jsonb_typeof(p_evidence_refs) <> 'array' then
    raise exception 'inspect evidence refs must be an array';
  end if;

  select ri.website_id, ri.run_id
    into v_website_id, v_research_run_id
    from public.research_ideas ri
   where ri.id = p_research_idea_id;

  if v_website_id is null or v_research_run_id is null then
    raise exception 'inspect research idea was not found';
  end if;

  if not exists (
    select 1
      from public.research_runs rr
     where rr.id = v_research_run_id
       and rr.website_id = v_website_id
  ) then
    raise exception 'inspect research run does not belong to the idea website';
  end if;

  if not exists (
    select 1
      from public.site_models sm
     where sm.id = p_site_model_id
       and sm.website_id = v_website_id
  ) then
    raise exception 'inspect site model does not belong to the idea website';
  end if;

  if not exists (
    select 1
      from public.crawl_runs cr
     where cr.id = p_crawl_run_id
       and cr.website_id = v_website_id
       and cr.purpose = 'site_sample'
  ) then
    raise exception 'inspect crawl does not belong to the idea website';
  end if;

  if p_gsc_search_sync_id is not null and not exists (
    select 1
      from public.gsc_search_syncs gs
     where gs.id = p_gsc_search_sync_id
       and gs.website_id = v_website_id
  ) then
    raise exception 'inspect GSC sync does not belong to the idea website';
  end if;

  select
    obs.website_id,
    obs.status,
    obs.source_crawl_run_id,
    obs.source_queue_id,
    obs.targeted_crawl_run_id,
    obs.result_page_id,
    obs.requested_url,
    obs.requested_url_key,
    obs.selection_mode,
    obs.completed_at
    into
      v_obs_website_id,
      v_obs_status,
      v_obs_source_crawl_id,
      v_obs_source_queue_id,
      v_obs_targeted_crawl_id,
      v_obs_result_page_id,
      v_obs_requested_url,
      v_obs_requested_url_key,
      v_obs_selection_mode,
      v_obs_completed_at
    from public.targeted_observations obs
   where obs.id = p_targeted_observation_id;

  if v_obs_website_id is null then
    raise exception 'inspect targeted observation was not found';
  end if;

  if v_obs_website_id <> v_website_id then
    raise exception 'inspect targeted observation does not belong to the idea website';
  end if;

  if v_obs_status <> 'analyzed' then
    raise exception 'inspect targeted observation is not analyzed';
  end if;

  if v_obs_source_crawl_id <> p_crawl_run_id then
    raise exception 'inspect targeted observation source crawl does not match';
  end if;

  if v_obs_targeted_crawl_id is null or v_obs_result_page_id is null then
    raise exception 'inspect targeted observation is missing page evidence';
  end if;

  select cr.website_id, cr.purpose
    into v_targeted_crawl_website_id, v_targeted_crawl_purpose
    from public.crawl_runs cr
   where cr.id = v_obs_targeted_crawl_id;

  if v_targeted_crawl_website_id is null
     or v_targeted_crawl_website_id <> v_website_id
     or v_targeted_crawl_purpose <> 'targeted_observe' then
    raise exception 'inspect targeted crawl does not belong to the idea website';
  end if;

  select p.website_id, p.crawl_run_id
    into v_result_page_website_id, v_result_page_crawl_id
    from public.pages p
   where p.id = v_obs_result_page_id;

  if v_result_page_website_id is null
     or v_result_page_website_id <> v_website_id
     or v_result_page_crawl_id <> v_obs_targeted_crawl_id then
    raise exception 'inspect targeted page does not belong to the targeted crawl';
  end if;

  if p_page_id is not null then
    if p_page_id = v_obs_result_page_id then
      null;
    else
      select p.website_id, p.crawl_run_id
        into v_page_website_id, v_page_crawl_id
        from public.pages p
       where p.id = p_page_id;
      if v_page_website_id is null
         or v_page_website_id <> v_website_id
         or v_page_crawl_id <> p_crawl_run_id then
        raise exception 'inspect page does not belong to the idea website crawl';
      end if;
    end if;
  end if;

  v_observation_snapshot := jsonb_build_object(
    'requested_url', v_obs_requested_url,
    'requested_url_key', v_obs_requested_url_key,
    'source_crawl_run_id', v_obs_source_crawl_id,
    'source_queue_id', v_obs_source_queue_id,
    'targeted_crawl_run_id', v_obs_targeted_crawl_id,
    'result_page_id', v_obs_result_page_id,
    'selection_mode', v_obs_selection_mode,
    'completed_at', v_obs_completed_at
  );

  for v_ref in
    select value
      from jsonb_array_elements(p_evidence_refs)
  loop
    v_kind := v_ref->>'kind';
    v_record_id := v_ref->>'record_id';
    if v_kind is null or v_record_id is null or btrim(v_record_id) = '' then
      raise exception 'inspect evidence refs must include kind and record_id';
    end if;
    if v_kind not in (
      'page',
      'crawl_run',
      'gsc_sync',
      'site_model',
      'research_run',
      'research_idea',
      'targeted_observation'
    ) then
      raise exception 'inspect evidence kind is invalid';
    end if;
    if v_kind = 'research_idea' then
      if v_record_id <> p_research_idea_id::text then
        raise exception 'inspect research idea evidence does not match';
      end if;
      v_has_idea := true;
    elsif v_kind = 'research_run' then
      if v_record_id <> v_research_run_id::text then
        raise exception 'inspect research run evidence does not match';
      end if;
      v_has_run := true;
    elsif v_kind = 'site_model' then
      if v_record_id <> p_site_model_id::text then
        raise exception 'inspect site model evidence does not match';
      end if;
      v_has_model := true;
    elsif v_kind = 'crawl_run' then
      if v_record_id <> p_crawl_run_id::text then
        raise exception 'inspect crawl evidence does not match';
      end if;
      v_has_crawl := true;
    elsif v_kind = 'gsc_sync' then
      if p_gsc_search_sync_id is null or v_record_id <> p_gsc_search_sync_id::text then
        raise exception 'inspect GSC evidence does not match';
      end if;
      v_has_gsc := true;
    elsif v_kind = 'targeted_observation' then
      if v_record_id <> p_targeted_observation_id::text then
        raise exception 'inspect targeted observation evidence does not match';
      end if;
      v_has_observation := true;
    elsif v_kind = 'page' then
      if v_record_id = v_obs_result_page_id::text then
        null;
      elsif not exists (
        select 1
          from public.pages p
         where p.id = v_record_id::uuid
           and p.website_id = v_website_id
           and p.crawl_run_id = p_crawl_run_id
      ) then
        raise exception 'inspect page evidence does not belong to the idea website crawl';
      end if;
    end if;
  end loop;

  if not v_has_idea or not v_has_run or not v_has_model or not v_has_crawl or not v_has_observation then
    raise exception 'inspect evidence must include idea, run, site model, crawl, and targeted observation';
  end if;

  if p_gsc_search_sync_id is not null and not v_has_gsc then
    raise exception 'inspect GSC identity requires GSC evidence';
  end if;

  if p_gsc_search_sync_id is null and v_has_gsc then
    raise exception 'inspect NULL-GSC identity cannot include GSC evidence';
  end if;

  perform pg_advisory_xact_lock(
    hashtext('decision_research_inspect_v0:' || v_website_id::text),
    hashtext(
      p_research_idea_id::text || ':' ||
      p_crawl_run_id::text || ':' ||
      coalesce(p_gsc_search_sync_id::text, 'no-gsc') || ':' ||
      p_targeted_observation_id::text
    )
  );

  select dr.id
    into v_existing_run_id
    from public.decision_runs dr
   where dr.website_id = v_website_id
     and dr.research_idea_id = p_research_idea_id
     and dr.crawl_run_id = p_crawl_run_id
     and dr.engine_version = c_engine
     and dr.status = 'completed'
     and dr.targeted_observation_id = p_targeted_observation_id
     and (
       (p_gsc_search_sync_id is null and dr.gsc_search_sync_id is null)
       or dr.gsc_search_sync_id = p_gsc_search_sync_id
     )
   order by dr.completed_at desc nulls last
   limit 1
   for update;

  if v_existing_run_id is not null then
    select d.id
      into v_existing_decision_id
      from public.decisions d
     where d.decision_run_id = v_existing_run_id
       and d.decision_type = c_decision_type
     limit 1;
    if v_existing_decision_id is null then
      raise exception 'inspect completed run is missing its decision';
    end if;
    return jsonb_build_object(
      'reused', true,
      'run_id', v_existing_run_id,
      'decision_id', v_existing_decision_id
    );
  end if;

  begin
    insert into public.decision_runs (
      website_id,
      site_model_id,
      crawl_run_id,
      gsc_search_sync_id,
      engine_version,
      status,
      goal_id,
      goal_snapshot,
      gsc_truncated,
      research_idea_id,
      targeted_observation_id,
      completed_at
    )
    values (
      v_website_id,
      p_site_model_id,
      p_crawl_run_id,
      p_gsc_search_sync_id,
      c_engine,
      'completed',
      null,
      '{}'::jsonb,
      coalesce(p_gsc_truncated, false),
      p_research_idea_id,
      p_targeted_observation_id,
      timezone('utc', now())
    )
    returning id into v_run_id;

    insert into public.decisions (
      decision_run_id,
      website_id,
      decision_type,
      title,
      explanation,
      page_url,
      page_id,
      priority_band,
      rank,
      scoring,
      confidence,
      inspection_state
    )
    values (
      v_run_id,
      v_website_id,
      c_decision_type,
      p_title,
      p_explanation,
      nullif(btrim(coalesce(p_page_url, '')), ''),
      p_page_id,
      null,
      null,
      null,
      null,
      p_inspection_state
    )
    returning id into v_decision_id;

    insert into public.decision_evidence_refs (decision_id, kind, record_id, snapshot)
    select
      v_decision_id,
      ref->>'kind',
      ref->>'record_id',
      case
        when ref->>'kind' = 'targeted_observation' then v_observation_snapshot
        else coalesce(ref->'snapshot', '{}'::jsonb)
      end
    from jsonb_array_elements(p_evidence_refs) as ref;

    return jsonb_build_object(
      'reused', false,
      'run_id', v_run_id,
      'decision_id', v_decision_id
    );
  exception
    when unique_violation then
      select dr.id
        into v_existing_run_id
        from public.decision_runs dr
       where dr.website_id = v_website_id
         and dr.research_idea_id = p_research_idea_id
         and dr.crawl_run_id = p_crawl_run_id
         and dr.engine_version = c_engine
         and dr.status = 'completed'
         and dr.targeted_observation_id = p_targeted_observation_id
         and (
           (p_gsc_search_sync_id is null and dr.gsc_search_sync_id is null)
           or dr.gsc_search_sync_id = p_gsc_search_sync_id
         )
       order by dr.completed_at desc nulls last
       limit 1;

      if v_existing_run_id is null then
        raise;
      end if;

      select d.id
        into v_existing_decision_id
        from public.decisions d
       where d.decision_run_id = v_existing_run_id
         and d.decision_type = c_decision_type
       limit 1;

      if v_existing_decision_id is null then
        raise;
      end if;

      return jsonb_build_object(
        'reused', true,
        'run_id', v_existing_run_id,
        'decision_id', v_existing_decision_id
      );
  end;
end;
$$;

revoke all on function public.persist_research_inspect_decision(uuid, uuid, uuid, uuid, text, text, text, uuid, text, boolean, jsonb) from public;
revoke all on function public.persist_research_inspect_decision(uuid, uuid, uuid, uuid, text, text, text, uuid, text, boolean, jsonb) from anon;
revoke all on function public.persist_research_inspect_decision(uuid, uuid, uuid, uuid, text, text, text, uuid, text, boolean, jsonb) from authenticated;
grant execute on function public.persist_research_inspect_decision(uuid, uuid, uuid, uuid, text, text, text, uuid, text, boolean, jsonb) to service_role;

revoke all on function public.persist_research_inspect_decision_with_observation(uuid, uuid, uuid, uuid, uuid, text, text, text, uuid, text, boolean, jsonb) from public;
revoke all on function public.persist_research_inspect_decision_with_observation(uuid, uuid, uuid, uuid, uuid, text, text, text, uuid, text, boolean, jsonb) from anon;
revoke all on function public.persist_research_inspect_decision_with_observation(uuid, uuid, uuid, uuid, uuid, text, text, text, uuid, text, boolean, jsonb) from authenticated;
grant execute on function public.persist_research_inspect_decision_with_observation(uuid, uuid, uuid, uuid, uuid, text, text, text, uuid, text, boolean, jsonb) to service_role;

notify pgrst, 'reload schema';

COMMIT;
