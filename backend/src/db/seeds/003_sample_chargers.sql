INSERT INTO chargers (
  site_id,
  code,
  name,
  manufacturer,
  model,
  serial_number,
  type,
  power_kw,
  firmware_version,
  description,
  status
)
SELECT
  sites.id,
  sample.code,
  sample.name,
  sample.manufacturer,
  sample.model,
  sample.serial_number,
  sample.type,
  sample.power_kw,
  sample.firmware_version,
  sample.description,
  sample.status
FROM (
  VALUES
    ('MOWASALAT', 'MOW-DC-01', 'Mowasalat DC Charger 01', 'Zeeda Energy', 'DC Fast Charger', 'MOW-DC-01-SN', 'DC', 120.00, '1.0.0', 'Sample DC charger for Mowasalat operations.', 'active'),
    ('MSHEIREB', 'MSH-DC-01', 'Msheireb DC Charger 01', 'Zeeda Energy', 'DC Fast Charger', 'MSH-DC-01-SN', 'DC', 120.00, '1.0.0', 'Sample DC charger for Msheireb operations.', 'active'),
    ('MSHEIREB', 'MSH-DC-02', 'Msheireb DC Charger 02', 'Zeeda Energy', 'DC Fast Charger', 'MSH-DC-02-SN', 'DC', 120.00, '1.0.0', 'Second sample DC charger for Msheireb operations.', 'active'),
    ('MSHEIREB', 'MSH-AC-01', 'Msheireb AC Charger 01', 'Zeeda Energy', 'AC Charger', 'MSH-AC-01-SN', 'AC', 22.00, '1.0.0', 'Sample AC charger for Msheireb operations.', 'active'),
    ('AL_MANA', 'ALM-AC-01', 'Al Mana AC Charger 01', 'Zeeda Energy', 'AC Charger', 'ALM-AC-01-SN', 'AC', 22.00, '1.0.0', 'Sample AC charger for Al Mana operations.', 'active')
) AS sample(site_code, code, name, manufacturer, model, serial_number, type, power_kw, firmware_version, description, status)
JOIN sites ON sites.code = sample.site_code
ON CONFLICT (code) DO UPDATE
SET
  site_id = EXCLUDED.site_id,
  name = EXCLUDED.name,
  manufacturer = EXCLUDED.manufacturer,
  model = EXCLUDED.model,
  serial_number = EXCLUDED.serial_number,
  type = EXCLUDED.type,
  power_kw = EXCLUDED.power_kw,
  firmware_version = EXCLUDED.firmware_version,
  description = EXCLUDED.description,
  status = EXCLUDED.status;
