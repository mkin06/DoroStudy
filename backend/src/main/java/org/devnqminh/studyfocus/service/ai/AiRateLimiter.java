package org.devnqminh.studyfocus.service.ai;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.devnqminh.studyfocus.config.ai.AiQuotaProperties;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Đếm số lượt gọi AI theo user theo ngày để chặn vượt quota.
 *
 * Redis là nơi đếm chính (không đụng DB mỗi lần check). Nếu Redis không chạy —
 * môi trường dev thường không có — bộ đếm rơi về in-memory để app vẫn khởi động
 * và vẫn có rate limit, thay vì chết cả luồng reflection.
 *
 * Sau một lần Redis lỗi, ta ngừng gọi Redis trong {@link #REDIS_COOLDOWN} để mỗi
 * request không phải trả thêm thời gian chờ kết nối — ngân sách phản hồi chỉ có 4 giây.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class AiRateLimiter {

    private static final Duration REDIS_COOLDOWN = Duration.ofSeconds(60);
    private static final String KEY_PREFIX = "ai:quota:";

    private final StringRedisTemplate redisTemplate;
    private final AiQuotaProperties quotaProperties;

    /** Bộ đếm dự phòng khi Redis không khả dụng. Key giống hệt key Redis. */
    private final Map<String, AtomicLong> localCounters = new ConcurrentHashMap<>();

    private volatile long redisDownUntilEpochMs = 0L;

    public record Decision(boolean allowed, int used, int limit) {

        public boolean unlimited() {
            return limit < 0;
        }

        public int remaining() {
            return unlimited() ? Integer.MAX_VALUE : Math.max(0, limit - used);
        }
    }

    /**
     * Trừ một lượt gọi AI của user. Trả về allowed=false khi đã hết quota trong ngày.
     * Lượt bị từ chối không bị tính vào bộ đếm.
     */
    public Decision tryConsume(Long userId, String planCode) {
        int limit = quotaProperties.limitFor(planCode);
        if (limit < 0) {
            return new Decision(true, 0, limit);   // gói không giới hạn: khỏi đếm
        }

        String key = buildKey(userId);
        long used = increment(key);

        if (used > limit) {
            decrement(key);
            return new Decision(false, limit, limit);
        }
        return new Decision(true, (int) used, limit);
    }

    /** Số lượt đã dùng hôm nay, không trừ quota — dùng để hiển thị cho user. */
    public int usedToday(Long userId) {
        String key = buildKey(userId);
        if (redisUsable()) {
            try {
                String value = redisTemplate.opsForValue().get(key);
                return value == null ? 0 : Integer.parseInt(value);
            } catch (Exception e) {
                markRedisDown(e);
            }
        }
        AtomicLong counter = localCounters.get(key);
        return counter == null ? 0 : (int) counter.get();
    }

    // ------------------------------------------------------------------

    private String buildKey(Long userId) {
        ZoneId zone = zone();
        return KEY_PREFIX + userId + ":" + LocalDate.now(zone);
    }

    private ZoneId zone() {
        try {
            return ZoneId.of(quotaProperties.getZone());
        } catch (Exception e) {
            return ZoneId.systemDefault();
        }
    }

    private long increment(String key) {
        if (redisUsable()) {
            try {
                Long value = redisTemplate.opsForValue().increment(key);
                if (value != null) {
                    if (value == 1L) {
                        // key vừa được tạo → hẹn giờ xoá vào cuối ngày để quota tự reset
                        redisTemplate.expire(key, ttlUntilEndOfDay());
                    }
                    return value;
                }
            } catch (Exception e) {
                markRedisDown(e);
            }
        }
        return localIncrement(key);
    }

    private void decrement(String key) {
        if (redisUsable()) {
            try {
                redisTemplate.opsForValue().decrement(key);
                return;
            } catch (Exception e) {
                markRedisDown(e);
            }
        }
        AtomicLong counter = localCounters.get(key);
        if (counter != null) {
            counter.decrementAndGet();
        }
    }

    private long localIncrement(String key) {
        // Bộ đếm in-memory chỉ giữ key của hôm nay; key ngày cũ bị dọn ở đây.
        localCounters.keySet().removeIf(existing -> !existing.equals(key));
        return localCounters.computeIfAbsent(key, k -> new AtomicLong()).incrementAndGet();
    }

    private Duration ttlUntilEndOfDay() {
        ZoneId zone = zone();
        ZonedDateTime now = ZonedDateTime.now(zone);
        ZonedDateTime endOfDay = now.toLocalDate().plusDays(1).atStartOfDay(zone);
        return Duration.between(now, endOfDay).plusMinutes(1);
    }

    private boolean redisUsable() {
        return System.currentTimeMillis() >= redisDownUntilEpochMs;
    }

    private void markRedisDown(Exception e) {
        boolean firstFailure = redisUsable();
        redisDownUntilEpochMs = System.currentTimeMillis() + REDIS_COOLDOWN.toMillis();
        if (firstFailure) {
            log.warn("Redis không dùng được ({}), rate limit AI tạm đếm in-memory trong {}s",
                    e.getMessage(), REDIS_COOLDOWN.toSeconds());
        }
    }
}
