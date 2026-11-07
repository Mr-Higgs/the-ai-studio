-- Owner-uploaded reference files (PDF, Markdown, CSV, Excel). The browser extracts the text;
-- only that text is stored and inlined into Devin's context.
create table if not exists uploads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  business_id uuid not null references businesses(id) on delete cascade,
  name text not null,
  kind text not null,
  size int not null default 0,
  text text not null,
  truncated boolean not null default false,
  created_at timestamptz default now()
);
create index if not exists uploads_business_idx on uploads (business_id, created_at);
alter table uploads enable row level security;
create policy "own uploads" on uploads for all using (user_id = auth.uid()) with check (user_id = auth.uid());
