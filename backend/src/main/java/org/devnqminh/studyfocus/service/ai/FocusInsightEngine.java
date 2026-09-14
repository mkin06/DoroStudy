package org.devnqminh.studyfocus.service.ai;

import org.devnqminh.studyfocus.dto.response.Discovery;
import org.devnqminh.studyfocus.dto.response.FocusProfileResponse;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;

/**
 * Bộ máy rút ra quy luật học tập của một user từ lịch sử reflection.
 *
 * Thuần tính toán, không đụng DB và không gọi AI — nhờ vậy chạy được ngay trong request
 * (vài chục bản ghi trong bộ nhớ), không tốn một đồng COGS nào, và unit test được không
 * cần Spring context.
 *
 * Nguyên tắc thiết kế:
 *
 * 1. MỖI PHIÊN PHẢI TRẢ VỀ THỨ GÌ ĐÓ. Bản Meta-Learning trước đây chỉ chạy sau 10 phiên,
 *    tức là phần thông minh nhất chỉ xuất hiện sau khi phần lớn user đã bỏ đi. Ở đây phiên
 *    đầu tiên đã có mốc chuẩn, phiên thứ hai đã có so sánh.
 *
 * 2. KHÔNG BAO GIỜ KHẲNG ĐỊNH KHI CHƯA ĐỦ MẪU. Mỗi phát hiện có ngưỡng số phiên tối thiểu
 *    và một mức chênh lệch tối thiểu; dưới ngưỡng thì im lặng thay vì đoán bừa. Một lời
 *    khuyên sai làm hỏng niềm tin nhanh hơn là không có lời khuyên nào.
 *
 * 3. PHÁT HIỆN PHẢI HÀNH ĐỘNG ĐƯỢC. "Bạn tập trung 4/5" là mô tả lại input. "Toán lúc 20h
 *    cao hơn Toán lúc 14h 22 điểm" mới là thứ user đổi lịch học vì nó.
 */
@Component
public class FocusInsightEngine {

    // --- Ngưỡng mẫu tối thiểu cho từng loại phát hiện ---
    private static final int MIN_FOR_DISTRACTION = 3;
    private static final int MIN_FOR_DURATION = 4;
    private static final int MIN_FOR_TIME_OF_DAY = 5;
    private static final int MIN_FOR_ENERGY = 5;
    private static final int MIN_PER_SUBJECT_HOUR = 3;
    private static final int MIN_PER_SUBJECT_COMPARE = 2;
    private static final int MIN_FOR_CONSISTENCY = 3;

    /** Chênh lệch điểm tối thiểu để coi là quy luật thật chứ không phải nhiễu. */
    private static final double MEANINGFUL_GAP = 8.0;

    private static final int MIN_SUGGESTED_MINUTES = 15;
    private static final int MAX_SUGGESTED_MINUTES = 60;

    /**
     * Bậc thang mở khoá hiển thị cho user. Cố ý tách khỏi điều kiện thật của từng phát hiện:
     * đây là thanh tiến độ tạo động lực quay lại, còn phát hiện thật có thể xuất hiện sớm hơn
     * — bất ngờ dương thì tốt, bất ngờ âm mới là vấn đề.
     */
    private static final List<Unlock> UNLOCK_LADDER = List.of(
            new Unlock(2, "So sánh với phiên trước"),
            new Unlock(3, "Tác nhân xao nhãng chủ đạo"),
            new Unlock(4, "Độ dài phiên tối ưu"),
            new Unlock(5, "Khung giờ vàng của bạn"),
            new Unlock(7, "Đường cong năng lượng"),
            new Unlock(10, "Giờ vàng theo từng môn"),
            new Unlock(15, "Bản đồ tập trung đầy đủ"));

    private record Unlock(int sessions, String name) {
    }

    /**
     * Một phiên đã có reflection, phẳng hoá khỏi entity JPA để engine test được độc lập.
     */
    public record SessionPoint(
            Long sessionId,
            String subject,
            double durationMinutes,
            Instant startedAt,
            int completionPercent,
            int focusLevel,
            Integer energyLevel,
            List<String> distractionReasons,
            double focusScore
    ) {
        public boolean hasRealDistraction() {
            return distractionReasons != null
                    && distractionReasons.stream().anyMatch(r -> r != null && !r.isBlank() && !"none".equals(r));
        }

        public String normalizedSubject() {
            return subject == null || subject.isBlank() ? null : subject.trim();
        }
    }

