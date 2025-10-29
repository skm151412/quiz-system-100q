-- SQL to update the IDs of questions 106 and 107 to 25 and 26
-- First, check if questions 25 and 26 already exist to avoid conflicts
SELECT id FROM questions WHERE id IN (25, 26);

-- Update options to reference new question IDs
-- We need to update the foreign keys first
UPDATE question_options SET question_id = 25 WHERE question_id = 106;
UPDATE question_options SET question_id = 26 WHERE question_id = 107;

-- Update user answers if any
UPDATE user_answers SET question_id = 25 WHERE question_id = 106;
UPDATE user_answers SET question_id = 26 WHERE question_id = 107;

-- Now update the questions themselves
UPDATE questions SET id = 25 WHERE id = 106;
UPDATE questions SET id = 26 WHERE id = 107;

-- Verify the changes
SELECT id, order_num, question_text FROM questions WHERE id IN (25, 26) OR id IN (106, 107);