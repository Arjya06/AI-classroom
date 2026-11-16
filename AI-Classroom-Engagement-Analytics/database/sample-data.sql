-- Sample Demonstration Data for AI Classroom Engagement Analytics
-- Clearly marked with is_demo = TRUE so demonstration records are separated from live measurements.

USE classroom_engagement_db;

-- Demo Teacher (Password is 'Demo@1234' hashed with BCrypt cost 10)
INSERT INTO teachers (id, name, email, password, role, department)
VALUES (
  1,
  'Dr. Ananya Sharma',
  'ananya.sharma@university.edu',
  '$2a$10$7EqJtq98hPqEX7fNZaFWoOa7/3G6J9fM8wZ9Z1xO3qM7o8bU8r5G2',
  'TEACHER',
  'Computer Science & Engineering'
) ON DUPLICATE KEY UPDATE name = VALUES(name);

INSERT INTO teacher_settings (teacher_id, attention_weight, presence_weight, participation_weight, include_participation, high_threshold, moderate_threshold, sampling_interval, retention_days)
VALUES (1, 50.0, 30.0, 20.0, TRUE, 75.0, 50.0, 3, 90)
ON DUPLICATE KEY UPDATE attention_weight = VALUES(attention_weight);

-- Demo Classrooms
INSERT INTO classrooms (id, classroom_name, subject, section, academic_year, description, is_demo, teacher_id) VALUES
(1, 'CS-301 Data Structures & Algorithms [DEMO]', 'Data Structures & Algorithms', 'CSE-A', '2026-27', 'Demonstration classroom with historical simulated session metrics for academic viva.', TRUE, 1),
(2, 'CS-402 Machine Learning Foundations [DEMO]', 'Machine Learning', 'CSE-B', '2026-27', 'Upper-division seminar classroom used for simulated engagement trend comparison.', TRUE, 1)
ON DUPLICATE KEY UPDATE classroom_name = VALUES(classroom_name);

-- Demo Students
INSERT INTO students (id, student_name, email, roll_number, classroom_id, enrollment_date, is_demo) VALUES
(1, 'Aarav Kulkarni', 'aarav.k@student.edu', '23CSE001', 1, '2026-08-01', TRUE),
(2, 'Diya Menon', 'diya.m@student.edu', '23CSE002', 1, '2026-08-01', TRUE),
(3, 'Rohan Deshmukh', 'rohan.d@student.edu', '23CSE003', 1, '2026-08-01', TRUE),
(4, 'Meera Nair', 'meera.n@student.edu', '23CSE004', 1, '2026-08-01', TRUE),
(5, 'Kabir Verma', 'kabir.v@student.edu', '23CSE005', 1, '2026-08-01', TRUE),
(6, 'Sanya Iyer', 'sanya.i@student.edu', '23CSE006', 1, '2026-08-01', TRUE),
(7, 'Vikram Joshi', 'vikram.j@student.edu', '22CSE101', 2, '2026-08-01', TRUE),
(8, 'Priya Kapoor', 'priya.k@student.edu', '22CSE102', 2, '2026-08-01', TRUE),
(9, 'Ishaan Gupta', 'ishaan.g@student.edu', '22CSE103', 2, '2026-08-01', TRUE),
(10, 'Neha Chatterjee', 'neha.c@student.edu', '22CSE104', 2, '2026-08-01', TRUE)
ON DUPLICATE KEY UPDATE student_name = VALUES(student_name);

-- Demo Monitoring Sessions
INSERT INTO monitoring_sessions (id, session_title, classroom_id, teacher_id, start_time, end_time, duration, average_engagement, attendance_percentage, status, mode, is_demo) VALUES
(1, 'Graph Traversal & BFS/DFS [DEMO]', 1, 1, DATE_SUB(NOW(), INTERVAL 6 DAY), DATE_ADD(DATE_SUB(NOW(), INTERVAL 6 DAY), INTERVAL 45 MINUTE), 2700, 78.4, 83.3, 'COMPLETED', 'DEMO', TRUE),
(2, 'Dynamic Programming Memoization [DEMO]', 1, 1, DATE_SUB(NOW(), INTERVAL 3 DAY), DATE_ADD(DATE_SUB(NOW(), INTERVAL 3 DAY), INTERVAL 50 MINUTE), 3000, 72.1, 83.3, 'COMPLETED', 'DEMO', TRUE),
(3, 'Linear Regression & Gradient Descent [DEMO]', 2, 1, DATE_SUB(NOW(), INTERVAL 2 DAY), DATE_ADD(DATE_SUB(NOW(), INTERVAL 2 DAY), INTERVAL 40 MINUTE), 2400, 81.6, 100.0, 'COMPLETED', 'DEMO', TRUE)
ON DUPLICATE KEY UPDATE session_title = VALUES(session_title);

