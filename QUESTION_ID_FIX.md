# Synchronizing Question IDs with Order Numbers

This document explains how to fix the issue where question IDs in the database don't match the question numbers shown to students.

## The Problem

The current implementation stores questions with:
- `id`: An auto-incremented database ID (e.g., 104)
- `order_num`: The question number shown to students (e.g., 101)

This causes confusion when teachers try to delete questions, as they enter the question number (order_num) but the system looks for a question with that ID.

## The Solution

We've modified the system to:

1. Try to set a question's ID equal to its order_num when creating new questions
2. Provide an SQL script to synchronize existing questions
3. Update the teacher UI to make this behavior clearer

## How to Apply the Changes

### 1. Database Synchronization

Run the `sync_question_ids.sql` script to synchronize existing question IDs with their order_num:

```bash
mysql -u username -p quiz_system < sync_question_ids.sql
```

This script:
- Creates a backup of the questions table
- Deletes all questions
- Reinserts them with ID = order_num
- Updates foreign key references in related tables

### 2. Stored Procedure (Optional)

If you need direct SQL access to add questions, run the `add_question_procedure.sql` script:

```bash
mysql -u username -p quiz_system < add_question_procedure.sql
```

This creates a `add_question_with_matching_id` procedure that ensures new questions have ID = order_num.

### 3. Application Changes

The Java backend now attempts to set a question's ID equal to its order_num when adding questions. This makes deletion and management more intuitive for teachers.

### 4. Restart Application

After applying the SQL changes, restart the application:

```bash
./start-quiz-system.bat
```

## Verify Changes

After applying these changes, check the database to ensure question IDs match their order_num values:

```sql
SELECT id, order_num, question_text FROM questions ORDER BY order_num;
```

Teachers should now be able to delete questions using the question number they see in the UI.

## Important Notes

- If a question with a specific ID already exists, the system will fall back to auto-incrementing IDs
- The UI now explains that Question Number will be used as the database ID
- This solution maintains backward compatibility with existing code