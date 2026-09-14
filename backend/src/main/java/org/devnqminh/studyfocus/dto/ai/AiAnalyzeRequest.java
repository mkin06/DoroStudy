package org.devnqminh.studyfocus.dto.ai;

import java.util.List;

/**
 * Payload gửi sang Python AI service (POST /analyze-session).
 * Jackson serialize camelCase — Pydantic bên Python đã cấu hình alias khớp.
 */
public record AiAnalyzeRequest(
        CurrentSession currentSession,
        List<HistoryItem> history,

        /**
         * Các quy luật FocusInsightEngine đã xác minh được từ dữ liệu (tối đa 3).
         *
         * Gửi kèm để Gemini DIỄN GIẢI quy luật có thật thay vì tự suy ra từ vài dòng lịch sử
         * rồi bịa số. Thống kê là việc của code (chính xác, miễn phí), diễn đạt và động viên
         * là việc của model — chia việc như vậy vừa rẻ hơn vừa đáng tin hơn.
         */
        List<String> knownPatterns,

        /**
         * Kế hoạch cho phiên kế tiếp mà {@code NextSessionPlanner} đã tính sẵn, ví dụ
         * "môn Toán, 25 phút, khung giờ tối (dự đoán 78 điểm)".
         *
         * Gửi kèm để lời khuyên sau phiên KHỚP với kế hoạch mà user sẽ thấy trước phiên sau.
         * Thiếu nó thì model tự nghĩ ra một con số khác, user nhận hai lời khuyên mâu thuẫn
         * trong cùng một app và không tin cái nào nữa.
         */
        String plannedNextSession,

        /**
         * Trích đoạn ghi chú user viết TRONG phiên (đã cắt ngắn), và một câu kết luận mà
         * {@code NoteAnalyzer} đã rút ra từ chúng.
         *
         * Gửi kèm để feedback nói được về thứ user thật sự làm, chứ không chỉ về mấy con số
         * họ tự chấm. Kết luận thì do code quyết định — model chỉ được diễn đạt lại, vì
         * "bạn khai một đằng làm một nẻo" là câu quá nặng để cho model tự phán.
         */
        String sessionNotes,
        String noteVerdict
) {

    public record CurrentSession(
            String subject,
            Double durationMinutes,
            Integer pomodoroCount,
            String startTime,           // ISO datetime hoặc null
            Integer completionPercent,
            Integer focusLevel,
            Integer energyLevel,        // 1-5, null nếu user bỏ qua câu này
            List<String> distractionReasons
    ) {
    }

    public record HistoryItem(
            String date,                // yyyy-MM-dd
            String subject,
            Double durationMinutes,
            Integer focusLevel,
            Integer completionPercent,
            List<String> distractionReasons
    ) {
    }
}
