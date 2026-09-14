package org.devnqminh.studyfocus.service.Impl;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.devnqminh.studyfocus.client.AiCallResult;
import org.devnqminh.studyfocus.client.AiServiceClient;
import org.devnqminh.studyfocus.config.ai.AiQuotaProperties;
import org.devnqminh.studyfocus.dto.ai.AiAnalyzeRequest;
import org.devnqminh.studyfocus.dto.ai.AiAnalyzeResponse;
import org.devnqminh.studyfocus.dto.request.ReflectionRequest;
import org.devnqminh.studyfocus.dto.response.Discovery;
import org.devnqminh.studyfocus.dto.response.FocusProfileResponse;
import org.devnqminh.studyfocus.dto.response.NextSessionPlan;
import org.devnqminh.studyfocus.dto.response.NoteInsight;
import org.devnqminh.studyfocus.dto.response.ReflectionResponse;
import org.devnqminh.studyfocus.exception.AiQuotaExceededException;
import org.devnqminh.studyfocus.model.AiCallLog;
import org.devnqminh.studyfocus.model.AiReflection;
import org.devnqminh.studyfocus.model.Note;
import org.devnqminh.studyfocus.model.StudyTime;
import org.devnqminh.studyfocus.repository.AiReflectionRepository;
import org.devnqminh.studyfocus.repository.NoteRepository;
import org.devnqminh.studyfocus.repository.StudyTimeRepository;
import org.devnqminh.studyfocus.repository.UserRepository;
import org.devnqminh.studyfocus.service.IAiReflectionService;
import org.devnqminh.studyfocus.service.ai.AiCallLogger;
import org.devnqminh.studyfocus.service.ai.AiRateLimiter;
import org.devnqminh.studyfocus.service.ai.FocusInsightEngine.SessionPoint;
import org.devnqminh.studyfocus.service.ai.FocusProfileService;
import org.devnqminh.studyfocus.service.ai.FocusScorePredictor;
import org.devnqminh.studyfocus.service.ai.NextSessionPlanner;
import org.devnqminh.studyfocus.service.ai.NoteAnalyzer;
import org.devnqminh.studyfocus.service.ai.ReflectionFallback;
import org.devnqminh.studyfocus.service.ai.ReflectionWriter;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.util.List;
import java.util.Optional;

