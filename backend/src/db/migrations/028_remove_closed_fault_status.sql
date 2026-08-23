UPDATE faults
SET status = 'resolved'
WHERE status = 'closed';

ALTER TABLE faults
DROP CONSTRAINT faults_status_check,
ADD CONSTRAINT faults_status_check CHECK (status IN ('open', 'in_progress', 'resolved'));
