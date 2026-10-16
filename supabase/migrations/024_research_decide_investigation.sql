-- Foundfy DECIDE: inspect related RESEARCH demand against current pages.
-- Additive. Does not rewrite historical decision_v1 rows or invent GSC/goal refs.
-- Engine-specific evidence:
--   decision_v1: site_model, crawl, GSC sync, and goal remain required.
--   decision_research_inspect_v0: site_model, crawl, and research_idea required;
--   GSC optional; goal not used.

alter table public.research_ideas
  drop constraint if exists research_ideas_id_website_id_key;

alter table public.research_ideas
  add constraint research_ideas_id_website_id_key unique (id, website_id);

alter table public.decision_runs
  add column if not exists research_idea_id uuid;

alter table public.decision_runs
  alter column gsc_search_sync_id drop not null;

alter table public.decision_runs
  alter column goal_id drop not null;

alter table public.decision_runs
  drop constraint if exists decision_runs_engine_version_check;

alter table public.decision_runs
  add constraint decision_runs_engine_version_check
  check (engine_version in ('decision_v1', 'decision_research_inspect_v0'));

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
    )
    or (
      engine_version = 'decision_research_inspect_v0'
      and site_model_id is not null
      and crawl_run_id is not null
      and research_idea_id is not null
      and goal_id is null
    )
  );

alter table public.decision_runs
  drop constraint if exists decision_runs_research_idea_id_fkey;

alter table public.decision_runs
  add constraint decision_runs_research_idea_id_fkey
  foreign key (research_idea_id)
  references public.research_ideas (id)
  on delete cascade;

alter table public.decision_runs
  drop constraint if exists decision_runs_research_idea_website_fk;

alter table public.decision_runs
  add constraint decision_runs_research_idea_website_fk
  foreign key (research_idea_id, website_id)
  references public.research_ideas (id, website_id)
  on delete cascade;

drop index if exists public.decision_runs_inspect_identity_gsc_uidx;
drop index if exists public.decision_runs_inspect_identity_no_gsc_uidx;

create unique index if not exists decision_runs_inspect_identity_gsc_uidx
  on public.decision_runs (website_id, research_idea_id, crawl_run_id, gsc_search_sync_id)
  where engine_version = 'decision_research_inspect_v0'
    and status = 'completed'
    and gsc_search_sync_id is not null;

create unique index if not exists decision_runs_inspect_identity_no_gsc_uidx
  on public.decision_runs (website_id, research_idea_id, crawl_run_id)
  where engine_version = 'decision_research_inspect_v0'
    and status = 'completed'
    and gsc_search_sync_id is null;

create index if not exists decision_runs_research_idea_id_idx
  on public.decision_runs (research_idea_id)
  where research_idea_id is not null;

alter table public.decisions
  drop constraint if exists decisions_decision_type_check;

alter table public.decisions
  add constraint decisions_decision_type_check
  check (decision_type in (
    'existing_demand_page_issue',
    'inspect_unanalyzed_page',
    'multi_page_issue_with_visibility',
    'inspect_related_demand_against_pages'
  ));

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
    'research_idea'
  ));

-- Inspect rows are investigations, not ranked v1 recommendations.
-- Existing 012 value CHECKs stay: rank 1-5, priority_band in
-- (do_first, next, later), confidence in (exact_match, bounded_dataset,
-- unmapped_page). Those CHECKs already pass NULL. The type-conditional
-- check below restores non-NULL for decision_v1 and forbids v1 fields on inspect.
alter table public.decisions
  add column if not exists inspection_state text;

alter table public.decisions
  alter column priority_band drop not null;

alter table public.decisions
  alter column rank drop not null;

alter table public.decisions
  alter column scoring drop default;

alter table public.decisions
  alter column scoring drop not null;

alter table public.decisions
  alter column confidence drop not null;

alter table public.decisions
  drop constraint if exists decisions_run_rank_unique;

drop index if exists public.decisions_run_rank_uidx;
drop index if exists public.decisions_inspect_one_per_run_uidx;

create unique index if not exists decisions_run_rank_uidx
  on public.decisions (decision_run_id, rank)
  where rank is not null;

create unique index if not exists decisions_inspect_one_per_run_uidx
  on public.decisions (decision_run_id)
  where decision_type = 'inspect_related_demand_against_pages';

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
        'ambiguous'
      )
    )
  );

-- Persistence-only create-or-reuse for already-computed inspect results.
-- Does not interpret matching, freshness, language, GSC meaning, or owner copy.
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

notify pgrst, 'reload schema';
