-- Foundfy LEARN v0: append-only post-verification Search Console comparisons.
-- Also makes disconnect/property-change explicit:
--   keep executed/verified/blocked/cancelled ACT history
--   delete Google-derived LEARN snapshots and GSC evidence
--   do not let GSC sync deletion cascade-wipe actions
-- Additive. Does not store credentials or AI conclusions.

alter table public.actions
  alter column decision_id drop not null,
  alter column decision_run_id drop not null,
  alter column gsc_sync_id drop not null;

alter table public.actions
  drop constraint if exists actions_decision_id_fkey,
  drop constraint if exists actions_decision_run_id_fkey,
  drop constraint if exists actions_gsc_sync_id_fkey;

alter table public.actions
  add constraint actions_decision_id_fkey
    foreign key (decision_id) references public.decisions (id) on delete set null,
  add constraint actions_decision_run_id_fkey
    foreign key (decision_run_id) references public.decision_runs (id) on delete set null,
  add constraint actions_gsc_sync_id_fkey
    foreign key (gsc_sync_id) references public.gsc_search_syncs (id) on delete set null;

create table if not exists public.action_learning_snapshots (
  id uuid primary key default gen_random_uuid(),
  action_id uuid not null references public.actions (id) on delete cascade,
  verification_id uuid not null references public.action_verifications (id) on delete cascade,
  website_id uuid not null references public.websites (id) on delete cascade,
  page_url text not null,
  page_comparison_key text not null,
  baseline_sync_id uuid references public.gsc_search_syncs (id) on delete set null,
  comparison_sync_id uuid not null references public.gsc_search_syncs (id) on delete cascade,
  baseline_period_start date not null,
  baseline_period_end date not null,
  comparison_period_start date not null,
  comparison_period_end date not null,
  baseline_appearances double precision not null,
  baseline_visits double precision not null,
  baseline_ctr double precision,
  baseline_position double precision,
  comparison_appearances double precision not null,
  comparison_visits double precision not null,
  comparison_ctr double precision,
  comparison_position double precision,
  baseline_pages_truncated boolean not null default false,
  comparison_pages_truncated boolean not null default false,
  outcome_state text not null
    check (outcome_state in (
      'insufficient_data',
      'observed_improvement',
      'observed_decline',
      'mixed',
      'no_meaningful_change'
    )),
  insufficient_reason text,
  calculation_version text not null default 'learn_v0'
    check (calculation_version = 'learn_v0'),
  created_at timestamptz not null default now(),
  constraint action_learning_snapshots_action_verification_sync_unique
    unique (action_id, verification_id, comparison_sync_id),
  constraint action_learning_snapshots_page_url_length_check
    check (char_length(page_url) <= 2048),
  constraint action_learning_snapshots_key_length_check
    check (char_length(page_comparison_key) <= 2048)
);

create index if not exists action_learning_snapshots_action_id_idx
  on public.action_learning_snapshots (action_id, created_at desc);

create index if not exists action_learning_snapshots_website_id_idx
  on public.action_learning_snapshots (website_id, created_at desc);

alter table public.action_learning_snapshots enable row level security;

grant all on public.action_learning_snapshots to service_role;

notify pgrst, 'reload schema';
