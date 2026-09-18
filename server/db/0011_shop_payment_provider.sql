-- Persist the merchant dashboard payment provider selection and shop name.
ALTER TABLE shop_settings ADD COLUMN IF NOT EXISTS payment_provider text NOT NULL DEFAULT '';

INSERT INTO schema_migrations(version)
VALUES ('0011_shop_payment_provider')
ON CONFLICT (version) DO NOTHING;
