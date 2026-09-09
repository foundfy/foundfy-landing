-- Foundfy Phase 1 crawler schema
-- Run manually in Supabase SQL Editor before using the crawler APIs/worker.

create extension if not exists "pgcrypto";

create table if not exists public.websites (
  id uuid primary key default gen_random_uuid(),
  url text not null,
  hostname text not null,
  first_seen_at timestamptz not null default now(),
  last_crawled_at timestamptz,
  constraint websites_hostname_unique unique (hostname)
);

create table if not exists public.crawl_runs (
  id uuid primary key default gen_random_uuid(),
  website_id uuid not null references public.websites (id) on delete cascade,
  status text not null default 'queued'
    check (status in ('queued', 'running', 'completed', 'failed')),
  seed_url text not null,
  max_pages integer not null default 10 check (max_pages > 0 and max_pages <= 10),
  pages_crawled integer not null default 0 check (pages_crawled >= 0),
  pages_discovered integer not null default 0 check (pages_discovered >= 0),
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists crawl_runs_status_created_at_idx
  on public.crawl_runs (status, created_at);

create table if not exists public.pages (
  id uuid primary key default gen_random_uuid(),
  crawl_run_id uuid not null references public.crawl_runs (id) on delete cascade,
  website_id uuid not null references public.websites (id) on delete cascade,
  requested_url text not null,
  final_url text not null,
  status_code integer,
  redirect_chain jsonb not null default '[]'::jsonb,
  title text,
  meta_description text,
  canonical text,
  robots_meta text,
  x_robots_tag text,
  h1 text[] not null default '{}'::text[],
  h2 text[] not null default '{}'::text[],
  html_lang text,
  internal_link_count integer not null default 0,
  external_link_count integer not null default 0,
  image_count integer not null default 0,
  missing_alt_count integer not null default 0,
  json_ld_types text[] not null default '{}'::text[],
  word_count integer not null default 0,
  fetched_at timestamptz not null default now(),
  constraint pages_crawl_run_requested_url_unique unique (crawl_run_id, requested_url)
);

create index if not exists pages_crawl_run_id_idx on public.pages (crawl_run_id);

create table if not exists public.links (
  id uuid primary key default gen_random_uuid(),
  crawl_run_id uuid not null references public.crawl_runs (id) on delete cascade,
  from_page_id uuid not null references public.pages (id) on delete cascade,
  to_url text not null,
  link_type text not null check (link_type in ('internal', 'external')),
  anchor_text text
);

create index if not exists links_crawl_run_id_idx on public.links (crawl_run_id);
create index if not exists links_from_page_id_idx on public.links (from_page_id);

create table if not exists public.crawl_queue (
  id uuid primary key default gen_random_uuid(),
  crawl_run_id uuid not null references public.crawl_runs (id) on delete cascade,
  url text not null,
  depth integer not null default 0 check (depth >= 0),
  priority integer not null default 0,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'done', 'skipped', 'failed')),
  skip_reason text,
  created_at timestamptz not null default now(),
  constraint crawl_queue_crawl_run_url_unique unique (crawl_run_id, url)
);

create index if not exists crawl_queue_run_status_priority_idx
  on public.crawl_queue (crawl_run_id, status, priority desc, depth asc, created_at asc);

create table if not exists public.crawl_site_artifacts (
  id uuid primary key default gen_random_uuid(),
  crawl_run_id uuid not null references public.crawl_runs (id) on delete cascade,
  website_id uuid not null references public.websites (id) on delete cascade,
  artifact_type text not null check (artifact_type in ('robots_txt', 'sitemap_xml')),
  url text not null,
  status_code integer,
  content text,
  parsed jsonb,
  fetched_at timestamptz not null default now()
);

create index if not exists crawl_site_artifacts_crawl_run_id_idx
  on public.crawl_site_artifacts (crawl_run_id);

alter table public.websites enable row level security;
alter table public.crawl_runs enable row level security;
alter table public.pages enable row level security;
alter table public.links enable row level security;
alter table public.crawl_queue enable row level security;
alter table public.crawl_site_artifacts enable row level security;

grant all on public.websites to service_role;
grant all on public.crawl_runs to service_role;
grant all on public.pages to service_role;
grant all on public.links to service_role;
grant all on public.crawl_queue to service_role;
grant all on public.crawl_site_artifacts to service_role;
