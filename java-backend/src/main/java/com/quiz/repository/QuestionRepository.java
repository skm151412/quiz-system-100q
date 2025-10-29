package com.quiz.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.quiz.entity.Question;

public interface QuestionRepository extends JpaRepository<Question, Integer> {

    List<Question> findByQuizIdAndSubjectId(Integer quizId, Integer subjectId);

    List<Question> findByQuizId(Integer quizId);

    @Query("SELECT q FROM Question q WHERE q.quizId = :quizId ORDER BY q.subjectId, q.orderNum")
    List<Question> findByQuizIdOrdered(@Param("quizId") Integer quizId);

    // Find questions by orderNum
    List<Question> findByOrderNum(Integer orderNum);
}
