package com.quiz.controller;

import com.quiz.dto.QuestionDto;
import com.quiz.service.QuizService;
import com.quiz.repository.UserRepository;
import com.quiz.entity.User;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.HashMap;
import java.util.ArrayList;

/**
 * Lightweight teacher endpoints (no full auth) – guarded by verifying userId
 * belongs to a teacher.
 */
@RestController
@RequestMapping("/api/teacher")
@CrossOrigin(origins = "*")
public class TeacherController {

    @Autowired
    private QuizService quizService;

    @Autowired
    private UserRepository userRepository;

    private boolean isTeacher(Integer userId) {
        if (userId == null) {
            return false;
        }
        return userRepository.findById(userId)
                .map(u -> u.getRole() == User.Role.teacher)
                .orElse(false);
    }

    private ResponseEntity<?> forbidden() {
        return new ResponseEntity<>(HttpStatus.FORBIDDEN);
    }

    /**
     * List attempt summaries
     */
    @GetMapping("/attempts")
    public ResponseEntity<?> getAttempts(@RequestParam Integer userId) {
        if (!isTeacher(userId)) {
            return forbidden();
        }
        return new ResponseEntity<>(quizService.getAllAttemptSummaries(), HttpStatus.OK);
    }

    /**
     * Add a question (MCQ)
     */
    @PostMapping("/questions")
    public ResponseEntity<?> addQuestion(@RequestParam Integer userId, @RequestBody Map<String, Object> body) {
        if (!isTeacher(userId)) {
            return forbidden();
        }
        try {
            Integer quizId = ((Number) body.getOrDefault("quizId", 1)).intValue();
            Integer subjectId = ((Number) body.getOrDefault("subjectId", 1)).intValue();
            String questionText = (String) body.get("questionText");
            Integer points = body.get("points") instanceof Number ? ((Number) body.get("points")).intValue() : 1;
            Integer orderNum = body.get("orderNum") instanceof Number ? ((Number) body.get("orderNum")).intValue() : 0;
            Object rawOptions = body.get("options");
            List<String> options = new ArrayList<>();
            if (rawOptions instanceof List<?>) {
                for (Object o : (List<?>) rawOptions) {
                    if (o != null) {
                        options.add(o.toString());
                    }
                }
            }
            Integer correctIndex = body.get("correctIndex") instanceof Number ? ((Number) body.get("correctIndex")).intValue() : 0;
            if (questionText == null || questionText.isBlank() || options.isEmpty() || correctIndex < 0 || correctIndex >= options.size()) {
                return new ResponseEntity<>(HttpStatus.BAD_REQUEST);
            }
            QuestionDto dto = quizService.addQuestion(quizId, subjectId, questionText, options, correctIndex, points, orderNum);
            return new ResponseEntity<>(dto, HttpStatus.CREATED);
        } catch (com.quiz.service.DuplicateQuestionNumberException e) {
            // Return a specific error message for duplicate question numbers
            Map<String, String> errorResponse = new HashMap<>();
            errorResponse.put("error", "duplicate_question_number");
            errorResponse.put("message", e.getMessage());

            // Add the orderNum value from the request for better error handling
            Integer orderNum = body.get("orderNum") instanceof Number ? ((Number) body.get("orderNum")).intValue() : 0;
            errorResponse.put("questionNumber", String.valueOf(orderNum));

            return new ResponseEntity<>(errorResponse, HttpStatus.CONFLICT); // HTTP 409 Conflict
        } catch (Exception e) {
            // For other errors, return a general bad request
            return new ResponseEntity<>(HttpStatus.BAD_REQUEST);
        }
    }

    /**
     * Delete question
     */
    @DeleteMapping("/questions/{id}")
    public ResponseEntity<?> deleteQuestion(
            @RequestParam Integer userId,
            @PathVariable Integer id,
            @RequestParam(required = false) Boolean byOrderNum) {
        if (!isTeacher(userId)) {
            return forbidden();
        }

        boolean deleted;
        if (Boolean.TRUE.equals(byOrderNum)) {
            // Delete by order_num instead of id
            deleted = quizService.deleteQuestionByOrderNum(id);
        } else {
            // Default behavior - delete by ID
            deleted = quizService.deleteQuestion(id);
        }

        return deleted ? new ResponseEntity<>(HttpStatus.NO_CONTENT) : new ResponseEntity<>(HttpStatus.NOT_FOUND);
    }
}
