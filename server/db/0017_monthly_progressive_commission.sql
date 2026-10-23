-- Additive monthly commission ledger. Existing payouts remain unchanged.
-- New order snapshots are created only when the progressive mode is enabled.
CREATE TABLE IF NOT EXISTS merchant_order_commissions (
  order_id uuid PRIMARY KEY REFERENCES orders(id) ON DELETE RESTRICT,
  merchant_id uuid NOT NULL REFERENCES merchants(id) ON DELETE RESTRICT,
  commission_month text NOT NULL CHECK (commission_month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  currency text NOT NULL DEFAULT 'EUR' CHECK (currency = 'EUR'),
  net_merchandise numeric(12,2) NOT NULL CHECK (net_merchandise >= 0),
  commission_amount numeric(12,2) NOT NULL CHECK (commission_amount >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS merchant_order_commissions_month_idx
 ON merchant_order_commissions(merchant_id,commission_month);
ALTER TABLE merchant_payout_orders
 ADD COLUMN IF NOT EXISTS commission_amount numeric(12,2);
ALTER TABLE merchant_payouts
 ADD COLUMN IF NOT EXISTS commission_model text NOT NULL DEFAULT 'flat_legacy';
