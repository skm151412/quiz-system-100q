package com.quiz.service;

import com.quiz.dto.*;
import com.quiz.entity.*;
import com.quiz.repository.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import java.util.List;
import java.util.stream.Collectors;
import java.util.Optional;
import java.util.Date;
import java.util.ArrayList;
import java.util.Map;

@Service
public class QuizService {

    @Autowired
    private QuizRepository quizRepository;

    @Autowired
    private SubjectRepository subjectRepository;

    @Autowired
    private QuestionRepository questionRepository;

    @Autowired
    private QuestionOptionRepository optionRepository;

    @Autowired
    private QuizAttemptRepository attemptRepository;

    @Autowired
    private UserAnswerRepository userAnswerRepository;

    @Autowired
    private UserRepository userRepository;

    /**
     * Teacher dashboard: fetch all attempts with basic user+quiz metadata.
     * Lightweight projection to avoid creating many new DTO classes.
     */
    public List<Map<String, Object>> getAllAttemptSummaries() {
        return attemptRepository.findAll().stream().map(a -> {
            Map<String, Object> m = new java.util.HashMap<>();
            m.put("attemptId", a.getId());
            m.put("quizId", a.getQuizId());
            m.put("userId", a.getUserId());
            m.put("score", a.getScore());
            m.put("totalQuestions", a.getTotalQuestions());
            m.put("correctAnswers", a.getCorrectAnswers());
            m.put("completed", a.getCompleted());
            m.put("startTime", a.getStartTime());
            m.put("endTime", a.getEndTime());
            Optional<User> u = userRepository.findById(a.getUserId());
            u.ifPresent(user -> {
                m.put("username", user.getUsername());
                m.put("email", user.getEmail());
            });
            Optional<Quiz> q = quizRepository.findById(a.getQuizId());
            q.ifPresent(qz -> m.put("quizTitle", qz.getTitle()));
            return m;
        }).collect(Collectors.toList());
    }

    /**
     * Add a new question with options (teacher action). This method now checks
     * for duplicate question numbers and throws an exception if one is found
     */
    public QuestionDto addQuestion(Integer quizId, Integer subjectId, String text, List<String> options, int correctIndex, Integer points, Integer orderNum) throws DuplicateQuestionNumberException {
        // First, check if a question with this orderNum already exists
        // If it does, throw an exception to notify the teacher
        List<Question> existingQuestions = questionRepository.findByOrderNum(orderNum);
        Question q;

        if (!existingQuestions.isEmpty()) {
            // Question with this orderNum exists, throw an exception
            throw new DuplicateQuestionNumberException("Question number " + orderNum + " already exists. Please use a different number.");
        } else {
            // Create new question with ID = orderNum
            // Check if a question with this ID already exists
            boolean idExists = questionRepository.existsById(orderNum);

            if (idExists) {
                // If ID already exists, throw an exception - this is a critical error
                throw new DuplicateQuestionNumberException("Question with ID " + orderNum + " already exists. Please use a different number.");
            } else {
                // If ID doesn't exist, create the question with ID = orderNum
                q = new Question();
                // ALWAYS set ID equal to orderNum to ensure consistency
                q.setId(orderNum);
            }

            q.setQuizId(quizId);
            q.setSubjectId(subjectId);
            q.setQuestionText(text);
            q.setQuestionType(Question.QuestionType.MULTIPLE_CHOICE);
            q.setPoints(points);
            q.setOrderNum(orderNum);
        }

        q = questionRepository.save(q);

        // Now add options
        for (int i = 0; i < options.size(); i++) {
            String optText = options.get(i);
            if (optText == null || optText.isBlank()) {
                continue;
            }
            QuestionOption opt = new QuestionOption();
            opt.setQuestionId(q.getId());
            opt.setOptionText(optText.trim());
            opt.setIsCorrect(i == correctIndex);
            opt.setOrderNum(i + 1);
            optionRepository.save(opt);
        }

        return convertToQuestionDto(q);
    }

