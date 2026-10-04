package org.devnqminh.studyfocus.service.ai;

import lombok.RequiredArgsConstructor;
import org.devnqminh.studyfocus.dto.response.Discovery;
import org.devnqminh.studyfocus.dto.response.FocusProfileResponse;
import org.devnqminh.studyfocus.dto.response.NextSessionPlan;
import org.devnqminh.studyfocus.service.ai.FocusInsightEngine.SessionPoint;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Biến hồ sơ tập trung thành một kế hoạch cụ thể cho phiên SẮP tới.
 *
 * Ba câu hỏi mà mọi lời khuyên học tập đều né, còn ở đây bắt buộc phải trả lời bằng số:
 * học MÔN gì, trong BAO LÂU, và BÂY GIỜ có phải lúc nên học không. Trả lời được ba câu đó
 * mới là thứ thay đổi hành vi; "hãy cố gắng tập trung hơn" thì không.
 *
 * Toàn bộ tính cục bộ, không gọi Gemini: kế hoạch phải hiện ngay khi user mở app, và phải
 * hiện ở MỌI lần mở app — thứ gì tính tiền theo lượt gọi thì không làm được điều đó.
 */
@Component
@RequiredArgsConstructor
public class NextSessionPlanner {

    private static final int DEFAULT_DURATION = 25;
    private static final int MIN_DURATION = 15;
    private static final int MAX_DURATION = 60;

    /** Chênh điểm tối thiểu để dám nói "khung giờ này kém hơn" — giữ đúng ngưỡng của engine. */
    private static final double MEANINGFUL_GAP = 8.0;

    /** Dưới ngưỡng này thì kế hoạch chưa phải của riêng user, và giao diện phải nói thẳng. */
    private static final int MIN_FOR_PERSONALIZED = 3;

    /** Cần ít nhất bấy nhiêu phiên mới dám phán xét khung giờ. */
    private static final int MIN_FOR_TIMING = 5;

    /** Một môn phải có ngần này phiên mới được đem ra tranh vị trí "nên học bây giờ". */
    private static final int MIN_PER_SUBJECT = 2;

    /**
     * Biện pháp chặn ứng với từng tác nhân xao nhãng.
     *
     * Cố ý là THAO TÁC LÀM TRƯỚC KHI BẤM START, không phải lời khuyên trong lúc học: khi đã
     * mất tập trung rồi thì không ai đọc lời khuyên nữa. Chặn trước là việc duy nhất còn kịp.
     */
    private static final Map<String, String> GUARDRAILS = Map.of(
            "social_media", "Trước khi bấm Start: bật Không làm phiền và úp điện thoại ra xa tầm với.",
            "noise", "Trước khi bấm Start: đeo tai nghe và bật nhạc nền trong app.",
            "fatigue", "Trước khi bấm Start: uống nước và đứng dậy vận động 2 phút.",
            "mind_wandering", "Trước khi bấm Start: viết đúng MỘT mục tiêu của phiên này vào ô Task.");

    private final FocusScorePredictor predictor;

    /**
     * @param points      lịch sử đã có reflection, cũ → mới
     * @param profile     hồ sơ do {@link FocusInsightEngine} dựng từ chính lịch sử đó
     * @param now         thời điểm lập kế hoạch
     * @param subjectHint môn user đang gõ ở ô Task; có thì tôn trọng lựa chọn của user và
     *                    chuyển sang dự đoán cho chính môn đó thay vì gợi ý môn khác
     */
    public NextSessionPlan plan(List<SessionPoint> points,
                                FocusProfileResponse profile,
                                ZoneId zone,
                                Instant now,
                                String subjectHint) {
        List<SessionPoint> history = points == null ? List.of() : points;
        int hour = now.atZone(zone).getHour();

        DurationChoice duration = chooseDuration(profile);
        String subject = chooseSubject(history, subjectHint, hour, duration.minutes(), zone);

        FocusScorePredictor.Prediction prediction = predictor.predict(
                history,
                new FocusScorePredictor.Context(subject, hour, (double) duration.minutes()),
                zone);

        Timing timing = evaluateTiming(history, zone, hour);

        List<String> reasons = new ArrayList<>();
        if (duration.reason() != null) {
            reasons.add(duration.reason());
        }
        reasons.addAll(prediction.drivers());

        FocusScorePredictor.Accuracy accuracy = predictor.backtest(history, zone);
        boolean personalized = history.size() >= MIN_FOR_PERSONALIZED;

        return new NextSessionPlan(
                personalized,
                history.size(),
                headline(subject, duration.minutes(), timing, personalized),
                subject,
                duration.minutes(),
                breakFor(duration.minutes()),
                prediction.score(),
                prediction.confidence(),
                timing.verdict(),
                timing.message(),
                timing.betterLabel(),
                timing.betterHour(),
                guardrail(profile),
                profile.consistency() == null ? null : profile.consistency().message(),
                List.copyOf(reasons),
                new NextSessionPlan.CoachAccuracy(
                        accuracy.sampleSize(), accuracy.meanAbsoluteError(), accuracy.accuracyPercent()),
                now);
    }

