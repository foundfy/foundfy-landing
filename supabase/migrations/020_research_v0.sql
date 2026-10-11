-- Foundfy RESEARCH v0: owner-triggered related demand around confirmed offerings.
-- Owner-private. Not Decisions, Actions, Opportunities, SERP, or Google Ads metrics.
-- GSC disconnect must SET NULL the sync FK and keep external RESEARCH evidence.
-- Website deletion removes RESEARCH rows.
-- site_model_id and requested_by SET NULL so sibling CASCADE from websites is not blocked.

create table if not exists public.research_runs (
  id uuid primary key default gen_random_uuid(),
  website_id uuid not null references public.websites (id) on delete cascade,
  site_model_id uuid references public.site_models (id) on delete set null,
  site_model_confirmed_at timestamptz not null,
  requested_by uuid references public.gsc_observe_owners (id) on delete set null,
  gsc_sync_id uuid references public.gsc_search_syncs (id) on delete set null,
  gsc_queries_truncated boolean not null default false,
  country_key text not null,
  country_name text not null,
  location_code integer not null,
  language_codes text[] not null,
  offering_seeds text[] not null,
  provider text not null
    check (provider in ('fixture', 'dataforseo')),
  provider_environment text not null
    check (provider_environment in ('fixture', 'sandbox', 'live')),
  status text not null
    check (status in ('requested', 'running', 'completed', 'partial', 'failed')),
  request_fingerprint text not null,
  request_ledger jsonb not null default '[]'::jsonb,
  provider_cost numeric,
  failure_code text,
  failure_message text,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint research_runs_id_website_id_key unique (id, website_id),
  constraint research_runs_provider_environment_compat_check
    check (
      (provider = 'fixture' and provider_environment = 'fixture')
      or (provider = 'dataforseo' and provider_environment in ('sandbox', 'live'))
    ),
  constraint research_runs_country_key_length_check
    check (char_length(country_key) >= 2 and char_length(country_key) <= 8),
  constraint research_runs_country_name_length_check
    check (char_length(country_name) >= 2 and char_length(country_name) <= 80),
  constraint research_runs_location_code_check
    check (location_code > 0),
  constraint research_runs_language_codes_length_check
    check (
      cardinality(language_codes) >= 1
      and cardinality(language_codes) <= 3
    ),
  constraint research_runs_offering_seeds_length_check
    check (
      cardinality(offering_seeds) >= 1
      and cardinality(offering_seeds) <= 5
    ),
  constraint research_runs_request_fingerprint_length_check
    check (char_length(request_fingerprint) = 64),
  constraint research_runs_request_ledger_bounds_check
    check (
      jsonb_typeof(request_ledger) = 'array'
      and jsonb_array_length(request_ledger) <= 15
    ),
  constraint research_runs_provider_cost_nonnegative_check
    check (provider_cost is null or provider_cost >= 0),
  constraint research_runs_failure_code_length_check
    check (failure_code is null or char_length(failure_code) <= 80),
  constraint research_runs_failure_message_length_check
    check (failure_message is null or char_length(failure_message) <= 500)
);

create unique index if not exists research_runs_active_fingerprint_uidx
  on public.research_runs (website_id, request_fingerprint)
  where status in ('requested', 'running');

create index if not exists research_runs_website_created_at_idx
  on public.research_runs (website_id, created_at desc);

create index if not exists research_runs_website_fingerprint_idx
  on public.research_runs (website_id, request_fingerprint, created_at desc);

