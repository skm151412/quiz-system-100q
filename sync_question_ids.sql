-- SQL script to make question id match order_num
-- This script should be run once to synchronize IDs

-- First, create a backup table of questions
CREATE TABLE questions_backup AS SELECT * FROM questions;

-- Set auto increment to a high value to avoid conflicts
ALTER TABLE questions AUTO_INCREMENT = 1000;

-- Function to sync question IDs with order_num
DELIMITER //
CREATE PROCEDURE sync_question_ids()
BEGIN
    DECLARE done INT DEFAULT FALSE;
    DECLARE q_id, q_order_num, q_quiz_id, q_subject_id, q_points INT;
    DECLARE q_text TEXT;
    DECLARE q_type VARCHAR(50);
    DECLARE q_created TIMESTAMP;
    
    -- Cursor to fetch all questions
    DECLARE cur CURSOR FOR 
        SELECT id, order_num, quiz_id, subject_id, question_text, 
               question_type, points, created_at
        FROM questions_backup
        ORDER BY order_num;
    
    DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = TRUE;
    
    -- Clear existing questions
    DELETE FROM questions;
    
    -- Open cursor
    OPEN cur;
    
    read_loop: LOOP
        FETCH cur INTO q_id, q_order_num, q_quiz_id, q_subject_id, 
                      q_text, q_type, q_points, q_created;
        
        IF done THEN
            LEAVE read_loop;
        END IF;
        
        -- Insert with ID = order_num
        INSERT INTO questions (id, quiz_id, subject_id, question_text, 
                             question_type, points, order_num, created_at)
        VALUES (q_order_num, q_quiz_id, q_subject_id, q_text, 
                q_type, q_points, q_order_num, q_created);
                
    END LOOP;
    
    -- Close cursor
    CLOSE cur;
    
    -- Fix foreign key references in question_options
    UPDATE question_options qo
    JOIN questions_backup qb ON qo.question_id = qb.id
    JOIN questions q ON q.order_num = qb.order_num
    SET qo.question_id = q.id;
    
    -- Fix foreign key references in user_answers
    UPDATE user_answers ua
    JOIN questions_backup qb ON ua.question_id = qb.id
    JOIN questions q ON q.order_num = qb.order_num
    SET ua.question_id = q.id;
END //
DELIMITER ;

-- Execute the procedure
CALL sync_question_ids();

-- Drop the procedure and backup table
DROP PROCEDURE sync_question_ids;
-- Keep backup table for a while: DROP TABLE questions_backup;

-- Display the updated questions
SELECT id, order_num, question_text FROM questions ORDER BY order_num;