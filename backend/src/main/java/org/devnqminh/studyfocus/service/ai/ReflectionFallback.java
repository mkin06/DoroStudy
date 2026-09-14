package org.devnqminh.studyfocus.service.ai;

import lombok.RequiredArgsConstructor;
import org.devnqminh.studyfocus.dto.ai.AiAnalyzeResponse;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * Feedback mặc định khi không gọi được ai-service.
 *
 * Yêu cầu nghiệp vụ: user không bao giờ được thấy màn hình trắng hay lỗi kỹ thuật sau khi
 * đã bỏ công điền reflection. focus_score vẫn tính được tại chỗ từ chính 3 câu trả lời
 * (không cần AI), nên phiên vẫn có điểm để thống kê và để Meta-Learning dùng về sau.
 */
@Component
@RequiredArgsConstructor
public class ReflectionFallback {

    public static final String SOURCE = "unavailable";

    private final FocusScoreCalculator focusScoreCalculator;

    public AiAnalyzeResponse build(int completionPercent, int focusLevel,
                                   Integer energyLevel, List<String> distractionReasons) {
        double score = focusScoreCalculator.calculate(completionPercent, focusLevel, energyLevel);

        String summary = String.format(
                "Đã ghi nhận phiên học: bạn hoàn thành %d%% mục tiêu với mức tập trung %d/5.",
                completionPercent, focusLevel);

        String recommendation = recommend(focusLevel, distractionReasons);

        return new AiAnalyzeResponse(summary, null, recommendation, score, SOURCE);
    }

    private String recommend(int focusLevel, List<String> distractionReasons) {
        String base = "Hệ thống AI đang bận, phân tích chi tiết sẽ có ở phiên sau. ";
        if (distractionReasons != null && !distractionReasons.isEmpty()) {
            return base + "Phiên tới thử loại bỏ trước tác nhân bạn vừa chọn ("
                    + String.join(", ", distractionReasons) + ").";
        }
        if (focusLevel <= 2) {
            return base + "Phiên tới thử rút ngắn thời lượng và đặt một mục tiêu nhỏ, rõ ràng hơn.";
        }
        return base + "Giữ nguyên thiết lập này cho phiên tiếp theo.";
    }
}
