-- Foundfy VERIFY v0: persist crawl-based verification separately from action status.
-- Additive. Does not change actions.status. Does not store credentials.

create table if not exists public.action_verifications (
  id uuid primary key default gen_random_uuid(),
  action_id uuid not null references public.actions (id) on delete cascade,
  website_id uuid not null references public.websites (id) on delete cascade,
  execution_attempt_id uuid not null references public.action_attempts (id) on delete restrict,
  crawl_run_id uuid not null references public.crawl_runs (id) on delete restrict,
  target_page_id uuid references public.pages (id) on delete restrict,
  verification_type text not null
    check (verification_type = 'update_meta_description'),
  status text not null
    check (status in ('verified', 'not_verified', 'inconclusive')),
  expected_value text,
  observed_value text,
  evidence_snapshot jsonb not null default '{}'::jsonb,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  constraint action_verifications_action_attempt_crawl_unique
    unique (action_id, execution_attempt_id, crawl_run_id),
  constraint action_verifications_evidence_size_check
    check (char_length(evidence_snapshot::text) <= 8000)
);

create index if not exists action_verifications_action_id_idx
  on public.action_verifications (action_id, created_at desc);

create index if not exists action_verifications_website_id_idx
  on public.action_verifications (website_id, created_at desc);

alter table public.action_verifications enable row level security;

grant all on public.action_verifications to service_role;

notify pgrst, 'reload schema';
