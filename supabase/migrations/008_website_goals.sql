-- Foundfy Goals v0: user-declared outcomes for a website.
-- Additive. Belongs to website_id, not a crawl run.
-- Does not alter crawler, observations, Site Model, interpretation, or jobs.
--
-- source is always user_declared in v0. This is Decision Engine context later,
-- not an SEO finding or action.

create table if not exists public.website_goals (
  id uuid primary key default gen_random_uuid(),
  website_id uuid not null references public.websites (id) on delete cascade,
  primary_goal_type text not null
    check (primary_goal_type in (
      'get_more_enquiries',
      'sell_more_products',
      'increase_bookings',
      'grow_signups',
      'reach_more_readers',
      'build_awareness',
      'get_discovered_locally',
      'custom'
    )),
  secondary_goal_type text
    check (
      secondary_goal_type is null
      or secondary_goal_type in (
        'get_more_enquiries',
        'sell_more_products',
        'increase_bookings',
        'grow_signups',
        'reach_more_readers',
        'build_awareness',
        'get_discovered_locally',
        'custom'
      )
    ),
  note text,
  source text not null default 'user_declared'
    check (source = 'user_declared'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint website_goals_website_unique unique (website_id),
  constraint website_goals_primary_secondary_distinct
    check (
      secondary_goal_type is null
      or secondary_goal_type <> primary_goal_type
    )
);

create index if not exists website_goals_website_id_idx
  on public.website_goals (website_id);

alter table public.website_goals enable row level security;

grant all on public.website_goals to service_role;

notify pgrst, 'reload schema';