/**
 * Luồng reflection sau mỗi phiên Pomodoro.
 *
 * Thứ tự cố ý:
 *   1. Đọc & kiểm tra phiên (transaction ngắn)
 *   2. Trừ quota AI trên Redis  — chặn trước khi tốn tiền, không phải sau
 *   3. Gọi ai-service NGOÀI transaction — network I/O không được giữ connection MySQL
 *   4. Lưu reflection + ghi log COGS
 *   5. Tính hồ sơ tập trung và đính kèm phần thưởng tức thì vào chính response này
 *
 * Bước 5 chạy đồng bộ và không tốn COGS (thuần tính toán), nên user thấy delta điểm,
 * kỷ lục mới và phát hiện vừa mở khoá ngay lúc đóng popup.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class AiReflectionServiceImpl implements IAiReflectionService {

    private static final String OPERATION = "REFLECTION";

    /** Số phiên lịch sử gửi kèm làm context cho AI. Càng nhiều càng tốn token. */
    private static final int HISTORY_SIZE = 7;

    /**
     * Ghi chú viết ngay sau khi chuông reo vẫn thuộc về phiên vừa xong — người ta hay gõ nốt
     * ý đang dở trong lúc màn hình nghỉ vừa hiện ra.
     */
    private static final Duration NOTE_GRACE = Duration.ofMinutes(10);

    /**
     * Số ký tự ghi chú gửi kèm cho Gemini. Cắt ngắn vì hai lý do, và lý do thứ hai quan
     * trọng hơn: token phải trả tiền, và ghi chú là thứ riêng tư nhất user có trong app —
     * gửi đi càng ít càng tốt, chỉ vừa đủ để feedback nhắc đúng nội dung họ đang học.
     */
    private static final int NOTE_EXCERPT_LIMIT = 600;

    private final AiReflectionRepository aiReflectionRepository;
    private final NoteRepository noteRepository;
    private final StudyTimeRepository studyTimeRepository;
    private final UserRepository userRepository;
    private final AiServiceClient aiServiceClient;
    private final AiRateLimiter rateLimiter;
    private final AiCallLogger aiCallLogger;
    private final ReflectionFallback reflectionFallback;
    private final ReflectionWriter reflectionWriter;
    private final FocusProfileService focusProfileService;
    private final FocusScorePredictor focusScorePredictor;
    private final NextSessionPlanner nextSessionPlanner;
    private final NoteAnalyzer noteAnalyzer;
    private final AiQuotaProperties quotaProperties;

    private static final ZoneId LOCAL_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");

    @Override
    public ReflectionResponse createReflection(ReflectionRequest request, Long userId) {
        StudyTime session = loadOwnedSession(request.sessionId(), userId);

        if (aiReflectionRepository.existsBySessionId(session.getId())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Phiên này đã có reflection");
        }

        // Đọc ghi chú TRƯỚC khi rẽ nhánh quota: kết luận từ ghi chú tính cục bộ, không tốn
        // đồng nào, nên user hết lượt AI vẫn phải nhận được nó.
        List<Note> sessionNotes = notesWrittenDuring(session, userId);
        NoteInsight noteInsight = noteAnalyzer
                .analyze(sessionNotes, effectiveSubject(session, request))
                .orElse(null);

        String plan = resolvePlan(userId);
        AiRateLimiter.Decision decision = rateLimiter.tryConsume(userId, plan);

        if (!decision.allowed()) {
            // Hết quota: vẫn lưu câu trả lời của user kèm điểm tính cục bộ, chỉ bỏ lượt gọi AI.
            // Phần thưởng và phát hiện vẫn được tính đầy đủ vì chúng không cần Gemini —
            // user hết lượt AI vẫn nhận được giá trị, đó là điểm bán của gói Free.
            AiAnalyzeResponse fallback = reflectionFallback.build(
                    request.completionPercent(), request.focusLevel(),
                    request.energyLevel(), request.distractionReasons());

            ReflectionResponse saved = attachReward(reflectionWriter.persist(
                    session, userId, request, fallback, decision.unlimited() ? null : 0), userId)
                    .withNoteInsight(noteInsight)
                    .withNextPlan(planAfterSession(userId, session));

            aiCallLogger.record(userId, session.getId(), OPERATION,
                    AiCallLog.Outcome.RATE_LIMITED, null, null, 0L,
                    "Vượt quota " + decision.limit() + " lượt/ngày của gói " + plan);

            throw new AiQuotaExceededException(plan, decision.limit(), decision.used(), saved);
        }

        AiAnalyzeRequest aiRequest = buildAnalyzeRequest(
                session, request, buildHistory(userId), knownPatterns(userId),
                plannedNextSession(userId, session), sessionNotes, noteInsight);
        AiCallResult call = aiServiceClient.analyzeSession(aiRequest);

        AiAnalyzeResponse feedback;
        AiCallLog.Outcome outcome;
        if (call.isSuccess()) {
            feedback = call.response();
            outcome = "gemini".equals(feedback.source())
                    ? AiCallLog.Outcome.GEMINI
                    : AiCallLog.Outcome.FALLBACK_SERVICE;
        } else {
            feedback = reflectionFallback.build(
                    request.completionPercent(), request.focusLevel(),
                    request.energyLevel(), request.distractionReasons());
            outcome = AiCallLog.Outcome.FALLBACK_LOCAL;
        }

        Integer remaining = decision.unlimited() ? null : decision.remaining();
        ReflectionResponse saved = reflectionWriter.persist(session, userId, request, feedback, remaining);

        aiCallLogger.record(userId, session.getId(), OPERATION, outcome,
                aiRequest, feedback, call.latencyMs(), call.errorMessage());

        return attachReward(saved, userId)
                .withNoteInsight(noteInsight)
                .withNextPlan(planAfterSession(userId, session));
    }

    @Override
    public List<ReflectionResponse> getUserReflections(Long userId) {
        return aiReflectionRepository.findByUserIdOrderByIdDesc(userId).stream()
                .map(r -> toResponse(r, null))
                .toList();
    }

    @Override
    public ReflectionResponse getBySessionId(Long sessionId, Long userId) {
        AiReflection reflection = aiReflectionRepository.findBySessionId(sessionId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Reflection not found"));
        if (!reflection.getUser().getId().equals(userId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Reflection does not belong to this user");
        }
        return toResponse(reflection, null);
    }

    @Override
    public FocusProfileResponse getFocusProfile(Long userId) {
        return focusProfileService.getProfile(userId, resolvePlan(userId));
    }

    @Override
    public NextSessionPlan getNextSessionPlan(Long userId, String subjectHint) {
        FocusProfileService.PlanningContext ctx =
                focusProfileService.planningContext(userId, resolvePlan(userId));
        return nextSessionPlanner.plan(
                ctx.points(), ctx.profile(), ctx.zone(), Instant.now(), subjectHint);
    }

    // ------------------------------------------------------------------

    /**
     * Gắn phần thưởng tức thì: phiên thứ mấy, chênh so với phiên trước, có phá kỷ lục không,
     * chuỗi ngày, phát hiện vừa mở khoá, và còn bao nhiêu phiên nữa tới mốc kế tiếp.
     */
    private ReflectionResponse attachReward(ReflectionResponse saved, Long userId) {
        FocusProfileService.ProfileSnapshot snapshot = focusProfileService.snapshot(userId);
        List<SessionPoint> points = snapshot.points();
        FocusProfileResponse profile = snapshot.profile();

        int n = points.size();
        Double previous = null;
        Double delta = null;
        boolean personalBest = false;

        if (n >= 2) {
            SessionPoint latest = points.get(n - 1);
            previous = round1(points.get(n - 2).focusScore());
            delta = round1(latest.focusScore() - previous);
            double bestBefore = points.subList(0, n - 1).stream()
                    .mapToDouble(SessionPoint::focusScore).max().orElse(0);
            personalBest = latest.focusScore() > bestBefore;
        }

        List<Discovery> unlocked = snapshot.newDiscoveries();

        // AI đã đoán phiên này ra bao nhiêu điểm? Đoán lại bằng ĐÚNG dữ liệu có trước phiên
        // vừa xong, nên con số này là dự đoán thật chứ không phải giải thích sau khi biết
        // kết quả. Nhờ vậy không cần lưu dự đoán vào DB mà vẫn trung thực.
        Double predicted = null;
        Double predictionError = null;
        if (n >= 2) {
            SessionPoint latest = points.get(n - 1);
            List<SessionPoint> before = points.subList(0, n - 1);
            double p = focusScorePredictor.predict(
                    before, focusScorePredictor.contextOf(latest, snapshot.zone()), snapshot.zone()).score();
            predicted = round1(p);
            predictionError = round1(Math.abs(latest.focusScore() - p));
        }
        int accuracy = focusScorePredictor.backtest(points, snapshot.zone()).accuracyPercent();

        return saved.withReward(new ReflectionResponse.SessionReward(
                n,
                previous,
                delta,
                personalBest,
                profile.consistency() == null ? 0 : profile.consistency().currentStreakDays(),
                unlocked,
                profile.nextUnlockName(),
                profile.sessionsToNextUnlock(),
                predicted,
                predictionError,
                accuracy));
    }

    private StudyTime loadOwnedSession(Long sessionId, Long userId) {
        StudyTime session = studyTimeRepository.findById(sessionId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Session not found"));
        if (!session.getUser().getId().equals(userId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Session does not belong to this user");
        }
        return session;
    }

    /** Gói cước của user; chưa gắn subscription thì áp gói mặc định trong config. */
    private String resolvePlan(Long userId) {
        return userRepository.findPlanCodeByUserId(userId)
                .orElse(quotaProperties.getDefaultPlan());
    }

    private List<AiAnalyzeRequest.HistoryItem> buildHistory(Long userId) {
        return aiReflectionRepository.findTop7ByUserIdOrderByIdDesc(userId).stream()
                .limit(HISTORY_SIZE)
                .map(r -> new AiAnalyzeRequest.HistoryItem(
                        sessionDate(r.getSession()),
                        r.getSession().getSubject(),
                        r.getSession().getDuration(),
                        r.getFocusLevel(),
                        r.getCompletionPercent(),
                        r.getDistractionReasons()))
                .toList();
    }

    private String sessionDate(StudyTime session) {
        Instant reference = session.getStartTime() != null
                ? session.getStartTime()
                : session.getCreatedAt();
        return reference == null ? null : reference.atZone(LOCAL_ZONE).toLocalDate().toString();
    }

    /**
     * Quy luật đã xác minh, gửi kèm cho Gemini diễn giải. Giới hạn 3 cái hữu ích nhất:
     * mỗi dòng thêm vào là token phải trả tiền, và prompt dài không làm feedback hay hơn.
     */
    private List<String> knownPatterns(Long userId) {
        return focusProfileService.getProfile(userId).discoveries().stream()
                .filter(d -> d.confidence() >= 60)
                .limit(3)
                .map(d -> d.title() + ": " + d.detail())
                .toList();
    }

    /**
     * Kế hoạch cho phiên kế tiếp, rút gọn thành một dòng cho Gemini.
     *
     * Tính TRƯỚC khi reflection này được lưu, nên nó chưa gồm phiên vừa xong — chấp nhận
     * được: kế hoạch dựa trên hàng chục phiên, thêm hay bớt một phiên không đổi kết luận,
     * và đổi lại ta không phải chạy engine thêm một lượt nữa trên đường đi tốn tiền nhất.
     */
    private String plannedNextSession(Long userId, StudyTime session) {
        try {
            NextSessionPlan plan = getNextSessionPlan(userId, session.getSubject());
            StringBuilder sb = new StringBuilder();
            if (plan.subject() != null) {
                sb.append("môn ").append(plan.subject()).append(", ");
            }
            sb.append(plan.durationMinutes()).append(" phút");
            if (plan.betterWindowHour() != null) {
                sb.append(", nên học lúc ").append(String.format("%02d:00", plan.betterWindowHour()));
            }
            sb.append(String.format(" (dự đoán %.0f điểm)", plan.predictedFocusScore()));
            if (plan.guardrail() != null) {
                sb.append(". ").append(plan.guardrail());
            }
            return sb.toString();
        } catch (RuntimeException e) {
            // Kế hoạch chỉ là phần bổ trợ cho prompt; hỏng thì feedback vẫn phải chạy
            log.warn("Không dựng được kế hoạch phiên kế tiếp cho user {}: {}", userId, e.getMessage());
            return null;
        }
    }

    private AiAnalyzeRequest buildAnalyzeRequest(StudyTime session,
                                                 ReflectionRequest request,
                                                 List<AiAnalyzeRequest.HistoryItem> history,
                                                 List<String> knownPatterns,
                                                 String plannedNextSession,
                                                 List<Note> sessionNotes,
                                                 NoteInsight noteInsight) {
        // startTime được lưu ngay khi tạo phiên, không còn phải suy đoán lại ở đây
        Instant startedAt = session.getStartTime() != null
                ? session.getStartTime()
                : session.getCreatedAt();
        String startTime = startedAt == null
                ? null
                : startedAt.atZone(LOCAL_ZONE).toLocalDateTime().toString();

        AiAnalyzeRequest.CurrentSession current = new AiAnalyzeRequest.CurrentSession(
                effectiveSubject(session, request),
                session.getDuration(),
                session.getCount(),
                startTime,
                request.completionPercent(),
                request.focusLevel(),
                request.energyLevel(),
                request.distractionReasons() == null ? List.of() : request.distractionReasons());

        return new AiAnalyzeRequest(current, history, knownPatterns, plannedNextSession,
                noteExcerpt(sessionNotes), noteInsight == null ? null : noteInsight.message());
    }

    /**
     * Kế hoạch phiên kế tiếp, tính SAU khi reflection vừa rồi đã được lưu.
     *
     * Khác với {@link #plannedNextSession} (chạy trước, để nhét vào prompt): bản này phải
     * bao gồm cả phiên vừa xong, vì user sẽ nhìn nó ngay trên màn hình kết quả và bấm áp
     * dụng luôn. Một kế hoạch bỏ qua đúng phiên họ vừa học xong thì vô lý.
     */
    private NextSessionPlan planAfterSession(Long userId, StudyTime session) {
        try {
            return getNextSessionPlan(userId, session.getSubject());
        } catch (RuntimeException e) {
            log.warn("Không dựng được kế hoạch sau phiên {}: {}", session.getId(), e.getMessage());
            return null;
        }
    }

    /**
     * Ghi chú user chạm vào trong lúc phiên đang chạy.
     *
     * Dùng cửa sổ thời gian thay vì gắn note vào session bằng khoá ngoại: user mở NotesPanel
     * từ chính màn hình timer và không hề "chọn phiên" bao giờ, nên bắt họ khai thêm một
     * liên kết nữa là thêm một bước không ai làm.
     */
    private List<Note> notesWrittenDuring(StudyTime session, Long userId) {
        Instant start = session.getStartTime() != null ? session.getStartTime() : session.getCreatedAt();
        if (start == null) {
            return List.of();
        }
        double minutes = session.getDuration() == null ? 0 : session.getDuration();
        Instant end = start.plusSeconds(Math.round(minutes * 60)).plus(NOTE_GRACE);
        try {
            return noteRepository.findByUser_IdAndUpdatedAtBetween(userId, start, end);
        } catch (RuntimeException e) {
            // Ghi chú là phần bổ trợ; hỏng thì reflection vẫn phải lưu được
            log.warn("Không đọc được ghi chú của phiên {}: {}", session.getId(), e.getMessage());
            return List.of();
        }
    }

    /** Trích đoạn ghi chú gửi cho Gemini, đã cắt theo hạn mức ký tự. */
    private String noteExcerpt(List<Note> notes) {
        if (notes == null || notes.isEmpty()) {
            return null;
        }
        StringBuilder sb = new StringBuilder();
        for (Note note : notes) {
            if (note.getTitle() != null) {
                sb.append(note.getTitle()).append(": ");
            }
            if (note.getContent() != null) {
                sb.append(note.getContent());
            }
            sb.append(System.lineSeparator());
            if (sb.length() >= NOTE_EXCERPT_LIMIT) {
                break;
            }
        }
        String text = sb.toString().trim();
        if (text.isEmpty()) {
            return null;
        }
        return text.length() > NOTE_EXCERPT_LIMIT ? text.substring(0, NOTE_EXCERPT_LIMIT) + "…" : text;
    }

    /** Môn học của phiên; cho phép popup reflection tag ngược nếu lúc học chưa tag. */
    private String effectiveSubject(StudyTime session, ReflectionRequest request) {
        if (session.getSubject() != null && !session.getSubject().isBlank()) {
            return session.getSubject();
        }
        return request.subject() == null || request.subject().isBlank()
                ? null
                : request.subject().trim();
    }

    private ReflectionResponse toResponse(AiReflection r, Integer remaining) {
        return new ReflectionResponse(
                r.getId(),
                r.getSession().getId(),
                r.getCompletionPercent(),
                r.getFocusLevel(),
                r.getEnergyLevel(),
                r.getDistractionReasons(),
                r.getAiSummary(),
                r.getAiComparison(),
                r.getAiRecommendation(),
                r.getFocusScore(),
                "gemini".equals(r.getAiSource()),
                r.getAiSource(),
                remaining,
                null,
                null,
                null,
                r.getCreatedAt());
    }

    private double round1(double value) {
        return Math.round(value * 10.0) / 10.0;
    }
}