    // ==================================================================
    // Độ dài phiên
    // ==================================================================

    private record DurationChoice(int minutes, String reason) {
    }

    /**
     * Độ dài tối ưu, nhưng luôn bị ngưỡng cạn năng lượng cắt xuống.
     *
     * Đây là chỗ hệ thống chủ động khuyên user HỌC ÍT ĐI. Điều đó đi ngược lại bản năng của
     * mọi app đếm giờ (app nào cũng muốn khoe tổng số phút), nhưng nó đúng: học thêm 20 phút
     * sau khi đã cạn pin chỉ tạo ra thời gian ngồi bàn, không tạo ra sự tập trung.
     */
    private DurationChoice chooseDuration(FocusProfileResponse profile) {
        Integer best = profile.suggestedDurationMinutes();
        Integer drop = profile.energyDropAfterMinutes();

        if (best == null && drop == null) {
            return new DurationChoice(DEFAULT_DURATION, null);
        }
        if (best == null) {
            int capped = clamp(roundTo5(drop - 5));
            return new DurationChoice(capped, String.format(
                    "Bạn thường báo cạn năng lượng từ khoảng phút thứ %d, nên phiên này dừng ở %d phút.",
                    drop, capped));
        }
        if (drop != null && drop <= best) {
            int capped = clamp(roundTo5(drop - 5));
            return new DurationChoice(capped, String.format(
                    "Phiên %d phút cho điểm cao nhất, nhưng bạn cạn năng lượng từ phút %d — "
                            + "rút xuống %d phút để kết thúc lúc còn tập trung.",
                    best, drop, capped));
        }
        return new DurationChoice(clamp(best), String.format(
                "Phiên %d phút là độ dài cho điểm cao nhất của bạn.", best));
    }

    /** Nghỉ bằng 1/5 phiên, kẹp trong 5-15 phút — đủ để hồi, không đủ để rơi khỏi mạch. */
    private int breakFor(int durationMinutes) {
        return Math.max(5, Math.min(15, (int) Math.round(durationMinutes / 5.0)));
    }

    // ==================================================================
    // Môn học
    // ==================================================================

    /**
     * Môn nên học bây giờ = môn có điểm dự đoán cao nhất TẠI KHUNG GIỜ NÀY.
     *
     * Không chọn môn user đang yếu nhất: ép học môn yếu vào khung giờ xấu là công thức chắc
     * chắn tạo ra một phiên tệ và một user bỏ app. Môn yếu được xử lý ở chỗ khác — engine
     * đã có phát hiện "môn đang kéo bạn xuống" kèm khung giờ tốt nhất của nó.
     *
     * User đã tự gõ môn vào ô Task thì tôn trọng: lúc đó vai trò của AI là dự đoán và cảnh
     * báo, không phải giành quyền quyết định.
     */
    private String chooseSubject(List<SessionPoint> history, String hint, int hour,
                                 int durationMinutes, ZoneId zone) {
        if (hint != null && !hint.isBlank()) {
            return hint.trim();
        }

        Map<String, Integer> counts = new LinkedHashMap<>();
        for (SessionPoint p : history) {
            String subject = p.normalizedSubject();
            if (subject != null) {
                counts.merge(subject, 1, Integer::sum);
            }
        }
        List<String> candidates = counts.entrySet().stream()
                .filter(e -> e.getValue() >= MIN_PER_SUBJECT)
                .map(Map.Entry::getKey)
                .toList();
        if (candidates.isEmpty()) {
            return null;
        }

        return candidates.stream()
                .max(Comparator.comparingDouble(s -> predictor.predict(
                        history,
                        new FocusScorePredictor.Context(s, hour, (double) durationMinutes),
                        zone).score()))
                .orElse(null);
    }

    // ==================================================================
    // Khung giờ
    // ==================================================================

    private record Timing(String verdict, String message, String betterLabel, Integer betterHour) {
    }

