package org.devnqminh.studyfocus.service.ai;

import org.springframework.stereotype.Component;

/**
 * Điểm tập trung 0-100 của một phiên.
 *
 * Đây là con số quan trọng nhất trong sản phẩm: mọi phát hiện của
 * {@link FocusInsightEngine} — giờ vàng, độ dài tối ưu, môn mạnh/yếu, kỷ lục cá nhân —
 * đều là phép so sánh điểm giữa các phiên.
 *
 * Vì vậy điểm PHẢI do công thức cố định tính, không để model chấm. Model chấm thì cùng
 * một phiên chạy hai lần ra hai điểm khác nhau, và mọi so sánh phía trên sụp đổ. Công thức
 * này khớp với hàm focus_score() trong ai-service/main.py — sửa một bên phải sửa cả hai.
 *
 * Cố ý KHÔNG trừ điểm khi user báo bị xao nhãng: trừ điểm là dạy user khai "không xao nhãng"
 * để được điểm đẹp, trong khi dữ liệu xao nhãng trung thực mới là thứ tìm ra quy luật.
 * Xao nhãng là biến giải thích, không phải hình phạt.
 */
@Component
public class FocusScoreCalculator {

    public double calculate(Integer completionPercent, Integer focusLevel, Integer energyLevel) {
        int completion = completionPercent == null ? 0 : completionPercent;
        int focus = focusLevel == null ? 3 : focusLevel;

        double score;
        if (energyLevel == null) {
            // Reflection không có câu năng lượng (dữ liệu cũ, hoặc user bỏ qua)
            score = completion * 0.5 + focus * 20 * 0.5;
        } else {
            score = completion * 0.45
                    + focus * 20 * 0.40
                    + energyLevel * 20 * 0.15;
        }
        return round1(Math.max(0, Math.min(100, score)));
    }

    private double round1(double value) {
        return Math.round(value * 10.0) / 10.0;
    }
}
