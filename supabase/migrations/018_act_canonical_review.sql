-- Foundfy ACT v1 Slice B: canonical review-only records.
-- Dedicated table. No mutation_spec, field, before, after, Prepare, Approve, Execute, or VERIFY.
-- Owner-private. Survives Decision regeneration (decision_id ON DELETE SET NULL).
-- Disconnect: keep reviews, SET NULL GSC FKs, scrub copied Google metrics.

create table if not exists public.action_reviews (
  id uuid primary key default gen_random_uuid(),
  website_id uuid not null references public.websites (id) on delete cascade,
  review_type text not null
    check (review_type = 'review_canonical_target'),
  outcome text not null
    check (outcome in ('intentional', 'needs_change', 'unsure')),
  owner_id uuid not null references public.gsc_observe_owners (id) on delete restrict,
  reviewed_at timestamptz not null default now(),
  decision_id uuid references public.decisions (id) on delete set null,
  decision_run_id uuid references public.decision_runs (id) on delete set null,
  observation_id uuid not null references public.observations (id) on delete restrict,
  page_id uuid references public.pages (id) on delete restrict,
  crawl_run_id uuid not null references public.crawl_runs (id) on delete restrict,
  gsc_sync_id uuid references public.gsc_search_syncs (id) on delete set null,
  site_model_id uuid not null references public.site_models (id) on delete restrict,
  goal_id uuid not null references public.website_goals (id) on delete restrict,
  requested_url text not null,
  final_url text not null,
  canonical_url text not null,
  page_url text not null,
  created_at timestamptz not null default now(),
  constraint action_reviews_requested_url_length_check
    check (char_length(requested_url) <= 2048),
  constraint action_reviews_final_url_length_check
    check (char_length(final_url) <= 2048),
  constraint action_reviews_canonical_url_length_check
    check (char_length(canonical_url) <= 2048),
  constraint action_reviews_page_url_length_check
    check (char_length(page_url) <= 2048)
);

create index if not exists action_reviews_website_created_at_idx
  on public.action_reviews (website_id, created_at desc);

create index if not exists action_reviews_observation_id_idx
  on public.action_reviews (observation_id, created_at desc);

create index if not exists action_reviews_decision_id_idx
  on public.action_reviews (decision_id);

create table if not exists public.action_review_evidence_refs (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.action_reviews (id) on delete cascade,
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
  snapshot jsonb not null default '{}'::jsonb,
  constraint action_review_evidence_refs_snapshot_size_check
    check (char_length(snapshot::text) <= 4000)
);

create index if not exists action_review_evidence_refs_review_id_idx
  on public.action_review_evidence_refs (review_id);

alter table public.action_reviews enable row level security;
alter table public.action_review_evidence_refs enable row level security;

grant all on public.action_reviews to service_role;
grant all on public.action_review_evidence_refs to service_role;

notify pgrst, 'reload schema';
