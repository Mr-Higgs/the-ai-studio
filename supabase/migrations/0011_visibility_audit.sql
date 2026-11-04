alter table businesses add column if not exists visibility_audit jsonb;
alter table businesses add column if not exists visibility_audit_updated_at timestamptz;