    /**
     * @param points sắp xếp cũ → mới
     */
    public FocusProfileResponse analyze(List<SessionPoint> points, ZoneId zone) {
        int n = points.size();
        if (n == 0) {
            return emptyProfile();
        }

        List<Discovery> discoveries = new ArrayList<>();

        addScoreDiscoveries(points, discoveries);
        addDistractionDiscovery(points, discoveries);
        DurationFinding duration = analyzeDuration(points);
        addDurationDiscovery(duration, discoveries);
        addTimeOfDayDiscoveries(points, zone, discoveries);
        Integer energyDrop = addEnergyDiscoveries(points, discoveries);
        List<FocusProfileResponse.SubjectGoldenHour> subjectHours = analyzeSubjectHours(points, zone);
        List<FocusProfileResponse.SubjectHeatCell> heatmap = buildHeatmap(points, zone);
        addSubjectDiscoveries(points, subjectHours, discoveries);
        addSubjectAffinityDiscovery(points, discoveries);
        addRoutineDiscovery(points, zone, discoveries);

        FocusProfileResponse.ConsistencyStatus consistency = analyzeConsistency(points, zone);
        addConsistencyDiscovery(consistency, discoveries);

        double avg = points.stream().mapToDouble(SessionPoint::focusScore).average().orElse(0);
        double best = points.stream().mapToDouble(SessionPoint::focusScore).max().orElse(0);

        Unlock next = nextUnlock(n);

        return new FocusProfileResponse(
                n,
                tierOf(n),
                tierName(n),
                next == null ? null : next.name(),
                next == null ? null : next.sessions() - n,
                round1(avg),
                round1(best),
                discoveries,
                subjectHours,
                heatmap,
                duration == null ? null : duration.suggestedMinutes(),
                energyDrop,
                consistency,
                Instant.now());
    }

    /**
     * Phát hiện vừa mới xuất hiện ở phiên cuối cùng: chạy engine trên toàn bộ lịch sử và
     * trên lịch sử bỏ phiên cuối, rồi lấy phần chênh. Không cần lưu trạng thái ở đâu cả.
     */
    public List<Discovery> newDiscoveries(List<SessionPoint> points, ZoneId zone) {
        if (points.isEmpty()) {
            return List.of();
        }
        List<Discovery> current = analyze(points, zone).discoveries();
        if (points.size() == 1) {
            return current.stream().map(Discovery::asNew).toList();
        }
        Set<String> previousIds = new HashSet<>();
        for (Discovery d : analyze(points.subList(0, points.size() - 1), zone).discoveries()) {
            previousIds.add(d.id());
        }
        return current.stream()
                .filter(d -> !previousIds.contains(d.id()))
                .map(Discovery::asNew)
                .toList();
    }

    // ==================================================================
    // Điểm số
    // ==================================================================

    private void addScoreDiscoveries(List<SessionPoint> points, List<Discovery> out) {
        int n = points.size();
        SessionPoint latest = points.get(n - 1);

        if (n == 1) {
            out.add(new Discovery(
                    "baseline",
                    "🎯",
                    "Mốc chuẩn của bạn",
                    String.format("Phiên đầu tiên đạt %.0f điểm. Từ giờ mọi phiên đều được so với mốc này.",
                            latest.focusScore()),
                    "1 phiên",
                    50,
                    false));
            return;
        }

        double bestBefore = points.subList(0, n - 1).stream()
                .mapToDouble(SessionPoint::focusScore).max().orElse(0);
        if (latest.focusScore() > bestBefore) {
            out.add(new Discovery(
                    "personal_best",
                    "⭐",
                    "Kỷ lục cá nhân",
                    String.format("%.0f điểm — cao nhất trong %d phiên của bạn.", latest.focusScore(), n),
                    n + " phiên",
                    90,
                    false));
        }
    }

    // ==================================================================
    // Xao nhãng
    // ==================================================================

    private static final Map<String, String> DISTRACTION_LABELS = Map.of(
            "social_media", "mạng xã hội",
            "noise", "tiếng ồn",
            "fatigue", "mệt mỏi",
            "mind_wandering", "suy nghĩ lan man",
            "none", "không xao nhãng");

    static String distractionLabel(String id) {
        return DISTRACTION_LABELS.getOrDefault(id, id);
    }

