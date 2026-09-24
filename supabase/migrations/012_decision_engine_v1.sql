-- Foundfy DECIDE Phase 1: Decision Engine v1.
-- Additive. Does not create ACT jobs or change crawl/Site Model/Goals tables.

create table if not exists public.decision_runs (
  id uuid primary key default gen_random_uuid(),
  website_id uuid not null references public.websites (id) on delete cascade,
  site_model_id uuid not null references public.site_models (id) on delete restrict,
  crawl_run_id uuid not null references public.crawl_runs (id) on delete restrict,
  gsc_search_sync_id uuid not null references public.gsc_search_syncs (id) on delete cascade,
  engine_version text not null
    check (engine_version = 'decision_v1'),
  status text not null
    check (status in ('running', 'completed', 'failed', 'stale')),
  goal_id uuid not null references public.website_goals (id) on delete restrict,
  goal_snapshot jsonb not null default '{}'::jsonb,
  gsc_truncated boolean not null default false,
  error_code text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists decision_runs_website_created_at_idx
  on public.decision_runs (website_id, created_at desc);

create table if not exists public.decisions (
  id uuid primary key default gen_random_uuid(),
  decision_run_id uuid not null references public.decision_runs (id) on delete cascade,
  website_id uuid not null references public.websites (id) on delete cascade,
  decision_type text not null
    check (decision_type in (
      'existing_demand_page_issue',
      'inspect_unanalyzed_page',
      'multi_page_issue_with_visibility'
    )),
  title text not null,
  explanation text not null,
  page_url text,
  page_id uuid references public.pages (id) on delete set null,
  priority_band text not null
    check (priority_band in ('do_first', 'next', 'later')),
  rank integer not null check (rank >= 1 and rank <= 5),
  scoring jsonb not null default '{}'::jsonb,
  confidence text not null
    check (confidence in ('exact_match', 'bounded_dataset', 'unmapped_page')),
  created_at timestamptz not null default now(),
  constraint decisions_run_rank_unique unique (decision_run_id, rank)
);

create index if not exists decisions_run_id_idx on public.decisions (decision_run_id);

create table if not exists public.decision_evidence_refs (
  id uuid primary key default gen_random_uuid(),
  decision_id uuid not null references public.decisions (id) on delete cascade,
  kind text not null
    check (kind in (
      'observation',
      'gsc_evidence',
      'page',
      'crawl_run',
      'gsc_sync',
      'site_model',
      'goal'
    )),
  record_id text not null,
  snapshot jsonb not null default '{}'::jsonb
);

create index if not exists decision_evidence_refs_decision_id_idx
  on public.decision_evidence_refs (decision_id);

alter table public.decision_runs enable row level security;
alter table public.decisions enable row level security;
alter table public.decision_evidence_refs enable row level security;

grant all on public.decision_runs to service_role;
grant all on public.decisions to service_role;
grant all on public.decision_evidence_refs to service_role;

notify pgrst, 'reload schema';
