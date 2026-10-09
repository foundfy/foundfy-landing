-- Foundfy Type B OBSERVE: owner-requested crawl of one Google-visible page.
-- Dedicated table. Not an ACT mutation. No mutation_spec, Prepare, Approve, Execute, VERIFY, or LEARN.
-- Owner-private. Survives Decision regeneration (decision_id ON DELETE SET NULL).
-- Disconnect: block pending/running requests, SET NULL GSC/Decision FKs, keep crawl result history.

create table if not exists public.analysis_requests (
  id uuid primary key default gen_random_uuid(),
  website_id uuid not null references public.websites (id) on delete cascade,
  decision_id uuid references public.decisions (id) on delete set null,
  decision_run_id uuid references public.decision_runs (id) on delete set null,
  gsc_sync_id uuid references public.gsc_search_syncs (id) on delete set null,
  requested_url text not null,
  requested_url_key text not null,
  requested_by uuid not null references public.gsc_observe_owners (id) on delete restrict,
  requested_at timestamptz not null default now(),
  crawl_run_id uuid references public.crawl_runs (id) on delete restrict,
  result_page_id uuid references public.pages (id) on delete set null,
  status text not null
    check (status in (
      'requested',
      'running',
      'analyzed',
      'fetch_failed',
      'blocked'
    )),
  failure_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint analysis_requests_requested_url_length_check
    check (char_length(requested_url) <= 2048),
  constraint analysis_requests_requested_url_key_length_check
    check (char_length(requested_url_key) <= 2048),
  constraint analysis_requests_failure_reason_length_check
    check (failure_reason is null or char_length(failure_reason) <= 500)
);

create unique index if not exists analysis_requests_active_website_url_idx
  on public.analysis_requests (website_id, requested_url_key)
  where status in ('requested', 'running');

create index if not exists analysis_requests_website_created_at_idx
  on public.analysis_requests (website_id, created_at desc);

create index if not exists analysis_requests_decision_id_idx
  on public.analysis_requests (decision_id);

create index if not exists analysis_requests_crawl_run_id_idx
  on public.analysis_requests (crawl_run_id);

alter table public.analysis_requests enable row level security;

grant all on public.analysis_requests to service_role;

notify pgrst, 'reload schema';
