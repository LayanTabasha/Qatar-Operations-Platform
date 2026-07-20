CREATE TABLE site_visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES sites(id) ON DELETE RESTRICT,
  charger_id uuid REFERENCES chargers(id) ON DELETE SET NULL,
  visit_date date NOT NULL,
  check_in_time time,
  check_out_time time,
  visited_by text NOT NULL,
  purpose text NOT NULL,
  observations text,
  actions_taken text,
  follow_up_required boolean NOT NULL DEFAULT false,
  report_file_path text,
  created_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT site_visits_time_order_check CHECK (
    check_out_time IS NULL OR check_in_time IS NULL OR check_out_time >= check_in_time
  )
);

CREATE TRIGGER site_visits_set_updated_at
BEFORE UPDATE ON site_visits
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();
