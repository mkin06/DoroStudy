package org.devnqminh.studyfocus.service.ai;

import lombok.RequiredArgsConstructor;
import org.devnqminh.studyfocus.config.ai.AiQuotaProperties;
import org.devnqminh.studyfocus.dto.response.Discovery;
import org.devnqminh.studyfocus.dto.response.FocusProfileResponse;
import org.devnqminh.studyfocus.model.AiReflection;
import org.devnqminh.studyfocus.model.StudyTime;
import org.devnqminh.studyfocus.repository.AiReflectionRepository;
import org.devnqminh.studyfocus.service.ai.FocusInsightEngine.SessionPoint;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/**
 * Nạp lịch sử reflection và giao cho {@link FocusInsightEngine} phân tích.
 *
 * Cố ý chạy đồng bộ ngay trong request thay vì làm job async như bản trước: phân tích là
 * thao tác trong bộ nhớ trên tối đa {@link #MAX_HISTORY} bản ghi (dưới một mili giây), còn
 * giá trị của nó nằm ở chỗ user thấy phát hiện mới NGAY khi đóng popup. Đẩy sang job nền
 * chỉ để rồi bắt user F5 xem kết quả là đánh mất đúng khoảnh khắc họ đang chú ý nhất.
 */
@Service
@RequiredArgsConstructor
public class FocusProfileService {

    /**
     * Cửa sổ phân tích. Đủ dài để thấy quy luật theo môn và theo giờ, đủ ngắn để thói quen
     * cũ từ nhiều tháng trước không làm nhiễu bức tranh hiện tại.
     */
    private static final int MAX_HISTORY = 60;

    private final AiReflectionRepository aiReflectionRepository;
    private final FocusInsightEngine engine;
    private final AiQuotaProperties quotaProperties;

    @Value("${ai.insights.zone:Asia/Ho_Chi_Minh}")
    private String zoneId;

    @Transactional(readOnly = true)
    public FocusProfileResponse getProfile(Long userId) {
        return getProfile(userId, quotaProperties.getDefaultPlan());
    }

    /**
     * Hồ sơ áp giới hạn của gói cước. Phần cốt lõi (điểm, chuỗi ngày, độ dài tối ưu,
     * ngưỡng năng lượng, cảnh báo tụt nhịp) KHÔNG bị giới hạn ở gói nào — nó chạy cục bộ,
     * không tốn chi phí, và là lý do user quay lại. Chỉ chiều sâu theo môn và độ dài cửa sổ
     * lịch sử là phần bán được.
     */
    @Transactional(readOnly = true)
    public FocusProfileResponse getProfile(Long userId, String planCode) {
        AiQuotaProperties.PlanLimits limits = quotaProperties.limitsFor(planCode);
        return applyPlanLimits(
                engine.analyze(loadPoints(userId, limits.getHistoryDays()), zone()), limits);
    }

    /** Phát hiện vừa mở khoá đúng ở phiên gần nhất. */
    @Transactional(readOnly = true)
    public List<Discovery> newDiscoveries(Long userId) {
        return engine.newDiscoveries(loadPoints(userId, -1), zone());
    }

    /**
     * Lịch sử + hồ sơ trong một lần đọc DB — dùng khi vừa lưu reflection xong và cần cả
     * phần thưởng tức thì lẫn tiến độ mở khoá.
     */
    @Transactional(readOnly = true)
    public ProfileSnapshot snapshot(Long userId) {
        List<SessionPoint> points = loadPoints(userId, -1);
        ZoneId zone = zone();
        return new ProfileSnapshot(points, engine.analyze(points, zone),
                engine.newDiscoveries(points, zone), zone);
    }

    public record ProfileSnapshot(
            List<SessionPoint> points,
            FocusProfileResponse profile,
            List<Discovery> newDiscoveries,
            ZoneId zone
    ) {
    }

    /**
     * Nguyên liệu để lập kế hoạch cho phiên kế tiếp: lịch sử thô (cho mô hình dự đoán) và
     * hồ sơ đã áp giới hạn gói cước (cho phần phát hiện).
     *
     * Tách khỏi {@link #snapshot(Long)} vì kế hoạch không cần biết phát hiện nào VỪA mở khoá
     * — tính thêm phần đó là chạy engine thừa hai lượt ở một endpoint được gọi mỗi lần mở app.
     */
    @Transactional(readOnly = true)
    public PlanningContext planningContext(Long userId, String planCode) {
        AiQuotaProperties.PlanLimits limits = quotaProperties.limitsFor(planCode);
        List<SessionPoint> points = loadPoints(userId, limits.getHistoryDays());
        ZoneId zone = zone();
        return new PlanningContext(points, applyPlanLimits(engine.analyze(points, zone), limits), zone);
    }

