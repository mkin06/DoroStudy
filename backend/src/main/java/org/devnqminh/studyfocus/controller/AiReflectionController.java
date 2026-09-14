package org.devnqminh.studyfocus.controller;

import jakarta.servlet.http.HttpSession;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.devnqminh.studyfocus.dto.request.ReflectionRequest;
import org.devnqminh.studyfocus.dto.response.FocusProfileResponse;
import org.devnqminh.studyfocus.dto.response.NextSessionPlan;
import org.devnqminh.studyfocus.dto.response.ReflectionResponse;
import org.devnqminh.studyfocus.service.IAiReflectionService;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@RestController
@RequestMapping("/api/reflections")
@RequiredArgsConstructor
public class AiReflectionController {

    private final IAiReflectionService aiReflectionService;

    private Long requireUserId(HttpSession session) {
        Long userId = (Long) session.getAttribute("USER_ID");
        if (userId == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Unauthenticated");
        }
        return userId;
    }

    /**
     * Gửi reflection sau phiên học, nhận về AI feedback.
     * POST /api/reflections
     *
     * Trả 429 kèm reflection đã lưu khi user hết quota AI trong ngày.
     */
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ReflectionResponse createReflection(@Valid @RequestBody ReflectionRequest request,
                                               HttpSession session) {
        Long userId = requireUserId(session);
        return aiReflectionService.createReflection(request, userId);
    }

    /**
     * Lịch sử reflection của user (mới nhất trước)
     * GET /api/reflections
     */
    @GetMapping
    public List<ReflectionResponse> getUserReflections(HttpSession session) {
        Long userId = requireUserId(session);
        return aiReflectionService.getUserReflections(userId);
    }

    /**
     * Hồ sơ tập trung cá nhân: phát hiện đã mở khoá, giờ vàng theo môn, độ dài tối ưu,
     * ngưỡng cạn năng lượng, tình trạng duy trì thói quen.
     * GET /api/reflections/insights
     */
    @GetMapping("/insights")
    public FocusProfileResponse getFocusProfile(HttpSession session) {
        Long userId = requireUserId(session);
        return aiReflectionService.getFocusProfile(userId);
    }

    /**
     * Kế hoạch cho phiên học tiếp theo — phần AI chạy TRƯỚC khi user bấm Start.
     * GET /api/reflections/next-session?subject=Toán
     *
     * Không tốn quota AI (tính cục bộ), nên frontend gọi thoải mái mỗi lần mở app và mỗi
     * khi user đổi môn ở ô Task.
     */
    @GetMapping("/next-session")
    public NextSessionPlan getNextSessionPlan(@RequestParam(value = "subject", required = false) String subject,
                                              HttpSession session) {
        Long userId = requireUserId(session);
        return aiReflectionService.getNextSessionPlan(userId, subject);
    }

    /**
     * Lấy reflection theo session
     * GET /api/reflections/session/{sessionId}
     */
    @GetMapping("/session/{sessionId}")
    public ReflectionResponse getBySession(@PathVariable("sessionId") Long sessionId,
                                           HttpSession session) {
        Long userId = requireUserId(session);
        return aiReflectionService.getBySessionId(sessionId, userId);
    }
}
