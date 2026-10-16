package org.devnqminh.studyfocus.controller;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import lombok.RequiredArgsConstructor;
import org.devnqminh.studyfocus.dto.request.feedback.FeedbackCreateRequest;
import org.devnqminh.studyfocus.dto.response.feedback.FeedbackResponse;
import org.devnqminh.studyfocus.service.IFeedbackService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/feedback")
@RequiredArgsConstructor
public class FeedbackController {

    private final IFeedbackService feedbackService;

    @PostMapping
    public ResponseEntity<?> submitFeedback(@RequestBody FeedbackCreateRequest request,
                                            HttpServletRequest servletRequest) {
        HttpSession session = servletRequest.getSession(false);
        Long userId = session != null ? (Long) session.getAttribute("USER_ID") : null;

        FeedbackResponse response = feedbackService.createFeedback(request, userId);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping("/admin")
    public ResponseEntity<?> getAllFeedback(HttpServletRequest servletRequest) {
        if (!isAdmin(servletRequest)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("message", "Chỉ tài khoản quản trị viên (Admin) mới có quyền xem danh sách này."));
        }
        List<FeedbackResponse> feedbacks = feedbackService.getAllFeedback();
        Map<String, Object> stats = feedbackService.getFeedbackStats();
        return ResponseEntity.ok(Map.of(
                "feedbacks", feedbacks,
                "stats", stats
        ));
    }

    @PatchMapping("/admin/{id}/status")
    public ResponseEntity<?> updateStatus(@PathVariable Long id,
                                          @RequestBody Map<String, String> body,
                                          HttpServletRequest servletRequest) {
        if (!isAdmin(servletRequest)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("message", "Chỉ tài khoản quản trị viên (Admin) mới có quyền thực hiện."));
        }
        String status = body.get("status");
        FeedbackResponse updated = feedbackService.updateStatus(id, status);
        return ResponseEntity.ok(updated);
    }

    @DeleteMapping("/admin/{id}")
    public ResponseEntity<?> deleteFeedback(@PathVariable Long id,
                                            HttpServletRequest servletRequest) {
        if (!isAdmin(servletRequest)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("message", "Chỉ tài khoản quản trị viên (Admin) mới có quyền thực hiện."));
        }
        feedbackService.deleteFeedback(id);
        return ResponseEntity.ok(Map.of("success", true, "message", "Đã xóa góp ý thành công."));
    }

    private boolean isAdmin(HttpServletRequest servletRequest) {
        HttpSession session = servletRequest.getSession(false);
        if (session == null) return false;
        String role = (String) session.getAttribute("ROLE");
        return "ADMIN".equalsIgnoreCase(role);
    }
}
