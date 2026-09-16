-- Zorqemi self-hosted authentication
-- Passwords are stored as salted scrypt hashes; raw passwords are never persisted.

CREATE TABLE IF NOT EXISTS merchant_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  email text NOT NULL,
  password_hash text NOT NULL,
  role text NOT NULL DEFAULT 'owner' CHECK (role IN ('owner','manager')),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS merchant_users_email_unique ON merchant_users(lower(email));
CREATE INDEX IF NOT EXISTS merchant_users_merchant_idx ON merchant_users(merchant_id);

CREATE TABLE IF NOT EXISTS merchant_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES merchant_users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS merchant_sessions_user_idx ON merchant_sessions(user_id);
CREATE INDEX IF NOT EXISTS merchant_sessions_expires_idx ON merchant_sessions(expires_at);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES merchant_users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS password_reset_user_idx ON password_reset_tokens(user_id);

DROP TRIGGER IF EXISTS merchant_users_updated_at ON merchant_users;
CREATE TRIGGER merchant_users_updated_at BEFORE UPDATE ON merchant_users FOR EACH ROW EXECUTE FUNCTION set_updated_at();

INSERT INTO schema_migrations(version) VALUES ('0005_auth_sessions') ON CONFLICT (version) DO NOTHING;
