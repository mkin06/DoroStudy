package org.devnqminh.studyfocus.controller;

import jakarta.servlet.http.HttpSession;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.devnqminh.studyfocus.dto.request.SessionRequest;
import org.devnqminh.studyfocus.dto.response.SessionResponse;
import org.devnqminh.studyfocus.dto.response.StatsResponse;
import org.devnqminh.studyfocus.service.IStudyTimeService;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@RestController
@RequestMapping("/api/study-sessions")
@RequiredArgsConstructor
public class StudyTimeController {
    private final IStudyTimeService studyTimeService;

    /**
     * Lấy userId từ session, nếu chưa đăng nhập thì trả 401
     */
    private Long requireUserId(HttpSession session) {
        Long userId = (Long) session.getAttribute("USER_ID");
        if (userId == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Unauthenticated");
        }
        return userId;
    }


    /**
     * Lưu một study session mới
     * POST /api/study-sessions
     */
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public SessionResponse saveSession(@Valid @RequestBody SessionRequest request, HttpSession session) {
        //take json via RequestBody
        // TODO: Sau này lấy userId từ JWT
        Long userId = requireUserId(session);
        return studyTimeService.saveSession(request, userId);

    }
    /**
     * Lấy tất cả sessions của user
     * GET /api/study-sessions
     */
    @GetMapping
    public List<SessionResponse> getUserSessions(HttpSession session) {
        // TODO: Sau này lấy userId từ JWT
        Long userId = requireUserId(session);
        return studyTimeService.getUserSessions(userId);
    }
    /**
     * Lấy một session theo ID
     * GET /api/study-sessions/{id}
     */
    @GetMapping("/{id}")
    public SessionResponse getSession(@PathVariable("id") Long id, HttpSession session) {
        Long userId = requireUserId(session);
        return studyTimeService.getSessionById(id, userId);
    }
    /**
     * Xóa một session
     * DELETE /api/study-sessions/{id}
     */
    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteSession(@PathVariable Long id, HttpSession session) {
        Long userId = requireUserId(session);
        studyTimeService.deleteSession(id, userId);
    }
    /**
     * Lấy statistics của user
     * GET /api/study-sessions/stats
     */
    @GetMapping("/stats")
    public StatsResponse getSessionStats(HttpSession session) {
        Long userId = requireUserId(session);
        return studyTimeService.getUserStats(userId);
    }
}
