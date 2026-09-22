-- Retentionvolt — migration 002: site visits (first-party, privacy-first)
-- Run: Supabase Dashboard > SQL Editor > paste & Run
-- Safe to re-run (IF NOT EXISTS guards). No changes to existing tables.
--
-- Design:
--  - One row per visitor per day (unique guard) = "visite sito" metric.
--  - Visitor is an anonymous random id (rb_vid cookie, first-party).
--    NEVER store the raw id or the IP in chiaro: only a daily salted hash.
--  - Bot traffic is filtered at the API route (user-agent), never stored.
--  - Analytics consent (rv_consent) is enforced client-side before the beacon
--    is ever sent; this table only sees consented traffic.

create table if not exists public.site_visits (
  id bigint generated always as identity primary key,
  visitor_hash text not null,
  visited_on date not null,
  path text not null default '/',
  created_at timestamptz not null default now(),
  constraint site_visits_one_per_day unique (visitor_hash, visited_on)
);
create index if not exists site_visits_day_idx on public.site_visits (visited_on desc);
create index if not exists site_visits_hash_idx on public.site_visits (visitor_hash);

-- Service-role only: no anon/authenticated access (server writes via service_role,
-- admin dashboard reads via service_role). Same pattern as 001 tables.
alter table public.site_visits enable row level security;
do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'site_visits'
  ) then
    create policy "service role only" on public.site_visits
      for all using (false) with check (false);
  end if;
end $$;
