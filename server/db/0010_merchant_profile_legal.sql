-- Merchant profile and legal settings for the self-hosted dashboard.
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS contact_email text;
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS vat_id text;
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS logo_url text;
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS shop_url text;
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS payout_method text;
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS payout_email text;
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS description text;

CREATE TABLE IF NOT EXISTS merchant_legal_settings (
  merchant_id uuid PRIMARY KEY REFERENCES merchants(id) ON DELETE CASCADE,
  impressum text NOT NULL DEFAULT '',
  datenschutz text NOT NULL DEFAULT '',
  agb text NOT NULL DEFAULT '',
  widerruf text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS merchant_legal_settings_updated_at ON merchant_legal_settings;
CREATE TRIGGER merchant_legal_settings_updated_at BEFORE UPDATE ON merchant_legal_settings FOR EACH ROW EXECUTE FUNCTION set_updated_at();

INSERT INTO schema_migrations(version) VALUES ('0010_merchant_profile_legal') ON CONFLICT (version) DO NOTHING;
