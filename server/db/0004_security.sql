-- Security hardening for self-hosted API.
-- Public data is exposed only through explicit API queries; DB credentials never reach clients.

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;

-- Application role is configured at deployment time. The API connects with DATABASE_URL,
-- while migrations run with the same role. Keep this migration intentionally role-neutral.

CREATE INDEX IF NOT EXISTS orders_payment_reference_idx ON orders(payment_reference) WHERE payment_reference IS NOT NULL;
CREATE INDEX IF NOT EXISTS checkout_payment_reference_idx ON checkout_sessions(payment_reference) WHERE payment_reference IS NOT NULL;

INSERT INTO schema_migrations(version) VALUES ('0004_security') ON CONFLICT (version) DO NOTHING;
