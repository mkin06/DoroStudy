package org.devnqminh.studyfocus.controller;

import jakarta.servlet.http.HttpSession;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.devnqminh.studyfocus.dto.request.authentication.LoginRequest;
import org.devnqminh.studyfocus.dto.request.authentication.RegisterRequest;
import org.devnqminh.studyfocus.dto.response.authentication.LoginResponse;
import org.devnqminh.studyfocus.dto.response.user.UserProfileResponse;
import org.devnqminh.studyfocus.service.IAuthService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
    @Autowired
    private IAuthService authService;



    @PostMapping("/login")
    public ResponseEntity<?> login(@Valid @RequestBody LoginRequest loginRequest,
                                   HttpServletRequest request) {
        try {
            LoginResponse response = authService.login(loginRequest);
            establishSession(request, response);
            return ResponseEntity.ok(response);
        } catch (RuntimeException exception) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("message", "Tên đăng nhập/email hoặc mật khẩu không đúng."));
        }
    }

    @PostMapping("/logout")
    public ResponseEntity<?> logout(HttpServletRequest request) {
        HttpSession session = request.getSession(false);
        if (session != null) session.invalidate();
        return ResponseEntity.ok(Map.of("success", "Đã đăng xuất thành công"));
    }

    @GetMapping("/me")
    public ResponseEntity<?> me(HttpServletRequest request) {
        HttpSession session = request.getSession(false);
        Long userId = session == null ? null : (Long) session.getAttribute("USER_ID");
        String username = session == null ? null : (String) session.getAttribute("USERNAME");

        if(userId == null || username == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("message", "Bạn chưa đăng nhập."));
        }

        UserProfileResponse response = authService.getUserProfile(userId);

        return ResponseEntity.ok(response);
    }

    @PostMapping("/register")
    public ResponseEntity<?> register(@Valid @RequestBody RegisterRequest request) {
        authService.register(request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(Map.of("message", "Đăng ký thành công. Bạn có thể đăng nhập ngay."));
    }

    @PostMapping("/google")
    public ResponseEntity<?> googleLogin(@RequestBody org.devnqminh.studyfocus.dto.request.authentication.GoogleAuthRequest googleRequest,
                                         HttpServletRequest request) {
        try {
            LoginResponse response = authService.loginOrRegisterWithGoogle(googleRequest.getIdToken());
            establishSession(request, response);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("message", "Đăng nhập Google thất bại: " + e.getMessage()));
        }
    }

    private void establishSession(HttpServletRequest request, LoginResponse response) {
        // Only create a cookie after authentication succeeds. Anonymous /me polling
        // must not overwrite this cookie with a different, empty session.
        HttpSession session = request.getSession(false);
        if (session == null) session = request.getSession(true);
        else request.changeSessionId();
        session.setAttribute("USER_ID", response.getUserId());
        session.setAttribute("USERNAME", response.getUsername());
    }
}
