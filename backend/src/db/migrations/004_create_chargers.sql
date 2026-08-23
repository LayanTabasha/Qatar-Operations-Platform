CREATE TABLE chargers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES sites(id) ON DELETE RESTRICT,
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  manufacturer text,
  model text,
  serial_number text,
  type text NOT NULL,
  power_kw numeric(10, 2) NOT NULL DEFAULT 0,
  firmware_version text,
  description text,
  image_path text,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chargers_type_check CHECK (type IN ('AC', 'DC')),
  CONSTRAINT chargers_power_non_negative CHECK (power_kw >= 0),
  CONSTRAINT chargers_status_check CHECK (status IN ('active', 'maintenance', 'faulted', 'archived'))
);

CREATE TRIGGER chargers_set_updated_at
BEFORE UPDATE ON chargers
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();
