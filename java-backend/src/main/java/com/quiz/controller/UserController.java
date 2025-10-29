package com.quiz.controller;

import com.quiz.entity.User;
import com.quiz.service.UserService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/users")
@CrossOrigin(origins = "*")
public class UserController {

    @Autowired
    private UserService userService;

    @PostMapping("/identify")
    public ResponseEntity<User> identify(@RequestBody Map<String, Object> payload) {
        Integer providedId = payload.get("id") instanceof Number ? ((Number) payload.get("id")).intValue() : null;
        String username = (String) payload.getOrDefault("username", null);
        String email = (String) payload.getOrDefault("email", null);
        String fullName = (String) payload.getOrDefault("fullName", payload.getOrDefault("full_name", null));
        String role = (String) payload.getOrDefault("role", "student");

        User saved = userService.createOrUpdateAnonUser(providedId, username, email, fullName, role);
        return new ResponseEntity<>(saved, HttpStatus.CREATED);
    }
}
