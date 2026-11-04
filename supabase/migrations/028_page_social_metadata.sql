-- Foundfy: persist observed social metadata on crawled pages.
-- Backward compatible: existing rows keep social_metadata NULL.
-- NULL means not collected. A JSON object (including null field values)
-- means this crawl observed the fields. Do not backfill historical rows.

alter table public.pages
  add column if not exists social_metadata jsonb;

comment on column public.pages.social_metadata is
  'Collected Open Graph / Twitter metadata for this page in this crawl. NULL means not collected. JSON null field values mean observed absent.';

alter table public.pages
  drop constraint if exists pages_social_metadata_object_check;

alter table public.pages
  add constraint pages_social_metadata_object_check
  check (social_metadata is null or jsonb_typeof(social_metadata) = 'object');

notify pgrst, 'reload schema';
