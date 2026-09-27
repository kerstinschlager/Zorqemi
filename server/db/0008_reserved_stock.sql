ALTER TABLE products
  ADD COLUMN IF NOT EXISTS reserved_stock integer NOT NULL DEFAULT 0;
ALTER TABLE product_variants
  ADD COLUMN IF NOT EXISTS reserved_stock integer NOT NULL DEFAULT 0;

ALTER TABLE products
  ADD CONSTRAINT products_reserved_stock_check CHECK (reserved_stock >= 0);
ALTER TABLE product_variants
  ADD CONSTRAINT variants_reserved_stock_check CHECK (reserved_stock >= 0);

INSERT INTO schema_migrations(version)
VALUES ('0008_reserved_stock')
ON CONFLICT (version) DO NOTHING;
