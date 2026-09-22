-- Zorqemi platform data-integrity guards
-- NOT VALID keeps existing legacy rows untouched while enforcing rules on new/updated rows.

ALTER TABLE products
  ADD CONSTRAINT zq_products_price_nonnegative CHECK (price >= 0) NOT VALID,
  ADD CONSTRAINT zq_products_stock_nonnegative CHECK (stock >= 0) NOT VALID;

ALTER TABLE product_variants
  ADD CONSTRAINT zq_product_variants_price_nonnegative CHECK (price IS NULL OR price >= 0) NOT VALID,
  ADD CONSTRAINT zq_product_variants_stock_nonnegative CHECK (stock >= 0) NOT VALID;

ALTER TABLE checkout_items
  ADD CONSTRAINT zq_checkout_items_quantity_positive CHECK (quantity > 0) NOT VALID,
  ADD CONSTRAINT zq_checkout_items_unit_price_nonnegative CHECK (unit_price >= 0) NOT VALID,
  ADD CONSTRAINT zq_checkout_items_total_nonnegative CHECK (total >= 0) NOT VALID;

ALTER TABLE orders
  ADD CONSTRAINT zq_orders_subtotal_nonnegative CHECK (subtotal >= 0) NOT VALID,
  ADD CONSTRAINT zq_orders_shipping_nonnegative CHECK (shipping_total >= 0) NOT VALID,
  ADD CONSTRAINT zq_orders_tax_nonnegative CHECK (tax_total >= 0) NOT VALID,
  ADD CONSTRAINT zq_orders_total_nonnegative CHECK (total >= 0) NOT VALID;

ALTER TABLE checkout_sessions
  ADD CONSTRAINT zq_checkout_sessions_subtotal_nonnegative CHECK (subtotal >= 0) NOT VALID,
  ADD CONSTRAINT zq_checkout_sessions_shipping_nonnegative CHECK (shipping_total >= 0) NOT VALID,
  ADD CONSTRAINT zq_checkout_sessions_tax_nonnegative CHECK (tax_total >= 0) NOT VALID,
  ADD CONSTRAINT zq_checkout_sessions_total_nonnegative CHECK (total >= 0) NOT VALID;

INSERT INTO schema_migrations(version)
VALUES ('0014_data_integrity_checks')
ON CONFLICT (version) DO NOTHING;