    private void addDistractionDiscovery(List<SessionPoint> points, List<Discovery> out) {
        if (points.size() < MIN_FOR_DISTRACTION) {
            return;
        }
        Map<String, Integer> counts = new HashMap<>();
        for (SessionPoint p : points) {
            if (p.distractionReasons() == null) {
                continue;
            }
            for (String r : p.distractionReasons()) {
                if (r != null && !r.isBlank() && !"none".equals(r)) {
                    counts.merge(r, 1, Integer::sum);
                }
            }
        }
        var top = counts.entrySet().stream().max(Map.Entry.comparingByValue()).orElse(null);
        if (top == null) {
            return;
        }
        int n = points.size();
        int share = (int) Math.round(top.getValue() * 100.0 / n);
        // Dưới 40% thì chưa phải "thủ phạm chính", chỉ là chuyện xảy ra vài lần
        if (share < 40) {
            return;
        }

        // Điểm chênh giữa phiên có và không có tác nhân này — biến quan sát thành lý do hành động
        double withIt = points.stream().filter(p -> p.distractionReasons() != null
                        && p.distractionReasons().contains(top.getKey()))
                .mapToDouble(SessionPoint::focusScore).average().orElse(0);
        double withoutIt = points.stream().filter(p -> p.distractionReasons() == null
                        || !p.distractionReasons().contains(top.getKey()))
                .mapToDouble(SessionPoint::focusScore).average().orElse(0);

        String detail = String.format("%s xuất hiện ở %d/%d phiên (%d%%).",
                capitalize(distractionLabel(top.getKey())), top.getValue(), n, share);
        if (withoutIt - withIt >= MEANINGFUL_GAP) {
            detail += String.format(" Những phiên không bị nó làm phiền, bạn cao hơn %.0f điểm.",
                    withoutIt - withIt);
        }

        out.add(new Discovery(
                "distraction_top:" + top.getKey(),
                "📵",
                "Thủ phạm số 1",
                detail,
                n + " phiên",
                confidence(n),
                false));
    }

    // ==================================================================
    // Độ dài phiên
    // ==================================================================

    private record DurationFinding(int suggestedMinutes, int bestBucket, double bestScore,
                                   int worstBucket, double worstScore, int sampleSize) {
    }

    private DurationFinding analyzeDuration(List<SessionPoint> points) {
        if (points.size() < MIN_FOR_DURATION) {
            return null;
        }
        Map<Integer, double[]> byBucket = new HashMap<>();
        for (SessionPoint p : points) {
            if (p.durationMinutes() <= 0) {
                continue;
            }
            int bucket = clampMinutes((int) (Math.round(p.durationMinutes() / 5.0) * 5));
            double[] acc = byBucket.computeIfAbsent(bucket, b -> new double[2]);
            acc[0] += p.focusScore();
            acc[1] += 1;
        }
        if (byBucket.isEmpty()) {
            return null;
        }
        if (byBucket.size() == 1) {
            // Chỉ dùng đúng một độ dài thì không có gì để so; điều chỉnh nhẹ theo điểm trung bình
            int only = byBucket.keySet().iterator().next();
            double avg = points.stream().mapToDouble(SessionPoint::focusScore).average().orElse(0);
            int suggested = avg >= 75 ? clampMinutes(only + 5)
                    : avg <= 50 ? clampMinutes(only - 5) : only;
            return new DurationFinding(suggested, only, avg, only, avg, points.size());
        }

        var best = byBucket.entrySet().stream()
                .max(Comparator.comparingDouble(e -> e.getValue()[0] / e.getValue()[1])).orElseThrow();
        var worst = byBucket.entrySet().stream()
                .min(Comparator.comparingDouble(e -> e.getValue()[0] / e.getValue()[1])).orElseThrow();

        return new DurationFinding(
                best.getKey(),
                best.getKey(), best.getValue()[0] / best.getValue()[1],
                worst.getKey(), worst.getValue()[0] / worst.getValue()[1],
                points.size());
    }

    private void addDurationDiscovery(DurationFinding f, List<Discovery> out) {
        if (f == null || f.bestBucket() == f.worstBucket()) {
            return;
        }
        double gap = f.bestScore() - f.worstScore();
        if (gap < MEANINGFUL_GAP) {
            return;
        }

        // Trường hợp đáng giá nhất: phiên dài lại cho điểm thấp hơn → khuyên rút ngắn
        boolean shorterIsBetter = f.bestBucket() < f.worstBucket();
        out.add(new Discovery(
                shorterIsBetter ? "duration_shorter" : "duration_longer",
                shorterIsBetter ? "✂️" : "⏱️",
                shorterIsBetter ? "Phiên ngắn hợp bạn hơn" : "Bạn cần phiên dài hơn",
                String.format("Phiên %d phút đạt %.0f điểm, phiên %d phút chỉ %.0f. Chênh %.0f điểm.",
                        f.bestBucket(), f.bestScore(), f.worstBucket(), f.worstScore(), gap),
                f.sampleSize() + " phiên",
                confidence(f.sampleSize()),
                false));
    }

    // ==================================================================
    // Khung giờ
    // ==================================================================

    private record DayPart(String key, String label, int fromHour, int toHour) {
    }

    private static final List<DayPart> DAY_PARTS = List.of(
            new DayPart("morning", "buổi sáng", 5, 11),
            new DayPart("afternoon", "buổi chiều", 12, 17),
            new DayPart("evening", "buổi tối", 18, 22),
            new DayPart("night", "đêm khuya", 23, 4));

    static DayPart dayPartOf(int hour) {
        for (DayPart part : DAY_PARTS) {
            if (part.fromHour() <= part.toHour()) {
                if (hour >= part.fromHour() && hour <= part.toHour()) {
                    return part;
                }
            } else if (hour >= part.fromHour() || hour <= part.toHour()) {
                return part;   // khung vắt qua nửa đêm
            }
        }
        return DAY_PARTS.get(0);
    }

