-- Local disposable Postgres gate for Migration 026. Not applied to production.

create table if not exists observe_gate_ctx (
  k text primary key,
  v uuid
);

create table if not exists observe_gate_results (
  test text primary key,
  status text not null,
  detail text
);

create or replace function observe_gate_put(p_k text, p_v uuid)
returns void language sql as $$
  insert into observe_gate_ctx(k, v) values (p_k, p_v)
  on conflict (k) do update set v = excluded.v;
$$;

create or replace function observe_gate_get(p_k text)
returns uuid language sql as $$
  select v from observe_gate_ctx where k = p_k;
$$;

create or replace function observe_gate_pass(p_test text, p_detail text default '')
returns void language sql as $$
  insert into observe_gate_results(test, status, detail)
  values (p_test, 'PASS', p_detail)
  on conflict (test) do update set status = 'PASS', detail = excluded.detail;
$$;

create or replace function observe_gate_fail(p_test text, p_detail text)
returns void language plpgsql as $$
begin
  insert into observe_gate_results(test, status, detail)
  values (p_test, 'FAIL', p_detail)
  on conflict (test) do update set status = 'FAIL', detail = excluded.detail;
  raise exception 'observe gate fail %: %', p_test, p_detail;
end;
$$;

create or replace function observe_gate_seed(p_prefix text)
returns void
language plpgsql
as $$
declare
  v_website uuid := gen_random_uuid();
  v_crawl uuid := gen_random_uuid();
  v_queue1 uuid := gen_random_uuid();
  v_queue2 uuid := gen_random_uuid();
  v_owner uuid := gen_random_uuid();
  v_identity uuid := gen_random_uuid();
  v_token uuid := gen_random_uuid();
  v_model uuid := gen_random_uuid();
  v_run uuid := gen_random_uuid();
  v_idea1 uuid := gen_random_uuid();
  v_idea2 uuid := gen_random_uuid();
  v_idea_clear uuid := gen_random_uuid();
  v_idea_amb uuid := gen_random_uuid();
  v_property uuid := gen_random_uuid();
  v_gsc1 uuid := gen_random_uuid();
  v_gsc2 uuid := gen_random_uuid();
  v_t0 jsonb;
  v_t0b jsonb;
  v_t0g jsonb;
  v_t0clear jsonb;
  v_t0amb jsonb;
  v_host text := p_prefix || '.example.com';
  v_url1 text := 'https://' || v_host || '/es/pintar-en-seda';
  v_url2 text := 'https://' || v_host || '/es/seda-studio';
