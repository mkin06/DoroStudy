package org.devnqminh.studyfocus.controller;

import jakarta.servlet.http.HttpSession;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.devnqminh.studyfocus.dto.request.PushSubscriptionRequest;
import org.devnqminh.studyfocus.dto.response.Nudge;
import org.devnqminh.studyfocus.service.nudge.NudgeService;
import org.devnqminh.studyfocus.service.nudge.VapidSigner;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;

/**
 * API cho lời nhắc chủ động.
 *
 * {@code GET /current} phục vụ hai nơi cùng lúc: banner trong app, và service worker sau khi
 * bị đánh thức bởi một push rỗng. Nhờ dùng chung một nguồn, nội dung thông báo luôn được
 * tính lại tại đúng thời điểm nó hiện lên — user vừa học xong thì lời nhắc tự biến mất thay
 * vì bật ra một câu đã cũ.
 */
@RestController
@RequestMapping("/api/nudges")
@RequiredArgsConstructor
public class NudgeController {

    private final NudgeService nudgeService;
    private final VapidSigner vapidSigner;

    private Long requireUserId(HttpSession session) {
        Long userId = (Long) session.getAttribute("USER_ID");
        if (userId == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Unauthenticated");
        }
        return userId;
    }

    /**
     * Lời nhắc đáng nói nhất lúc này.
     * GET /api/nudges/current
     *
     * Trả 204 khi không có gì đáng nói — và đó là câu trả lời phổ biến nhất, đúng như thiết kế.
     */
    @GetMapping("/current")
    public ResponseEntity<Nudge> current(HttpSession session) {
        return nudgeService.currentNudge(requireUserId(session))
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.noContent().build());
    }

    /**
     * Khoá công khai VAPID + trạng thái đăng ký của user hiện tại.
     * GET /api/nudges/config
     *
     * Frontend cần khoá này để gọi {@code pushManager.subscribe()}; {@code enabled=false}
     * nghĩa là môi trường chưa cấu hình push và giao diện phải ẩn nút bật thông báo.
     */
    @GetMapping("/config")
    public Map<String, Object> config(HttpSession session) {
        Long userId = requireUserId(session);
        return Map.of(
                "enabled", vapidSigner.isConfigured(),
                "publicKey", vapidSigner.isConfigured() ? vapidSigner.publicKey() : "",
                "subscribed", nudgeService.hasSubscription(userId));
    }

    /**
     * Bật thông báo cho trình duyệt hiện tại.
     * POST /api/nudges/subscribe
     */
    @PostMapping("/subscribe")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void subscribe(@Valid @RequestBody PushSubscriptionRequest request, HttpSession session) {
        nudgeService.subscribe(requireUserId(session), request);
    }

    /**
     * Tắt thông báo cho trình duyệt hiện tại.
     * DELETE /api/nudges/subscribe
     */
    @DeleteMapping("/subscribe")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void unsubscribe(@RequestParam("endpoint") String endpoint, HttpSession session) {
        nudgeService.unsubscribe(requireUserId(session), endpoint);
    }
}