    private void addTimeOfDayDiscoveries(List<SessionPoint> points, ZoneId zone, List<Discovery> out) {
        if (points.size() < MIN_FOR_TIME_OF_DAY) {
            return;
        }

        Map<String, double[]> byPart = new LinkedHashMap<>();   // key -> [tổng điểm, số phiên, số phiên bị xao nhãng]
        for (SessionPoint p : points) {
            Instant at = p.startedAt();
            if (at == null) {
                continue;
            }
            DayPart part = dayPartOf(at.atZone(zone).getHour());
            double[] acc = byPart.computeIfAbsent(part.key(), k -> new double[3]);
            acc[0] += p.focusScore();
            acc[1] += 1;
            if (p.hasRealDistraction()) {
                acc[2] += 1;
            }
        }
        if (byPart.size() < 2) {
            return;
        }

        var best = byPart.entrySet().stream()
                .max(Comparator.comparingDouble(e -> e.getValue()[0] / e.getValue()[1])).orElseThrow();
        var worst = byPart.entrySet().stream()
                .min(Comparator.comparingDouble(e -> e.getValue()[0] / e.getValue()[1])).orElseThrow();
        double bestScore = best.getValue()[0] / best.getValue()[1];
        double worstScore = worst.getValue()[0] / worst.getValue()[1];

        if (bestScore - worstScore >= MEANINGFUL_GAP) {
            out.add(new Discovery(
                    "golden_hour:" + best.getKey(),
                    "🌟",
                    "Khung giờ vàng",
                    String.format("Học %s bạn đạt %.0f điểm, còn %s chỉ %.0f. Ưu tiên xếp việc khó vào %s.",
                            labelOf(best.getKey()), bestScore, labelOf(worst.getKey()), worstScore,
                            labelOf(best.getKey())),
                    points.size() + " phiên",
                    confidence(points.size()),
                    false));
        }

        // Khung giờ dễ bị phân tâm — trả lời trực tiếp câu hỏi "giờ này có bị phân tâm hơn không"
        var mostDistracted = byPart.entrySet().stream()
                .filter(e -> e.getValue()[1] >= 2)
                .max(Comparator.comparingDouble(e -> e.getValue()[2] / e.getValue()[1]))
                .orElse(null);
        if (mostDistracted != null) {
            double rate = mostDistracted.getValue()[2] / mostDistracted.getValue()[1];
            if (rate >= 0.6) {
                out.add(new Discovery(
                        "distraction_hour:" + mostDistracted.getKey(),
                        "🔔",
                        "Giờ dễ mất tập trung",
                        String.format("%d%% số phiên %s của bạn bị xao nhãng — cao nhất trong ngày.",
                                (int) Math.round(rate * 100), labelOf(mostDistracted.getKey())),
                        (int) mostDistracted.getValue()[1] + " phiên",
                        confidence(points.size()),
                        false));
            }
        }
    }

    private String labelOf(String dayPartKey) {
        return dayPartLabel(dayPartKey);
    }

    /**
     * Khoá buổi trong ngày của một giờ. Bản static package-private để
     * {@link FocusScorePredictor} và {@link NextSessionPlanner} gộp phiên theo đúng cùng
     * một cách chia buổi — hai nơi chia khác nhau thì dự đoán và phát hiện sẽ mâu thuẫn.
     */
    static String dayPartKey(int hour) {
        return dayPartOf(hour).key();
    }

    /** Nhãn tiếng Việt của một buổi ("buổi tối", "đêm khuya"...). */
    static String dayPartLabel(String dayPartKey) {
        return DAY_PARTS.stream().filter(p -> p.key().equals(dayPartKey))
                .findFirst().map(DayPart::label).orElse(dayPartKey);
    }

    /** Giờ đại diện của một buổi — dùng khi cần gợi ý "hãy học lúc mấy giờ". */
    static int representativeHour(String dayPartKey) {
        return DAY_PARTS.stream().filter(p -> p.key().equals(dayPartKey)).findFirst()
                .map(p -> p.fromHour() <= p.toHour()
                        ? (p.fromHour() + p.toHour()) / 2
                        : p.fromHour())
                .orElse(20);
    }

    // ==================================================================
    // Năng lượng
    // ==================================================================

