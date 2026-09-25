-- Persist the Stripe PaymentIntent on orders so refund webhooks can resolve the order
-- without trusting client input or performing an extra Stripe lookup.

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id text;

CREATE INDEX IF NOT EXISTS orders_stripe_payment_intent_idx
  ON orders(stripe_payment_intent_id);

INSERT INTO schema_migrations(version)
VALUES ('0016_order_stripe_payment_intent')
ON CONFLICT (version) DO NOTHING;
