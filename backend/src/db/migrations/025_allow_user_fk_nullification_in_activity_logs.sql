CREATE OR REPLACE FUNCTION prevent_activity_log_changes()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF current_setting('qatar_ops.allow_activity_log_user_nullification', true) = 'on'
       AND OLD.user_id IS NOT NULL
       AND NEW.user_id IS NULL
       AND (to_jsonb(NEW) - 'user_id') = (to_jsonb(OLD) - 'user_id') THEN
      RETURN NEW;
    END IF;
  END IF;

  RAISE EXCEPTION 'activity_logs records are append-only';
END;
$$ LANGUAGE plpgsql;
