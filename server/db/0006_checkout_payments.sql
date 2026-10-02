-- Zorqemi checkout + Stripe persistence
-- Additive migration for server-side checkout, stock reservations and webhook idempotency.

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS reserved_stock integer NOT NULL DEFAULT 0;
ALTER TABLE product_variants
  ADD COLUMN IF NOT EXISTS reserved_stock integer NOT NULL DEFAULT 0;

ALTER TABLE checkout_sessions
  ADD COLUMN IF NOT EXISTS idempotency_key text,
  ADD COLUMN IF NOT EXISTS checkout_access_token_hash text;

CREATE UNIQUE INDEX IF NOT EXISTS checkout_sessions_idempotency_unique
  ON checkout_sessions(idempotency_key)
  WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS checkout_sessions_access_token_idx
  ON checkout_sessions(checkout_access_token_hash)
  WHERE checkout_access_token_hash IS NOT NULL;

CREATE TABLE IF NOT EXISTS checkout_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checkout_session_id uuid NOT NULL REFERENCES checkout_sessions(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  variant_id uuid REFERENCES product_variants(id) ON DELETE RESTRICT,
  merchant_id uuid NOT NULL REFERENCES merchants(id) ON DELETE RESTRICT,
  product_name text NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  unit_price numeric(12,2) NOT NULL CHECK (unit_price >= 0),
  total numeric(12,2) NOT NULL CHECK (total >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS checkout_items_session_idx ON checkout_items(checkout_session_id);
CREATE INDEX IF NOT EXISTS checkout_items_merchant_idx ON checkout_items(merchant_id);

CREATE TABLE IF NOT EXISTS checkout_merchant_totals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checkout_session_id uuid NOT NULL REFERENCES checkout_sessions(id) ON DELETE CASCADE,
  merchant_id uuid NOT NULL REFERENCES merchants(id) ON DELETE RESTRICT,
  currency text NOT NULL,
  subtotal numeric(12,2) NOT NULL DEFAULT 0,
  shipping_total numeric(12,2) NOT NULL DEFAULT 0,
  tax_total numeric(12,2) NOT NULL DEFAULT 0,
  total numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(checkout_session_id, merchant_id)
);
CREATE INDEX IF NOT EXISTS checkout_merchant_totals_session_idx ON checkout_merchant_totals(checkout_session_id);

CREATE TABLE IF NOT EXISTS checkout_stock_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checkout_session_id uuid NOT NULL REFERENCES checkout_sessions(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  variant_id uuid REFERENCES product_variants(id) ON DELETE RESTRICT,
  quantity integer NOT NULL CHECK (quantity > 0),
  released_at timestamptz,
  settled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (NOT (released_at IS NOT NULL AND settled_at IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS checkout_stock_reservations_session_idx
  ON checkout_stock_reservations(checkout_session_id);
CREATE INDEX IF NOT EXISTS checkout_stock_reservations_open_idx
  ON checkout_stock_reservations(checkout_session_id)
  WHERE released_at IS NULL AND settled_at IS NULL;

CREATE TABLE IF NOT EXISTS payment_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  event_id text NOT NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(provider,event_id)
);
CREATE INDEX IF NOT EXISTS payment_events_provider_created_idx
  ON payment_events(provider, created_at DESC);

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id text,
  ADD COLUMN IF NOT EXISTS shipping_carrier text,
  ADD COLUMN IF NOT EXISTS tracking_number text,
  ADD COLUMN IF NOT EXISTS tracking_url text,
  ADD COLUMN IF NOT EXISTS shipped_at timestamptz;
CREATE INDEX IF NOT EXISTS orders_stripe_payment_intent_idx
  ON orders(stripe_payment_intent_id)
  WHERE stripe_payment_intent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS orders_payment_reference_idx
  ON orders(payment_provider, payment_reference);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname='merchant_users_role_check') THEN
    ALTER TABLE merchant_users DROP CONSTRAINT merchant_users_role_check;
  END IF;
  ALTER TABLE merchant_users
    ADD CONSTRAINT merchant_users_role_check
    CHECK (role IN ('owner','manager','admin'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

INSERT INTO schema_migrations(version)
VALUES ('0006_checkout_payments')
ON CONFLICT (version) DO NOTHING;
