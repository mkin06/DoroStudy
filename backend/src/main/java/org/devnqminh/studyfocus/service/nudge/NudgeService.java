package org.devnqminh.studyfocus.service.nudge;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.devnqminh.studyfocus.config.nudge.NudgeProperties;
import org.devnqminh.studyfocus.dto.request.PushSubscriptionRequest;
import org.devnqminh.studyfocus.dto.response.Nudge;
import org.devnqminh.studyfocus.model.PushSubscription;
import org.devnqminh.studyfocus.model.User;
import org.devnqminh.studyfocus.repository.PushSubscriptionRepository;
import org.devnqminh.studyfocus.repository.UserRepository;
import org.devnqminh.studyfocus.service.ai.FocusProfileService;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Điều phối việc nhắc chủ động: quyết định nội dung ({@link NudgeEngine}), quản lý đăng ký
 * trình duyệt, và chạy lượt quét đẩy thông báo.
 *
 * Hai kênh, cùng một nội dung:
 *
 *   - TRONG APP: {@link #currentNudge(Long)} — hiện mọi loại nhắc khi user tự mở app.
 *   - ĐẨY RA NGOÀI: {@link #sendDueNudges()} — chỉ những lời nhắc vượt ngưỡng khẩn cấp.
 *
 * Chia như vậy vì hai kênh có cái giá rất khác nhau: một banner trong app user liếc qua rồi
 * bỏ qua, còn một thông báo đẩy sai lúc thì họ tắt vĩnh viễn quyền thông báo — và ta mất
 * kênh đó với người đó mãi mãi.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class NudgeService {

    private final NudgeEngine nudgeEngine;
    private final FocusProfileService focusProfileService;
    private final PushSubscriptionRepository pushSubscriptionRepository;
    private final UserRepository userRepository;
    private final WebPushSender webPushSender;
    private final NudgeProperties properties;

    /** Lời nhắc đáng nói nhất cho user này lúc này, dùng cho banner trong app. */
    @Transactional(readOnly = true)
    public Optional<Nudge> currentNudge(Long userId) {
        // Dùng đúng gói cước của user để cửa sổ lịch sử khớp với hồ sơ họ nhìn thấy trong app;
        // lời nhắc dựa trên một tập dữ liệu khác với Focus DNA sẽ mâu thuẫn với chính nó.
        String plan = userRepository.findPlanCodeByUserId(userId).orElse(null);
        FocusProfileService.PlanningContext ctx = focusProfileService.planningContext(userId, plan);
        return nudgeEngine.evaluate(ctx.points(), ctx.profile(), ctx.zone(), Instant.now());
    }

    // ------------------------------------------------------------------
    // Đăng ký trình duyệt
    // ------------------------------------------------------------------

    /**
     * Lưu (hoặc kích hoạt lại) đăng ký nhận thông báo của một trình duyệt.
     *
     * Cùng một endpoint có thể quay lại sau khi user tắt rồi bật lại, hoặc sau khi đổi tài
     * khoản trên cùng máy — nên ghi đè cả chủ sở hữu, không tạo bản ghi trùng.
     */
    @Transactional
    public void subscribe(Long userId, PushSubscriptionRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        PushSubscription subscription = pushSubscriptionRepository
                .findByEndpoint(request.endpoint())
                .orElseGet(() -> PushSubscription.builder().endpoint(request.endpoint()).build());

        subscription.setUser(user);
        subscription.setP256dh(request.p256dh());
        subscription.setAuth(request.auth());
        subscription.setActive(true);
        pushSubscriptionRepository.save(subscription);
    }

    @Transactional
    public void unsubscribe(Long userId, String endpoint) {
        pushSubscriptionRepository.findByEndpoint(endpoint)
                .filter(s -> s.getUser().getId().equals(userId))
                .ifPresent(pushSubscriptionRepository::delete);
    }

    @Transactional(readOnly = true)
    public boolean hasSubscription(Long userId) {
        return !pushSubscriptionRepository.findByUserIdAndActiveTrue(userId).isEmpty();
    }

    // ------------------------------------------------------------------
    // Lượt quét đẩy thông báo
    // ------------------------------------------------------------------

    /**
     * Quét toàn bộ user đã bật thông báo và đẩy cho những ai đang có lời nhắc đủ khẩn cấp.
     *
     * @return số user đã được đẩy trong lượt này
     */
    @Transactional
    public int sendDueNudges() {
        if (!properties.isEnabled()) {
            return 0;
        }
        ZoneId zone = zone();
        Instant now = Instant.now();
        int hour = now.atZone(zone).getHour();
        if (isQuietHour(hour)) {
            return 0;
        }

        // Gom theo user: một người có 3 thiết bị vẫn chỉ là một lời nhắc, và giới hạn
        // "một lần mỗi ngày" phải tính trên người chứ không phải trên từng trình duyệt.
        Map<Long, List<PushSubscription>> byUser = new LinkedHashMap<>();
        for (PushSubscription s : pushSubscriptionRepository.findAllActiveWithUser()) {
            byUser.computeIfAbsent(s.getUser().getId(), k -> new ArrayList<>()).add(s);
        }

        LocalDate today = now.atZone(zone).toLocalDate();
        int nudged = 0;

        for (var entry : byUser.entrySet()) {
            List<PushSubscription> subscriptions = entry.getValue();
            if (alreadyNudgedOn(subscriptions, zone, today)) {
                continue;
            }
            Optional<Nudge> nudge = safeEvaluate(entry.getKey());
            if (nudge.isEmpty() || nudge.get().urgency() < properties.getPushUrgencyThreshold()) {
                continue;
            }

            boolean deliveredToAny = false;
            for (PushSubscription subscription : subscriptions) {
                WebPushSender.Result result = webPushSender.send(subscription.getEndpoint());
                if (result == WebPushSender.Result.SENT) {
                    subscription.setLastNudgedAt(now);
                    subscription.setLastNudgeType(nudge.get().type());
                    deliveredToAny = true;
                } else if (result == WebPushSender.Result.GONE) {
                    subscription.setActive(false);
                }
            }
            if (deliveredToAny) {
                nudged++;
            }
        }

        if (nudged > 0) {
            log.info("Đã đẩy nhắc nhở cho {} user", nudged);
        }
        return nudged;
    }

    /**
     * Một user hỏng dữ liệu không được làm chết cả lượt quét của những người còn lại.
     */
    private Optional<Nudge> safeEvaluate(Long userId) {
        try {
            return currentNudge(userId);
        } catch (RuntimeException e) {
            log.warn("Không đánh giá được lời nhắc cho user {}: {}", userId, e.getMessage());
            return Optional.empty();
        }
    }

    private boolean alreadyNudgedOn(List<PushSubscription> subscriptions, ZoneId zone, LocalDate day) {
        return subscriptions.stream()
                .map(PushSubscription::getLastNudgedAt)
                .filter(java.util.Objects::nonNull)
                .anyMatch(at -> at.atZone(zone).toLocalDate().equals(day));
    }

    /** Khoảng im lặng có thể vắt qua nửa đêm (22h → 7h), nên không so sánh kiểu from < to. */
    private boolean isQuietHour(int hour) {
        int from = properties.getQuietHoursFrom();
        int to = properties.getQuietHoursTo();
        return from <= to ? (hour >= from && hour < to) : (hour >= from || hour < to);
    }

    private ZoneId zone() {
        try {
            return ZoneId.of(properties.getZone());
        } catch (Exception e) {
            return ZoneId.systemDefault();
        }
    }
}
