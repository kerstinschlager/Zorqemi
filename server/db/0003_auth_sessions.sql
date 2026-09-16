-- Zorqemi self-hosted authentication.
-- Passwords are stored as scrypt hashes; raw passwords are never persisted.

CREATE TABLE IF NOT EXISTS user_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  password_hash text NOT NULL,
  first_name text,
  last_name text,
  role text NOT NULL DEFAULT 'merchant' CHECK (role IN ('merchant','admin')),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS user_accounts_email_unique ON user_accounts (lower(email));

CREATE TABLE IF NOT EXISTS auth_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES user_accounts(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS auth_sessions_user_idx ON auth_sessions(user_id);
CREATE INDEX IF NOT EXISTS auth_sessions_expiry_idx ON auth_sessions(expires_at);

CREATE OR REPLACE FUNCTION touch_user_accounts_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS user_accounts_updated_at ON user_accounts;
CREATE TRIGGER user_accounts_updated_at
BEFORE UPDATE ON user_accounts
FOR EACH ROW EXECUTE FUNCTION touch_user_accounts_updated_at();

INSERT INTO schema_migrations(version)
VALUES ('0003_auth_sessions')
ON CONFLICT (version) DO NOTHING;