begin
  insert into public.websites (id, url, hostname, last_crawled_at)
  values (v_website, 'https://' || v_host, v_host, timestamptz '2020-01-01 00:00:00+00');

  insert into public.crawl_runs (
    id, website_id, seed_url, purpose, max_pages, status, pages_crawled, pages_discovered, started_at, completed_at
  ) values (
    v_crawl, v_website, 'https://' || v_host, 'site_sample', 10, 'completed', 2, 8,
    timezone('utc', now()), timezone('utc', now())
  );

  insert into public.crawl_queue (id, crawl_run_id, url, status, skip_reason)
  values
    (v_queue1, v_crawl, v_url1, 'pending', null),
    (v_queue2, v_crawl, v_url2, 'pending', null);

  insert into public.pages (crawl_run_id, website_id, requested_url, final_url, title)
  values (v_crawl, v_website, 'https://' || v_host || '/es', 'https://' || v_host || '/es', 'Home');

  insert into public.google_identities (id, google_sub, email)
  values (v_identity, p_prefix || '-sub', p_prefix || '@example.com');

  insert into public.google_oauth_tokens (id, google_identity_id, refresh_token_ciphertext, scopes)
  values (v_token, v_identity, 'cipher', 'https://www.googleapis.com/auth/webmasters.readonly');

  insert into public.gsc_observe_owners (id, website_id, google_identity_id, google_oauth_token_id, status)
  values (v_owner, v_website, v_identity, v_token, 'google_connected');

  insert into public.site_models (id, website_id, source_crawl_run_id, understanding, evidence)
  values (v_model, v_website, v_crawl, '{"offerings":["seda"]}'::jsonb, '{}'::jsonb);

  insert into public.research_runs (
    id, website_id, site_model_id, site_model_confirmed_at, requested_by,
    country_key, country_name, location_code, language_codes, offering_seeds,
    provider, provider_environment, status, request_fingerprint
  ) values (
    v_run, v_website, v_model, timezone('utc', now()), v_owner,
    'es', 'Spain', 2724, array['es'], array['seda'],
    'fixture', 'fixture', 'completed', md5(p_prefix) || md5(p_prefix || '2')
  );

  insert into public.research_ideas (
    id, run_id, website_id, seed_offering, language_code, keyword, compact_key,
    provider_result_order, initial_gsc_sample_status
  ) values
    (v_idea1, v_run, v_website, 'seda', 'es', 'pintar en seda', 'pintarensed', 0, 'not_in_current_gsc_sample'),
    (v_idea2, v_run, v_website, 'seda', 'es', 'pintura en seda', 'pinturaensed', 1, 'not_in_current_gsc_sample'),
    (v_idea_clear, v_run, v_website, 'seda', 'es', 'clear idea', 'clearidea', 2, 'not_in_current_gsc_sample'),
    (v_idea_amb, v_run, v_website, 'seda', 'es', 'ambiguous idea', 'ambidea', 3, 'not_in_current_gsc_sample');

  insert into public.gsc_property_connections (
    id, website_id, observe_owner_id, google_identity_id, property_uri, property_type, status
  ) values (
    v_property, v_website, v_owner, v_identity, 'sc-domain:' || v_host, 'domain', 'connected'
  );

  insert into public.gsc_search_syncs (
    id, website_id, property_connection_id, period_start, period_end, status
  ) values
    (v_gsc1, v_website, v_property, '2026-01-01', '2026-01-31', 'completed'),
    (v_gsc2, v_website, v_property, '2026-02-01', '2026-02-28', 'completed');

  v_t0 := public.persist_research_inspect_decision(
    v_idea1, v_model, v_crawl, v_gsc1,
    'Inspect pintar', 'No obvious match in current crawl.',
    null, null, 'no_obvious_match_in_current_crawl', false,
    jsonb_build_array(
      jsonb_build_object('kind', 'research_idea', 'record_id', v_idea1::text, 'snapshot', '{}'::jsonb),
      jsonb_build_object('kind', 'research_run', 'record_id', v_run::text, 'snapshot', '{}'::jsonb),
      jsonb_build_object('kind', 'site_model', 'record_id', v_model::text, 'snapshot', '{}'::jsonb),
      jsonb_build_object('kind', 'crawl_run', 'record_id', v_crawl::text, 'snapshot', '{}'::jsonb),
      jsonb_build_object('kind', 'gsc_sync', 'record_id', v_gsc1::text, 'snapshot', '{}'::jsonb)
    )
  );
  v_t0g := public.persist_research_inspect_decision(
    v_idea1, v_model, v_crawl, v_gsc2,
    'Inspect pintar newer gsc', 'No obvious match in current crawl.',
    null, null, 'no_obvious_match_in_current_crawl', false,
    jsonb_build_array(
      jsonb_build_object('kind', 'research_idea', 'record_id', v_idea1::text, 'snapshot', '{}'::jsonb),
      jsonb_build_object('kind', 'research_run', 'record_id', v_run::text, 'snapshot', '{}'::jsonb),
      jsonb_build_object('kind', 'site_model', 'record_id', v_model::text, 'snapshot', '{}'::jsonb),
      jsonb_build_object('kind', 'crawl_run', 'record_id', v_crawl::text, 'snapshot', '{}'::jsonb),
      jsonb_build_object('kind', 'gsc_sync', 'record_id', v_gsc2::text, 'snapshot', '{}'::jsonb)
    )
  );
  v_t0b := public.persist_research_inspect_decision(
    v_idea2, v_model, v_crawl, null,
    'Inspect pintura', 'No obvious match in current crawl.',
    null, null, 'no_obvious_match_in_current_crawl', false,
    jsonb_build_array(
      jsonb_build_object('kind', 'research_idea', 'record_id', v_idea2::text, 'snapshot', '{}'::jsonb),
      jsonb_build_object('kind', 'research_run', 'record_id', v_run::text, 'snapshot', '{}'::jsonb),
      jsonb_build_object('kind', 'site_model', 'record_id', v_model::text, 'snapshot', '{}'::jsonb),
      jsonb_build_object('kind', 'crawl_run', 'record_id', v_crawl::text, 'snapshot', '{}'::jsonb)
    )
  );
  v_t0clear := public.persist_research_inspect_decision(
    v_idea_clear, v_model, v_crawl, null,
    'Inspect clear', 'Clear existing page evidence.',
    null, null, 'clear_existing_page_evidence', false,
    jsonb_build_array(
      jsonb_build_object('kind', 'research_idea', 'record_id', v_idea_clear::text, 'snapshot', '{}'::jsonb),
      jsonb_build_object('kind', 'research_run', 'record_id', v_run::text, 'snapshot', '{}'::jsonb),
      jsonb_build_object('kind', 'site_model', 'record_id', v_model::text, 'snapshot', '{}'::jsonb),
      jsonb_build_object('kind', 'crawl_run', 'record_id', v_crawl::text, 'snapshot', '{}'::jsonb)
    )
  );
  v_t0amb := public.persist_research_inspect_decision(
    v_idea_amb, v_model, v_crawl, null,
    'Inspect amb', 'Ambiguous.',
    null, null, 'ambiguous', false,
    jsonb_build_array(
      jsonb_build_object('kind', 'research_idea', 'record_id', v_idea_amb::text, 'snapshot', '{}'::jsonb),
      jsonb_build_object('kind', 'research_run', 'record_id', v_run::text, 'snapshot', '{}'::jsonb),
      jsonb_build_object('kind', 'site_model', 'record_id', v_model::text, 'snapshot', '{}'::jsonb),
      jsonb_build_object('kind', 'crawl_run', 'record_id', v_crawl::text, 'snapshot', '{}'::jsonb)
    )
  );

  perform observe_gate_put(p_prefix || '_website', v_website);
  perform observe_gate_put(p_prefix || '_crawl', v_crawl);
  perform observe_gate_put(p_prefix || '_queue1', v_queue1);
  perform observe_gate_put(p_prefix || '_queue2', v_queue2);
  perform observe_gate_put(p_prefix || '_owner', v_owner);
  perform observe_gate_put(p_prefix || '_model', v_model);
  perform observe_gate_put(p_prefix || '_run', v_run);
  perform observe_gate_put(p_prefix || '_idea1', v_idea1);
  perform observe_gate_put(p_prefix || '_idea2', v_idea2);
  perform observe_gate_put(p_prefix || '_inspect1', (v_t0->>'run_id')::uuid);
  perform observe_gate_put(p_prefix || '_inspect_gsc2', (v_t0g->>'run_id')::uuid);
  perform observe_gate_put(p_prefix || '_inspect2', (v_t0b->>'run_id')::uuid);
  perform observe_gate_put(p_prefix || '_inspect_clear', (v_t0clear->>'run_id')::uuid);
  perform observe_gate_put(p_prefix || '_inspect_amb', (v_t0amb->>'run_id')::uuid);
  perform observe_gate_put(p_prefix || '_gsc1', v_gsc1);
  perform observe_gate_put(p_prefix || '_page_source', (
    select p.id from public.pages p where p.crawl_run_id = v_crawl limit 1
  ));
end;
$$;

select observe_gate_seed('a');
select observe_gate_seed('b');
select observe_gate_seed('c');
select observe_gate_seed('d');
select observe_gate_seed('e');

insert into observe_gate_ctx(k, v)
select 'b_url_key', '00000000-0000-0000-0000-000000000000'
where false;

