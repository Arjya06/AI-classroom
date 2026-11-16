-- AI Classroom Engagement Analytics - MySQL Database Schema
-- Compatible with MySQL 8.0+

CREATE DATABASE IF NOT EXISTS classroom_engagement_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE classroom_engagement_db;

-- 1. Teachers Table
CREATE TABLE IF NOT EXISTS teachers (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(160) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  role VARCHAR(30) NOT NULL DEFAULT 'TEACHER',
  department VARCHAR(120) DEFAULT 'Computer Science & Engineering',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 2. Classrooms Table
CREATE TABLE IF NOT EXISTS classrooms (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  classroom_name VARCHAR(150) NOT NULL,
  subject VARCHAR(150) NOT NULL,
  section VARCHAR(40) NOT NULL,
  academic_year VARCHAR(20) NOT NULL,
  description TEXT,
  is_demo BOOLEAN NOT NULL DEFAULT FALSE,
  teacher_id BIGINT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_classroom_teacher FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 3. Students Table
CREATE TABLE IF NOT EXISTS students (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  student_name VARCHAR(150) NOT NULL,
  email VARCHAR(160) NOT NULL,
  roll_number VARCHAR(50) NOT NULL,
  classroom_id BIGINT NOT NULL,
  enrollment_date DATE NOT NULL,
  is_demo BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_student_classroom FOREIGN KEY (classroom_id) REFERENCES classrooms(id) ON DELETE CASCADE,
  CONSTRAINT uq_roll_classroom UNIQUE (roll_number, classroom_id)
) ENGINE=InnoDB;

-- 4. Monitoring Sessions Table
CREATE TABLE IF NOT EXISTS monitoring_sessions (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  session_title VARCHAR(200) NOT NULL,
  classroom_id BIGINT NOT NULL,
  teacher_id BIGINT NOT NULL,
  start_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  end_time TIMESTAMP NULL,
  duration INT NOT NULL DEFAULT 0, -- seconds
  average_engagement DOUBLE NOT NULL DEFAULT 0.0,
  attendance_percentage DOUBLE NOT NULL DEFAULT 0.0,
  status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE', -- ACTIVE, PAUSED, COMPLETED
  mode VARCHAR(20) NOT NULL DEFAULT 'LIVE', -- LIVE, DEMO
  is_demo BOOLEAN NOT NULL DEFAULT FALSE,
  CONSTRAINT fk_session_classroom FOREIGN KEY (classroom_id) REFERENCES classrooms(id) ON DELETE CASCADE,
  CONSTRAINT fk_session_teacher FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 5. Engagement Records Table
CREATE TABLE IF NOT EXISTS engagement_records (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  session_id BIGINT NOT NULL,
  student_id BIGINT NULL, -- nullable for classroom-level camera aggregates
  timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  face_presence_score DOUBLE NOT NULL,
  attention_orientation_score DOUBLE NOT NULL,
  participation_score DOUBLE NULL, -- nullable when no explicit participation event exists
  final_engagement_score DOUBLE NOT NULL,
  detected_faces_count INT NOT NULL DEFAULT 0,
  data_quality_status VARCHAR(40) NOT NULL DEFAULT 'RELIABLE', -- RELIABLE, INSUFFICIENT_VISUAL_DATA, POOR_LIGHTING, SIMULATED_DEMO
  CONSTRAINT fk_record_session FOREIGN KEY (session_id) REFERENCES monitoring_sessions(id) ON DELETE CASCADE,
  CONSTRAINT fk_record_student FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- 6. Attendance Table
CREATE TABLE IF NOT EXISTS attendance (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  student_id BIGINT NOT NULL,
  classroom_id BIGINT NOT NULL,
  attendance_date DATE NOT NULL,
  status VARCHAR(20) NOT NULL, -- PRESENT, ABSENT, LATE
  is_demo BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_attendance_student FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  CONSTRAINT fk_attendance_classroom FOREIGN KEY (classroom_id) REFERENCES classrooms(id) ON DELETE CASCADE,
  CONSTRAINT uq_attendance_student_date UNIQUE (student_id, attendance_date)
) ENGINE=InnoDB;

-- 7. Participation Events Table
CREATE TABLE IF NOT EXISTS participation_events (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  student_id BIGINT NULL,
  session_id BIGINT NOT NULL,
  event_type VARCHAR(80) NOT NULL, -- QUESTION_ANSWERED, HAND_RAISED, GROUP_DISCUSSION, QUIZ_RESPONSE
  score_value DOUBLE NOT NULL DEFAULT 85.0,
  timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  recorded_by BIGINT NOT NULL,
  CONSTRAINT fk_part_student FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE SET NULL,
  CONSTRAINT fk_part_session FOREIGN KEY (session_id) REFERENCES monitoring_sessions(id) ON DELETE CASCADE,
  CONSTRAINT fk_part_teacher FOREIGN KEY (recorded_by) REFERENCES teachers(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 8. Teacher Settings Table
CREATE TABLE IF NOT EXISTS teacher_settings (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  teacher_id BIGINT NOT NULL UNIQUE,
  attention_weight DOUBLE NOT NULL DEFAULT 50.0,
  presence_weight DOUBLE NOT NULL DEFAULT 30.0,
  participation_weight DOUBLE NOT NULL DEFAULT 20.0,
  include_participation BOOLEAN NOT NULL DEFAULT TRUE,
  high_threshold DOUBLE NOT NULL DEFAULT 75.0,
  moderate_threshold DOUBLE NOT NULL DEFAULT 50.0,
  sampling_interval INT NOT NULL DEFAULT 3, -- seconds
  preferred_camera_label VARCHAR(160) DEFAULT 'Default Classroom Camera',
  retention_days INT NOT NULL DEFAULT 90,
  CONSTRAINT fk_settings_teacher FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE INDEX idx_sessions_classroom ON monitoring_sessions(classroom_id);
CREATE INDEX idx_records_session_ts ON engagement_records(session_id, timestamp);
CREATE INDEX idx_attendance_class_date ON attendance(classroom_id, attendance_date);