create table if not exists public.research_ideas (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.research_runs (id) on delete cascade,
  website_id uuid not null references public.websites (id) on delete cascade,
  seed_offering text not null,
  language_code text not null,
  provider_task_id text,
  keyword text not null,
  compact_key text not null,
  estimated_monthly_searches integer,
  provider_result_order integer not null,
  initial_gsc_sample_status text not null
    check (initial_gsc_sample_status in (
      'in_current_gsc_sample',
      'not_in_current_gsc_sample'
    )),
  created_at timestamptz not null default now(),
  constraint research_ideas_run_website_fk
    foreign key (run_id, website_id)
    references public.research_runs (id, website_id)
    on delete cascade,
  constraint research_ideas_seed_offering_length_check
    check (char_length(seed_offering) >= 1 and char_length(seed_offering) <= 80),
  constraint research_ideas_language_code_length_check
    check (char_length(language_code) >= 2 and char_length(language_code) <= 8),
  constraint research_ideas_keyword_length_check
    check (char_length(keyword) >= 1 and char_length(keyword) <= 160),
  constraint research_ideas_compact_key_length_check
    check (char_length(compact_key) >= 1 and char_length(compact_key) <= 160),
  constraint research_ideas_provider_task_id_length_check
    check (provider_task_id is null or char_length(provider_task_id) <= 80),
  constraint research_ideas_estimated_monthly_searches_nonnegative_check
    check (estimated_monthly_searches is null or estimated_monthly_searches >= 0),
  constraint research_ideas_provider_result_order_check
    check (provider_result_order >= 0 and provider_result_order <= 20000)
);

create index if not exists research_ideas_run_id_idx
  on public.research_ideas (run_id, language_code, provider_result_order);

create index if not exists research_ideas_website_id_idx
  on public.research_ideas (website_id);

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
  existing public.research_runs%rowtype;
  created public.research_runs%rowtype;
begin
  perform pg_advisory_xact_lock(
    hashtext(p_website_id::text),
    hashtext(p_request_fingerprint)
  );

  select *
    into existing
    from public.research_runs
   where website_id = p_website_id
     and request_fingerprint = p_request_fingerprint
     and status = 'completed'
     and completed_at is not null
     and completed_at >= p_reuse_since
   order by completed_at desc
   limit 1;
  if found then
    return jsonb_build_object('outcome', 'reuse_completed', 'run', to_jsonb(existing));
  end if;

  select *
    into existing
    from public.research_runs
   where website_id = p_website_id
     and request_fingerprint = p_request_fingerprint
     and status in ('requested', 'running')
   order by created_at desc
   limit 1;
  if found then
    return jsonb_build_object('outcome', 'reuse_active', 'run', to_jsonb(existing));
  end if;

  select *
    into existing
    from public.research_runs
   where website_id = p_website_id
     and request_fingerprint = p_request_fingerprint
     and status in ('partial', 'failed')
     and created_at >= p_reuse_since
   order by created_at desc
   limit 1;
  if found then
    return jsonb_build_object('outcome', 'block_retry', 'run', to_jsonb(existing));
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
      request_ledger
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
      '[]'::jsonb
    )
    returning * into created;
    return jsonb_build_object('outcome', 'claimed', 'run', to_jsonb(created));
  exception
    when unique_violation then
      select *
        into existing
        from public.research_runs
       where website_id = p_website_id
         and request_fingerprint = p_request_fingerprint
         and status in ('requested', 'running')
       order by created_at desc
       limit 1;
      if found then
        return jsonb_build_object('outcome', 'reuse_active', 'run', to_jsonb(existing));
      end if;

      select *
        into existing
        from public.research_runs
       where website_id = p_website_id
         and request_fingerprint = p_request_fingerprint
         and status = 'completed'
         and completed_at is not null
         and completed_at >= p_reuse_since
       order by completed_at desc
       limit 1;
      if found then
        return jsonb_build_object('outcome', 'reuse_completed', 'run', to_jsonb(existing));
      end if;

      raise;
  end;
end;
$$;

alter table public.research_runs enable row level security;
alter table public.research_ideas enable row level security;

grant all on public.research_runs to service_role;
grant all on public.research_ideas to service_role;

revoke all on function public.claim_research_run(uuid, text, timestamptz, jsonb) from public;
revoke all on function public.claim_research_run(uuid, text, timestamptz, jsonb) from anon;
revoke all on function public.claim_research_run(uuid, text, timestamptz, jsonb) from authenticated;
grant execute on function public.claim_research_run(uuid, text, timestamptz, jsonb) to service_role;

notify pgrst, 'reload schema';
