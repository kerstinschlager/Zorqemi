-- One fixed commission rate per merchant and calendar month.
-- Created in a feature branch; deploy only after integration tests.
CREATE TABLE IF NOT EXISTS merchant_monthly_commissions (
  merchant_id uuid NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  month_key text NOT NULL CHECK (month_key ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  based_on_month_key text NOT NULL CHECK (based_on_month_key ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  previous_revenue_cents bigint NOT NULL CHECK (previous_revenue_cents >= 0),
  rate_bps integer NOT NULL CHECK (rate_bps IN (300,500,700,800,1000)),
  calculated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (merchant_id, month_key)
);
CREATE INDEX IF NOT EXISTS merchant_monthly_commissions_month_idx
  ON merchant_monthly_commissions(month_key);
