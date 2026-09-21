-- Zorqemi platform indexes
-- Improves merchant dashboards, checkout lookups and session validation without changing behavior.

CREATE INDEX IF NOT EXISTS merchant_sessions_token_hash_idx
  ON merchant_sessions(token_hash);
CREATE INDEX IF NOT EXISTS merchant_sessions_expires_at_idx
  ON merchant_sessions(expires_at);
CREATE INDEX IF NOT EXISTS merchant_sessions_user_id_idx
  ON merchant_sessions(user_id);

CREATE INDEX IF NOT EXISTS customer_sessions_token_hash_idx
  ON customer_sessions(token_hash);
CREATE INDEX IF NOT EXISTS customer_sessions_expires_at_idx
  ON customer_sessions(expires_at);

CREATE INDEX IF NOT EXISTS product_variants_product_active_idx
  ON product_variants(product_id, active);
CREATE INDEX IF NOT EXISTS product_variants_product_created_idx
  ON product_variants(product_id, created_at DESC);

CREATE INDEX IF NOT EXISTS order_items_merchant_order_idx
  ON order_items(merchant_id, order_id);
CREATE INDEX IF NOT EXISTS orders_merchant_created_idx
  ON orders(merchant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS orders_merchant_status_created_idx
  ON orders(merchant_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS checkout_items_checkout_merchant_idx
  ON checkout_items(checkout_session_id, merchant_id);
CREATE INDEX IF NOT EXISTS checkout_merchant_totals_checkout_idx
  ON checkout_merchant_totals(checkout_session_id, merchant_id);

INSERT INTO schema_migrations(version)
VALUES ('0013_platform_indexes')
ON CONFLICT (version) DO NOTHING;
