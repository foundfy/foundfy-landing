-- Foundfy Phase 2A observations schema
-- Run manually in Supabase SQL Editor after 001_crawler_phase1.sql.

create table if not exists public.observations (
  id uuid primary key default gen_random_uuid(),
  crawl_run_id uuid not null references public.crawl_runs (id) on delete cascade,
  website_id uuid not null references public.websites (id) on delete cascade,
  page_id uuid references public.pages (id) on delete set null,
  rule_key text not null,
  category text not null
    check (category in ('indexability', 'page_fundamentals', 'internal_structure', 'site_discovery')),
  severity text not null check (severity in ('info', 'warning', 'error')),
  title text not null,
  description text not null,
  page_url text,
  subject_key text not null,
  evidence jsonb not null default '{}'::jsonb,
  status text not null default 'active'
    check (status in ('active', 'suppressed', 'resolved')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint observations_crawl_run_rule_subject_unique
    unique (crawl_run_id, rule_key, subject_key)
);

create index if not exists observations_crawl_run_id_idx
  on public.observations (crawl_run_id);

create index if not exists observations_website_id_idx
  on public.observations (website_id);

create index if not exists observations_rule_key_idx
  on public.observations (rule_key);

create index if not exists observations_category_severity_idx
  on public.observations (category, severity);

alter table public.observations enable row level security;

grant all on public.observations to service_role;

-- Refresh PostgREST schema cache so the API can see the new table immediately.
notify pgrst, 'reload schema';
