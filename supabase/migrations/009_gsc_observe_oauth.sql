-- Foundfy OBSERVE Phase 1: Google OAuth ownership boundary.
-- Additive. Does not store Search Console properties or Search Analytics.
--
-- gsc_observe_owners is a lightweight reservation:
-- a Google identity connected to a website, property not selected yet.
-- This is NOT "Search Console connected".

create table if not exists public.google_identities (
  id uuid primary key default gen_random_uuid(),
  google_sub text not null,
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint google_identities_google_sub_unique unique (google_sub)
);

create table if not exists public.google_oauth_tokens (
  id uuid primary key default gen_random_uuid(),
  google_identity_id uuid not null references public.google_identities (id) on delete cascade,
  encryption_key_id text not null default 'v1',
  refresh_token_ciphertext text not null,
  scopes text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  revoked_at timestamptz,
  constraint google_oauth_tokens_identity_unique unique (google_identity_id)
);

create table if not exists public.gsc_observe_owners (
  id uuid primary key default gen_random_uuid(),
  website_id uuid not null references public.websites (id) on delete cascade,
  google_identity_id uuid not null references public.google_identities (id) on delete restrict,
  google_oauth_token_id uuid not null references public.google_oauth_tokens (id) on delete restrict,
  status text not null default 'google_connected'
    check (status in ('google_connected', 'revoked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  revoked_at timestamptz
);

create unique index if not exists gsc_observe_owners_website_active_unique
  on public.gsc_observe_owners (website_id)
  where status = 'google_connected';

create index if not exists gsc_observe_owners_identity_id_idx
  on public.gsc_observe_owners (google_identity_id);

create table if not exists public.gsc_oauth_states (
  id uuid primary key default gen_random_uuid(),
  state text not null,
  website_id uuid not null references public.websites (id) on delete cascade,
  return_path text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint gsc_oauth_states_state_unique unique (state)
);

create index if not exists gsc_oauth_states_expires_at_idx
  on public.gsc_oauth_states (expires_at);

create table if not exists public.gsc_owner_sessions (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null,
  google_identity_id uuid not null references public.google_identities (id) on delete cascade,
  website_id uuid not null references public.websites (id) on delete cascade,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  constraint gsc_owner_sessions_token_hash_unique unique (token_hash)
);

create index if not exists gsc_owner_sessions_identity_website_idx
  on public.gsc_owner_sessions (google_identity_id, website_id);

alter table public.google_identities enable row level security;
alter table public.google_oauth_tokens enable row level security;
alter table public.gsc_observe_owners enable row level security;
alter table public.gsc_oauth_states enable row level security;
alter table public.gsc_owner_sessions enable row level security;

grant all on public.google_identities to service_role;
grant all on public.google_oauth_tokens to service_role;
grant all on public.gsc_observe_owners to service_role;
grant all on public.gsc_oauth_states to service_role;
grant all on public.gsc_owner_sessions to service_role;

notify pgrst, 'reload schema';
