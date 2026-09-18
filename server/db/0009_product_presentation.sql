-- Product presentation fields used by the self-hosted storefront.
ALTER TABLE products ADD COLUMN IF NOT EXISTS image_url text;
ALTER TABLE products ADD COLUMN IF NOT EXISTS category text;

CREATE INDEX IF NOT EXISTS products_merchant_active_idx
  ON products(merchant_id, active, created_at DESC);

INSERT INTO schema_migrations(version)
VALUES ('0009_product_presentation')
ON CONFLICT (version) DO NOTHING;
