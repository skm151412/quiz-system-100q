package com.quiz.service;

import java.time.LocalDateTime;
import java.util.Optional;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.quiz.entity.User;
import com.quiz.repository.UserRepository;

@Service
public class UserService {

    @Autowired
    private UserRepository userRepository;

    public User createOrUpdateAnonUser(Integer id, String username, String email, String fullName, String role) {
        User user = null;

        // 1. Preferred: explicit id (only if in safe integer range & exists).
        if (id != null) {
            Optional<User> existing = userRepository.findById(id);
            user = existing.orElse(null);
            // We intentionally DO NOT force-set a large provided id to avoid INT overflow issues.
        }

        // 2. Try to find by email if no user yet.
        if (user == null && email != null && !email.isBlank()) {
            try {
                user = userRepository.findByEmail(email);
            } catch (Exception ignored) {
            }
        }

        // 3. Try to find by username if still not found.
        if (user == null && username != null && !username.isBlank()) {
            try {
                user = userRepository.findByUsername(username);
            } catch (Exception ignored) {
            }
        }

        // 4. Create new if still null.
        if (user == null) {
            user = new User();
        }

        if (username == null || username.isBlank()) {
            // Generate a lightweight username if not provided
            username = "user" + System.currentTimeMillis();
        }
        if (email == null || email.isBlank()) {
            email = username + "@example.local"; // dummy email to satisfy NOT NULL
        }
        if (user.getCreatedAt() == null) {
            user.setCreatedAt(LocalDateTime.now());
        }
        user.setUpdatedAt(LocalDateTime.now());
        user.setUsername(username);
        user.setEmail(email);
        user.setFullName(fullName);
        try {
            if (role != null) {
                user.setRole(User.Role.valueOf(role));
            }
        } catch (IllegalArgumentException ignored) {
        }
        // Store a placeholder password hash since quiz start doesn't authenticate
        if (user.getPasswordHash() == null) {
            user.setPasswordHash("NOPASS");
        }
        return userRepository.save(user);
    }
}