    /**
     * @return số phút mà sau đó năng lượng thường tụt, null khi chưa đủ dữ liệu
     */
    private Integer addEnergyDiscoveries(List<SessionPoint> points, List<Discovery> out) {
        List<SessionPoint> withEnergy = points.stream()
                .filter(p -> p.energyLevel() != null).toList();
        if (withEnergy.size() < MIN_FOR_ENERGY) {
            return null;
        }

        // Năng lượng cao có thật sự đi kèm điểm cao không?
        double highEnergyScore = withEnergy.stream().filter(p -> p.energyLevel() >= 4)
                .mapToDouble(SessionPoint::focusScore).average().orElse(Double.NaN);
        double lowEnergyScore = withEnergy.stream().filter(p -> p.energyLevel() <= 2)
                .mapToDouble(SessionPoint::focusScore).average().orElse(Double.NaN);
        if (!Double.isNaN(highEnergyScore) && !Double.isNaN(lowEnergyScore)
                && highEnergyScore - lowEnergyScore >= MEANINGFUL_GAP) {
            out.add(new Discovery(
                    "energy_matters",
                    "⚡",
                    "Năng lượng quyết định điểm",
                    String.format("Khi vào phiên còn nhiều năng lượng bạn đạt %.0f điểm, lúc cạn pin chỉ %.0f. "
                                    + "Nghỉ đủ trước khi học đáng giá hơn học cố.",
                            highEnergyScore, lowEnergyScore),
                    withEnergy.size() + " phiên",
                    confidence(withEnergy.size()),
                    false));
        }

        // Ngưỡng cạn kiệt: độ dài ngắn nhất mà từ đó năng lượng thường xuống <= 2
        List<SessionPoint> drained = withEnergy.stream()
                .filter(p -> p.energyLevel() <= 2 && p.durationMinutes() > 0)
                .sorted(Comparator.comparingDouble(SessionPoint::durationMinutes))
                .toList();
        if (drained.size() < 2) {
            return null;
        }
        int threshold = clampMinutes((int) Math.round(
                drained.stream().mapToDouble(SessionPoint::durationMinutes).average().orElse(0) / 5.0) * 5);

        out.add(new Discovery(
                "energy_drop",
                "🔋",
                "Ngưỡng cạn năng lượng",
                String.format("Từ khoảng %d phút trở đi bạn thường báo cạn năng lượng. "
                        + "Chèn nghỉ trước mốc này thay vì sau.", threshold),
                drained.size() + " phiên cạn pin",
                confidence(withEnergy.size()),
                false));
        return threshold;
    }

    // ==================================================================
    // Theo môn học — phần khác biệt so với mọi app Pomodoro khác
    // ==================================================================

    private List<FocusProfileResponse.SubjectGoldenHour> analyzeSubjectHours(List<SessionPoint> points,
                                                                             ZoneId zone) {
        Map<String, List<SessionPoint>> bySubject = new LinkedHashMap<>();
        for (SessionPoint p : points) {
            String subject = p.normalizedSubject();
            if (subject == null || p.startedAt() == null) {
                continue;
            }
            bySubject.computeIfAbsent(subject, s -> new ArrayList<>()).add(p);
        }

        List<FocusProfileResponse.SubjectGoldenHour> result = new ArrayList<>();
        for (var entry : bySubject.entrySet()) {
            List<SessionPoint> subjectPoints = entry.getValue();
            if (subjectPoints.size() < MIN_PER_SUBJECT_HOUR) {
                continue;
            }
            Map<Integer, double[]> byHour = new HashMap<>();
            for (SessionPoint p : subjectPoints) {
                int hour = p.startedAt().atZone(zone).getHour();
                double[] acc = byHour.computeIfAbsent(hour, h -> new double[2]);
                acc[0] += p.focusScore();
                acc[1] += 1;
            }
            var best = byHour.entrySet().stream()
                    .max(Comparator.comparingDouble(e -> e.getValue()[0] / e.getValue()[1])).orElseThrow();
            var worst = byHour.entrySet().stream()
                    .min(Comparator.comparingDouble(e -> e.getValue()[0] / e.getValue()[1])).orElseThrow();

            boolean hasContrast = !best.getKey().equals(worst.getKey());
            result.add(new FocusProfileResponse.SubjectGoldenHour(
                    entry.getKey(),
                    best.getKey(),
                    round1(best.getValue()[0] / best.getValue()[1]),
                    hasContrast ? worst.getKey() : null,
                    hasContrast ? round1(worst.getValue()[0] / worst.getValue()[1]) : null,
                    subjectPoints.size()));
        }
        result.sort(Comparator.comparingInt(FocusProfileResponse.SubjectGoldenHour::sampleSize).reversed());
        return result;
    }

