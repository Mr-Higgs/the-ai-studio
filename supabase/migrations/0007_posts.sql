alter table businesses add column if not exists posts jsonb default '[]';
alter table businesses add column if not exists posts_updated_at timestamptz;
