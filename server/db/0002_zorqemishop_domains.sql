-- ZorqemiShop domain and storefront routing foundation.
-- A merchant can have one canonical ZorqemiShop slug and optional custom domains.

ALTER TABLE merchants
  ADD COLUMN IF NOT EXISTS shop_slug text;

-- Keep existing merchant URLs usable during the migration from the current database.
UPDATE merchants
SET shop_slug = lower(trim(slug))
WHERE (shop_slug IS NULL OR trim(shop_slug) = '')
  AND slug IS NOT NULL
  AND trim(slug) <> '';

CREATE UNIQUE INDEX IF NOT EXISTS merchants_shop_slug_uidx
  ON merchants (lower(shop_slug))
  WHERE shop_slug IS NOT NULL;

CREATE TABLE IF NOT EXISTS shop_domains (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  hostname text NOT NULL,
  domain_type text NOT NULL DEFAULT 'zorqemishop',
  is_primary boolean NOT NULL DEFAULT false,
  is_verified boolean NOT NULL DEFAULT false,
  verification_token text,
  ssl_status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT shop_domains_type_check CHECK (domain_type IN ('zorqemishop', 'custom')),
  CONSTRAINT shop_domains_ssl_check CHECK (ssl_status IN ('pending', 'active', 'error')),
  CONSTRAINT shop_domains_hostname_check CHECK (hostname = lower(trim(hostname)))
);

CREATE UNIQUE INDEX IF NOT EXISTS shop_domains_hostname_uidx
  ON shop_domains (hostname);

CREATE UNIQUE INDEX IF NOT EXISTS shop_domains_one_primary_per_merchant_uidx
  ON shop_domains (merchant_id)
  WHERE is_primary = true;

CREATE INDEX IF NOT EXISTS shop_domains_merchant_idx
  ON shop_domains (merchant_id);

CREATE INDEX IF NOT EXISTS shop_domains_hostname_lookup_idx
  ON shop_domains (lower(hostname));

CREATE OR REPLACE FUNCTION set_shop_domains_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS shop_domains_updated_at ON shop_domains;
CREATE TRIGGER shop_domains_updated_at
BEFORE UPDATE ON shop_domains
FOR EACH ROW
EXECUTE FUNCTION set_shop_domains_updated_at();

-- The public storefront router will use this lookup once the own API serves shops.
CREATE OR REPLACE VIEW shop_domain_routes AS
SELECT
  d.hostname,
  d.merchant_id,
  m.shop_slug,
  d.domain_type,
  d.is_primary,
  d.is_verified,
  d.ssl_status
FROM shop_domains d
JOIN merchants m ON m.id = d.merchant_id;
