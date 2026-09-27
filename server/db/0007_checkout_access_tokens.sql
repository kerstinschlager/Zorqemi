ALTER TABLE checkout_sessions
  ADD COLUMN IF NOT EXISTS checkout_access_token_hash text;

CREATE UNIQUE INDEX IF NOT EXISTS checkout_sessions_access_token_hash_uq
  ON checkout_sessions(checkout_access_token_hash)
  WHERE checkout_access_token_hash IS NOT NULL;

INSERT INTO schema_migrations(version)
VALUES ('0007_checkout_access_tokens')
ON CONFLICT (version) DO NOTHING;
