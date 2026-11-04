-- Local disposable Postgres gate for Google-derived data cleanup (C1). Not applied to production.
-- Synthetic fixtures only. Loaded by scripts/google-cleanup-pg-gate.mjs after migrations 001-028.

create table if not exists google_cleanup_gate_ids (
  k text primary key,
  v uuid not null
);

-- Seeds one website with Google-derived data, historical ACT records and, optionally,
-- a Targeted OBSERVE chain (T0 inspect run -> targeted observation -> T1 inspect run).
--   p_mode = 'none'     : no targeted observation
--   p_mode = 'running'  : claimed observation still running (no T1 yet)
--   p_mode = 'analyzed' : finalized observation plus the T1 run that consumed it
create or replace function google_cleanup_gate_seed(p text, p_mode text default 'none')
returns void
language plpgsql
as $$
declare
  v_website uuid := gen_random_uuid();
  v_crawl uuid := gen_random_uuid();
  v_queue uuid := gen_random_uuid();
  v_page uuid := gen_random_uuid();
  v_identity uuid := gen_random_uuid();
  v_token uuid := gen_random_uuid();
  v_owner uuid := gen_random_uuid();
  v_model uuid := gen_random_uuid();
  v_goal uuid := gen_random_uuid();
  v_property uuid := gen_random_uuid();
  v_sync uuid := gen_random_uuid();
  v_run uuid := gen_random_uuid();
  v_decision uuid := gen_random_uuid();
  v_executed uuid := gen_random_uuid();
  v_attempt uuid := gen_random_uuid();
  v_research_run uuid := gen_random_uuid();
  v_idea uuid := gen_random_uuid();
  v_result_page uuid := gen_random_uuid();
  v_t0 jsonb;
  v_claim jsonb;
  v_host text := p || '.example.com';
  v_url text := 'https://' || p || '.example.com/es/pagina';
