-- Public "Project intake" survey (/intake): one row per completed submission.
-- Not per-user data: RLS on with no policies, so only the service role (API, dashboard) reads or writes.
create table intake_submissions (
  id uuid primary key default gen_random_uuid(),
  form text not null,                      -- survey version, e.g. 'rll-intake-v2'
  name text not null default '',
  email text not null default '',
  business text not null default '',
  answers jsonb not null default '{}',     -- whitelisted answers keyed by field id
  summary text not null default '',        -- markdown rendering of answers (dashboard reading / webhooks)
  created_at timestamptz default now()
);
alter table intake_submissions enable row level security;
create index intake_submissions_created on intake_submissions (created_at desc);
