CREATE TABLE activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip_address inet,
  request_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION prevent_activity_log_changes()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'activity_logs records are append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER activity_logs_prevent_update
BEFORE UPDATE ON activity_logs
FOR EACH ROW
EXECUTE FUNCTION prevent_activity_log_changes();

CREATE TRIGGER activity_logs_prevent_delete
BEFORE DELETE ON activity_logs
FOR EACH ROW
EXECUTE FUNCTION prevent_activity_log_changes();
