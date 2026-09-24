-- Keep merchant order lifecycle monotonic at the database boundary.
-- INSERTs are unaffected; this only constrains later status changes.

CREATE OR REPLACE FUNCTION enforce_order_status_transition()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;

  IF OLD.status = 'new' AND NEW.status IN ('paid','processing','cancelled') THEN
    RETURN NEW;
  ELSIF OLD.status = 'paid' AND NEW.status IN ('processing','cancelled') THEN
    RETURN NEW;
  ELSIF OLD.status = 'processing' AND NEW.status IN ('shipped','cancelled') THEN
    RETURN NEW;
  ELSIF OLD.status = 'shipped' AND NEW.status IN ('completed') THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'invalid_order_status_transition: % -> %', OLD.status, NEW.status
    USING ERRCODE = 'check_violation';
END;
$$;

DROP TRIGGER IF EXISTS orders_status_transition_guard ON orders;

CREATE TRIGGER orders_status_transition_guard
BEFORE UPDATE OF status ON orders
FOR EACH ROW
EXECUTE FUNCTION enforce_order_status_transition();

INSERT INTO schema_migrations(version)
VALUES ('0014_order_status_transitions')
ON CONFLICT (version) DO NOTHING;
