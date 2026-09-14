package org.devnqminh.studyfocus.dto.response;

import java.time.Instant;
import java.util.List;

public record ReflectionResponse(
        Long id,
        Long sessionId,
        Integer completionPercent,
        Integer focusLevel,
        Integer energyLevel,
        List<String> distractionReasons,
        String summary,          // AI: tóm tắt phiên học
        String comparison,       // AI: so sánh với lịch sử (null nếu user mới)
        String recommendation,   // AI: gợi ý cụ thể cho phiên sau
        Double focusScore,       // Điểm 0-100 (luôn có, kể cả khi AI chết)
        boolean aiAvailable,     // false nếu feedback do fallback sinh ra
        String source,           // "gemini" | "fallback" | "unavailable"
        Integer aiCallsRemaining,// Lượt AI còn lại hôm nay; null nếu gói không giới hạn
        SessionReward reward,    // Phần thưởng tức thì của phiên này

        /**
         * Điều đọc được từ ghi chú user viết trong chính phiên này — null khi không có ghi chú.
         *
         * Đây là nguồn dữ liệu duy nhất KHÔNG phải lời tự khai của user, nên nó là thứ duy
         * nhất kiểm chứng được ô Task và các câu trả lời trong popup.
         */
        NoteInsight noteInsight,

        /**
         * Kế hoạch cho phiên kế tiếp, tính LẠI sau khi phiên vừa xong đã vào hồ sơ.
         *
         * Trước đây popup chỉ có một câu khuyên do model viết. Câu đó hay nhưng không trả
         * lời được "vậy phiên sau tôi đặt bao nhiêu phút, học môn gì, lúc mấy giờ" — và đó
         * mới là thứ user cần ngay lúc đóng popup. Gửi kèm nguyên kế hoạch để popup dựng
         * được ba con số đó thành chip bấm-một-cái-là-áp-dụng.
         */
        NextSessionPlan nextPlan,

        Instant createdAt
) {

    public ReflectionResponse withReward(SessionReward newReward) {
        return new ReflectionResponse(id, sessionId, completionPercent, focusLevel, energyLevel,
                distractionReasons, summary, comparison, recommendation, focusScore,
                aiAvailable, source, aiCallsRemaining, newReward, noteInsight, nextPlan, createdAt);
    }

    public ReflectionResponse withNoteInsight(NoteInsight insight) {
        return new ReflectionResponse(id, sessionId, completionPercent, focusLevel, energyLevel,
                distractionReasons, summary, comparison, recommendation, focusScore,
                aiAvailable, source, aiCallsRemaining, reward, insight, nextPlan, createdAt);
    }

    public ReflectionResponse withNextPlan(NextSessionPlan plan) {
        return new ReflectionResponse(id, sessionId, completionPercent, focusLevel, energyLevel,
                distractionReasons, summary, comparison, recommendation, focusScore,
                aiAvailable, source, aiCallsRemaining, reward, noteInsight, plan, createdAt);
    }

    /**
     * Thứ user nhận được ngay khi đóng popup, không phải chờ tới phiên thứ 10.
     *
     * Đây là "variable reward" của vòng lặp: điểm số thì đoán được, nhưng delta, kỷ lục mới
     * và phát hiện vừa mở khoá thì không — nên mỗi phiên vẫn còn lý do để mở popup thay vì
     * bấm Skip.
     *
     * @param sessionNumber       phiên thứ mấy của user
     * @param previousFocusScore  điểm phiên trước, null ở phiên đầu tiên
     * @param scoreDelta          chênh lệch so với phiên trước
     * @param personalBest        true khi đây là điểm cao nhất từ trước tới nay
     * @param currentStreakDays   chuỗi ngày học liên tiếp
     * @param newDiscoveries      phát hiện vừa mở khoá đúng ở phiên này
     * @param nextUnlockName      phát hiện kế tiếp đang chờ, để user biết vì sao nên quay lại
     * @param sessionsToNextUnlock còn bao nhiêu phiên nữa
     * @param predictedFocusScore điểm mà mô hình ĐÃ đoán cho phiên này, tính lại bằng đúng
     *                            dữ liệu có trước phiên; null khi chưa đủ lịch sử để đoán
     * @param predictionErrorPoints sai lệch giữa dự đoán và thực tế, tính bằng điểm
     * @param coachAccuracyPercent độ chính xác của mô hình trên các phiên gần đây (0 = chưa chấm)
     */
    public record SessionReward(
            int sessionNumber,
            Double previousFocusScore,
            Double scoreDelta,
            boolean personalBest,
            int currentStreakDays,
            List<Discovery> newDiscoveries,
            String nextUnlockName,
            Integer sessionsToNextUnlock,
            Double predictedFocusScore,
            Double predictionErrorPoints,
            int coachAccuracyPercent
    ) {
    }
}