    /**
     * Delete a question and its options (cascade handles options).
     */
    public boolean deleteQuestion(Integer questionId) {
        Optional<Question> qOpt = questionRepository.findById(questionId);
        if (qOpt.isEmpty()) {
            return false;
        }

        // Delete options explicitly (in case cascade not configured properly in schema)
        List<QuestionOption> opts = optionRepository.findByQuestionId(questionId);
        if (!opts.isEmpty()) {
            optionRepository.deleteAll(opts);
        }

        // Delete user answers referencing this question (need manual query logic)
        // We don't have a repository method directly, so fetch all attempts' answers and filter (OK for small scale)
        // For efficiency in larger scale, add a derived query in UserAnswerRepository.
        List<UserAnswer> allAnswers = userAnswerRepository.findAll();
        List<UserAnswer> toDelete = allAnswers.stream()
                .filter(a -> questionId.equals(a.getQuestionId()))
                .collect(Collectors.toList());
        if (!toDelete.isEmpty()) {
            userAnswerRepository.deleteAll(toDelete);
        }

        questionRepository.deleteById(questionId);
        return true;
    }

    /**
     * Delete a question by order_num (Question Number) rather than ID This
     * makes it easier for teachers who don't know internal IDs
     */
    public boolean deleteQuestionByOrderNum(Integer orderNum) {
        List<Question> questions = questionRepository.findByOrderNum(orderNum);
        if (questions.isEmpty()) {
            return false;
        }

        // Delete each question found with this order_num
        boolean anyDeleted = false;
        for (Question q : questions) {
            try {
                deleteQuestion(q.getId());
                anyDeleted = true;
            } catch (Exception e) {
                // Log but continue with others
                System.err.println("Failed to delete question ID " + q.getId() + ": " + e.getMessage());
            }
        }

        return anyDeleted;
    }

    /**
     * Get all available quizzes
     */
    public List<QuizDto> getAllQuizzes() {
        return quizRepository.findAll().stream()
                .map(this::convertToDto)
                .collect(Collectors.toList());
    }

    /**
     * Get a quiz by id
     */
    public QuizDto getQuizById(Integer id) {
        Optional<Quiz> quiz = quizRepository.findById(id);
        return quiz.map(this::convertToDto).orElse(null);
    }

    /**
     * Get all questions for a quiz
     */
    public List<QuestionDto> getQuestionsByQuizId(Integer quizId) {
        return questionRepository.findByQuizId(quizId).stream()
                .map(this::convertToQuestionDto)
                .collect(Collectors.toList());
    }

    /**
     * Get options for a question
     */
    public List<QuestionOptionDto> getOptionsForQuestion(Integer questionId) {
        return optionRepository.findByQuestionId(questionId).stream()
                .map(this::convertToOptionDto)
                .collect(Collectors.toList());
    }

    /**
     * Start a new quiz attempt import java.util.Map;
     */
    public QuizAttemptDto startQuizAttempt(Integer quizId, Integer userId) {
        QuizAttempt attempt = new QuizAttempt();
        attempt.setQuizId(quizId);
        attempt.setUserId(userId);
        attempt.setStartTime(new Date());
        attempt.setCompleted(false);

        attempt = attemptRepository.save(attempt);
        return convertToAttemptDto(attempt);
    }

    /**
     * Save user answer
     */
    public UserAnswerDto saveUserAnswer(Integer attemptId, Integer questionId, Integer selectedOptionId) {
        UserAnswer userAnswer = new UserAnswer();
        userAnswer.setQuizAttemptId(attemptId);
        userAnswer.setQuestionId(questionId);
        userAnswer.setSelectedOptionId(selectedOptionId);

        // Check if the answer is correct
        QuestionOption selectedOption = optionRepository.findById(selectedOptionId).orElse(null);
        if (selectedOption != null) {
            userAnswer.setIsCorrect(selectedOption.getIsCorrect());
        } else {
            userAnswer.setIsCorrect(false);
        }

        userAnswer = userAnswerRepository.save(userAnswer);
        return convertToUserAnswerDto(userAnswer);
    }

    /**
     * Complete quiz attempt
     */
    public QuizAttemptDto completeQuizAttempt(Integer attemptId) {
        Optional<QuizAttempt> attemptOpt = attemptRepository.findById(attemptId);
        if (attemptOpt.isPresent()) {
            QuizAttempt attempt = attemptOpt.get();
            attempt.setEndTime(new Date());
            attempt.setCompleted(true);

            // Calculate score
            List<UserAnswer> userAnswers = userAnswerRepository.findByQuizAttemptId(attemptId);
            int correctAnswers = (int) userAnswers.stream()
                    .filter(UserAnswer::getIsCorrect)
                    .count();

            attempt.setScore(correctAnswers);
            attempt.setCorrectAnswers(correctAnswers);
            attempt.setTotalQuestions(userAnswers.size());

            // Calculate time spent
            long timeSpentMillis = attempt.getEndTime().getTime() - attempt.getStartTime().getTime();
            int timeSpentSeconds = (int) (timeSpentMillis / 1000);
            attempt.setTimeSpentSeconds(timeSpentSeconds);

            attempt = attemptRepository.save(attempt);
            return convertToAttemptDto(attempt);
        }
        return null;
    }

