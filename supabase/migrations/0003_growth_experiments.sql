alter table businesses add column if not exists experiments jsonb default '[]';
alter table agent_sessions add column if not exists context_hashes jsonb default '{}';
