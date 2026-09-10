-- Foundfy Phase 2B deterministic prioritisation schema
-- Run manually in Supabase SQL Editor after 002_observations_phase2a.sql.

create table if not exists public.observation_priorities (
  id uuid primary key default gen_random_uuid(),
  crawl_run_id uuid not null references public.crawl_runs (id) on delete cascade,
  website_id uuid not null references public.websites (id) on delete cascade,
  observation_id uuid not null references public.observations (id) on delete cascade,
  rule_key text not null,
  subject_key text not null,
  priority_score integer not null check (priority_score between 0 and 100),
  priority_level text not null
    check (priority_level in ('critical', 'high', 'medium', 'low')),
  impact_score integer not null check (impact_score between 0 and 100),
  reach_score integer not null check (reach_score between 0 and 100),
  confidence_score integer not null check (confidence_score between 0 and 100),
  why_it_matters text not null,
  recommended_action text not null,
  verification text,
  explainability jsonb not null default '{}'::jsonb,
  rank integer not null,
  status text not null default 'active'
    check (status in ('active', 'suppressed', 'resolved')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint observation_priorities_crawl_observation_unique
    unique (crawl_run_id, observation_id)
);

create index if not exists observation_priorities_crawl_run_id_idx
  on public.observation_priorities (crawl_run_id);

create index if not exists observation_priorities_rank_idx
  on public.observation_priorities (crawl_run_id, rank);

alter table public.observation_priorities enable row level security;

grant all on public.observation_priorities to service_role;

notify pgrst, 'reload schema';