    /**
     * Get all subjects
     */
    public List<SubjectDto> getAllSubjects() {
        return subjectRepository.findAll().stream()
                .map(this::convertToSubjectDto)
                .collect(Collectors.toList());
    }

    /**
     * Convert Quiz entity to DTO
     */
    private QuizDto convertToDto(Quiz quiz) {
        QuizDto dto = new QuizDto();
        dto.setId(quiz.getId());
        dto.setTitle(quiz.getTitle());
        dto.setDescription(quiz.getDescription());
        dto.setTimeLimit(quiz.getTimeLimit());
        dto.setTotalQuestions(quiz.getTotalQuestions());
        dto.setDifficulty(quiz.getDifficulty());
        dto.setActive(quiz.getActive());
        dto.setCreatedAt(quiz.getCreatedAt());
        return dto;
    }

    /**
     * Convert Subject entity to DTO
     */
    private SubjectDto convertToSubjectDto(Subject subject) {
        SubjectDto dto = new SubjectDto();
        dto.setId(subject.getId());
        dto.setName(subject.getName());
        dto.setDescription(subject.getDescription());
        dto.setColor(subject.getColor());
        return dto;
    }

    /**
     * Convert Question entity to DTO
     */
    private QuestionDto convertToQuestionDto(Question question) {
        QuestionDto dto = new QuestionDto();
        dto.setId(question.getId());
        dto.setQuizId(question.getQuizId());
        dto.setSubjectId(question.getSubjectId());
        dto.setQuestionText(question.getQuestionText());
        dto.setQuestionType(question.getQuestionType());
        dto.setPoints(question.getPoints());
        dto.setOrderNum(question.getOrderNum());

        // Get subject details
        Optional<Subject> subject = subjectRepository.findById(question.getSubjectId());
        if (subject.isPresent()) {
            dto.setSubjectName(subject.get().getName());
            dto.setSubjectColor(subject.get().getColor());
        }

        return dto;
    }

    /**
     * Convert QuestionOption entity to DTO
     */
    private QuestionOptionDto convertToOptionDto(QuestionOption option) {
        QuestionOptionDto dto = new QuestionOptionDto();
        dto.setId(option.getId());
        dto.setQuestionId(option.getQuestionId());
        dto.setOptionText(option.getOptionText());
        dto.setIsCorrect(option.getIsCorrect());
        return dto;
    }

    /**
     * Convert QuizAttempt entity to DTO
     */
    private QuizAttemptDto convertToAttemptDto(QuizAttempt attempt) {
        QuizAttemptDto dto = new QuizAttemptDto();
        dto.setId(attempt.getId());
        dto.setUserId(attempt.getUserId());
        dto.setQuizId(attempt.getQuizId());
        dto.setStartTime(attempt.getStartTime());
        dto.setEndTime(attempt.getEndTime());
        dto.setScore(attempt.getScore());
        dto.setTotalQuestions(attempt.getTotalQuestions());
        dto.setCorrectAnswers(attempt.getCorrectAnswers());
        dto.setCompleted(attempt.getCompleted());
        dto.setTimeSpentSeconds(attempt.getTimeSpentSeconds());
        return dto;
    }

    /**
     * Convert UserAnswer entity to DTO
     */
    private UserAnswerDto convertToUserAnswerDto(UserAnswer userAnswer) {
        UserAnswerDto dto = new UserAnswerDto();
        dto.setId(userAnswer.getId());
        dto.setQuizAttemptId(userAnswer.getQuizAttemptId());
        dto.setQuestionId(userAnswer.getQuestionId());
        dto.setSelectedOptionId(userAnswer.getSelectedOptionId());
        dto.setIsCorrect(userAnswer.getIsCorrect());
        return dto;
    }
}
