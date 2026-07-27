ALTER TABLE site_visits
RENAME COLUMN check_in_time TO time_in;

ALTER TABLE site_visits
RENAME COLUMN check_out_time TO time_out;
