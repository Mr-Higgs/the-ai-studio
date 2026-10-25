alter table user_settings add column if not exists meta_instagram_id text;
alter table businesses add column if not exists instagram_insights jsonb;
