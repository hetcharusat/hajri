-- Quick Sample Data for Testing
-- Run this AFTER running CLEAN-SCHEMA.sql

-- Add more departments
INSERT INTO departments (code, name) VALUES 
  ('IT', 'Information Technology'),
  ('ECE', 'Electronics & Communication')
ON CONFLICT (code) DO NOTHING;

-- Add more semesters
INSERT INTO semesters (name, year, start_date, end_date, is_active) VALUES 
  ('Semester 2', 2025, '2025-07-01', '2025-12-15', false),
  ('Semester 1', 2026, '2026-01-15', '2026-05-31', false)
ON CONFLICT (name, year) DO NOTHING;

-- Add sample subjects
INSERT INTO subjects (code, name, department_id, credits, type) VALUES 
  ('CS101', 'Programming Fundamentals', (SELECT id FROM departments WHERE code = 'CS'), 4, 'LECTURE'),
  ('CS102', 'Programming Lab', (SELECT id FROM departments WHERE code = 'CS'), 2, 'LAB'),
  ('CS201', 'Data Structures', (SELECT id FROM departments WHERE code = 'CS'), 4, 'LECTURE'),
  ('CS202', 'Data Structures Lab', (SELECT id FROM departments WHERE code = 'CS'), 2, 'LAB'),
  ('EE101', 'Circuit Theory', (SELECT id FROM departments WHERE code = 'EE'), 3, 'LECTURE'),
  ('EE102', 'Circuit Lab', (SELECT id FROM departments WHERE code = 'EE'), 2, 'LAB'),
  ('ME101', 'Engineering Mechanics', (SELECT id FROM departments WHERE code = 'ME'), 4, 'LECTURE'),
  ('ME102', 'Workshop Practice', (SELECT id FROM departments WHERE code = 'ME'), 2, 'LAB');

-- Add sample faculty
INSERT INTO faculty (name, email, department_id) VALUES 
  ('Dr. John Smith', 'john.smith@university.edu', (SELECT id FROM departments WHERE code = 'CS')),
  ('Prof. Sarah Johnson', 'sarah.j@university.edu', (SELECT id FROM departments WHERE code = 'CS')),
  ('Dr. Michael Brown', 'michael.b@university.edu', (SELECT id FROM departments WHERE code = 'EE')),
  ('Prof. Emily Davis', 'emily.d@university.edu', (SELECT id FROM departments WHERE code = 'EE')),
  ('Dr. Robert Wilson', 'robert.w@university.edu', (SELECT id FROM departments WHERE code = 'ME')),
  ('Prof. Lisa Anderson', 'lisa.a@university.edu', (SELECT id FROM departments WHERE code = 'ME'));

-- Add sample rooms
INSERT INTO rooms (room_number, building, capacity, type) VALUES 
  ('101', 'Main Building', 50, 'CLASSROOM'),
  ('102', 'Main Building', 50, 'CLASSROOM'),
  ('103', 'Main Building', 50, 'CLASSROOM'),
  ('201', 'Main Building', 45, 'CLASSROOM'),
  ('202', 'Main Building', 45, 'CLASSROOM'),
  ('L-101', 'Lab Block', 30, 'LAB'),
  ('L-102', 'Lab Block', 30, 'LAB'),
  ('L-201', 'Lab Block', 30, 'LAB'),
  ('L-202', 'Lab Block', 30, 'LAB'),
  ('A-Hall', 'Admin Block', 200, 'HALL'),
  ('B-Hall', 'Block B', 150, 'HALL');

-- Add sample batches
INSERT INTO batches (name, department_id, semester_id) VALUES 
  ('A', (SELECT id FROM departments WHERE code = 'CS'), (SELECT id FROM semesters WHERE name = 'Semester 1' AND year = 2025)),
  ('B', (SELECT id FROM departments WHERE code = 'CS'), (SELECT id FROM semesters WHERE name = 'Semester 1' AND year = 2025)),
  ('A', (SELECT id FROM departments WHERE code = 'EE'), (SELECT id FROM semesters WHERE name = 'Semester 1' AND year = 2025)),
  ('B', (SELECT id FROM departments WHERE code = 'EE'), (SELECT id FROM semesters WHERE name = 'Semester 1' AND year = 2025)),
  ('A', (SELECT id FROM departments WHERE code = 'ME'), (SELECT id FROM semesters WHERE name = 'Semester 1' AND year = 2025)),
  ('B', (SELECT id FROM departments WHERE code = 'ME'), (SELECT id FROM semesters WHERE name = 'Semester 1' AND year = 2025))