begin
  if p_mode not in ('none', 'running', 'analyzed') then
    raise exception 'unknown seed mode %', p_mode;
  end if;

  insert into public.websites (id, url, hostname) values (v_website, 'https://' || v_host, v_host);
  insert into public.crawl_runs (id, website_id, seed_url, purpose, max_pages, status, pages_crawled, pages_discovered, started_at, completed_at)
  values (v_crawl, v_website, 'https://' || v_host, 'site_sample', 10, 'completed', 1, 2, now(), now());
  insert into public.crawl_queue (id, crawl_run_id, url, status) values (v_queue, v_crawl, v_url, 'pending');
  insert into public.pages (id, crawl_run_id, website_id, requested_url, final_url, title)
  values (v_page, v_crawl, v_website, v_url, v_url, 'Pagina');
  insert into public.google_identities (id, google_sub, email) values (v_identity, p || '-sub', p || '@example.com');
  insert into public.google_oauth_tokens (id, google_identity_id, refresh_token_ciphertext, scopes)
  values (v_token, v_identity, 'cipher', 'https://www.googleapis.com/auth/webmasters.readonly');
  insert into public.gsc_observe_owners (id, website_id, google_identity_id, google_oauth_token_id, status)
  values (v_owner, v_website, v_identity, v_token, 'google_connected');
  insert into public.site_models (id, website_id, source_crawl_run_id, understanding, evidence)
  values (v_model, v_website, v_crawl, '{}'::jsonb, '{}'::jsonb);
  insert into public.website_goals (id, website_id, primary_goal_type) values (v_goal, v_website, 'get_more_enquiries');
  insert into public.gsc_property_connections (id, website_id, observe_owner_id, google_identity_id, property_uri, property_type, status)
  values (v_property, v_website, v_owner, v_identity, 'sc-domain:' || v_host, 'domain', 'connected');
  insert into public.gsc_search_syncs (id, website_id, property_connection_id, period_start, period_end, status)
  values (v_sync, v_website, v_property, '2026-10-01', '2026-10-28', 'completed');
  insert into public.gsc_search_evidence (sync_id, website_id, property_connection_id, evidence_type, period_start, period_end)
  values
    (v_sync, v_website, v_property, 'page', '2026-10-01', '2026-10-28'),
    (v_sync, v_website, v_property, 'query', '2026-10-01', '2026-10-28');
  insert into public.decision_runs (id, website_id, site_model_id, crawl_run_id, gsc_search_sync_id, goal_id, engine_version, status)
  values (v_run, v_website, v_model, v_crawl, v_sync, v_goal, 'decision_v1', 'completed');
  insert into public.decisions (id, decision_run_id, website_id, decision_type, title, explanation, rank, priority_band, confidence, scoring)
  values (v_decision, v_run, v_website, 'existing_demand_page_issue', 'Fix description', 'Synthetic', 1, 'do_first', 'exact_match', '{}'::jsonb);

  -- Historical ACT (executed + verified, blocked, cancelled) and one open action.
  insert into public.actions (id, website_id, decision_id, decision_run_id, owner_id, action_type, target_page_id, target_page_url, field, mutation_spec, crawl_run_id, gsc_sync_id, site_model_id, goal_id, status)
  values
    (v_executed,         v_website, v_decision, v_run, v_owner, 'update_meta_description', v_page, v_url, 'meta_description', '{}'::jsonb, v_crawl, v_sync, v_model, v_goal, 'executed'),
    (gen_random_uuid(), v_website, v_decision, v_run, v_owner, 'update_meta_description', v_page, v_url, 'meta_description', '{}'::jsonb, v_crawl, v_sync, v_model, v_goal, 'blocked'),
    (gen_random_uuid(), v_website, v_decision, v_run, v_owner, 'update_meta_description', v_page, v_url, 'meta_description', '{}'::jsonb, v_crawl, v_sync, v_model, v_goal, 'cancelled'),
    (gen_random_uuid(), v_website, v_decision, v_run, v_owner, 'update_page_title',       v_page, v_url, 'title',            '{}'::jsonb, v_crawl, v_sync, v_model, v_goal, 'approved');
  insert into public.action_attempts (id, action_id, attempt_number, idempotency_key, result)
  values (v_attempt, v_executed, 1, p || '-idem', 'success');
  insert into public.action_verifications (action_id, website_id, execution_attempt_id, crawl_run_id, verification_type, status)
  values (v_executed, v_website, v_attempt, v_crawl, 'update_meta_description', 'verified');
  insert into public.action_evidence_refs (action_id, kind, record_id, snapshot)
  values
    (v_executed, 'gsc_evidence', v_sync::text, '{"clicks": 7, "impressions": 120}'::jsonb),
    (v_executed, 'gsc_sync', v_sync::text, '{"period": "2026-10"}'::jsonb),
    (v_executed, 'page', v_page::text, '{"title": "Pagina"}'::jsonb);
  insert into public.analysis_requests (website_id, decision_id, decision_run_id, gsc_sync_id, requested_url, requested_url_key, requested_by, status)
  values (v_website, v_decision, v_run, v_sync, v_url, v_url, v_owner, 'requested');

  -- RESEARCH is always present: it must survive the cleanup.
  insert into public.research_runs (id, website_id, site_model_id, site_model_confirmed_at, requested_by, country_key, country_name, location_code, language_codes, offering_seeds, provider, provider_environment, status, request_fingerprint)
  values (v_research_run, v_website, v_model, now(), v_owner, 'es', 'Spain', 2724, array['es'], array['seda'], 'fixture', 'fixture', 'completed', md5(p) || md5(p || '2'));
  insert into public.research_ideas (id, run_id, website_id, seed_offering, language_code, keyword, compact_key, provider_result_order, initial_gsc_sample_status)
  values (v_idea, v_research_run, v_website, 'seda', 'es', 'pintar en seda', 'pintarensed', 0, 'not_in_current_gsc_sample');

  if p_mode in ('running', 'analyzed') then
    v_t0 := public.persist_research_inspect_decision(
      v_idea, v_model, v_crawl, v_sync, 'Inspect', 'No obvious match.', null, null,
      'no_obvious_match_in_current_crawl', false,
      jsonb_build_array(
        jsonb_build_object('kind', 'research_idea', 'record_id', v_idea::text, 'snapshot', '{}'::jsonb),
        jsonb_build_object('kind', 'research_run', 'record_id', v_research_run::text, 'snapshot', '{}'::jsonb),
        jsonb_build_object('kind', 'site_model', 'record_id', v_model::text, 'snapshot', '{}'::jsonb),
        jsonb_build_object('kind', 'crawl_run', 'record_id', v_crawl::text, 'snapshot', '{}'::jsonb),
        jsonb_build_object('kind', 'gsc_sync', 'record_id', v_sync::text, 'snapshot', '{}'::jsonb)
      )
    );
    v_claim := public.claim_targeted_observation(
      v_website, v_crawl, v_queue, (v_t0->>'run_id')::uuid, v_url, v_owner, 'owner_selected'
    );
    if v_claim->>'status' <> 'claimed' then
      raise exception 'fixture claim failed: %', v_claim;
    end if;
    insert into google_cleanup_gate_ids values (p || '_observation', (v_claim->>'observation_id')::uuid)
      on conflict (k) do update set v = excluded.v;

    if p_mode = 'analyzed' then
      insert into public.pages (id, crawl_run_id, website_id, requested_url, final_url, title)
      values (v_result_page, (v_claim->>'targeted_crawl_run_id')::uuid, v_website, v_url, v_url, 'Pagina observada');
      perform public.finalize_targeted_observation((v_claim->>'observation_id')::uuid, 'analyzed', v_result_page, null);
      -- T1 inspect run that consumed the observation (decision_runs -> targeted_observations RESTRICT).
      insert into public.decision_runs (website_id, site_model_id, crawl_run_id, gsc_search_sync_id, research_idea_id, targeted_observation_id, engine_version, status)
      values (v_website, v_model, v_crawl, v_sync, v_idea, (v_claim->>'observation_id')::uuid, 'decision_research_inspect_v0', 'completed');
    end if;
  end if;

  insert into google_cleanup_gate_ids values (p || '_website', v_website)
    on conflict (k) do update set v = excluded.v;
