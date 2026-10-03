-- Foundfy ACT v0 Slice 2: Git Execute for Foundfy homepage meta description.
-- Additive. Stores durable provider artifacts on action_attempts.
-- Does not store GitHub credentials.

alter table public.actions
  drop constraint if exists actions_status_check;

alter table public.actions
  add constraint actions_status_check
  check (status in (
    'prepared',
    'awaiting_approval',
    'approved',
    'executed',
    'cancelled',
    'blocked'
  ));

alter table public.action_attempts
  add column if not exists artifact jsonb not null default '{}'::jsonb;

alter table public.action_attempts
  drop constraint if exists action_attempts_artifact_size_check;

alter table public.action_attempts
  add constraint action_attempts_artifact_size_check
  check (char_length(artifact::text) <= 8000);

notify pgrst, 'reload schema';
