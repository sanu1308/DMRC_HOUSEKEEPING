-- DMRC Housekeeping Management System Database Schema

-- Create Database
CREATE DATABASE IF NOT EXISTS dmrc_housekeeping;
USE dmrc_housekeeping;

-- Users Table
CREATE TABLE users (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  role ENUM('superadmin', 'user') NOT NULL DEFAULT 'user',
  station_id INT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Stations Table
CREATE TABLE stations (
  id INT PRIMARY KEY AUTO_INCREMENT,
  station_name VARCHAR(100) NOT NULL,
  station_code VARCHAR(50) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by INT NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_by INT,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT,
  FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
);

ALTER TABLE users
  ADD CONSTRAINT fk_users_station
    FOREIGN KEY (station_id) REFERENCES stations(id) ON DELETE SET NULL;

CREATE INDEX idx_users_station ON users(station_id);

-- Chemical Products Table
CREATE TABLE chemical_products (
  id INT PRIMARY KEY AUTO_INCREMENT,
  chemical_name VARCHAR(100) NOT NULL,
  category VARCHAR(100) NOT NULL DEFAULT 'General',
  measuring_unit VARCHAR(50) NOT NULL,
  total_stock DECIMAL(12, 2) NOT NULL DEFAULT 0,
  minimum_stock_level DECIMAL(12, 2) NOT NULL DEFAULT 0,
  quantity INT NOT NULL,
  monthly_quantity INT NOT NULL,
  daily_utilized INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by INT NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_by INT,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT,
  FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Machinery Table
CREATE TABLE machinery (
  id INT PRIMARY KEY AUTO_INCREMENT,
  machinery_name VARCHAR(100) NOT NULL,
  machine_type VARCHAR(100) NOT NULL DEFAULT 'General',
  quantity_total INT NOT NULL DEFAULT 1,
  quantity_in_use INT NOT NULL DEFAULT 0,
  quantity_faulty INT NOT NULL DEFAULT 0,
  quantity_maintenance INT NOT NULL DEFAULT 0,
  number_of_days INT NOT NULL,
  station_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by INT NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_by INT,
  FOREIGN KEY (station_id) REFERENCES stations(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT,
  FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL,
  CHECK (quantity_total >= 0),
  CHECK (quantity_in_use >= 0),
  CHECK (quantity_faulty >= 0),
  CHECK (quantity_maintenance >= 0),
  CHECK (quantity_in_use + quantity_faulty + quantity_maintenance <= quantity_total)
);

-- Staff Table
CREATE TABLE staff (
  id INT PRIMARY KEY AUTO_INCREMENT,
  date DATE NOT NULL,
  day VARCHAR(20) NOT NULL,
  station_name VARCHAR(100) NOT NULL,
  shift VARCHAR(50) NOT NULL,
  manpower VARCHAR(50) NOT NULL,
  number_of_persons INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by INT NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_by INT,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT,
  FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Staff Master Table (Admin managed roster)
CREATE TABLE staff_master (
  id INT PRIMARY KEY AUTO_INCREMENT,
  staff_name VARCHAR(120) NOT NULL,
  role VARCHAR(80) NOT NULL,
  shift VARCHAR(20) NOT NULL,
  station_id INT NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by INT NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_by INT,
  FOREIGN KEY (station_id) REFERENCES stations(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT,
  FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_staff_master_station ON staff_master(station_id);
CREATE INDEX idx_staff_master_shift ON staff_master(shift);

-- Station manpower allocation (minimum 20 manpower per station)
CREATE TABLE station_manpower (
  id INT PRIMARY KEY AUTO_INCREMENT,
  station_id INT NOT NULL UNIQUE,
  total_manpower INT NOT NULL,
  supervisors INT NOT NULL DEFAULT 0,
  technicians INT NOT NULL DEFAULT 0,
  cleaners INT NOT NULL DEFAULT 0,
  notes VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (station_id) REFERENCES stations(id) ON DELETE CASCADE,
  CHECK (total_manpower >= 20),
  CHECK (supervisors + technicians + cleaners <= total_manpower)
);

CREATE INDEX idx_station_manpower_station ON station_manpower(station_id);

-- Section-wise manpower usage ledger to keep track the consumption per day
CREATE TABLE section_manpower_usage (
  id INT PRIMARY KEY AUTO_INCREMENT,
  station_id INT NOT NULL,
  section ENUM('chemical', 'machinery', 'pest') NOT NULL,
  usage_date DATE NOT NULL,
  manpower_used INT NOT NULL,
  source_type ENUM('chemical', 'machinery', 'pest') NOT NULL,
  source_record_id INT NOT NULL,
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (station_id) REFERENCES stations(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT,
  UNIQUE KEY uk_section_usage_source (source_type, source_record_id),
  INDEX idx_section_usage_station_date (station_id, section, usage_date)
);

-- Areas Table
CREATE TABLE areas (
  id INT PRIMARY KEY AUTO_INCREMENT,
  area_name VARCHAR(120) NOT NULL,
  description VARCHAR(255),
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_area_name (area_name)
);

-- Pest Control Table
CREATE TABLE pest_control (
  id INT PRIMARY KEY AUTO_INCREMENT,
  pest_control_type VARCHAR(100) NOT NULL,
  pest_type VARCHAR(100),
  control_method VARCHAR(100),
  chemical_used VARCHAR(100) NOT NULL,
  measuring_unit VARCHAR(50) NOT NULL,
  quantity_used DECIMAL(10, 2) NOT NULL,
  manpower_used INT NOT NULL DEFAULT 0,
  station_id INT NOT NULL,
  shift VARCHAR(20),
  area_covered VARCHAR(150),
  status VARCHAR(50),
  service_date DATE,
  date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by INT NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_by INT,
  FOREIGN KEY (station_id) REFERENCES stations(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT,
  FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Housekeeping Logs Table
CREATE TABLE housekeeping_logs (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  station_id INT NOT NULL,
  chemical_id INT,
  machinery_id INT,
  staff_id INT,
  pest_control_id INT,
  cleaning_area VARCHAR(100) NOT NULL,
  cleaning_type VARCHAR(100) NOT NULL,
  date DATE NOT NULL,
  time TIME NOT NULL,
  remarks TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (station_id) REFERENCES stations(id) ON DELETE CASCADE,
  FOREIGN KEY (chemical_id) REFERENCES chemical_products(id) ON DELETE SET NULL,
  FOREIGN KEY (machinery_id) REFERENCES machinery(id) ON DELETE SET NULL,
  FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE SET NULL,
  FOREIGN KEY (pest_control_id) REFERENCES pest_control(id) ON DELETE SET NULL
);

-- Create Indexes for better query performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_stations_code ON stations(station_code);
CREATE INDEX idx_housekeeping_user ON housekeeping_logs(user_id);
CREATE INDEX idx_housekeeping_station ON housekeeping_logs(station_id);
CREATE INDEX idx_housekeeping_date ON housekeeping_logs(date);
CREATE INDEX idx_staff_date ON staff(date);
CREATE INDEX idx_pest_control_date ON pest_control(date);

-- Sample Data
-- Insert Super Admin User
INSERT INTO users (name, email, password, role, station_id) VALUES 
('Super Admin', 'admin@dmrc.gov.in', '$2a$10$YourHashedPasswordHere', 'superadmin', NULL);

-- Insert Sample Stations
INSERT INTO stations (station_name, station_code, created_by, updated_by) VALUES
('Kashmiri Gate','KG-004',1,1),
('Dwarka','D-005',1,1), 
('Rajiv Chowk Station', 'RC-001', 1, 1),
('Central Secretariat Station', 'CS-002', 1, 1),
('Patel Nagar Station', 'PN-003', 1, 1);

-- Insert Station-linked Staff Users (one per station)
INSERT INTO users (name, email, password, role, station_id) VALUES
('Kashmiri Gate Supervisor', 'kashmirigate.ops@dmrc.gov.in', '$2a$10$YourHashedPasswordHere', 'user', 1),
('Dwarka Supervisor', 'dwarka.ops@dmrc.gov.in', '$2a$10$YourHashedPasswordHere', 'user', 2),
('Rajiv Chowk Supervisor', 'rajivchowk.ops@dmrc.gov.in', '$2a$10$YourHashedPasswordHere', 'user', 3),
('Central Secretariat Supervisor', 'cs.ops@dmrc.gov.in', '$2a$10$YourHashedPasswordHere', 'user', 4),
('Patel Nagar Supervisor', 'patelnagar.ops@dmrc.gov.in', '$2a$10$YourHashedPasswordHere', 'user', 5);

-- Insert Sample Chemical Products
INSERT INTO chemical_products (chemical_name, category, measuring_unit, total_stock, minimum_stock_level, quantity, monthly_quantity, daily_utilized, created_by, updated_by) VALUES 
('Phenol Disinfectant', 'Cleaning', 'Liters', 100, 25, 100, 500, 15, 1, 1),
('Bleach Powder', 'Disinfection', 'Kg', 50, 15, 50, 200, 5, 1, 1),
('Floor Polish', 'Finishing', 'Liters', 30, 10, 30, 150, 2, 1, 1);

-- Insert Sample Areas
INSERT INTO areas (area_name, description) VALUES
('Lobby', 'Station lobby and ticketing hall'),
('Platform', 'All passenger platforms'),
('Stairs', 'Stairways and escalator landings'),
('Toilets', 'Public restrooms and wash areas'),
('Entry / Exit', 'Entry gates, concourse, and exit points'),
('Backend Work', 'Staff rooms, storage, back office corridors');
--('concourse','large hall');

-- ==================== NEW TABLES FOR USAGE TRACKING ====================

-- Chemical Usage Table (does NOT replace existing chemical_products)
CREATE TABLE chemical_usage (
  id INT PRIMARY KEY AUTO_INCREMENT,
  station_id INT NOT NULL,
  user_id INT NULL,
  chemical_name VARCHAR(100) NOT NULL,
  area VARCHAR(120) NOT NULL,
  shift VARCHAR(20) NOT NULL,
  quantity DECIMAL(10, 2) NOT NULL,
  unit VARCHAR(50) NOT NULL,
  manpower_used INT NOT NULL DEFAULT 0,
  usage_date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (station_id) REFERENCES stations(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_chemical_usage_user ON chemical_usage(user_id);
CREATE INDEX idx_chemical_usage_station ON chemical_usage(station_id);
CREATE INDEX idx_chemical_usage_date ON chemical_usage(usage_date);

-- Machinery Usage Table (does NOT replace existing machinery)
CREATE TABLE machinery_usage (
  id INT PRIMARY KEY AUTO_INCREMENT,
  station_id INT NOT NULL,
  user_id INT NOT NULL,
  shift_id INT NULL,
  machine_name VARCHAR(100) NOT NULL,
  machine_type VARCHAR(100) NOT NULL,
  area_used VARCHAR(120) NOT NULL,
  usage_hours DECIMAL(10, 2) NOT NULL,
  manpower_used INT NOT NULL DEFAULT 0,
  status VARCHAR(50) NOT NULL,
  usage_date DATE NOT NULL,
  shift VARCHAR(20) NOT NULL DEFAULT 'Day',
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (station_id) REFERENCES stations(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_machinery_usage_user ON machinery_usage(user_id);
CREATE INDEX idx_machinery_usage_station ON machinery_usage(station_id);
CREATE INDEX idx_machinery_usage_date ON machinery_usage(usage_date);

-- ==================== COMPLIANCE & AUDIT TABLES ====================

CREATE TABLE compliance_audits (
  id INT PRIMARY KEY AUTO_INCREMENT,
  station_id INT NOT NULL,
  audit_date DATE NOT NULL,
  auditor_name VARCHAR(120) NOT NULL,
  score INT NOT NULL,
  status ENUM('COMPLIANT', 'AT_RISK', 'NON_COMPLIANT') NOT NULL,
  report_url VARCHAR(255),
  notes TEXT,
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (station_id) REFERENCES stations(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT,
  INDEX idx_compliance_station_date (station_id, audit_date)
);

CREATE TABLE compliance_actions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  station_id INT NOT NULL,
  audit_id INT NULL,
  title VARCHAR(150) NOT NULL,
  description TEXT,
  priority ENUM('low', 'medium', 'high') NOT NULL DEFAULT 'medium',
  due_date DATE,
  status ENUM('open', 'in_progress', 'closed') NOT NULL DEFAULT 'open',
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (station_id) REFERENCES stations(id) ON DELETE CASCADE,
  FOREIGN KEY (audit_id) REFERENCES compliance_audits(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT,
  INDEX idx_compliance_actions_station (station_id),
  INDEX idx_compliance_actions_due (due_date)
);

CREATE TABLE compliance_documents (
  id INT PRIMARY KEY AUTO_INCREMENT,
  station_id INT NOT NULL,
  audit_id INT NULL,
  document_name VARCHAR(150) NOT NULL,
  file_path VARCHAR(255) NOT NULL,
  uploaded_by INT NOT NULL,
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (station_id) REFERENCES stations(id) ON DELETE CASCADE,
  FOREIGN KEY (audit_id) REFERENCES compliance_audits(id) ON DELETE SET NULL,
  FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE RESTRICT,
  INDEX idx_compliance_documents_station (station_id)
);

-- ==================== ALERT RULES & EVENTS ====================

CREATE TABLE alert_rules (
  id INT PRIMARY KEY AUTO_INCREMENT,
  rule_name VARCHAR(150) NOT NULL,
  alert_type ENUM('STAFF_SHORTAGE', 'CHEMICAL_STOCK', 'MACHINERY_STATUS', 'COMPLIANCE', 'CUSTOM') NOT NULL,
  severity ENUM('info', 'warning', 'critical') NOT NULL DEFAULT 'warning',
  station_id INT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  condition_json JSON NOT NULL,
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (station_id) REFERENCES stations(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT,
  INDEX idx_alert_rules_station (station_id),
  INDEX idx_alert_rules_active (is_active)
);

CREATE TABLE alert_events (
  id INT PRIMARY KEY AUTO_INCREMENT,
  rule_id INT NOT NULL,
  station_id INT NOT NULL,
  alert_type ENUM('STAFF_SHORTAGE', 'CHEMICAL_STOCK', 'MACHINERY_STATUS', 'COMPLIANCE', 'CUSTOM') NOT NULL,
  severity ENUM('info', 'warning', 'critical') NOT NULL,
  message VARCHAR(255) NOT NULL,
  details JSON,
  acknowledged TINYINT(1) NOT NULL DEFAULT 0,
  acknowledged_by INT,
  acknowledged_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  resolved_at TIMESTAMP NULL,
  FOREIGN KEY (rule_id) REFERENCES alert_rules(id) ON DELETE CASCADE,
  FOREIGN KEY (station_id) REFERENCES stations(id) ON DELETE CASCADE,
  FOREIGN KEY (acknowledged_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_alert_events_station (station_id),
  INDEX idx_alert_events_created (created_at)
);

-- ==================== EXPORT ARTIFACTS ====================

CREATE TABLE report_exports (
  id INT PRIMARY KEY AUTO_INCREMENT,
  station_id INT NULL,
  report_date DATE NOT NULL,
  format ENUM('pdf', 'csv') NOT NULL,
  status ENUM('pending', 'ready', 'failed') NOT NULL DEFAULT 'pending',
  file_path VARCHAR(255),
  expires_at DATETIME,
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (station_id) REFERENCES stations(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT,
  INDEX idx_report_exports_station (station_id),
  INDEX idx_report_exports_status (status)
);

-- ==================== SEED DATA FOR NEW TABLES ====================

INSERT INTO compliance_audits (station_id, audit_date, auditor_name, score, status, report_url, notes, created_by) VALUES
  (1, DATE_SUB(CURDATE(), INTERVAL 7 DAY), 'Meera Singh', 92, 'COMPLIANT', '/compliance/reports/KG-004-2024-03.pdf', 'Excellent upkeep with minor signage issues.', 1),
  (2, DATE_SUB(CURDATE(), INTERVAL 21 DAY), 'Rohan Das', 74, 'AT_RISK', '/compliance/reports/D-005-2024-02.pdf', 'Deep cleaning schedule needs tightening for concourse area.', 1),
  (3, DATE_SUB(CURDATE(), INTERVAL 35 DAY), 'Latika Rao', 64, 'NON_COMPLIANT', '/compliance/reports/RC-001-2024-02.pdf', 'Multiple repeat pest observations on platform 1.', 1);

INSERT INTO compliance_actions (station_id, audit_id, title, description, priority, due_date, status, created_by) VALUES
  (3, 3, 'Seal food waste chute leak', 'Recurring pest ingress traced to broken chute gasket behind platform 1.', 'high', DATE_ADD(CURDATE(), INTERVAL 5 DAY), 'open', 1),
  (2, 2, 'Refresh concourse polishing roster', 'Polish cycle slipped by 4 days causing dull patches near Gate B.', 'medium', DATE_ADD(CURDATE(), INTERVAL 10 DAY), 'in_progress', 1),
  (1, 1, 'Submit UV lamp maintenance proof', 'Auditor requested photos/logs for UV lamps replaced last quarter.', 'low', DATE_ADD(CURDATE(), INTERVAL 20 DAY), 'open', 1);

INSERT INTO compliance_documents (station_id, audit_id, document_name, file_path, uploaded_by) VALUES
  (1, 1, 'KG-004 Audit Checklist.pdf', '/docs/compliance/KG-004-checklist.pdf', 1),
  (2, 2, 'D-005 Corrective Plan.docx', '/docs/compliance/D-005-corrective-plan.docx', 1);

INSERT INTO alert_rules (rule_name, alert_type, severity, station_id, is_active, condition_json, created_by) VALUES
  ('Night shift staffing below threshold', 'STAFF_SHORTAGE', 'warning', NULL, 1, JSON_OBJECT('shift', 'Night', 'minPersons', 8), 1),
  ('Critical pest recurrence', 'COMPLIANCE', 'critical', 3, 1, JSON_OBJECT('pestType', 'Rodent', 'occurrences', 2, 'windowDays', 14), 1),
  ('Low disinfectant stock', 'CHEMICAL_STOCK', 'warning', 2, 1, JSON_OBJECT('chemical', 'Phenol Disinfectant', 'minLiters', 30), 1);

INSERT INTO alert_events (rule_id, station_id, alert_type, severity, message, details) VALUES
  (1, 2, 'STAFF_SHORTAGE', 'warning', 'Night shift reported only 6 persons at Dwarka.', JSON_OBJECT('reported', 6, 'expected', 8)),
  (2, 3, 'COMPLIANCE', 'critical', 'Rodent activity flagged twice at Rajiv Chowk within 10 days.', JSON_OBJECT('occurrences', 2, 'area', 'Platform 1')), 
  (3, 2, 'CHEMICAL_STOCK', 'warning', 'Phenol disinfectant stock at Dwarka dropped below 30 liters.', JSON_OBJECT('remaining', 24));

INSERT INTO report_exports (station_id, report_date, format, status, file_path, expires_at, created_by) VALUES
  (NULL, CURDATE(), 'csv', 'ready', '/exports/sample-system-digest.csv', DATE_ADD(CURDATE(), INTERVAL 7 DAY), 1),
  (3, DATE_SUB(CURDATE(), INTERVAL 1 DAY), 'pdf', 'pending', NULL, DATE_ADD(CURDATE(), INTERVAL 14 DAY), 1);

