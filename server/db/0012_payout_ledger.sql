-- Zorqemi self-hosted payout ledger
-- Keeps merchant revenue, platform commission and payout state in PostgreSQL.

CREATE TABLE IF NOT EXISTS platform_settings (
  id boolean PRIMARY KEY DEFAULT true,
  default_commission_rate numeric(5,2) NOT NULL DEFAULT 10.00 CHECK (default_commission_rate >= 0 AND default_commission_rate <= 100),
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO platform_settings(id) VALUES (true) ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS merchant_payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL REFERENCES merchants(id) ON DELETE RESTRICT,
  currency text NOT NULL DEFAULT 'EUR',
  gross_amount numeric(12,2) NOT NULL DEFAULT 0 CHECK (gross_amount >= 0),
  commission_rate numeric(5,2) NOT NULL DEFAULT 10.00 CHECK (commission_rate >= 0 AND commission_rate <= 100),
  commission_amount numeric(12,2) NOT NULL DEFAULT 0 CHECK (commission_amount >= 0),
  net_amount numeric(12,2) NOT NULL DEFAULT 0 CHECK (net_amount >= 0),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','cancelled')),
  payout_method text,
  payout_email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz,
  paid_by uuid
);

CREATE TABLE IF NOT EXISTS merchant_payout_orders (
  payout_id uuid NOT NULL REFERENCES merchant_payouts(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  order_total numeric(12,2) NOT NULL CHECK (order_total >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (payout_id, order_id),
  UNIQUE (order_id)
);

CREATE INDEX IF NOT EXISTS merchant_payouts_merchant_created_idx
  ON merchant_payouts(merchant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS merchant_payouts_status_created_idx
  ON merchant_payouts(status, created_at DESC);
CREATE INDEX IF NOT EXISTS merchant_payout_orders_order_idx
  ON merchant_payout_orders(order_id);

INSERT INTO schema_migrations(version)
VALUES ('0012_payout_ledger')
ON CONFLICT (version) DO NOTHING;
