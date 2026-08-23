CREATE INDEX idx_users_role_id ON users(role_id);

CREATE INDEX idx_chargers_site_id ON chargers(site_id);

CREATE INDEX idx_site_visits_site_id ON site_visits(site_id);
CREATE INDEX idx_site_visits_charger_id ON site_visits(charger_id);
CREATE INDEX idx_site_visits_visit_date ON site_visits(visit_date);

CREATE INDEX idx_faults_site_id ON faults(site_id);
CREATE INDEX idx_faults_charger_id ON faults(charger_id);
CREATE INDEX idx_faults_status ON faults(status);
CREATE INDEX idx_faults_severity ON faults(severity);
CREATE INDEX idx_faults_reported_at ON faults(reported_at);

CREATE INDEX idx_documents_site_id ON documents(site_id);
CREATE INDEX idx_documents_charger_id ON documents(charger_id);

CREATE INDEX idx_reports_site_id ON reports(site_id);
CREATE INDEX idx_reports_report_type ON reports(report_type);
CREATE INDEX idx_reports_period ON reports(period_start, period_end);

CREATE INDEX idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX idx_activity_logs_entity ON activity_logs(entity_type, entity_id);
CREATE INDEX idx_activity_logs_created_at ON activity_logs(created_at);
