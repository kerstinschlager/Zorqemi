-- Zorqemi checkout + Stripe webhook idempotency
CREATE TABLE IF NOT EXISTS payment_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  event_id text NOT NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(provider, event_id)
);

CREATE INDEX IF NOT EXISTS payment_events_provider_created_idx
  ON payment_events(provider, created_at DESC);

CREATE INDEX IF NOT EXISTS orders_payment_reference_idx
  ON orders(payment_provider, payment_reference);

INSERT INTO schema_migrations(version)
VALUES ('0006_checkout_payments')
ON CONFLICT (version) DO NOTHING;
