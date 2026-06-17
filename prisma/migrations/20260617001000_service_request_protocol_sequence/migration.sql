CREATE SEQUENCE IF NOT EXISTS service_request_protocol_seq;

DO $$
DECLARE
  max_number integer;
BEGIN
  SELECT COALESCE(MAX((substring(protocol from '^MD-[0-9]{4}-([0-9]{5})'))::integer), 0)
  INTO max_number
  FROM "ServiceRequest"
  WHERE protocol ~ '^MD-[0-9]{4}-[0-9]{5}$';

  PERFORM setval('service_request_protocol_seq', GREATEST(max_number, 1), true);
END $$;