    /**
     * Lưới môn x buổi cho bản đồ giờ vàng. Chỉ sinh ô có phiên thật — ô trống phải trống,
     * vẽ nó thành 0 điểm là nói dối rằng user học môn đó vào buổi đó và học tệ.
     */
    private List<FocusProfileResponse.SubjectHeatCell> buildHeatmap(List<SessionPoint> points,
                                                                    ZoneId zone) {
        // LinkedHashMap để thứ tự môn theo lần xuất hiện đầu, không nhảy loạn giữa các lần gọi
        Map<String, Map<String, double[]>> grid = new LinkedHashMap<>();
        for (SessionPoint p : points) {
            String subject = p.normalizedSubject();
            if (subject == null || p.startedAt() == null) {
                continue;
            }
            String part = dayPartOf(p.startedAt().atZone(zone).getHour()).key();
            double[] acc = grid.computeIfAbsent(subject, sub -> new LinkedHashMap<>())
                    .computeIfAbsent(part, k -> new double[2]);
            acc[0] += p.focusScore();
            acc[1] += 1;
        }

        List<FocusProfileResponse.SubjectHeatCell> cells = new ArrayList<>();
        for (var subjectEntry : grid.entrySet()) {
            for (var partEntry : subjectEntry.getValue().entrySet()) {
                double[] acc = partEntry.getValue();
                cells.add(new FocusProfileResponse.SubjectHeatCell(
                        subjectEntry.getKey(),
                        partEntry.getKey(),
                        labelOf(partEntry.getKey()),
                        round1(acc[0] / acc[1]),
                        (int) acc[1]));
            }
        }
        return cells;
    }

    private void addSubjectDiscoveries(List<SessionPoint> points,
                                       List<FocusProfileResponse.SubjectGoldenHour> subjectHours,
                                       List<Discovery> out) {
        for (var s : subjectHours) {
            if (s.worstHour() == null || s.worstScore() == null) {
                continue;
            }
            double gap = s.bestScore() - s.worstScore();
            if (gap < MEANINGFUL_GAP) {
                continue;
            }
            out.add(new Discovery(
                    "subject_hour:" + s.subject().toLowerCase(Locale.ROOT),
                    "📚",
                    "Giờ vàng môn " + s.subject(),
                    String.format("Học %s lúc %02d:00 bạn đạt %.0f điểm, lúc %02d:00 chỉ %.0f — chênh %.0f điểm.",
                            s.subject(), s.bestHour(), s.bestScore(), s.worstHour(), s.worstScore(), gap),
                    s.sampleSize() + " phiên " + s.subject(),
                    confidence(s.sampleSize()),
                    false));
        }

        // Môn mạnh / môn đuối
        Map<String, double[]> bySubject = new LinkedHashMap<>();
        for (SessionPoint p : points) {
            String subject = p.normalizedSubject();
            if (subject == null) {
                continue;
            }
            double[] acc = bySubject.computeIfAbsent(subject, s -> new double[2]);
            acc[0] += p.focusScore();
            acc[1] += 1;
        }
        var eligible = bySubject.entrySet().stream()
                .filter(e -> e.getValue()[1] >= MIN_PER_SUBJECT_COMPARE)
                .toList();
        if (eligible.size() < 2) {
            return;
        }
        var strongest = eligible.stream()
                .max(Comparator.comparingDouble(e -> e.getValue()[0] / e.getValue()[1])).orElseThrow();
        var weakest = eligible.stream()
                .min(Comparator.comparingDouble(e -> e.getValue()[0] / e.getValue()[1])).orElseThrow();
        double strongScore = strongest.getValue()[0] / strongest.getValue()[1];
        double weakScore = weakest.getValue()[0] / weakest.getValue()[1];
        if (strongScore - weakScore < MEANINGFUL_GAP) {
            return;
        }

        out.add(new Discovery(
                "subject_strength",
                "🏆",
                "Môn bạn vào guồng nhanh nhất",
                String.format("%s trung bình %.0f điểm, cao hơn %s (%.0f điểm) %.0f điểm.",
                        strongest.getKey(), strongScore, weakest.getKey(), weakScore,
                        strongScore - weakScore),
                (int) (strongest.getValue()[1] + weakest.getValue()[1]) + " phiên",
                confidence((int) (strongest.getValue()[1] + weakest.getValue()[1])),
                false));

        out.add(new Discovery(
                "subject_struggle:" + weakest.getKey().toLowerCase(Locale.ROOT),
                "🧗",
                "Môn đang kéo bạn xuống",
                String.format("%s chỉ đạt %.0f điểm. Thử chia thành phiên ngắn hơn và xếp vào khung giờ tốt nhất của bạn.",
                        weakest.getKey(), weakScore),
                (int) weakest.getValue()[1] + " phiên " + weakest.getKey(),
                confidence((int) weakest.getValue()[1]),
                false));
    }

