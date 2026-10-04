package org.devnqminh.studyfocus.dto.request;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

import java.util.List;

/**
 * 3 câu hỏi reflection sau khi kết thúc một phiên Pomodoro.
 * Frontend gửi lên ngay sau khi đã lưu session (có sessionId).
 */
public record ReflectionRequest(

        @NotNull(message = "sessionId không được để trống")
        Long sessionId,

        @NotNull(message = "completionPercent không được để trống")
        @Min(value = 0, message = "completionPercent phải từ 0-100")
        @Max(value = 100, message = "completionPercent phải từ 0-100")
        Integer completionPercent,   // Câu 1: hoàn thành bao nhiêu % mục tiêu

        @NotNull(message = "focusLevel không được để trống")
        @Min(value = 1, message = "focusLevel phải từ 1-5")
        @Max(value = 5, message = "focusLevel phải từ 1-5")
        Integer focusLevel,          // Câu 2: mức tập trung (1-5, emoji scale)

        @Min(value = 1, message = "energyLevel phải từ 1-5")
        @Max(value = 5, message = "energyLevel phải từ 1-5")
        Integer energyLevel,         // Câu 3: năng lượng còn lại sau phiên (1-5, optional)

        List<String> distractionReasons,  // Câu 4: ["social_media","noise","fatigue","mind_wandering","none"]

        String subject               // optional: tag môn học (cho phép tag ngược sau phiên)
) {
}
