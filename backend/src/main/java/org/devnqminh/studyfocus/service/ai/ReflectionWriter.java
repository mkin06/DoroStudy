package org.devnqminh.studyfocus.service.ai;

import lombok.RequiredArgsConstructor;
import org.devnqminh.studyfocus.dto.ai.AiAnalyzeResponse;
import org.devnqminh.studyfocus.dto.request.ReflectionRequest;
import org.devnqminh.studyfocus.dto.response.ReflectionResponse;
import org.devnqminh.studyfocus.model.AiReflection;
import org.devnqminh.studyfocus.model.StudyTime;
import org.devnqminh.studyfocus.model.User;
import org.devnqminh.studyfocus.repository.AiReflectionRepository;
import org.devnqminh.studyfocus.repository.StudyTimeRepository;
import org.devnqminh.studyfocus.repository.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.ArrayList;
import java.util.List;

/**
 * Ghi reflection + cập nhật phiên trong một transaction.
 *
 * Tách khỏi {@code AiReflectionServiceImpl} có lý do: lệnh gọi ai-service phải nằm ngoài
 * transaction (network I/O không được giữ connection MySQL), nhưng phần ghi DB vẫn cần
 * atomic. Self-invocation trong cùng một bean sẽ không đi qua proxy nên @Transactional
 * ở đó vô hiệu — vì vậy phần ghi nằm ở bean riêng.
 */
@Service
@RequiredArgsConstructor
public class ReflectionWriter {

    private final AiReflectionRepository aiReflectionRepository;
    private final StudyTimeRepository studyTimeRepository;
    private final UserRepository userRepository;
    private final FocusScoreCalculator focusScoreCalculator;

    @Transactional
    public ReflectionResponse persist(StudyTime session,
                                      Long userId,
                                      ReflectionRequest request,
                                      AiAnalyzeResponse feedback,
                                      Integer aiCallsRemaining) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        StudyTime managed = studyTimeRepository.findById(session.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Session not found"));

        // Cho phép tag ngược môn học ngay trong popup reflection
        if (request.subject() != null && !request.subject().isBlank() && managed.getSubject() == null) {
            managed.setSubject(request.subject().trim());
        }

        // Điểm luôn tính bằng công thức cố định, KHÔNG dùng con số AI trả về: mọi so sánh
        // giữa các phiên (kỷ lục, giờ vàng, độ dài tối ưu) chỉ có nghĩa khi thang đo bất biến.
        double score = focusScoreCalculator.calculate(
                request.completionPercent(), request.focusLevel(), request.energyLevel());

        // Điểm tập trung thuộc về phiên học, để thống kê không phải join sang reflection
        managed.setFocusScore(score);
        studyTimeRepository.save(managed);

        AiReflection reflection = AiReflection.builder()
                .session(managed)
                .user(user)
                .completionPercent(request.completionPercent())
                .focusLevel(request.focusLevel())
                .energyLevel(request.energyLevel())
                .distractionReasons(request.distractionReasons() == null
                        ? new ArrayList<>() : new ArrayList<>(request.distractionReasons()))
                .aiSummary(feedback.summary())
                .aiComparison(feedback.comparison())
                .aiRecommendation(feedback.recommendation())
                .focusScore(score)
                .aiSource(feedback.source())
                .build();

        AiReflection saved = aiReflectionRepository.save(reflection);

        return new ReflectionResponse(
                saved.getId(),
                managed.getId(),
                saved.getCompletionPercent(),
                saved.getFocusLevel(),
                saved.getEnergyLevel(),
                saved.getDistractionReasons() == null ? List.of() : saved.getDistractionReasons(),
                saved.getAiSummary(),
                saved.getAiComparison(),
                saved.getAiRecommendation(),
                saved.getFocusScore(),
                "gemini".equals(saved.getAiSource()),
                saved.getAiSource(),
                aiCallsRemaining,
                null,                    // reward do service gắn sau khi đã có hồ sơ đầy đủ
                null,                    // noteInsight cũng vậy — cần đọc bảng notes, không thuộc transaction này
                null,                    // nextPlan phải tính SAU khi phiên này đã vào hồ sơ
                saved.getCreatedAt());
    }
}
