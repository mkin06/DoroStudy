package org.devnqminh.studyfocus.service.ai;

import org.devnqminh.studyfocus.service.ai.FocusInsightEngine.SessionPoint;
import org.springframework.stereotype.Component;

import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * Dự đoán điểm tập trung của một phiên CHƯA diễn ra.
 *
 * Đây là bước biến sản phẩm từ "app ghi chép có AI nhận xét" thành "AI hiểu bạn": mọi app
 * Pomodoro đều kể lại được chuyện đã xảy ra, nhưng chỉ hệ thống nào có mô hình riêng của
 * từng user mới dám nói trước "phiên này bạn sẽ được khoảng 74 điểm" — và tự chấm điểm
 * chính mình khi phiên kết thúc.
 *
 * MÔ HÌNH (cố ý đơn giản và giải thích được, không phải mạng nơ-ron):
 *
 *   dự đoán = trung bình của user
 *             + độ lệch của môn học      × trọng số theo cỡ mẫu
 *             + độ lệch của buổi trong ngày × trọng số theo cỡ mẫu
 *             + độ lệch của độ dài phiên  × trọng số theo cỡ mẫu
 *
 * Trọng số n/(n+K) là phép co về trung bình (shrinkage): một môn mới học 1 lần gần như
 * không kéo được dự đoán đi đâu, môn đã học 10 lần thì kéo gần hết mức. Nhờ vậy hệ thống
 * KHÔNG khẳng định mạnh khi mới có vài phiên — đúng nguyên tắc của {@link FocusInsightEngine}.
 *
 * Vì mô hình chạy trên vài chục bản ghi trong bộ nhớ nên nó miễn phí, tức thì, và có mặt
 * TRƯỚC mỗi phiên chứ không chỉ sau phiên thứ 10.
 */
@Component
public class FocusScorePredictor {

    /**
     * Điểm mặc định cho user chưa có phiên nào. Cố ý không phải 0 hay 100: đây là mốc trung
     * tính để phiên đầu tiên vẫn có con số so sánh, và nó được nói rõ là chưa cá nhân hoá.
     */
    private static final double COLD_START_SCORE = 62.0;

    /**
     * Hệ số co. K = 3 nghĩa là một nhóm 3 phiên được tin 50%, 9 phiên được tin 75%.
     * Chọn 3 vì đó cũng là ngưỡng tối thiểu mà engine dùng để dám gọi một thứ là quy luật.
     */
    private static final int SHRINK_K = 3;

    /** Chênh dưới mức này không đáng nhắc — nói ra chỉ làm loãng phần giải thích. */
    private static final double MIN_DRIVER_EFFECT = 1.5;

    /** Cần ít nhất bấy nhiêu phiên đứng trước thì việc "đoán ngược" mới có nghĩa. */
    private static final int MIN_HISTORY_FOR_BACKTEST = 3;

    /** Chỉ chấm độ chính xác trên các phiên gần đây: mô hình cũ không đại diện cho user hiện tại. */
    private static final int BACKTEST_WINDOW = 10;

    /**
     * Bối cảnh của phiên sắp học. Field nào null thì chiều đó không được dùng để điều chỉnh
     * (ví dụ user chưa gắn môn) — không đoán bừa thay user.
     */
    public record Context(String subject, Integer hour, Double durationMinutes) {
    }

    /**
     * @param score      điểm dự đoán 0-100
     * @param confidence 0-100, phản ánh cỡ mẫu chứ không phải "AI thấy tự tin"
     * @param drivers    các yếu tố đã kéo dự đoán lệch khỏi trung bình, kèm số liệu thật
     */
    public record Prediction(double score, int confidence, List<String> drivers) {
    }

    /**
     * Kết quả tự chấm của mô hình: đoán lại các phiên đã qua bằng đúng dữ liệu có TRƯỚC
     * phiên đó, rồi so với điểm thật.
     *
     * @param sampleSize        số phiên đã đem ra chấm
     * @param meanAbsoluteError sai số trung bình, tính bằng điểm
     * @param accuracyPercent   100 - sai số, làm tròn — con số hiển thị cho user
     */
    public record Accuracy(int sampleSize, double meanAbsoluteError, int accuracyPercent) {
    }

