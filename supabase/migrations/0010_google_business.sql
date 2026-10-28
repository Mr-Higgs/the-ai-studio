alter table user_settings add column if not exists google_oauth text;          -- ciphertext JSON {access_token, refresh_token, expires_at, scope, account, locations, location}
alter table user_settings add column if not exists google_oauth_pending text;  -- ciphertext JSON {state, redirect_uri, created_at}
