-- Foundfy ACT v1 Slice A: Prepare → Preview → Approve for a single page title.
-- Additive. Does not add title Execute, CMS credentials, or provider tables.
--
-- Constraint changes:
--   actions.action_type
--     was: update_meta_description only
--     now: update_meta_description | update_page_title
--   actions.field
--     was: meta_description only
--     now: meta_description | title
--   action_verifications.verification_type
--     was: update_meta_description only
--     now: also permits update_page_title so a later title VERIFY row can exist
--          without a schema change. This slice does not write title verifications.
--
-- Unchanged:
--   proposed_value length (320) — storage bound, not an SEO character-count rule
--   open-action uniqueness (decision_id, action_type, field)
--   meta-description Git Execute path
--   LEARN snapshots

alter table public.actions
  drop constraint if exists actions_action_type_check;

alter table public.actions
  add constraint actions_action_type_check
    check (action_type in ('update_meta_description', 'update_page_title'));

alter table public.actions
  drop constraint if exists actions_field_check;

alter table public.actions
  add constraint actions_field_check
    check (field in ('meta_description', 'title'));

alter table public.action_verifications
  drop constraint if exists action_verifications_verification_type_check;

alter table public.action_verifications
  add constraint action_verifications_verification_type_check
    check (verification_type in ('update_meta_description', 'update_page_title'));

notify pgrst, 'reload schema';
