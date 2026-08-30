ALTER TABLE requests
  ADD COLUMN fault_id uuid REFERENCES faults(id) ON DELETE SET NULL;

CREATE INDEX idx_requests_fault_id ON requests(fault_id);
