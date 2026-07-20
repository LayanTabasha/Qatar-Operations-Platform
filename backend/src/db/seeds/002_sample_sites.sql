INSERT INTO sites (name, code, location, address, description, status)
VALUES
  ('Mowasalat', 'MOWASALAT', 'Doha, Qatar', 'Development placeholder address', 'Development testing site for Mowasalat operations.', 'active'),
  ('Msheireb', 'MSHEIREB', 'Doha, Qatar', 'Development placeholder address', 'Development testing site for Msheireb operations.', 'active'),
  ('Al Mana', 'AL_MANA', 'Doha, Qatar', 'Development placeholder address', 'Development testing site for Al Mana operations.', 'active')
ON CONFLICT (code) DO UPDATE
SET
  name = EXCLUDED.name,
  location = EXCLUDED.location,
  address = EXCLUDED.address,
  description = EXCLUDED.description,
  status = EXCLUDED.status;
