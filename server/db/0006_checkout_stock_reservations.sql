-- Reserve product stock while a Stripe checkout is pending.
-- Available stock remains in products/product_variants.stock; reservation subtracts it atomically.
CREATE TABLE IF NOT EXISTS checkout_stock_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checkout_session_id uuid NOT NULL REFERENCES checkout_sessions(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  variant_id uuid REFERENCES product_variants(id) ON DELETE RESTRICT,
  quantity integer NOT NULL CHECK (quantity > 0),
  released_at timestamptz,
  settled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(checkout_session_id, product_id, variant_id)
);
CREATE INDEX IF NOT EXISTS checkout_stock_reservations_checkout_idx ON checkout_stock_reservations(checkout_session_id);
CREATE INDEX IF NOT EXISTS checkout_stock_reservations_active_idx ON checkout_stock_reservations(released_at, settled_at) WHERE released_at IS NULL AND settled_at IS NULL;
INSERT INTO schema_migrations(version) VALUES ('0006_checkout_stock_reservations') ON CONFLICT (version) DO NOTHING;

ALTER TABLE checkout_sessions ADD COLUMN IF NOT EXISTS idempotency_key text;
CREATE UNIQUE INDEX IF NOT EXISTS checkout_sessions_idempotency_unique ON checkout_sessions(idempotency_key) WHERE idempotency_key IS NOT NULL;
