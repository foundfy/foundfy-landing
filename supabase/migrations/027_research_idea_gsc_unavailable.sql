-- Foundfy RESEARCH: admit gsc_unavailable on historical idea sample status.
-- Additive CHECK expansion only. Does not change gsc_sync_id nullability,
-- fingerprint schema, ownership, provider ledger, or other status semantics.
-- PostgreSQL named the unnamed CHECK from 020 as
-- research_ideas_initial_gsc_sample_status_check.

alter table public.research_ideas
  drop constraint research_ideas_initial_gsc_sample_status_check;

alter table public.research_ideas
  add constraint research_ideas_initial_gsc_sample_status_check
  check (initial_gsc_sample_status in (
    'in_current_gsc_sample',
    'not_in_current_gsc_sample',
    'gsc_unavailable'
  ));
