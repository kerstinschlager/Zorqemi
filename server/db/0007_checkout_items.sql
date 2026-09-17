-- Persist the server-priced checkout snapshot so Stripe webhooks can create orders safely.
CREATE TABLE IF NOT EXISTS checkout_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checkout_session_id uuid NOT NULL REFERENCES checkout_sessions(id) ON DELETE CASCADE,
  product_id uuid REFERENCES products(id) ON DELETE SET NULL,
  variant_id uuid REFERENCES product_variants(id) ON DELETE SET NULL,
  merchant_id uuid REFERENCES merchants(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  unit_price numeric(12,2) NOT NULL,
  total numeric(12,2) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS checkout_items_session_idx ON checkout_items(checkout_session_id);
CREATE INDEX IF NOT EXISTS checkout_items_merchant_idx ON checkout_items(merchant_id);

INSERT INTO schema_migrations(version)
VALUES ('0007_checkout_items')
ON CONFLICT (version) DO NOTHING;