-- Demo Engagement Records
INSERT INTO engagement_records (session_id, student_id, timestamp, face_presence_score, attention_orientation_score, participation_score, final_engagement_score, detected_faces_count, data_quality_status) VALUES
(1, 1, DATE_SUB(NOW(), INTERVAL 6 DAY), 94.0, 86.0, 85.0, 88.2, 1, 'SIMULATED_DEMO'),
(1, 2, DATE_SUB(NOW(), INTERVAL 6 DAY), 96.0, 88.0, 90.0, 90.8, 1, 'SIMULATED_DEMO'),
(1, 3, DATE_SUB(NOW(), INTERVAL 6 DAY), 62.0, 44.0, NULL, 50.8, 1, 'SIMULATED_DEMO'),
(1, 4, DATE_SUB(NOW(), INTERVAL 6 DAY), 85.0, 76.0, 80.0, 79.5, 1, 'SIMULATED_DEMO'),
(1, 5, DATE_SUB(NOW(), INTERVAL 6 DAY), 54.0, 38.0, NULL, 44.0, 1, 'SIMULATED_DEMO'),
(1, 6, DATE_SUB(NOW(), INTERVAL 6 DAY), 90.0, 82.0, 75.0, 83.0, 1, 'SIMULATED_DEMO'),
(2, 1, DATE_SUB(NOW(), INTERVAL 3 DAY), 90.0, 82.0, 85.0, 85.0, 1, 'SIMULATED_DEMO'),
(2, 2, DATE_SUB(NOW(), INTERVAL 3 DAY), 92.0, 84.0, 80.0, 85.6, 1, 'SIMULATED_DEMO'),
(2, 3, DATE_SUB(NOW(), INTERVAL 3 DAY), 55.0, 40.0, NULL, 45.6, 1, 'SIMULATED_DEMO'),
(2, 5, DATE_SUB(NOW(), INTERVAL 3 DAY), 50.0, 36.0, NULL, 41.3, 1, 'SIMULATED_DEMO'),
(3, 7, DATE_SUB(NOW(), INTERVAL 2 DAY), 92.0, 85.0, 88.0, 87.7, 1, 'SIMULATED_DEMO'),
(3, 8, DATE_SUB(NOW(), INTERVAL 2 DAY), 88.0, 80.0, 75.0, 81.4, 1, 'SIMULATED_DEMO'),
(3, 9, DATE_SUB(NOW(), INTERVAL 2 DAY), 80.0, 74.0, NULL, 76.3, 1, 'SIMULATED_DEMO'),
(3, 10, DATE_SUB(NOW(), INTERVAL 2 DAY), 86.0, 78.0, 82.0, 81.2, 1, 'SIMULATED_DEMO');

-- Demo Attendance Records
INSERT INTO attendance (student_id, classroom_id, attendance_date, status, is_demo) VALUES
(1, 1, CURDATE(), 'PRESENT', TRUE),
(2, 1, CURDATE(), 'PRESENT', TRUE),
(3, 1, CURDATE(), 'LATE', TRUE),
(4, 1, CURDATE(), 'PRESENT', TRUE),
(5, 1, CURDATE(), 'ABSENT', TRUE),
(6, 1, CURDATE(), 'PRESENT', TRUE),
(7, 2, CURDATE(), 'PRESENT', TRUE),
(8, 2, CURDATE(), 'PRESENT', TRUE),
(9, 2, CURDATE(), 'PRESENT', TRUE),
(10, 2, CURDATE(), 'LATE', TRUE)
ON DUPLICATE KEY UPDATE status = VALUES(status);