    /**
     * "Môn bạn gắn bó nhất" — xấp xỉ của sở thích môn học.
     *
     * Không có nút "tôi thích môn này", nên phải suy ra từ hành vi: môn user tự chọn học
     * nhiều nhất VÀ hoàn thành mục tiêu tốt nhất. Cố ý không gọi thẳng là "môn yêu thích":
     * dữ liệu chỉ đủ nói user gắn bó với nó, chưa đủ nói họ thích nó.
     */
    private void addSubjectAffinityDiscovery(List<SessionPoint> points, List<Discovery> out) {
        Map<String, double[]> bySubject = new LinkedHashMap<>();  // [số phiên, tổng completion, tổng phút]
        int totalTagged = 0;
        for (SessionPoint p : points) {
            String subject = p.normalizedSubject();
            if (subject == null) {
                continue;
            }
            double[] acc = bySubject.computeIfAbsent(subject, s -> new double[3]);
            acc[0] += 1;
            acc[1] += p.completionPercent();
            acc[2] += p.durationMinutes();
            totalTagged++;
        }
        if (bySubject.size() < 2 || totalTagged < MIN_FOR_DURATION) {
            return;   // một môn duy nhất thì "gắn bó nhất" là câu nói thừa
        }

        final int tagged = totalTagged;
        var top = bySubject.entrySet().stream()
                // Tần suất quay lại nhân với tỉ lệ hoàn thành: học nhiều mà bỏ dở không tính là gắn bó
                .max(Comparator.comparingDouble(e ->
                        (e.getValue()[0] / tagged) * (e.getValue()[1] / e.getValue()[0] / 100.0)))
                .orElse(null);
        if (top == null) {
            return;
        }
        int sessions = (int) top.getValue()[0];
        int share = (int) Math.round(sessions * 100.0 / tagged);
        int avgCompletion = (int) Math.round(top.getValue()[1] / sessions);
        int totalMinutes = (int) Math.round(top.getValue()[2]);

        out.add(new Discovery(
                "subject_affinity:" + top.getKey().toLowerCase(Locale.ROOT),
                "❤️",
                "Môn bạn gắn bó nhất",
                String.format("%s chiếm %d%% số phiên (%d phiên, %d phút) và bạn hoàn thành trung bình %d%% mục tiêu.",
                        top.getKey(), share, sessions, totalMinutes, avgCompletion),
                tagged + " phiên có gắn môn",
                confidence(sessions),
                false));
    }

    /**
     * Thói quen theo khung giờ: vào giờ này bạn thường học môn gì.
     *
     * Trả lời câu hỏi ngược với "giờ vàng theo môn": thay vì "học Toán lúc nào tốt nhất",
     * đây là "cứ 20h là bạn mở Toán" — dùng để nhắc đúng lúc và đề xuất lịch.
     */
    private void addRoutineDiscovery(List<SessionPoint> points, ZoneId zone, List<Discovery> out) {
        if (points.size() < MIN_FOR_TIME_OF_DAY) {
            return;
        }
        Map<String, Integer> byPartSubject = new HashMap<>();
        Map<String, Integer> byPart = new HashMap<>();
        for (SessionPoint p : points) {
            String subject = p.normalizedSubject();
            if (subject == null || p.startedAt() == null) {
                continue;
            }
            String part = dayPartOf(p.startedAt().atZone(zone).getHour()).key();
            byPart.merge(part, 1, Integer::sum);
            byPartSubject.merge(part + "|" + subject, 1, Integer::sum);
        }
        var top = byPartSubject.entrySet().stream().max(Map.Entry.comparingByValue()).orElse(null);
        if (top == null) {
            return;
        }
        // Tách bằng indexOf thay vì split(): tên môn do user tự nhập nên có thể chứa ký tự
        // đặc biệt của regex, và dấu '|' chỉ là ký tự nối khoá nội bộ.
        int separator = top.getKey().indexOf('|');
        String dayPartKey = top.getKey().substring(0, separator);
        String topSubject = top.getKey().substring(separator + 1);

        int inThatPart = byPart.getOrDefault(dayPartKey, 0);
        if (inThatPart < 3) {
            return;
        }
        int share = (int) Math.round(top.getValue() * 100.0 / inThatPart);
        if (share < 70) {
            return;   // chưa thành thói quen thì đừng gọi là thói quen
        }

        out.add(new Discovery(
                "routine:" + dayPartKey,
                "🔁",
                "Thói quen của bạn",
                String.format("%d%% số phiên %s của bạn là môn %s. Đây đã thành nếp — hãy đặt lịch cố định cho nó.",
                        share, labelOf(dayPartKey), topSubject),
                inThatPart + " phiên " + labelOf(dayPartKey),
                confidence(inThatPart),
                false));
    }

    // ==================================================================
    // Tính kiên trì — nỗi đau "ngày đực ngày cái"
    // ==================================================================