    /**
     * Bây giờ có phải lúc nên học không — so khung giờ hiện tại với chính các khung giờ khác
     * của user, không phải với "lời khuyên chung là nên học buổi sáng".
     */
    private Timing evaluateTiming(List<SessionPoint> history, ZoneId zone, int hour) {
        String currentPart = FocusInsightEngine.dayPartKey(hour);
        String currentLabel = FocusInsightEngine.dayPartLabel(currentPart);

        if (history.size() < MIN_FOR_TIMING) {
            return new Timing("UNKNOWN",
                    "Chưa đủ dữ liệu để biết " + currentLabel
                            + " có hợp với bạn không. Cứ học — mỗi phiên là một điểm dữ liệu.",
                    null, null);
        }

        Map<String, double[]> byPart = new LinkedHashMap<>();   // key -> [tổng điểm, số phiên]
        Map<String, double[]> byHour = new LinkedHashMap<>();
        for (SessionPoint p : history) {
            if (p.startedAt() == null) {
                continue;
            }
            int h = p.startedAt().atZone(zone).getHour();
            double[] partAcc = byPart.computeIfAbsent(FocusInsightEngine.dayPartKey(h), k -> new double[2]);
            partAcc[0] += p.focusScore();
            partAcc[1] += 1;
            double[] hourAcc = byHour.computeIfAbsent(String.valueOf(h), k -> new double[2]);
            hourAcc[0] += p.focusScore();
            hourAcc[1] += 1;
        }

        if (byPart.size() < 2 || !byPart.containsKey(currentPart)) {
            return new Timing("UNKNOWN",
                    "Bạn chưa học đủ nhiều khung giờ khác nhau để so sánh. "
                            + "Thử đổi giờ học vài phiên, AI sẽ tìm ra khung giờ vàng của bạn.",
                    null, null);
        }

        var best = byPart.entrySet().stream()
                .max(Comparator.comparingDouble(e -> e.getValue()[0] / e.getValue()[1])).orElseThrow();
        double bestScore = best.getValue()[0] / best.getValue()[1];
        double currentScore = byPart.get(currentPart)[0] / byPart.get(currentPart)[1];
        int currentSessions = (int) byPart.get(currentPart)[1];

        if (best.getKey().equals(currentPart)) {
            return new Timing("GOOD", String.format(Locale.US,
                    "Đây đang là khung giờ tốt nhất của bạn: %s bạn đạt trung bình %.0f điểm qua %d phiên. "
                            + "Xếp việc khó vào đúng lúc này.",
                    currentLabel, currentScore, currentSessions),
                    null, null);
        }

        double gap = bestScore - currentScore;
        String bestLabel = FocusInsightEngine.dayPartLabel(best.getKey());
        Integer bestHour = bestHourWithin(byHour, best.getKey());

        if (gap >= MEANINGFUL_GAP) {
            return new Timing("POOR", String.format(Locale.US,
                    "%s bạn thường chỉ đạt %.0f điểm, trong khi %s đạt %.0f — chênh %.0f điểm. "
                            + "Dời được thì học lúc %02d:00; học ngay bây giờ thì hạ mục tiêu xuống một nấc.",
                    capitalize(currentLabel), currentScore, bestLabel, bestScore, gap,
                    bestHour == null ? FocusInsightEngine.representativeHour(best.getKey()) : bestHour),
                    bestLabel,
                    bestHour == null ? FocusInsightEngine.representativeHour(best.getKey()) : bestHour);
        }

        return new Timing("OK", String.format(Locale.US,
                "%s của bạn ở mức ổn (%.0f điểm), chỉ thấp hơn %s %.0f điểm. Học được.",
                capitalize(currentLabel), currentScore, bestLabel, gap),
                null, null);
    }

    /** Giờ cho điểm cao nhất bên trong một buổi, chỉ tính giờ có ít nhất 2 phiên. */
    private Integer bestHourWithin(Map<String, double[]> byHour, String dayPartKey) {
        return byHour.entrySet().stream()
                .filter(e -> e.getValue()[1] >= 2)
                .filter(e -> FocusInsightEngine.dayPartKey(Integer.parseInt(e.getKey())).equals(dayPartKey))
                .max(Comparator.comparingDouble(e -> e.getValue()[0] / e.getValue()[1]))
                .map(e -> Integer.parseInt(e.getKey()))
                .orElse(null);
    }

    // ==================================================================

    /**
     * Biện pháp chặn lấy từ chính phát hiện "thủ phạm số 1" của user. Không có phát hiện đó
     * thì không bịa ra một lời khuyên chống xao nhãng chung chung.
     */
    private String guardrail(FocusProfileResponse profile) {
        return profile.discoveries().stream()
                .filter(d -> d.id().startsWith("distraction_top:"))
                .findFirst()
                .map(Discovery::id)
                .map(id -> GUARDRAILS.get(id.substring("distraction_top:".length())))
                .orElse(null);
    }

    private String headline(String subject, int minutes, Timing timing, boolean personalized) {
        String what = subject == null ? "một phiên" : "môn " + subject;
        if (!personalized) {
            return String.format("Bắt đầu %s trong %d phút", what, minutes);
        }
        if ("POOR".equals(timing.verdict())) {
            return String.format("Nếu học bây giờ: %s, rút còn %d phút", what, minutes);
        }
        return String.format("Học %s trong %d phút, ngay bây giờ", what, minutes);
    }

    private int roundTo5(int minutes) {
        return (int) (Math.round(minutes / 5.0) * 5);
    }

    private int clamp(int minutes) {
        return Math.max(MIN_DURATION, Math.min(MAX_DURATION, minutes));
    }

    private String capitalize(String s) {
        return s == null || s.isEmpty() ? s : Character.toUpperCase(s.charAt(0)) + s.substring(1);
    }
}