do $$
begin
  -- Store URL keys as text via a side table.
  create table if not exists observe_gate_text (
    k text primary key,
    v text not null
  );
  insert into observe_gate_text(k, v) values
    ('a_url_key', 'https://a.example.com/es/pintar-en-seda'),
    ('a_url_key_2', 'https://a.example.com/es/seda-studio'),
    ('b_url_key', 'https://b.example.com/es/pintar-en-seda'),
    ('b_url_key_2', 'https://b.example.com/es/seda-studio'),
    ('c_url_key', 'https://c.example.com/es/pintar-en-seda'),
    ('d_url_key', 'https://d.example.com/es/pintar-en-seda'),
    ('e_url_key', 'https://e.example.com/es/pintar-en-seda'),
    ('e_url_key_2', 'https://e.example.com/es/seda-studio')
  on conflict (k) do update set v = excluded.v;
end;
$$;

-- ---------------------------------------------------------------------------
-- Claim suite
-- ---------------------------------------------------------------------------

do $$
declare
  v_claim jsonb;
  v_obs uuid;
  v_crawl uuid;
  v_page uuid;
  v_source_page uuid;
  v_last timestamptz;
  v_count integer;
  v_orig_inspect uuid;
begin
  begin
    set local role anon;
    perform public.claim_targeted_observation(
      observe_gate_get('a_website'), observe_gate_get('a_crawl'), observe_gate_get('a_queue1'),
      observe_gate_get('a_inspect1'), 'https://a.example.com/es/pintar-en-seda',
      observe_gate_get('a_owner'), 'owner_selected'
    );
    perform observe_gate_fail('claim_acl', 'anon was allowed to execute claim');
  exception
    when insufficient_privilege then
      perform observe_gate_pass('claim_acl', 'anon denied');
  end;
  set role postgres;

  v_claim := public.claim_targeted_observation(
    observe_gate_get('a_website'), observe_gate_get('a_crawl'), observe_gate_get('a_queue1'),
    observe_gate_get('a_inspect1'), 'https://a.example.com/es/pintar-en-seda',
    observe_gate_get('a_owner'), 'owner_selected'
  );
  if v_claim->>'status' <> 'claimed' then
    perform observe_gate_fail('claim_fresh', v_claim::text);
  end if;
  v_obs := (v_claim->>'observation_id')::uuid;
  v_crawl := (v_claim->>'targeted_crawl_run_id')::uuid;
  perform observe_gate_put('a_obs1', v_obs);
  perform observe_gate_put('a_tcrawl1', v_crawl);

  if (select purpose from crawl_runs where id = v_crawl) <> 'targeted_observe'
     or (select max_pages from crawl_runs where id = v_crawl) <> 1
     or (select status from crawl_runs where id = v_crawl) <> 'running'
     or (select pages_crawled from crawl_runs where id = v_crawl) <> 0
     or (select pages_discovered from crawl_runs where id = v_crawl) <> 0
     or (select count(*) from crawl_queue where crawl_run_id = v_crawl) <> 0
     or (select requested_url from targeted_observations where id = v_obs)
          <> (select url from crawl_queue where id = observe_gate_get('a_queue1')) then
    perform observe_gate_fail('claim_atomic', 'targeted crawl shape invalid');
  end if;
  if (select source_research_idea_id from targeted_observations where id = v_obs)
       <> observe_gate_get('a_idea1')
     or (select source_inspect_run_id from targeted_observations where id = v_obs)
       <> observe_gate_get('a_inspect1') then
    perform observe_gate_fail('claim_source_idea', 'source idea/inspect not stored');
  end if;

  v_claim := public.claim_targeted_observation(
    observe_gate_get('a_website'), observe_gate_get('a_crawl'), observe_gate_get('a_queue2'),
    observe_gate_get('a_inspect1'), 'https://a.example.com/es/seda-studio',
    observe_gate_get('a_owner'), 'owner_selected'
  );
  if v_claim->>'status' <> 'already_running' then
    perform observe_gate_fail('claim_already_running', v_claim::text);
  end if;

  begin
    perform public.claim_targeted_observation(
      observe_gate_get('a_website'), observe_gate_get('a_crawl'), observe_gate_get('a_queue1'),
      observe_gate_get('a_inspect_clear'), 'https://a.example.com/es/pintar-en-seda',
      observe_gate_get('a_owner'), 'owner_selected'
    );
    perform observe_gate_fail('claim_clear_rejected', 'clear T0 was accepted');
  exception
    when others then
      if sqlerrm not like '%no_obvious_match_in_current_crawl%' then
        perform observe_gate_fail('claim_clear_rejected', sqlerrm);
      end if;
  end;

  begin
    perform public.claim_targeted_observation(
      observe_gate_get('a_website'), observe_gate_get('a_crawl'), observe_gate_get('a_queue1'),
      observe_gate_get('a_inspect_amb'), 'https://a.example.com/es/pintar-en-seda',
      observe_gate_get('a_owner'), 'owner_selected'
    );
    perform observe_gate_fail('claim_ambiguous_rejected', 'ambiguous T0 was accepted');
  exception
    when others then
      if sqlerrm not like '%no_obvious_match_in_current_crawl%' then
        perform observe_gate_fail('claim_ambiguous_rejected', sqlerrm);
      end if;
  end;

  begin
    perform public.claim_targeted_observation(
      observe_gate_get('a_website'), observe_gate_get('a_crawl'), gen_random_uuid(),
      observe_gate_get('a_inspect1'), 'https://a.example.com/es/pintar-en-seda',
      observe_gate_get('a_owner'), 'owner_selected'
    );
    perform observe_gate_fail('claim_wrong_queue', 'missing queue accepted');
  exception
    when others then
      if sqlerrm not like '%source queue%' then
        perform observe_gate_fail('claim_wrong_queue', sqlerrm);
      end if;
  end;

  v_last := (select last_crawled_at from websites where id = observe_gate_get('a_website'));
  v_source_page := observe_gate_get('a_page_source');
  begin
    perform public.finalize_targeted_observation(v_obs, 'analyzed', v_source_page, null);
    perform observe_gate_fail('finalize_wrong_page', 'source crawl page accepted');
  exception
    when others then
      if sqlerrm not like '%result page does not belong%' then
        perform observe_gate_fail('finalize_wrong_page', sqlerrm);
      end if;
  end;

  perform public.finalize_targeted_observation(v_obs, 'fetch_failed', null, 'interrupted');
  if (select status from targeted_observations where id = v_obs) <> 'fetch_failed'
     or (select status from crawl_runs where id = v_crawl) <> 'failed'
     or (select last_crawled_at from websites where id = observe_gate_get('a_website')) is distinct from v_last then
    perform observe_gate_fail('finalize_failed', 'failure terminals or last_crawled_at changed');
  end if;
  perform public.finalize_targeted_observation(v_obs, 'fetch_failed', null, 'interrupted');
  perform observe_gate_put('a_obs_failed', v_obs);

  v_claim := public.claim_targeted_observation(
    observe_gate_get('a_website'), observe_gate_get('a_crawl'), observe_gate_get('a_queue1'),
    observe_gate_get('a_inspect1'), 'https://a.example.com/es/pintar-en-seda',
    observe_gate_get('a_owner'), 'owner_selected'
  );
  if v_claim->>'status' <> 'claimed' then
    perform observe_gate_fail('claim_after_failed', v_claim::text);
  end if;
  v_obs := (v_claim->>'observation_id')::uuid;
  v_crawl := (v_claim->>'targeted_crawl_run_id')::uuid;
  insert into public.pages (crawl_run_id, website_id, requested_url, final_url, title)
  values (v_crawl, observe_gate_get('a_website'), 'https://a.example.com/es/pintar-en-seda', 'https://a.example.com/es/pintar-en-seda', 'Pintar')
  returning id into v_page;
  perform public.finalize_targeted_observation(v_obs, 'analyzed', v_page, null);
  if (select status from targeted_observations where id = v_obs) <> 'analyzed'
     or (select status from crawl_runs where id = v_crawl) <> 'completed'
     or (select pages_crawled from crawl_runs where id = v_crawl) <> 1
     or (select pages_discovered from crawl_runs where id = v_crawl) <> 0
     or (select last_crawled_at from websites where id = observe_gate_get('a_website')) is distinct from v_last then
    perform observe_gate_fail('finalize_analyzed', 'success terminals invalid');
  end if;
  perform public.finalize_targeted_observation(v_obs, 'analyzed', v_page, null);

  begin
    perform public.finalize_targeted_observation(v_obs, 'analyzed', v_source_page, null);
    perform observe_gate_fail('finalize_analyzed_other_page', 'different page accepted');
  exception
    when others then
      if sqlerrm not like '%split or mismatched%' and sqlerrm not like '%does not belong%' then
        perform observe_gate_fail('finalize_analyzed_other_page', sqlerrm);
      end if;
  end;

  begin
    perform public.finalize_targeted_observation(v_obs, 'fetch_failed', null, 'interrupted');
    perform observe_gate_fail('finalize_analyzed_to_failed', 'analyzed to fetch_failed accepted');
  exception
    when others then
      if sqlerrm not like '%split or mismatched%' then
        perform observe_gate_fail('finalize_analyzed_to_failed', sqlerrm);
      end if;
  end;

  begin
    perform public.finalize_targeted_observation(
      observe_gate_get('a_obs_failed'), 'analyzed', v_page, null
    );
    perform observe_gate_fail('finalize_failed_to_analyzed', 'fetch_failed to analyzed accepted');
  exception
    when others then
      if sqlerrm not like '%split or mismatched%' and sqlerrm not like '%does not belong%' then
        perform observe_gate_fail('finalize_failed_to_analyzed', sqlerrm);
      end if;
  end;

  perform observe_gate_put('a_obs_analyzed', v_obs);
  perform observe_gate_put('a_page_result', v_page);

  v_orig_inspect := (select source_inspect_run_id from targeted_observations where id = v_obs);
  v_claim := public.claim_targeted_observation(
    observe_gate_get('a_website'), observe_gate_get('a_crawl'), observe_gate_get('a_queue1'),
    observe_gate_get('a_inspect1'), 'https://a.example.com/es/pintar-en-seda',
    observe_gate_get('a_owner'), 'owner_selected'
  );
  if v_claim->>'status' <> 'reused' or (v_claim->>'observation_id')::uuid <> v_obs then
    perform observe_gate_fail('claim_reused', v_claim::text);
  end if;

  v_claim := public.claim_targeted_observation(
    observe_gate_get('a_website'), observe_gate_get('a_crawl'), observe_gate_get('a_queue1'),
    observe_gate_get('a_inspect_gsc2'), 'https://a.example.com/es/pintar-en-seda',
    observe_gate_get('a_owner'), 'owner_selected'
  );
  if v_claim->>'status' <> 'reused'
     or (v_claim->>'observation_id')::uuid <> v_obs
     or (select source_inspect_run_id from targeted_observations where id = v_obs) <> v_orig_inspect then
    perform observe_gate_fail('claim_newer_gsc_reuses_original', v_claim::text);
  end if;

  v_claim := public.claim_targeted_observation(
    observe_gate_get('a_website'), observe_gate_get('a_crawl'), observe_gate_get('a_queue1'),
    observe_gate_get('a_inspect2'), 'https://a.example.com/es/pintar-en-seda',
    observe_gate_get('a_owner'), 'owner_selected'
  );
  if v_claim->>'status' <> 'claimed' then
    perform observe_gate_fail('claim_different_idea', v_claim::text);
  end if;
  perform public.finalize_targeted_observation(
    (v_claim->>'observation_id')::uuid, 'fetch_failed', null, 'interrupted'
  );

  v_claim := public.claim_targeted_observation(
    observe_gate_get('a_website'), observe_gate_get('a_crawl'), observe_gate_get('a_queue2'),
    observe_gate_get('a_inspect1'), 'https://a.example.com/es/seda-studio',
    observe_gate_get('a_owner'), 'owner_selected'
  );
  if v_claim->>'status' <> 'claimed' then
    perform observe_gate_fail('claim_split_setup', v_claim::text);
  end if;
  insert into public.pages (crawl_run_id, website_id, requested_url, final_url, title)
  values (
    (v_claim->>'targeted_crawl_run_id')::uuid,
    observe_gate_get('a_website'),
    'https://a.example.com/es/seda-studio',
    'https://a.example.com/es/seda-studio',
    'Split'
  )
  returning id into v_page;
  update public.targeted_observations
     set status = 'analyzed',
         result_page_id = v_page,
         completed_at = timezone('utc', now()),
         updated_at = timezone('utc', now())
   where id = (v_claim->>'observation_id')::uuid;
  begin
    perform public.finalize_targeted_observation(
      (v_claim->>'observation_id')::uuid, 'analyzed', v_page, null
    );
    perform observe_gate_fail('finalize_split_state', 'split terminal accepted');
  exception
    when others then
      if sqlerrm not like '%split or mismatched%' then
        perform observe_gate_fail('finalize_split_state', sqlerrm);
      end if;
  end;
  if (select status from crawl_runs where id = (v_claim->>'targeted_crawl_run_id')::uuid) <> 'running' then
    perform observe_gate_fail('finalize_split_state', 'RPC repaired split crawl');
  end if;
  update public.targeted_observations
     set status = 'fetch_failed',
         result_page_id = null,
         failure_reason = 'interrupted',
         completed_at = timezone('utc', now())
   where id = (v_claim->>'observation_id')::uuid;
  update public.crawl_runs
     set status = 'failed',
         completed_at = timezone('utc', now())
   where id = (v_claim->>'targeted_crawl_run_id')::uuid;

  insert into public.crawl_runs (
    website_id, seed_url, purpose, max_pages, status, pages_crawled, pages_discovered, started_at, completed_at
  ) values (
    observe_gate_get('a_website'), 'https://a.example.com', 'site_sample', 10, 'completed', 3, 9,
    timezone('utc', now()), timezone('utc', now()) + interval '1 second'
  );
  v_count := (select count(*) from targeted_observations where website_id = observe_gate_get('a_website'));
  v_claim := public.claim_targeted_observation(
    observe_gate_get('a_website'), observe_gate_get('a_crawl'), observe_gate_get('a_queue1'),
    observe_gate_get('a_inspect1'), 'https://a.example.com/es/pintar-en-seda',
    observe_gate_get('a_owner'), 'owner_selected'
  );
  if v_claim->>'status' <> 'stale_source' then
    perform observe_gate_fail('claim_stale_source', v_claim::text);
  end if;
  if (select count(*) from targeted_observations where website_id = observe_gate_get('a_website')) <> v_count then
    perform observe_gate_fail('claim_stale_source', 'stale_source wrote rows');
  end if;

  perform observe_gate_pass('claim_suite', 'fresh/reuse/running/stale/acl');
  perform observe_gate_pass('finalize_suite', 'analyzed/failed/idempotent/wrong-page');
