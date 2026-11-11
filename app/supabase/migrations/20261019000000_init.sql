create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  sprint jsonb,
  profile jsonb,
  inputs jsonb not null default '{}'::jsonb,
  tracker jsonb,
  calendar jsonb,
  profile_updated_at timestamptz,
  calendar_updated_at timestamptz,
  tracker_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  active_business_id uuid references public.businesses(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.business_docs (
  business_id uuid not null references public.businesses(id) on delete cascade,
  doc_id text not null check (doc_id in ('offer', 'research', 'strategy', 'content', 'visibility', 'automation', 'action-plan')),
  content text not null,
  updated_at timestamptz not null default now(),
  primary key (business_id, doc_id)
);

create table public.business_history (
  id bigint generated always as identity primary key,
  business_id uuid not null references public.businesses(id) on delete cascade,
  file text not null,
  ext text not null check (ext in ('md', 'json')),
  content text not null,
  created_at timestamptz not null default now()
);

create table public.user_api_keys (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  provider text not null check (provider in ('heygen', 'elevenlabs', 'devin', 'linkedin')),
  ciphertext text not null,
  last4 text not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, provider)
);

create index businesses_owner_id_idx on public.businesses(owner_id);
create index business_history_business_file_created_idx on public.business_history(business_id, file, created_at desc);

create function public.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.create_profile_for_new_user();

create function public.set_business_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  if new.profile is distinct from old.profile then new.profile_updated_at := now(); end if;
  if new.calendar is distinct from old.calendar then new.calendar_updated_at := now(); end if;
  if new.tracker is distinct from old.tracker then new.tracker_updated_at := now(); end if;
  return new;
end;
$$;

create trigger businesses_updated_at
before update on public.businesses
for each row execute function public.set_business_updated_at();

create function public.snapshot_business_doc()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.business_history (business_id, file, ext, content)
  values (old.business_id, old.doc_id, 'md', old.content);
  return new;
end;
$$;

create trigger business_docs_snapshot
before update on public.business_docs
for each row
when (old.content is distinct from new.content)
execute function public.snapshot_business_doc();

create function public.snapshot_business_calendar()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.business_history (business_id, file, ext, content)
  values (old.id, 'calendar', 'json', old.calendar::text);
  return new;
end;
$$;

create trigger business_calendar_snapshot
before update on public.businesses
for each row
when (old.calendar is distinct from new.calendar and old.calendar is not null)
execute function public.snapshot_business_calendar();

alter table public.profiles enable row level security;
alter table public.businesses enable row level security;
alter table public.business_docs enable row level security;
alter table public.business_history enable row level security;
alter table public.user_api_keys enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles for select using (id = (select auth.uid()));
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles for update using (id = (select auth.uid())) with check (id = (select auth.uid()));

drop policy if exists "businesses_owner_all" on public.businesses;
create policy "businesses_owner_all" on public.businesses for all
using (owner_id = (select auth.uid()))
with check (owner_id = (select auth.uid()));

drop policy if exists "business_docs_owner_all" on public.business_docs;
create policy "business_docs_owner_all" on public.business_docs for all
using (exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = (select auth.uid())))
with check (exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = (select auth.uid())));

drop policy if exists "business_history_owner_all" on public.business_history;
create policy "business_history_owner_all" on public.business_history for all
using (exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = (select auth.uid())))
with check (exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = (select auth.uid())));
