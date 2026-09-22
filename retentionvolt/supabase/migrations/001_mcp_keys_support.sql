-- Retentionvolt — migration 001: MCP API keys + support tickets
-- Run: Supabase Dashboard > SQL Editor > paste & Run
-- Safe to re-run (IF NOT EXISTS guards). No changes to existing tables.

-- 1. MCP API keys (hashed at rest, never store plaintext)
create extension if not exists "pgcrypto";
create table if not exists public.mcp_api_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  key_prefix text not null,
  key_hash text not null unique,
  name text not null default 'Default key',
  is_active boolean not null default true,
  last_used_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists mcp_api_keys_user_id_idx on public.mcp_api_keys (user_id);
create index if not exists mcp_api_keys_hash_idx on public.mcp_api_keys (key_hash);

-- Service-role only: no anon/authenticated access (server verifies via service_role)
alter table public.mcp_api_keys enable row level security;
do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'mcp_api_keys'
  ) then
    create policy "service role only" on public.mcp_api_keys
      for all using (false) with check (false);
  end if;
end $$;

-- 2. Support tickets (written by server route with service_role)
create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  user_email text not null,
  category text not null default 'mcp',
  subject text not null,
  message text not null,
  status text not null default 'open',
  created_at timestamptz not null default now()
);
create index if not exists support_tickets_user_id_idx on public.support_tickets (user_id);

alter table public.support_tickets enable row level security;
do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'support_tickets'
  ) then
    create policy "service role only" on public.support_tickets
      for all using (false) with check (false);
  end if;
end $$;

-- 3. MCP request logs (best-effort analytics; server writes with service_role)
create table if not exists public.mcp_request_logs (
  id bigint generated always as identity primary key,
  user_id text,
  user_email text,
  plan text not null default 'unauthenticated',
  tool_name text,
  method text,
  status text not null default 'error',
  latency_ms integer,
  ip_address text,
  user_agent text,
  created_at timestamptz not null default now()
);
create index if not exists mcp_request_logs_created_idx on public.mcp_request_logs (created_at desc);
create index if not exists mcp_request_logs_user_idx on public.mcp_request_logs (user_id);

alter table public.mcp_request_logs enable row level security;
do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'mcp_request_logs'
  ) then
    create policy "service role only" on public.mcp_request_logs
      for all using (false) with check (false);
  end if;
end $$;
