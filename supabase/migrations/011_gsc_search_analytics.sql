-- Foundfy OBSERVE Phase 3: bounded Search Analytics evidence.
-- Additive. Does not create findings, jobs, or Decision Engine outputs.

create table if not exists public.gsc_search_syncs (
  id uuid primary key default gen_random_uuid(),
  website_id uuid not null references public.websites (id) on delete cascade,
  property_connection_id uuid not null references public.gsc_property_connections (id) on delete restrict,
  period_start date not null,
  period_end date not null,
  status text not null
    check (status in ('running', 'completed', 'failed')),
  source text not null default 'google_search_console_search_analytics'
    check (source = 'google_search_console_search_analytics'),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  error_code text,
  site_row_count integer not null default 0,
  page_row_count integer not null default 0,
  query_row_count integer not null default 0,
  query_page_row_count integer not null default 0,
  pages_truncated boolean not null default false,
  queries_truncated boolean not null default false,
  query_pages_truncated boolean not null default false
);

create index if not exists gsc_search_syncs_website_started_at_idx
  on public.gsc_search_syncs (website_id, started_at desc);

create table if not exists public.gsc_search_evidence (
  id uuid primary key default gen_random_uuid(),
  sync_id uuid not null references public.gsc_search_syncs (id) on delete cascade,
  website_id uuid not null references public.websites (id) on delete cascade,
  property_connection_id uuid not null references public.gsc_property_connections (id) on delete restrict,
  evidence_type text not null
    check (evidence_type in ('site', 'page', 'query', 'query_page')),
  page_url text,
  page_id uuid references public.pages (id) on delete set null,
  query_text text,
  clicks double precision not null default 0,
  impressions double precision not null default 0,
  ctr double precision not null default 0,
  position double precision not null default 0,
  period_start date not null,
  period_end date not null,
  retrieved_at timestamptz not null default now()
);

create index if not exists gsc_search_evidence_sync_type_idx
  on public.gsc_search_evidence (sync_id, evidence_type);

create index if not exists gsc_search_evidence_website_id_idx
  on public.gsc_search_evidence (website_id);

alter table public.gsc_search_syncs enable row level security;
alter table public.gsc_search_evidence enable row level security;

grant all on public.gsc_search_syncs to service_role;
grant all on public.gsc_search_evidence to service_role;

notify pgrst, 'reload schema';
