ALTER TABLE products
  ADD COLUMN IF NOT EXISTS reserved_stock integer NOT NULL DEFAULT 0;

ALTER TABLE product_variants
  ADD COLUMN IF NOT EXISTS reserved_stock integer NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'products_reserved_stock_check'
      AND conrelid = 'products'::regclass
  ) THEN
    ALTER TABLE products
      ADD CONSTRAINT products_reserved_stock_check CHECK (reserved_stock >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'variants_reserved_stock_check'
      AND conrelid = 'product_variants'::regclass
  ) THEN
    ALTER TABLE product_variants
      ADD CONSTRAINT variants_reserved_stock_check CHECK (reserved_stock >= 0);
  END IF;
END $$;

INSERT INTO schema_migrations(version)
VALUES ('0008_reserved_stock')
ON CONFLICT (version) DO NOTHING;
