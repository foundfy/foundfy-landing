begin;

create table if not exists research_027_gate_results (
  test text primary key,
  status text not null,
  detail text
);

do $$
declare
  constraint_def text;
  website_id uuid := '11111111-1111-4111-8111-111111111111';
  run_id uuid := '22222222-2222-4222-8222-222222222222';
  idea_unavailable uuid := '33333333-3333-4333-8333-333333333333';
  idea_in_sample uuid := '44444444-4444-4444-8444-444444444444';
  idea_not_in_sample uuid := '55555555-5555-4555-8555-555555555555';
  unsupported_ok boolean := false;
begin
  select pg_get_constraintdef(oid)
    into constraint_def
    from pg_constraint
   where conrelid = 'public.research_ideas'::regclass
     and conname = 'research_ideas_initial_gsc_sample_status_check';

  if constraint_def is null or constraint_def not like '%gsc_unavailable%' then
    insert into research_027_gate_results values
      ('check_definition', 'FAIL', coalesce(constraint_def, 'missing constraint'));
    raise exception '027 CHECK missing gsc_unavailable: %', constraint_def;
  end if;

  insert into public.websites (id, url, hostname)
  values (website_id, 'https://research-027.example/', 'research-027.example');

  insert into public.research_runs (
    id,
    website_id,
    site_model_confirmed_at,
    gsc_sync_id,
    country_key,
    country_name,
    location_code,
    language_codes,
    offering_seeds,
    provider,
    provider_environment,
    status,
    request_fingerprint
  ) values (
    run_id,
    website_id,
    now(),
    null,
    'US',
    'United States',
    2840,
    array['en'],
    array['silk paint'],
    'fixture',
    'fixture',
    'completed',
    repeat('a', 64)
  );

  insert into public.research_ideas (
    id, run_id, website_id, seed_offering, language_code, keyword, compact_key,
    provider_result_order, initial_gsc_sample_status
  ) values
    (idea_unavailable, run_id, website_id, 'silk paint', 'en', 'unavailable phrase', 'unavailable phrase', 1, 'gsc_unavailable'),
    (idea_in_sample, run_id, website_id, 'silk paint', 'en', 'in sample phrase', 'in sample phrase', 2, 'in_current_gsc_sample'),
    (idea_not_in_sample, run_id, website_id, 'silk paint', 'en', 'not in sample phrase', 'not in sample phrase', 3, 'not_in_current_gsc_sample');

  begin
    insert into public.research_ideas (
      run_id, website_id, seed_offering, language_code, keyword, compact_key,
      provider_result_order, initial_gsc_sample_status
    ) values (
      run_id, website_id, 'silk paint', 'en', 'bad status phrase', 'bad status phrase', 4, 'invented_status'
    );
  exception
    when check_violation then
      unsupported_ok := true;
  end;

  if not unsupported_ok then
    insert into research_027_gate_results values
      ('unsupported_status', 'FAIL', 'invented_status was accepted');
    raise exception 'unsupported initial_gsc_sample_status was accepted';
  end if;

  if exists (select 1 from public.gsc_search_syncs) then
    insert into research_027_gate_results values
      ('no_placeholder_sync', 'FAIL', 'gsc_search_syncs is not empty');
    raise exception 'placeholder gsc_search_syncs rows exist';
  end if;

  insert into research_027_gate_results values
    ('check_definition', 'PASS', constraint_def),
    ('accepted_statuses', 'PASS', 'gsc_unavailable,in_current_gsc_sample,not_in_current_gsc_sample'),
    ('unsupported_status', 'PASS', 'invented_status rejected'),
    ('no_placeholder_sync', 'PASS', 'gsc_search_syncs empty'),
    ('relationships', 'PASS', 'research_ideas retained null gsc_sync_id run');
end $$;

commit;
