-- Foundfy: minimum content evidence on crawled pages.
-- Backward compatible: existing rows keep nulls / empty defaults.
-- Do not persist full HTML or full body text.

alter table public.pages
  add column if not exists h3 text[] not null default '{}'::text[],
  add column if not exists nav_labels text[] not null default '{}'::text[],
  add column if not exists main_excerpt text,
  add column if not exists content_hash text,
  add column if not exists json_ld_properties jsonb not null default '[]'::jsonb,
  add column if not exists url_locale text;

alter table public.pages
  drop constraint if exists pages_main_excerpt_length_check;

alter table public.pages
  add constraint pages_main_excerpt_length_check
  check (main_excerpt is null or char_length(main_excerpt) <= 1000);

notify pgrst, 'reload schema';
