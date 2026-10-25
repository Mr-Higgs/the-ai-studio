alter table user_settings add column if not exists meta_access_token text;
alter table user_settings add column if not exists meta_ad_account_id text;
alter table businesses add column if not exists ad_insights jsonb;
