-- Foundfy Site Model v0: persistent understanding of a website.
-- Additive. Does not alter crawler, observations, priorities, or comparison.
--
-- status:
--   draft     = deterministic understanding, not user-confirmed (v0 always this)
--   confirmed = reserved for later user confirmation
--   stale     = reserved when a confirmed model lags a newer crawl
--
-- interpretation / confirmed columns are null in v0.
-- They exist so later work can add Foundfy draft interpretation and
-- user-confirmed understanding without another shape change.

create table if not exists public.site_models (
  id uuid primary key default gen_random_uuid(),
  website_id uuid not null references public.websites (id) on delete cascade,
  source_crawl_run_id uuid not null references public.crawl_runs (id) on delete cascade,
  version integer not null default 1 check (version >= 1),
  status text not null default 'draft'
    check (status in ('draft', 'confirmed', 'stale')),
  understanding jsonb not null,
  interpretation jsonb,
  confirmed jsonb,
  evidence jsonb not null default '{}'::jsonb,
  derived_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint site_models_website_crawl_unique unique (website_id, source_crawl_run_id)
);

create index if not exists site_models_website_id_derived_at_idx
  on public.site_models (website_id, derived_at desc);

alter table public.site_models enable row level security;

grant all on public.site_models to service_role;

notify pgrst, 'reload schema';
