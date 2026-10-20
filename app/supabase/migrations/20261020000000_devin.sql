alter table public.profiles
  add column if not exists devin_org_id text,
  add column if not exists devin_max_acu integer not null default 5
    check (devin_max_acu between 1 and 100);

create table if not exists public.devin_conversations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  devin_session_id text not null,
  url text,
  title text,
  status text,
  token_hash text not null unique,
  token_expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists devin_conversations_owner_id_idx
  on public.devin_conversations(owner_id);
create index if not exists devin_conversations_business_id_idx
  on public.devin_conversations(business_id);

alter table public.devin_conversations enable row level security;
drop policy if exists "Users can manage their Devin conversations" on public.devin_conversations;
create policy "Users can manage their Devin conversations"
  on public.devin_conversations for all
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);
