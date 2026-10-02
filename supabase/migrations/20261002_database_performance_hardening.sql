-- Zorqemi database performance hardening.
-- Foreign-key indexes improve joins and cascading operations.
-- Duplicate indexes removed.
-- RLS auth calls are evaluated once per statement via SELECT wrappers.

CREATE INDEX IF NOT EXISTS checkout_events_product_id_idx ON public.checkout_events(product_id);
CREATE INDEX IF NOT EXISTS merchants_owner_id_idx ON public.merchants(owner_id);
CREATE INDEX IF NOT EXISTS order_items_product_id_idx ON public.order_items(product_id);
CREATE INDEX IF NOT EXISTS order_items_variant_id_idx ON public.order_items(variant_id);
CREATE INDEX IF NOT EXISTS order_notifications_order_id_idx ON public.order_notifications(order_id);
CREATE INDEX IF NOT EXISTS platform_payout_items_order_id_idx ON public.platform_payout_items(order_id);
CREATE INDEX IF NOT EXISTS platform_payout_items_payout_id_idx ON public.platform_payout_items(payout_id);
CREATE INDEX IF NOT EXISTS platform_payouts_merchant_id_idx ON public.platform_payouts(merchant_id);
CREATE INDEX IF NOT EXISTS stock_reservations_product_id_idx ON public.stock_reservations(product_id);

DROP INDEX IF EXISTS public.merchant_integrations_merchant_provider_uidx;
DROP INDEX IF EXISTS public.order_notifications_customer_idx;

DO $$
DECLARE r record;
DECLARE q text;
DECLARE w text;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname, qual, with_check
    FROM pg_policies
    WHERE schemaname='public'
      AND (
        coalesce(qual,'') ~ 'auth\.(uid|role|jwt)\(\)'
        OR coalesce(with_check,'') ~ 'auth\.(uid|role|jwt)\(\)'
      )
  LOOP
    q := CASE WHEN r.qual IS NULL THEN NULL ELSE
      regexp_replace(regexp_replace(regexp_replace(r.qual,
        'auth\.uid\(\)', '(select auth.uid())', 'g'),
        'auth\.role\(\)', '(select auth.role())', 'g'),
        'auth\.jwt\(\)', '(select auth.jwt())', 'g') END;
    w := CASE WHEN r.with_check IS NULL THEN NULL ELSE
      regexp_replace(regexp_replace(regexp_replace(r.with_check,
        'auth\.uid\(\)', '(select auth.uid())', 'g'),
        'auth\.role\(\)', '(select auth.role())', 'g'),
        'auth\.jwt\(\)', '(select auth.jwt())', 'g') END;

    IF q IS NOT NULL AND w IS NOT NULL THEN
      EXECUTE format('ALTER POLICY %I ON %I.%I USING (%s) WITH CHECK (%s)',r.policyname,r.schemaname,r.tablename,q,w);
    ELSIF q IS NOT NULL THEN
      EXECUTE format('ALTER POLICY %I ON %I.%I USING (%s)',r.policyname,r.schemaname,r.tablename,q);
    ELSE
      EXECUTE format('ALTER POLICY %I ON %I.%I WITH CHECK (%s)',r.policyname,r.schemaname,r.tablename,w);
    END IF;
  END LOOP;
END $$;