    /**
     * @param history các phiên đã có reflection, sắp xếp cũ → mới
     */
    public Prediction predict(List<SessionPoint> history, Context ctx, ZoneId zone) {
        if (history == null || history.isEmpty()) {
            return new Prediction(COLD_START_SCORE, 15, List.of(
                    "Chưa có phiên nào để học từ bạn — đây là mốc trung bình chung, "
                            + "không phải dự đoán riêng cho bạn."));
        }

        double base = mean(history);
        List<String> drivers = new ArrayList<>();
        double adjusted = base;
        int matchedSamples = 0;

        if (ctx.subject() != null && !ctx.subject().isBlank()) {
            String subject = ctx.subject().trim();
            List<SessionPoint> group = history.stream()
                    .filter(p -> subject.equalsIgnoreCase(p.normalizedSubject()))
                    .toList();
            adjusted += effect(group, base, "môn " + subject, drivers);
            matchedSamples += group.size();
        }

        if (ctx.hour() != null) {
            String part = FocusInsightEngine.dayPartKey(ctx.hour());
            List<SessionPoint> group = history.stream()
                    .filter(p -> p.startedAt() != null
                            && FocusInsightEngine.dayPartKey(p.startedAt().atZone(zone).getHour()).equals(part))
                    .toList();
            adjusted += effect(group, base, "học " + FocusInsightEngine.dayPartLabel(part), drivers);
            matchedSamples += group.size();
        }

        if (ctx.durationMinutes() != null && ctx.durationMinutes() > 0) {
            int bucket = bucketOf(ctx.durationMinutes());
            List<SessionPoint> group = history.stream()
                    .filter(p -> p.durationMinutes() > 0 && bucketOf(p.durationMinutes()) == bucket)
                    .toList();
            adjusted += effect(group, base, "phiên " + bucket + " phút", drivers);
            matchedSamples += group.size();
        }

        if (drivers.isEmpty()) {
            drivers.add(String.format(Locale.US,
                    "Dựa trên mức trung bình %.0f điểm của %d phiên bạn đã học.",
                    base, history.size()));
        }

        return new Prediction(
                round1(clamp(adjusted)),
                confidence(history.size(), matchedSamples),
                List.copyOf(drivers));
    }

    /**
     * Tự chấm mô hình trên chính lịch sử của user.
     *
     * Cách chấm cố ý nghiêm: khi đoán phiên thứ i, chỉ được nhìn các phiên 0..i-1 — đúng
     * lượng thông tin mà hệ thống thực sự có tại thời điểm đó. Chấm bằng toàn bộ dữ liệu
     * (kể cả tương lai) sẽ ra một con số đẹp nhưng vô nghĩa.
     */
    public Accuracy backtest(List<SessionPoint> points, ZoneId zone) {
        if (points == null || points.size() <= MIN_HISTORY_FOR_BACKTEST) {
            return new Accuracy(0, 0, 0);
        }
        int from = Math.max(MIN_HISTORY_FOR_BACKTEST, points.size() - BACKTEST_WINDOW);
        double totalError = 0;
        int n = 0;
        for (int i = from; i < points.size(); i++) {
            SessionPoint actual = points.get(i);
            Prediction predicted = predict(points.subList(0, i), contextOf(actual, zone), zone);
            totalError += Math.abs(predicted.score() - actual.focusScore());
            n++;
        }
        if (n == 0) {
            return new Accuracy(0, 0, 0);
        }
        double mae = totalError / n;
        return new Accuracy(n, round1(mae), (int) Math.round(Math.max(0, 100 - mae)));
    }

    /** Bối cảnh của một phiên đã xảy ra — dùng để đoán ngược khi backtest. */
    public Context contextOf(SessionPoint p, ZoneId zone) {
        return new Context(
                p.normalizedSubject(),
                p.startedAt() == null ? null : p.startedAt().atZone(zone).getHour(),
                p.durationMinutes() > 0 ? p.durationMinutes() : null);
    }

    // ------------------------------------------------------------------

    /**
     * Độ lệch của một nhóm so với trung bình chung, đã co theo cỡ mẫu.
     * Nhóm rỗng trả 0: không có dữ liệu thì không được điều chỉnh gì cả.
     */
    private double effect(List<SessionPoint> group, double base, String label, List<String> drivers) {
        if (group.isEmpty()) {
            return 0;
        }
        double weight = group.size() / (double) (group.size() + SHRINK_K);
        double delta = (mean(group) - base) * weight;
        if (Math.abs(delta) >= MIN_DRIVER_EFFECT) {
            drivers.add(String.format(Locale.US, "%s %s%.0f điểm so với trung bình của bạn (%d phiên).",
                    capitalize(label), delta >= 0 ? "+" : "-", Math.abs(delta), group.size()));
        }
        return delta;
    }

    /**
     * Cỡ mẫu càng lớn càng tự tin, nhưng trần 88: mô hình này không bao giờ được tỏ ra
     * chắc chắn tuyệt đối về một con người.
     */
    private int confidence(int historySize, int matchedSamples) {
        return Math.min(88, 25 + historySize * 4 + matchedSamples * 2);
    }

    /** Gộp độ dài về bội số của 5 phút — cùng cách chia với phần phân tích độ dài của engine. */
    private int bucketOf(double minutes) {
        return (int) (Math.round(minutes / 5.0) * 5);
    }

    private double mean(List<SessionPoint> points) {
        return points.stream().mapToDouble(SessionPoint::focusScore).average().orElse(COLD_START_SCORE);
    }

    private double clamp(double value) {
        return Math.max(0, Math.min(100, value));
    }

    private double round1(double value) {
        return Math.round(value * 10.0) / 10.0;
    }

    private String capitalize(String s) {
        return s == null || s.isEmpty() ? s : Character.toUpperCase(s.charAt(0)) + s.substring(1);
    }
}
