-- Foundfy ACT v0 Slice 1: Prepare → Preview → Approve.
-- Additive. Provider-neutral. Does not store CMS credentials or claim execution.

create table if not exists public.actions (
  id uuid primary key default gen_random_uuid(),
  website_id uuid not null references public.websites (id) on delete cascade,
  decision_id uuid not null references public.decisions (id) on delete cascade,
  decision_run_id uuid not null references public.decision_runs (id) on delete cascade,
  owner_id uuid not null references public.gsc_observe_owners (id) on delete restrict,
  action_type text not null
    check (action_type = 'update_meta_description'),
  target_page_id uuid not null references public.pages (id) on delete restrict,
  target_page_url text not null,
  field text not null
    check (field = 'meta_description'),
  observed_before text,
  proposed_value text,
  mutation_spec jsonb not null,
  page_content_hash_at_prepare text,
  crawl_run_id uuid not null references public.crawl_runs (id) on delete restrict,
  gsc_sync_id uuid not null references public.gsc_search_syncs (id) on delete cascade,
  site_model_id uuid not null references public.site_models (id) on delete restrict,
  goal_id uuid not null references public.website_goals (id) on delete restrict,
  status text not null
    check (status in (
      'prepared',
      'awaiting_approval',
      'approved',
      'cancelled',
      'blocked'
    )),
  approved_by_owner_id uuid references public.gsc_observe_owners (id) on delete restrict,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint actions_proposed_value_length_check
    check (proposed_value is null or char_length(proposed_value) <= 320),
  constraint actions_target_page_url_length_check
    check (char_length(target_page_url) <= 2048),
  constraint actions_mutation_spec_size_check
    check (char_length(mutation_spec::text) <= 4000)
);

create unique index if not exists actions_open_decision_type_field_idx
  on public.actions (decision_id, action_type, field)
  where status in ('prepared', 'awaiting_approval', 'approved');

create index if not exists actions_website_created_at_idx
  on public.actions (website_id, created_at desc);

create index if not exists actions_decision_id_idx
  on public.actions (decision_id);

create table if not exists public.action_evidence_refs (
  id uuid primary key default gen_random_uuid(),
  action_id uuid not null references public.actions (id) on delete cascade,
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
  constraint action_evidence_refs_snapshot_size_check
    check (char_length(snapshot::text) <= 4000)
);

create index if not exists action_evidence_refs_action_id_idx
  on public.action_evidence_refs (action_id);

create table if not exists public.action_attempts (
  id uuid primary key default gen_random_uuid(),
  action_id uuid not null references public.actions (id) on delete cascade,
  attempt_number integer not null check (attempt_number >= 1),
  idempotency_key text not null,
  provider text,
  result text not null
    check (result in ('success', 'failure', 'ambiguous')),
  error_code text,
  created_at timestamptz not null default now(),
  finished_at timestamptz,
  constraint action_attempts_action_number_unique unique (action_id, attempt_number),
  constraint action_attempts_idempotency_key_unique unique (idempotency_key)
);

create index if not exists action_attempts_action_id_idx
  on public.action_attempts (action_id);

alter table public.actions enable row level security;
alter table public.action_evidence_refs enable row level security;
alter table public.action_attempts enable row level security;

grant all on public.actions to service_role;
grant all on public.action_evidence_refs to service_role;
grant all on public.action_attempts to service_role;

notify pgrst, 'reload schema';