end;
$$;

-- ---------------------------------------------------------------------------
-- T1 existing RPC matrix
-- ---------------------------------------------------------------------------

do $$
declare
  v_claim jsonb;
  v_obs uuid;
  v_crawl uuid;
  v_page uuid;
  v_t1 jsonb;
  v_t1b jsonb;
  v_obs2 uuid;
  v_page2 uuid;
  v_evidence jsonb;
begin
  v_claim := public.claim_targeted_observation(
    observe_gate_get('c_website'), observe_gate_get('c_crawl'), observe_gate_get('c_queue1'),
    observe_gate_get('c_inspect1'), 'https://c.example.com/es/pintar-en-seda',
    observe_gate_get('c_owner'), 'owner_selected'
  );
  if v_claim->>'status' <> 'claimed' then
    perform observe_gate_fail('t1_claim', v_claim::text);
  end if;
  v_obs := (v_claim->>'observation_id')::uuid;
  v_crawl := (v_claim->>'targeted_crawl_run_id')::uuid;
  insert into public.pages (crawl_run_id, website_id, requested_url, final_url, title)
  values (v_crawl, observe_gate_get('c_website'), 'https://c.example.com/es/pintar-en-seda', 'https://c.example.com/es/pintar-en-seda', 'Pintar')
  returning id into v_page;
  perform public.finalize_targeted_observation(v_obs, 'analyzed', v_page, null);

  v_evidence := jsonb_build_array(
    jsonb_build_object('kind', 'research_idea', 'record_id', observe_gate_get('c_idea1')::text, 'snapshot', '{}'::jsonb),
    jsonb_build_object('kind', 'research_run', 'record_id', observe_gate_get('c_run')::text, 'snapshot', '{}'::jsonb),
    jsonb_build_object('kind', 'site_model', 'record_id', observe_gate_get('c_model')::text, 'snapshot', '{}'::jsonb),
    jsonb_build_object('kind', 'crawl_run', 'record_id', observe_gate_get('c_crawl')::text, 'snapshot', '{}'::jsonb),
    jsonb_build_object('kind', 'targeted_observation', 'record_id', v_obs::text, 'snapshot', '{}'::jsonb),
    jsonb_build_object('kind', 'gsc_sync', 'record_id', observe_gate_get('c_gsc1')::text, 'snapshot', '{}'::jsonb)
  );

  v_t1 := public.persist_research_inspect_decision_with_observation(
    observe_gate_get('c_idea1'), observe_gate_get('c_model'), observe_gate_get('c_crawl'),
    observe_gate_get('c_gsc1'), v_obs,
    'T1 inspect', 'No obvious match after targeted observation.',
    null, null, 'no_obvious_match_after_targeted_observation', false, v_evidence
  );
  if v_t1->>'reused' <> 'false' then
    perform observe_gate_fail('t1_insert', v_t1::text);
  end if;
  if (select rank from decisions where id = (v_t1->>'decision_id')::uuid) is not null
     or (select scoring from decisions where id = (v_t1->>'decision_id')::uuid) is not null
     or (select goal_id from decision_runs where id = (v_t1->>'run_id')::uuid) is not null then
    perform observe_gate_fail('t1_null_v1_fields', 'goal/scoring/rank not null');
  end if;

  v_t1b := public.persist_research_inspect_decision_with_observation(
    observe_gate_get('c_idea1'), observe_gate_get('c_model'), observe_gate_get('c_crawl'),
    observe_gate_get('c_gsc1'), v_obs,
    'T1 inspect', 'No obvious match after targeted observation.',
    null, null, 'no_obvious_match_after_targeted_observation', false, v_evidence
  );
  if v_t1b->>'reused' <> 'true' or (v_t1b->>'run_id') <> (v_t1->>'run_id') then
    perform observe_gate_fail('t1_reuse', v_t1b::text);
  end if;

  if not exists (
    select 1
      from decision_runs
     where id = observe_gate_get('c_inspect1')
       and targeted_observation_id is null
       and research_idea_id = observe_gate_get('c_idea1')
       and crawl_run_id = observe_gate_get('c_crawl')
       and gsc_search_sync_id = observe_gate_get('c_gsc1')
  ) then
    perform observe_gate_fail('t1_distinct_from_t0', 'original T0 missing or overwritten');
  end if;
  if (v_t1->>'run_id')::uuid = observe_gate_get('c_inspect1') then
    perform observe_gate_fail('t1_distinct_from_t0', 'T1 reused T0 run_id');
  end if;
  if (select source_inspect_run_id from targeted_observations where id = v_obs)
       <> observe_gate_get('c_inspect1')
     or (select source_research_idea_id from targeted_observations where id = v_obs)
       <> observe_gate_get('c_idea1')
     or (select research_idea_id from decision_runs where id = observe_gate_get('c_inspect1'))
       <> observe_gate_get('c_idea1')
     or (select gsc_search_sync_id from decision_runs where id = (v_t1->>'run_id')::uuid)
       <> observe_gate_get('c_gsc1')
     or (select targeted_observation_id from decision_runs where id = (v_t1->>'run_id')::uuid)
       <> v_obs then
    perform observe_gate_fail('t1_provenance', 'T1 or observation provenance drifted');
  end if;

  begin
    perform public.persist_research_inspect_decision_with_observation(
      observe_gate_get('c_idea1'), observe_gate_get('c_model'), observe_gate_get('c_crawl'),
      observe_gate_get('c_gsc1'), v_obs,
      'T1 inspect', 'bad state',
      null, null, 'no_obvious_match_in_current_crawl', false, v_evidence
    );
    perform observe_gate_fail('t1_t0_state_rejected', 'T0 state accepted');
  exception
    when others then
      if sqlerrm not like '%inspection_state is invalid%' then
        perform observe_gate_fail('t1_t0_state_rejected', sqlerrm);
      end if;
  end;

  begin
    perform public.persist_research_inspect_decision_with_observation(
      observe_gate_get('c_idea1'), observe_gate_get('c_model'), observe_gate_get('c_crawl'),
      observe_gate_get('c_gsc1'), v_obs,
      'T1 inspect', 'wrong evidence',
      null, null, 'no_obvious_match_after_targeted_observation', false,
      jsonb_build_array(
        jsonb_build_object('kind', 'research_idea', 'record_id', observe_gate_get('c_idea1')::text, 'snapshot', '{}'::jsonb)
      )
    );
    perform observe_gate_fail('t1_evidence_rejected', 'incomplete evidence accepted');
  exception
    when others then
      if sqlerrm not like '%must include idea, run, site model, crawl, and targeted observation%' then
        perform observe_gate_fail('t1_evidence_rejected', sqlerrm);
      end if;
  end;

  v_claim := public.claim_targeted_observation(
    observe_gate_get('c_website'), observe_gate_get('c_crawl'), observe_gate_get('c_queue1'),
    observe_gate_get('c_inspect2'), 'https://c.example.com/es/pintar-en-seda',
    observe_gate_get('c_owner'), 'owner_selected'
  );
  v_obs2 := (v_claim->>'observation_id')::uuid;
  insert into public.pages (crawl_run_id, website_id, requested_url, final_url, title)
  values ((v_claim->>'targeted_crawl_run_id')::uuid, observe_gate_get('c_website'), 'https://c.example.com/es/pintar-en-seda', 'https://c.example.com/es/pintar-en-seda', 'Pintura')
  returning id into v_page2;
  perform public.finalize_targeted_observation(v_obs2, 'analyzed', v_page2, null);
  v_t1b := public.persist_research_inspect_decision_with_observation(
    observe_gate_get('c_idea2'), observe_gate_get('c_model'), observe_gate_get('c_crawl'),
    null, v_obs2,
    'T1 other idea', 'No obvious match after targeted observation.',
    null, null, 'no_obvious_match_after_targeted_observation', false,
    jsonb_build_array(
      jsonb_build_object('kind', 'research_idea', 'record_id', observe_gate_get('c_idea2')::text, 'snapshot', '{}'::jsonb),
      jsonb_build_object('kind', 'research_run', 'record_id', observe_gate_get('c_run')::text, 'snapshot', '{}'::jsonb),
      jsonb_build_object('kind', 'site_model', 'record_id', observe_gate_get('c_model')::text, 'snapshot', '{}'::jsonb),
      jsonb_build_object('kind', 'crawl_run', 'record_id', observe_gate_get('c_crawl')::text, 'snapshot', '{}'::jsonb),
      jsonb_build_object('kind', 'targeted_observation', 'record_id', v_obs2::text, 'snapshot', '{}'::jsonb)
    )
  );
  if (v_t1b->>'run_id') = (v_t1->>'run_id') then
    perform observe_gate_fail('t1_different_observation', 'T1 identities collided');
  end if;

  begin
    set local role anon;
    perform public.persist_research_inspect_decision_with_observation(
      observe_gate_get('c_idea1'), observe_gate_get('c_model'), observe_gate_get('c_crawl'),
      observe_gate_get('c_gsc1'), v_obs,
      'T1 inspect', 'No obvious match after targeted observation.',
      null, null, 'no_obvious_match_after_targeted_observation', false, v_evidence
    );
    perform observe_gate_fail('t1_acl', 'anon executed T1');
  exception
    when insufficient_privilege then
      perform observe_gate_pass('t1_acl', 'anon denied');
  end;
  set role postgres;

  begin
    perform public.claim_targeted_observation(
      observe_gate_get('c_website'), observe_gate_get('c_crawl'), observe_gate_get('c_queue1'),
      (v_t1->>'run_id')::uuid, 'https://c.example.com/es/pintar-en-seda',
      observe_gate_get('c_owner'), 'owner_selected'
    );
    perform observe_gate_fail('claim_t1_run_rejected', 'T1 run accepted as T0');
  exception
    when others then
      if sqlerrm not like '%not a valid T0 inspect%' then
        perform observe_gate_fail('claim_t1_run_rejected', sqlerrm);
      end if;
  end;

  begin
    perform public.persist_research_inspect_decision_with_observation(
      observe_gate_get('c_idea1'), observe_gate_get('c_model'), observe_gate_get('c_crawl'),
      observe_gate_get('c_gsc1'), observe_gate_get('a_obs_analyzed'),
      'T1 inspect', 'No obvious match after targeted observation.',
      null, null, 'no_obvious_match_after_targeted_observation', false, v_evidence
    );
    perform observe_gate_fail('t1_wrong_website_obs', 'cross-website observation accepted');
  exception
    when others then
      if sqlerrm not like '%does not belong to the idea website%' and sqlerrm not like '%was not found%' then
        perform observe_gate_fail('t1_wrong_website_obs', sqlerrm);
      end if;
  end;

  begin
    perform public.persist_research_inspect_decision_with_observation(
      observe_gate_get('c_idea1'), observe_gate_get('c_model'), observe_gate_get('c_crawl'),
      observe_gate_get('c_gsc1'), v_obs,
      'T1 inspect', 'No obvious match after targeted observation.',
      null, v_page2, 'no_obvious_match_after_targeted_observation', false, v_evidence
    );
    perform observe_gate_fail('t1_wrong_result_page', 'other targeted page accepted');
  exception
    when others then
      if sqlerrm not like '%does not belong to the idea website crawl%' then
        perform observe_gate_fail('t1_wrong_result_page', sqlerrm);
      end if;
  end;

  begin
    perform public.persist_research_inspect_decision_with_observation(
      observe_gate_get('c_idea1'), observe_gate_get('c_model'), observe_gate_get('c_crawl'),
      observe_gate_get('c_gsc1'), v_obs,
      'T1 inspect', 'gap',
      null, null, 'content_gap', false, v_evidence
    );
    perform observe_gate_fail('t1_content_gap_rejected', 'content_gap accepted');
  exception
    when others then
      if sqlerrm not like '%inspection_state is invalid%' then
        perform observe_gate_fail('t1_content_gap_rejected', sqlerrm);
      end if;
  end;

  perform observe_gate_pass('t1_suite', 'insert/reuse/distinct/security/provenance');
