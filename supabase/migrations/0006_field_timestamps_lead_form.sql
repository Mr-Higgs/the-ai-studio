alter table businesses add column if not exists profile_updated_at timestamptz;
alter table businesses add column if not exists calendar_updated_at timestamptz;
alter table businesses add column if not exists tracker_updated_at timestamptz;
alter table businesses add column if not exists lead_token text unique;