end;
$$;

create or replace function google_cleanup_gate_website(p text)
returns uuid
language sql
as $$
  select v from google_cleanup_gate_ids where k = p || '_website';
$$;

-- Aggregate, non-PII view of everything the cleanup may or must not touch for one website.
create or replace function google_cleanup_gate_state(p text)
returns jsonb
language sql
as $$
  with w as (select google_cleanup_gate_website(p) as id)
  select jsonb_build_object(
    'actions', (select jsonb_object_agg(status, n) from (select status, count(*) n from public.actions where website_id = (select id from w) group by status) s),
    'actions_with_null_refs', (select count(*) from public.actions where website_id = (select id from w) and decision_id is null and decision_run_id is null and gsc_sync_id is null),
    'attempts', (select count(*) from public.action_attempts a join public.actions x on x.id = a.action_id where x.website_id = (select id from w)),
    'verifications', (select count(*) from public.action_verifications where website_id = (select id from w)),
    'google_metric_snapshots', (select count(*) from public.action_evidence_refs r join public.actions x on x.id = r.action_id where x.website_id = (select id from w) and r.kind in ('gsc_evidence', 'gsc_sync') and r.snapshot <> '{}'::jsonb),
    'analysis_request_reasons', (select jsonb_agg(coalesce(failure_reason, '-') order by id) from public.analysis_requests where website_id = (select id from w)),
    'decision_runs', (select count(*) from public.decision_runs where website_id = (select id from w)),
    'decisions', (select count(*) from public.decisions where website_id = (select id from w)),
    'gsc_syncs', (select count(*) from public.gsc_search_syncs where website_id = (select id from w)),
    'gsc_evidence', (select count(*) from public.gsc_search_evidence where website_id = (select id from w)),
    'learning_snapshots', (select count(*) from public.action_learning_snapshots where website_id = (select id from w)),
    'targeted_observations', (select count(*) from public.targeted_observations where website_id = (select id from w)),
    'targeted_crawl_runs', (select count(*) from public.crawl_runs where website_id = (select id from w) and purpose = 'targeted_observe'),
    'pages', (select count(*) from public.pages where website_id = (select id from w)),
    'research_runs', (select count(*) from public.research_runs where website_id = (select id from w)),
    'research_ideas', (select count(*) from public.research_ideas where website_id = (select id from w))
  );
$$;

-- Global provenance invariants: no observation without its T0, no T1 without its observation.
create or replace function google_cleanup_gate_orphans()
returns jsonb
language sql
as $$
  select jsonb_build_object(
    'observations_without_t0', (select count(*) from public.targeted_observations o where not exists (select 1 from public.decision_runs r where r.id = o.source_inspect_run_id)),
    't1_without_observation', (select count(*) from public.decision_runs r where r.targeted_observation_id is not null and not exists (select 1 from public.targeted_observations o where o.id = r.targeted_observation_id))
  );
$$;
