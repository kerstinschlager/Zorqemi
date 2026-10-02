-- Zorqemi security hardening applied to Supabase production.
-- Keeps intentionally public RPCs public while removing inherited PUBLIC
-- execute grants from authenticated-only/admin/merchant SECURITY DEFINER functions.
-- Adds explicit deny policies for sensitive server-side tables and owner/admin
-- read access for shop analytics.
-- Makes the public_merchants view SECURITY INVOKER while the public RPC remains
-- the controlled public interface.

DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT format('%I.%I(%s)', n.nspname, p.proname,
                  pg_get_function_identity_arguments(p.oid)) AS signature
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public'
      AND p.prosecdef=true
      AND p.proname NOT IN (
        'is_admin','public_merchants','public_merchant_seo',
        'public_merchant_shop','public_merchant_site_content',
        'public_merchant_theme','public_product_sales_signals',
        'track_shop_visit'
      )
  LOOP
    EXECUTE 'REVOKE EXECUTE ON FUNCTION ' || r.signature || ' FROM public';
  END LOOP;
END $$;

ALTER VIEW public.public_merchants SET (security_invoker = true);

DROP POLICY IF EXISTS merchant_integration_secrets_deny_client ON public.merchant_integration_secrets;
CREATE POLICY merchant_integration_secrets_deny_client
  ON public.merchant_integration_secrets
  FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS stock_reservations_deny_client ON public.stock_reservations;
CREATE POLICY stock_reservations_deny_client
  ON public.stock_reservations
  FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS shop_analytics_owner_select ON public.shop_analytics;
CREATE POLICY shop_analytics_owner_select
  ON public.shop_analytics
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.merchants m
      WHERE m.id = shop_analytics.merchant_id
        AND m.owner_id = auth.uid()
    ) OR public.is_admin()
  );

DROP POLICY IF EXISTS shop_analytics_no_client_write ON public.shop_analytics;
CREATE POLICY shop_analytics_no_client_write
  ON public.shop_analytics FOR INSERT TO anon, authenticated
  WITH CHECK (false);

DROP POLICY IF EXISTS shop_analytics_no_client_update ON public.shop_analytics;
CREATE POLICY shop_analytics_no_client_update
  ON public.shop_analytics FOR UPDATE TO anon, authenticated
  USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS shop_analytics_no_client_delete ON public.shop_analytics;
CREATE POLICY shop_analytics_no_client_delete
  ON public.shop_analytics FOR DELETE TO anon, authenticated
  USING (false);