    private FocusProfileResponse.ConsistencyStatus analyzeConsistency(List<SessionPoint> points, ZoneId zone) {
        TreeSet<LocalDate> days = new TreeSet<>();
        for (SessionPoint p : points) {
            Instant at = p.startedAt();
            if (at != null) {
                days.add(at.atZone(zone).toLocalDate());
            }
        }
        if (days.isEmpty()) {
            return new FocusProfileResponse.ConsistencyStatus(0, 0, 0, null, false,
                    "Chưa đủ dữ liệu để đánh giá nhịp học.");
        }

        LocalDate today = LocalDate.now(zone);
        LocalDate last = days.last();
        int daysSince = (int) Math.max(0, Duration.between(last.atStartOfDay(), today.atStartOfDay()).toDays());

        int current = 0;
        LocalDate cursor = days.contains(today) ? today
                : days.contains(today.minusDays(1)) ? today.minusDays(1) : null;
        while (cursor != null && days.contains(cursor)) {
            current++;
            cursor = cursor.minusDays(1);
        }

        int best = 1;
        int running = 1;
        LocalDate prev = null;
        for (LocalDate d : days) {
            if (prev != null) {
                running = d.equals(prev.plusDays(1)) ? running + 1 : 1;
            }
            best = Math.max(best, running);
            prev = d;
        }

        Double averageGap = null;
        boolean atRisk = false;
        if (days.size() >= MIN_FOR_CONSISTENCY) {
            List<LocalDate> ordered = new ArrayList<>(days);
            long totalGap = 0;
            for (int i = 1; i < ordered.size(); i++) {
                totalGap += Duration.between(ordered.get(i - 1).atStartOfDay(),
                        ordered.get(i).atStartOfDay()).toDays();
            }
            averageGap = round1(totalGap / (double) (ordered.size() - 1));
            // Đang thưa hơn chính nhịp bình thường của user → cảnh báo trước khi họ bỏ hẳn
            atRisk = daysSince > Math.max(2, averageGap * 1.5);
        }

        return new FocusProfileResponse.ConsistencyStatus(
                current, best, daysSince, averageGap, atRisk,
                consistencyMessage(current, best, daysSince, atRisk));
    }

    private String consistencyMessage(int current, int best, int daysSince, boolean atRisk) {
        if (atRisk) {
            return String.format("Bạn đã nghỉ %d ngày — dài hơn nhịp thường ngày của bạn. "
                    + "Một phiên 15 phút hôm nay đủ để nối lại mạch.", daysSince);
        }
        if (current >= 2) {
            return String.format("Chuỗi %d ngày liên tiếp%s. Học hôm nay để giữ mạch.",
                    current, current >= best ? " — dài nhất từ trước tới nay" : "");
        }
        if (daysSince == 0) {
            return "Bạn đã học hôm nay. Quay lại ngày mai để bắt đầu chuỗi.";
        }
        return "Học một phiên hôm nay để bắt đầu chuỗi ngày liên tiếp.";
    }

    private void addConsistencyDiscovery(FocusProfileResponse.ConsistencyStatus c, List<Discovery> out) {
        if (c.atRisk()) {
            out.add(new Discovery(
                    "consistency_risk",
                    "⚠️",
                    "Nhịp học đang thưa dần",
                    c.message(),
                    "nhịp trung bình " + c.averageGapDays() + " ngày",
                    75,
                    false));
        } else if (c.currentStreakDays() >= 2) {
            out.add(new Discovery(
                    "streak:" + c.currentStreakDays(),
                    "🔥",
                    "Chuỗi " + c.currentStreakDays() + " ngày",
                    c.message(),
                    "kỷ lục " + c.bestStreakDays() + " ngày",
                    100,
                    false));
        }
    }

    // ==================================================================

    private FocusProfileResponse emptyProfile() {
        return new FocusProfileResponse(
                0, 0, tierName(0), UNLOCK_LADDER.get(0).name(), UNLOCK_LADDER.get(0).sessions(),
                null, null, List.of(), List.of(), List.of(), null, null,
                new FocusProfileResponse.ConsistencyStatus(0, 0, 0, null, false,
                        "Hoàn thành phiên đầu tiên để AI bắt đầu dựng hồ sơ tập trung của bạn."),
                Instant.now());
    }

    private Unlock nextUnlock(int sessions) {
        return UNLOCK_LADDER.stream().filter(u -> u.sessions() > sessions).findFirst().orElse(null);
    }

    private int tierOf(int n) {
        if (n < 3) return 0;
        if (n < 5) return 1;
        if (n < 10) return 2;
        return 3;
    }

    private String tierName(int n) {
        return switch (tierOf(n)) {
            case 0 -> "Đang khởi động";
            case 1 -> "Đang dò quy luật";
            case 2 -> "Đã thấy quy luật";
            default -> "Hồ sơ đầy đủ";
        };
    }

    /** Mẫu càng lớn càng tự tin, nhưng không bao giờ tuyệt đối. */
    private int confidence(int sampleSize) {
        return Math.min(95, 40 + sampleSize * 6);
    }

    private int clampMinutes(int minutes) {
        return Math.max(MIN_SUGGESTED_MINUTES, Math.min(MAX_SUGGESTED_MINUTES, minutes));
    }

    private double round1(double value) {
        return Math.round(value * 10.0) / 10.0;
    }

    private String capitalize(String s) {
        return s == null || s.isEmpty() ? s : Character.toUpperCase(s.charAt(0)) + s.substring(1);
    }
}
