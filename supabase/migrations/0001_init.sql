-- Studio multi-tenant schema. Every row is owned by a Supabase auth user; RLS keeps
-- users to their own rows (the API also filters by user_id as defense in depth).

create table user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  devin_api_key text,   -- ciphertext, see api/_lib/secrets.js
  devin_org_id text,    -- ciphertext
  heygen_api_key text,  -- ciphertext
  updated_at timestamptz default now()
);
alter table user_settings enable row level security;
create policy "own settings" on user_settings for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create table businesses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text default '',
  is_active boolean default true,
  sprint jsonb,
  profile jsonb,
  inputs jsonb default '{}',
  tracker jsonb,
  calendar jsonb,
  calendar_issues int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table businesses enable row level security;
create policy "own businesses" on businesses for all using (user_id = auth.uid()) with check (user_id = auth.uid());
-- one active business per user
create unique index businesses_one_active on businesses (user_id) where is_active;

create table docs (
  business_id uuid references businesses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text check (kind in ('offer','research','strategy','content','visibility','automation','action-plan')),
  content text not null,
  updated_at timestamptz default now(),
  primary key (business_id, kind)
);
alter table docs enable row level security;
create policy "own docs" on docs for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create table doc_history (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references businesses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text,        -- a doc kind or 'calendar'
  content text,
  created_at timestamptz default now()
);
alter table doc_history enable row level security;
create policy "own doc_history" on doc_history for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create table agent_sessions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references businesses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  scope text not null,            -- 'business' or a project slug
  devin_session_id text,
  devin_status text,
  applied_hash text,
  last_prompt_at timestamptz,
  created_at timestamptz default now(),
  unique (business_id, scope)
);
alter table agent_sessions enable row level security;
create policy "own agent_sessions" on agent_sessions for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create table projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text,
  created_at timestamptz default now(),
  unique (user_id, name)
);
alter table projects enable row level security;
create policy "own projects" on projects for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Videos live in a private bucket under <user_id>/<project>/<file>.
insert into storage.buckets (id, name, public) values ('videos', 'videos', false);
create policy "own video objects" on storage.objects for all
  using (bucket_id = 'videos' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'videos' and (storage.foldername(name))[1] = auth.uid()::text);
