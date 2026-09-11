-- Foundfy Phase A: website scan history lookups
-- Run manually in Supabase SQL Editor when deploying Phase A.

create index if not exists crawl_runs_website_id_created_at_idx
  on public.crawl_runs (website_id, created_at desc);

alter table public.crawl_runs
  add column if not exists observations_materialized_at timestamptz;
