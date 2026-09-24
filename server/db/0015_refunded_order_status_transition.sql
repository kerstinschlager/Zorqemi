-- Allow Stripe refund events to move an already paid order into the terminal refunded state.
-- Refund is a payment exception/terminal state and therefore intentionally bypasses
-- the normal fulfillment progression without weakening the other transitions.

CREATE OR REPLACE FUNCTION enforce_order_status_transition()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'refunded' AND OLD.status IN ('paid','processing','shipped','completed','cancelled') THEN
    RETURN NEW;
  ELSIF OLD.status = 'new' AND NEW.status IN ('paid','processing','cancelled') THEN
    RETURN NEW;
  ELSIF OLD.status = 'paid' AND NEW.status IN ('processing','cancelled') THEN
    RETURN NEW;
  ELSIF OLD.status = 'processing' AND NEW.status IN ('shipped','cancelled') THEN
    RETURN NEW;
  ELSIF OLD.status = 'shipped' AND NEW.status = 'completed' THEN
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
VALUES ('0015_refunded_order_status_transition')
ON CONFLICT (version) DO NOTHING;
