-- SQL procedure to add a question with ID = order_num

DELIMITER //
CREATE PROCEDURE add_question_with_matching_id(
    IN p_quiz_id INT,
    IN p_subject_id INT,
    IN p_question_text TEXT,
    IN p_question_type VARCHAR(50),
    IN p_points INT,
    IN p_order_num INT
)
BEGIN
    -- Check if this order_num exists
    DECLARE id_exists INT;
    SELECT COUNT(*) INTO id_exists FROM questions WHERE id = p_order_num;
    
    IF id_exists = 0 THEN
        -- Insert with specific ID
        INSERT INTO questions (id, quiz_id, subject_id, question_text, 
                             question_type, points, order_num)
        VALUES (p_order_num, p_quiz_id, p_subject_id, p_question_text, 
                p_question_type, p_points, p_order_num);
    ELSE
        -- Let MySQL auto-generate ID, but still set order_num
        INSERT INTO questions (quiz_id, subject_id, question_text, 
                             question_type, points, order_num)
        VALUES (p_quiz_id, p_subject_id, p_question_text, 
                p_question_type, p_points, p_order_num);
        
        -- Log message (in reality, might want to handle this differently)
        SELECT CONCAT('Warning: Question ID ', p_order_num, ' already exists, generated new ID') AS message;
    END IF;
END //
DELIMITER ;

-- Example usage:
-- CALL add_question_with_matching_id(1, 4, 'What is SQL?', 'MULTIPLE_CHOICE', 1, 105);