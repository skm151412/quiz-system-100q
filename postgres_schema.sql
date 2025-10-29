-- PostgreSQL Schema for Quiz System
-- Converted from MySQL

-- Create subjects table
CREATE TABLE IF NOT EXISTS subjects (
  id SERIAL PRIMARY KEY,
  color VARCHAR(20) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT NULL,
  description VARCHAR(255) DEFAULT NULL,
  name VARCHAR(50) NOT NULL
);

-- Create quizzes table
CREATE TABLE IF NOT EXISTS quizzes (
  id SERIAL PRIMARY KEY,
  active BOOLEAN DEFAULT NULL,
  created_at TIMESTAMP DEFAULT NULL,
  description VARCHAR(255) DEFAULT NULL,
  difficulty VARCHAR(255) DEFAULT NULL,
  password VARCHAR(255) DEFAULT NULL,
  time_limit INTEGER DEFAULT NULL,
  title VARCHAR(255) DEFAULT NULL,
  total_questions INTEGER DEFAULT NULL
);

-- Create questions table
CREATE TABLE IF NOT EXISTS questions (
  id SERIAL PRIMARY KEY,
  created_at TIMESTAMP DEFAULT NULL,
  order_num INTEGER DEFAULT NULL,
  points INTEGER DEFAULT NULL,
  question_text VARCHAR(255) NOT NULL,
  question_type VARCHAR(255) DEFAULT NULL,
  quiz_id INTEGER NOT NULL,
  subject_id INTEGER NOT NULL,
  CONSTRAINT fkn3gvco4b0kewxc0bywf1igfms FOREIGN KEY (quiz_id) REFERENCES quizzes(id),
  CONSTRAINT fko0h0rn8bxifrxmq1d8ipiyqv5 FOREIGN KEY (subject_id) REFERENCES subjects(id)
);

-- Create question_options table
CREATE TABLE IF NOT EXISTS question_options (
  id SERIAL PRIMARY KEY,
  is_correct BOOLEAN DEFAULT NULL,
  option_text VARCHAR(255) NOT NULL,
  order_num INTEGER DEFAULT NULL,
  question_id INTEGER NOT NULL,
  CONSTRAINT fksb9v00wdrgc9qojtjkv7e1gkp FOREIGN KEY (question_id) REFERENCES questions(id)
);

-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  created_at TIMESTAMP DEFAULT NULL,
  department VARCHAR(100) DEFAULT NULL,
  email VARCHAR(100) DEFAULT NULL,
  name VARCHAR(100) NOT NULL,
  password VARCHAR(255) DEFAULT NULL,
  role VARCHAR(50) DEFAULT NULL,
  roll_number VARCHAR(50) DEFAULT NULL,
  year VARCHAR(20) DEFAULT NULL
);

-- Create quiz_attempts table
CREATE TABLE IF NOT EXISTS quiz_attempts (
  id SERIAL PRIMARY KEY,
  completed BOOLEAN DEFAULT NULL,
  correct_answers INTEGER DEFAULT NULL,
  end_time TIMESTAMP DEFAULT NULL,
  quiz_id INTEGER DEFAULT NULL,
  score INTEGER DEFAULT NULL,
  start_time TIMESTAMP DEFAULT NULL,
  time_spent_seconds INTEGER DEFAULT NULL,
  total_questions INTEGER DEFAULT NULL,
  user_id INTEGER DEFAULT NULL
);

-- Create user_answers table
CREATE TABLE IF NOT EXISTS user_answers (
  id SERIAL PRIMARY KEY,
  is_correct BOOLEAN DEFAULT NULL,
  question_id INTEGER DEFAULT NULL,
  quiz_attempt_id INTEGER DEFAULT NULL,
  selected_option_id INTEGER DEFAULT NULL
);

-- Create quiz_subjects table
CREATE TABLE IF NOT EXISTS quiz_subjects (
  id SERIAL PRIMARY KEY,
  question_count INTEGER DEFAULT NULL,
  quiz_id INTEGER NOT NULL,
  subject_id INTEGER NOT NULL,
  CONSTRAINT fk8la3c36exutay7dwhc4ji5qa8 FOREIGN KEY (quiz_id) REFERENCES quizzes(id),
  CONSTRAINT fk4nxcuvpmajtxdvnfao4y8fqcw FOREIGN KEY (subject_id) REFERENCES subjects(id)
);

-- Insert data into subjects
INSERT INTO subjects (id, color, created_at, description, name) VALUES
(1, '#000000', '2025-09-25 10:07:38', 'Database Management Systems', 'DBMS'),
(2, '#FF6B6B', NULL, 'Front-End Development Frameworks', 'FEDF'),
(3, '#4ECDC4', NULL, 'Object-Oriented Programming', 'OOP'),
(4, '#45B7D1', NULL, 'Operating Systems', 'OS');

-- Insert data into quizzes
INSERT INTO quizzes (id, active, created_at, description, difficulty, password, time_limit, title, total_questions) VALUES
(1, true, '2025-09-25 10:07:46', 'A test quiz', 'EASY', NULL, 60, 'Test Quiz', 10);

-- Reset sequences
SELECT setval('subjects_id_seq', (SELECT MAX(id) FROM subjects));
SELECT setval('quizzes_id_seq', (SELECT MAX(id) FROM quizzes));
