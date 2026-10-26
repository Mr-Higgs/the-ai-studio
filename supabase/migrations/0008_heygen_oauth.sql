alter table user_settings add column if not exists heygen_oauth text;         -- ciphertext JSON {access_token, refresh_token, expires_at, client_id, scope, account}
alter table user_settings add column if not exists heygen_oauth_pending text; -- ciphertext JSON {state, verifier, client_id, redirect_uri, created_at}