end;
$$;

-- ---------------------------------------------------------------------------
-- Website delete gate
-- ---------------------------------------------------------------------------

do $$
declare
  v_claim jsonb;
  v_obs uuid;
  v_page uuid;
  v_evidence jsonb;
begin
  v_claim := public.claim_targeted_observation(
    observe_gate_get('d_website'), observe_gate_get('d_crawl'), observe_gate_get('d_queue1'),
    observe_gate_get('d_inspect1'), 'https://d.example.com/es/pintar-en-seda',
    observe_gate_get('d_owner'), 'owner_selected'
  );
  v_obs := (v_claim->>'observation_id')::uuid;
  insert into public.pages (crawl_run_id, website_id, requested_url, final_url, title)
  values ((v_claim->>'targeted_crawl_run_id')::uuid, observe_gate_get('d_website'), 'https://d.example.com/es/pintar-en-seda', 'https://d.example.com/es/pintar-en-seda', 'Pintar')
  returning id into v_page;
  perform public.finalize_targeted_observation(v_obs, 'analyzed', v_page, null);
  v_evidence := jsonb_build_array(
    jsonb_build_object('kind', 'research_idea', 'record_id', observe_gate_get('d_idea1')::text, 'snapshot', '{}'::jsonb),
    jsonb_build_object('kind', 'research_run', 'record_id', observe_gate_get('d_run')::text, 'snapshot', '{}'::jsonb),
    jsonb_build_object('kind', 'site_model', 'record_id', observe_gate_get('d_model')::text, 'snapshot', '{}'::jsonb),
    jsonb_build_object('kind', 'crawl_run', 'record_id', observe_gate_get('d_crawl')::text, 'snapshot', '{}'::jsonb),
    jsonb_build_object('kind', 'targeted_observation', 'record_id', v_obs::text, 'snapshot', '{}'::jsonb),
    jsonb_build_object('kind', 'gsc_sync', 'record_id', observe_gate_get('d_gsc1')::text, 'snapshot', '{}'::jsonb)
  );
  perform public.persist_research_inspect_decision_with_observation(
    observe_gate_get('d_idea1'), observe_gate_get('d_model'), observe_gate_get('d_crawl'),
    observe_gate_get('d_gsc1'), v_obs,
    'T1 inspect', 'No obvious match after targeted observation.',
    null, null, 'no_obvious_match_after_targeted_observation', false, v_evidence
  );

  begin
    delete from public.websites where id = observe_gate_get('d_website');
    if exists (select 1 from websites where id = observe_gate_get('d_website'))
       or exists (select 1 from targeted_observations where website_id = observe_gate_get('d_website'))
       or exists (select 1 from crawl_runs where website_id = observe_gate_get('d_website'))
       or exists (select 1 from decision_runs where website_id = observe_gate_get('d_website'))
       or exists (select 1 from pages where website_id = observe_gate_get('d_website'))
       or exists (select 1 from research_ideas where website_id = observe_gate_get('d_website')) then
      insert into observe_gate_results(test, status, detail)
      values ('website_delete', 'FAIL', 'DELETE succeeded but leftovers remain')
      on conflict (test) do update set status = 'FAIL', detail = excluded.detail;
    else
      insert into observe_gate_results(test, status, detail)
      values ('website_delete', 'PASS', 'DELETE succeeded; dependents removed')
      on conflict (test) do update set status = 'PASS', detail = excluded.detail;
    end if;
  exception
    when others then
      insert into observe_gate_results(test, status, detail)
      values ('website_delete', 'FAIL', sqlerrm)
      on conflict (test) do update set status = 'FAIL', detail = excluded.detail;
  end;
