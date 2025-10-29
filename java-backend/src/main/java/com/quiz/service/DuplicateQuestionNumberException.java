package com.quiz.service;

public class DuplicateQuestionNumberException extends RuntimeException {

    public DuplicateQuestionNumberException(String message) {
        super(message);
    }
}
