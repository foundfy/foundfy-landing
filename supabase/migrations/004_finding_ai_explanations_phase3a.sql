-- Foundfy Phase 3A AI explanation enrichment schema
-- Run manually in Supabase SQL Editor after 003_priorities_phase2b.sql.

create table if not exists public.finding_ai_explanations (
  id uuid primary key default gen_random_uuid(),
  crawl_run_id uuid not null references public.crawl_runs (id) on delete cascade,
  finding_id uuid not null references public.observations (id) on delete cascade,
  contextual_explanation text,
  evidence_explanation text,
  cited_evidence_keys jsonb not null default '[]'::jsonb,
  input_hash text not null,
  model text not null,
  prompt_version text not null,
  status text not null default 'pending'
    check (status in ('pending', 'ready', 'failed', 'skipped')),
  generated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint finding_ai_explanations_crawl_finding_unique
    unique (crawl_run_id, finding_id)
);

create index if not exists finding_ai_explanations_crawl_run_id_idx
  on public.finding_ai_explanations (crawl_run_id);

create index if not exists finding_ai_explanations_status_idx
  on public.finding_ai_explanations (crawl_run_id, status);

alter table public.finding_ai_explanations enable row level security;

grant all on public.finding_ai_explanations to service_role;

notify pgrst, 'reload schema';