end;
$$;

-- ---------------------------------------------------------------------------
-- Live catalog / ACL / index / lock-domain inspection
-- ---------------------------------------------------------------------------

do $$
declare
  v_claim oid;
  v_fin oid;
  v_t1 oid;
  v_idx text;
  v_claim_def text;
  v_fin_def text;
begin
  select p.oid into v_claim
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'claim_targeted_observation';
  select p.oid into v_fin
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'finalize_targeted_observation';
  select p.oid into v_t1
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'persist_research_inspect_decision_with_observation';

  if (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname='public' and p.proname='claim_targeted_observation') <> 1
     or (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname='public' and p.proname='finalize_targeted_observation') <> 1 then
    perform observe_gate_fail('catalog_overloads', 'unexpected function overload');
  end if;

  if pg_get_function_identity_arguments(v_claim)
       <> 'p_website_id uuid, p_source_crawl_run_id uuid, p_source_queue_id uuid, p_source_inspect_run_id uuid, p_requested_url_key text, p_requested_by uuid, p_selection_mode text'
     or pg_get_function_identity_arguments(v_fin)
       <> 'p_observation_id uuid, p_status text, p_result_page_id uuid, p_failure_reason text' then
    perform observe_gate_fail('catalog_signatures', 'unexpected RPC signature');
  end if;

  if not (select prosecdef from pg_proc where oid = v_claim)
     or not (select prosecdef from pg_proc where oid = v_fin)
     or not (select prosecdef from pg_proc where oid = v_t1) then
    perform observe_gate_fail('catalog_security_definer', 'SECURITY DEFINER missing');
  end if;

  if (select proconfig from pg_proc where oid = v_claim) is distinct from array['search_path=public']
     or (select proconfig from pg_proc where oid = v_fin) is distinct from array['search_path=public'] then
    perform observe_gate_fail('catalog_search_path', 'search_path is not public');
  end if;

  if has_function_privilege('public', v_claim, 'EXECUTE')
     or has_function_privilege('anon', v_claim, 'EXECUTE')
     or has_function_privilege('authenticated', v_claim, 'EXECUTE')
     or not has_function_privilege('service_role', v_claim, 'EXECUTE')
     or has_function_privilege('public', v_fin, 'EXECUTE')
     or has_function_privilege('anon', v_fin, 'EXECUTE')
     or has_function_privilege('authenticated', v_fin, 'EXECUTE')
     or not has_function_privilege('service_role', v_fin, 'EXECUTE')
     or has_function_privilege('public', v_t1, 'EXECUTE')
     or has_function_privilege('anon', v_t1, 'EXECUTE')
     or has_function_privilege('authenticated', v_t1, 'EXECUTE')
     or not has_function_privilege('service_role', v_t1, 'EXECUTE') then
    perform observe_gate_fail('catalog_acl', 'unexpected EXECUTE grants');
  end if;

  select pg_get_indexdef(ix.indexrelid) into v_idx
    from pg_index ix
    join pg_class i on i.oid = ix.indexrelid
   where i.relname = 'targeted_observations_analyzed_reuse_uidx';
  if v_idx is null
     or v_idx not like '%(website_id, source_crawl_run_id, source_research_idea_id, requested_url_key)%'
     or v_idx not like '%status = ''analyzed''%'
     or exists (
       select 1 from pg_index ix join pg_class i on i.oid = ix.indexrelid
        where i.relname = 'targeted_observations_analyzed_reuse_uidx' and not ix.indisunique
     ) then
    perform observe_gate_fail('catalog_reuse_index', coalesce(v_idx, 'missing'));
  end if;
  if exists (
    select 1 from pg_index ix join pg_class i on i.oid = ix.indexrelid
     where i.relname = 'targeted_observations_analyzed_reuse_uidx'
       and (not ix.indisvalid or not ix.indisready)
  ) then
    perform observe_gate_fail('catalog_reuse_index', 'index not valid/ready');
  end if;

  if not exists (
    select 1 from pg_index ix join pg_class i on i.oid = ix.indexrelid
     where i.relname = 'targeted_observations_active_website_uidx'
       and ix.indisunique and ix.indisvalid and ix.indisready
  ) then
    perform observe_gate_fail('catalog_active_index', 'active-running unique missing');
  end if;

  if not exists (
    select 1 from pg_constraint
     where conname = 'targeted_observations_source_inspect_run_id_fkey'
       and confdeltype = 'r'
  ) or not exists (
    select 1 from pg_constraint
     where conname = 'targeted_observations_source_research_idea_website_fk'
       and confdeltype = 'r'
  ) or not exists (
    select 1 from pg_constraint
     where conname = 'research_ideas_id_website_id_key'
  ) then
    perform observe_gate_fail('catalog_fks', 'provenance FKs missing or not RESTRICT');
  end if;

  v_claim_def := pg_get_functiondef(v_claim);
  v_fin_def := pg_get_functiondef(v_fin);
  if v_claim_def not like '%hashtext(''targeted_observe_lifecycle'')%'
     or v_fin_def not like '%hashtext(''targeted_observe_lifecycle'')%'
     or v_claim_def not like '%hashtext(v_website_id::text)%'
     or v_fin_def not like '%hashtext(v_website_id::text)%' then
    perform observe_gate_fail('catalog_lock_domain', 'advisory lock domain mismatch');
  end if;

  if exists (
    select 1 from crawl_runs cr
     where cr.purpose = 'targeted_observe'
       and not exists (
         select 1 from targeted_observations o where o.targeted_crawl_run_id = cr.id
       )
  ) then
    perform observe_gate_fail('catalog_orphans', 'orphan targeted crawl remains');
  end if;

  if exists (
    select 1 from websites w
     where w.last_crawled_at is distinct from timestamptz '2020-01-01 00:00:00+00'
  ) then
    perform observe_gate_fail('catalog_last_crawled', 'targeted path changed last_crawled_at');
  end if;

  if exists (
    select 1 from crawl_runs where purpose = 'targeted_observe' and status = 'queued'
  ) then
    perform observe_gate_fail('catalog_targeted_purpose', 'targeted crawl queued or mis-purposed');
  end if;

  perform observe_gate_pass('catalog_suite', 'signatures/acl/indexes/fks/lock');
end;
$$;
