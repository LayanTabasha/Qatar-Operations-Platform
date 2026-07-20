CREATE TABLE chargers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES sites(id) ON DELETE RESTRICT,
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  charger_type text,
  manufacturer text,
  model text,
  serial_number text,
  operator_name text,
  administrator_name text,
  rated_power_kw numeric(10, 2) NOT NULL DEFAULT 0,
  delivered_energy_kwh numeric(14, 3) NOT NULL DEFAULT 0,
  total_sessions integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active',
  installation_date date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chargers_rated_power_non_negative CHECK (rated_power_kw >= 0),
  CONSTRAINT chargers_delivered_energy_non_negative CHECK (delivered_energy_kwh >= 0),
  CONSTRAINT chargers_total_sessions_non_negative CHECK (total_sessions >= 0),
  CONSTRAINT chargers_status_check CHECK (status IN ('active', 'inactive', 'maintenance', 'faulted'))
);

CREATE TRIGGER chargers_set_updated_at
BEFORE UPDATE ON chargers
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();