    public record PlanningContext(
            List<SessionPoint> points,
            FocusProfileResponse profile,
            ZoneId zone
    ) {
    }

    // ------------------------------------------------------------------

    /**
     * @param historyDays cửa sổ lịch sử theo ngày; âm = lấy hết trong giới hạn MAX_HISTORY
     */
    private List<SessionPoint> loadPoints(Long userId, int historyDays) {
        List<AiReflection> recent = aiReflectionRepository.findTop60ByUserIdOrderByIdDesc(userId);
        List<AiReflection> ordered = new ArrayList<>(recent);
        Collections.reverse(ordered);    // repository trả mới nhất trước, engine cần cũ → mới

        List<SessionPoint> points = ordered.stream().map(this::toPoint).toList();
        if (historyDays < 0) {
            return points;
        }
        Instant cutoff = Instant.now().minus(Duration.ofDays(historyDays));
        return points.stream()
                .filter(p -> p.startedAt() == null || p.startedAt().isAfter(cutoff))
                .toList();
    }

    /**
     * Cắt chiều sâu theo môn cho gói thấp. Giữ lại đúng những môn có nhiều phiên nhất
     * (subjectGoldenHours đã sắp theo sampleSize giảm dần), và cắt heatmap theo cùng bộ môn
     * đó để bản đồ không hiện hàng mà phần phát hiện lại không có.
     */
    private FocusProfileResponse applyPlanLimits(FocusProfileResponse profile,
                                                 AiQuotaProperties.PlanLimits limits) {
        int max = limits.getSubjectInsightLimit();
        if (max < 0 || profile.subjectGoldenHours().size() <= max) {
            return profile;
        }

        List<FocusProfileResponse.SubjectGoldenHour> kept =
                profile.subjectGoldenHours().subList(0, max);
        Set<String> keptSubjects = new LinkedHashSet<>();
        kept.forEach(s -> keptSubjects.add(s.subject()));

        List<FocusProfileResponse.SubjectHeatCell> keptCells = profile.heatmap().stream()
                .filter(c -> keptSubjects.contains(c.subject()))
                .toList();

        List<Discovery> keptDiscoveries = profile.discoveries().stream()
                .filter(d -> !d.id().startsWith("subject_hour:")
                        || keptSubjects.stream().anyMatch(sub ->
                        d.id().equals("subject_hour:" + sub.toLowerCase(java.util.Locale.ROOT))))
                .toList();

        return new FocusProfileResponse(
                profile.totalSessions(), profile.tier(), profile.tierName(),
                profile.nextUnlockName(), profile.sessionsToNextUnlock(),
                profile.averageFocusScore(), profile.bestFocusScore(),
                keptDiscoveries, kept, keptCells,
                profile.suggestedDurationMinutes(), profile.energyDropAfterMinutes(),
                profile.consistency(), profile.generatedAt());
    }

    private SessionPoint toPoint(AiReflection r) {
        StudyTime session = r.getSession();
        return new SessionPoint(
                session.getId(),
                session.getSubject(),
                session.getDuration() == null ? 0 : session.getDuration(),
                session.getStartTime() != null ? session.getStartTime() : session.getCreatedAt(),
                r.getCompletionPercent() == null ? 0 : r.getCompletionPercent(),
                r.getFocusLevel() == null ? 3 : r.getFocusLevel(),
                r.getEnergyLevel(),
                r.getDistractionReasons() == null ? List.of() : r.getDistractionReasons(),
                scoreOf(r));
    }

    /**
     * focus_score do AI chấm; reflection cũ lưu trước khi có fallback có thể thiếu, khi đó
     * tính lại tại chỗ để phiên đó không bị loại khỏi thống kê.
     */
    private double scoreOf(AiReflection r) {
        if (r.getFocusScore() != null) {
            return r.getFocusScore();
        }
        int completion = r.getCompletionPercent() == null ? 0 : r.getCompletionPercent();
        int focus = r.getFocusLevel() == null ? 3 : r.getFocusLevel();
        return Math.max(0, Math.min(100, completion * 0.5 + focus * 20 * 0.5));
    }

    private ZoneId zone() {
        try {
            return ZoneId.of(zoneId);
        } catch (Exception e) {
            return ZoneId.systemDefault();
        }
    }
}
