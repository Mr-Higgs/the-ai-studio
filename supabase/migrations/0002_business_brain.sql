-- Business Brain: per-business questionnaire answers (+ their own timestamp so saving the
-- Brain doesn't make the profile look changed), a `brain` review doc, and per-user
-- integration toggles (e.g. Meta Ads MCP connected in the user's Devin org).
alter table businesses add column if not exists brain jsonb default '{}';
alter table businesses add column if not exists brain_updated_at timestamptz;

alter table docs drop constraint if exists docs_kind_check;
alter table docs add constraint docs_kind_check
  check (kind in ('offer','research','strategy','content','visibility','automation','action-plan','brain'));

alter table user_settings add column if not exists integrations jsonb default '{}';