ON CONFLICT (name, department_id, semester_id) DO NOTHING;

-- Add sample studentsn 
INSERT INTO students (roll_number, name, email, department_id, semester_id, batch_id, enrollment_year) VALUES 
  ('CS001', 'Alice Williams', 'alice.w@student.edu', 
    (SELECT id FROM departments WHERE code = 'CS'),
    (SELECT id FROM semesters WHERE name = 'Semester 1' AND year = 2025),
    (SELECT id FROM batches WHERE name = 'A' AND department_id = (SELECT id FROM departments WHERE code = 'CS') LIMIT 1),
    2024),
  ('CS002', 'Bob Taylor', 'bob.t@student.edu',
    (SELECT id FROM departments WHERE code = 'CS'),
    (SELECT id FROM semesters WHERE name = 'Semester 1' AND year = 2025),
    (SELECT id FROM batches WHERE name = 'A' AND department_id = (SELECT id FROM departments WHERE code = 'CS') LIMIT 1),
    2024),
  ('CS003', 'Charlie Davis', 'charlie.d@student.edu',
    (SELECT id FROM departments WHERE code = 'CS'),
    (SELECT id FROM semesters WHERE name = 'Semester 1' AND year = 2025),
    (SELECT id FROM batches WHERE name = 'B' AND department_id = (SELECT id FROM departments WHERE code = 'CS') LIMIT 1),
    2024),
  ('EE001', 'Diana Martinez', 'diana.m@student.edu',
    (SELECT id FROM departments WHERE code = 'EE'),
    (SELECT id FROM semesters WHERE name = 'Semester 1' AND year = 2025),
    (SELECT id FROM batches WHERE name = 'A' AND department_id = (SELECT id FROM departments WHERE code = 'EE') LIMIT 1),
    2024),
  ('EE002', 'Ethan Garcia', 'ethan.g@student.edu',
    (SELECT id FROM departments WHERE code = 'EE'),
    (SELECT id FROM semesters WHERE name = 'Semester 1' AND year = 2025),
    (SELECT id FROM batches WHERE name = 'A' AND department_id = (SELECT id FROM departments WHERE code = 'EE') LIMIT 1),
    2024),
  ('ME001', 'Frank Rodriguez', 'frank.r@student.edu',
    (SELECT id FROM departments WHERE code = 'ME'),
    (SELECT id FROM semesters WHERE name = 'Semester 1' AND year = 2025),
    (SELECT id FROM batches WHERE name = 'A' AND department_id = (SELECT id FROM departments WHERE code = 'ME') LIMIT 1),
    2024);

-- Add sample timetable entries (CS Batch A - Monday)
INSERT INTO timetable_entries (subject_id, faculty_id, room_id, batch_id, day_of_week, start_time, end_time, is_published) VALUES 
  (
    (SELECT id FROM subjects WHERE code = 'CS101'),
    (SELECT id FROM faculty WHERE name = 'Dr. John Smith'),
    (SELECT id FROM rooms WHERE room_number = '101'),
    (SELECT id FROM batches WHERE name = 'A' AND department_id = (SELECT id FROM departments WHERE code = 'CS') LIMIT 1),
    0, -- Monday
    '09:00',
    '10:00',
    false
  ),
  (
    (SELECT id FROM subjects WHERE code = 'CS102'),
    (SELECT id FROM faculty WHERE name = 'Prof. Sarah Johnson'),
    (SELECT id FROM rooms WHERE room_number = 'L-101'),
    (SELECT id FROM batches WHERE name = 'A' AND department_id = (SELECT id FROM departments WHERE code = 'CS') LIMIT 1),
    0, -- Monday
    '10:00',
    '11:00',
    false
  );

-- Verify data
SELECT 'Departments' as table_name, COUNT(*) as count FROM departments
UNION ALL
SELECT 'Semesters', COUNT(*) FROM semesters
UNION ALL
SELECT 'Subjects', COUNT(*) FROM subjects
UNION ALL
SELECT 'Faculty', COUNT(*) FROM faculty
UNION ALL
SELECT 'Rooms', COUNT(*) FROM rooms
UNION ALL
SELECT 'Batches', COUNT(*) FROM batches
UNION ALL
SELECT 'Students', COUNT(*) FROM students
UNION ALL
SELECT 'Timetable Entries', COUNT(*) FROM timetable_entries;
