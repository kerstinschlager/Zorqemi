-- Persist per-merchant checkout totals so one Stripe payment can be split into merchant orders safely.
CREATE TABLE IF NOT EXISTS checkout_merchant_totals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checkout_session_id uuid NOT NULL REFERENCES checkout_sessions(id) ON DELETE CASCADE,
  merchant_id uuid NOT NULL REFERENCES merchants(id) ON DELETE RESTRICT,
  currency text NOT NULL DEFAULT 'EUR',
  subtotal numeric(12,2) NOT NULL DEFAULT 0,
  shipping_total numeric(12,2) NOT NULL DEFAULT 0,
  tax_total numeric(12,2) NOT NULL DEFAULT 0,
  total numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(checkout_session_id, merchant_id)
);
CREATE INDEX IF NOT EXISTS checkout_merchant_totals_merchant_idx
  ON checkout_merchant_totals(merchant_id, created_at DESC);

INSERT INTO schema_migrations(version)
VALUES ('0008_checkout_merchant_totals')
ON CONFLICT (version) DO NOTHING;
