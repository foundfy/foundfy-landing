-- Foundfy OBSERVE Phase 2: explicit Search Console property binding.
-- Additive. Does not store Search Analytics.

create table if not exists public.gsc_property_connections (
  id uuid primary key default gen_random_uuid(),
  website_id uuid not null references public.websites (id) on delete cascade,
  observe_owner_id uuid not null references public.gsc_observe_owners (id) on delete restrict,
  google_identity_id uuid not null references public.google_identities (id) on delete restrict,
  property_uri text not null,
  property_type text not null
    check (property_type in ('domain', 'url_prefix')),
  permission_level text,
  confirmation_source text not null default 'user'
    check (confirmation_source = 'user'),
  status text not null default 'connected'
    check (status in ('connected', 'revoked')),
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  revoked_at timestamptz
);

create unique index if not exists gsc_property_connections_website_active_unique
  on public.gsc_property_connections (website_id)
  where status = 'connected';

create index if not exists gsc_property_connections_identity_id_idx
  on public.gsc_property_connections (google_identity_id);

alter table public.gsc_property_connections enable row level security;

grant all on public.gsc_property_connections to service_role;

notify pgrst, 'reload schema';
