package org.devnqminh.studyfocus.service.ai;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.devnqminh.studyfocus.model.AiCallLog;
import org.devnqminh.studyfocus.repository.AiCallLogRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Ghi nhật ký mỗi lượt gọi AI phục vụ tính COGS.
 *
 * Chạy trong transaction riêng (REQUIRES_NEW) và nuốt mọi lỗi: log là dữ liệu kế toán,
 * không phải dữ liệu nghiệp vụ — hỏng log không được kéo theo hỏng reflection của user.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class AiCallLogger {

    /** Cắt payload trước khi lưu để một lượt gọi bất thường không thổi phồng bảng log. */
    private static final int MAX_PAYLOAD_CHARS = 4000;

    private final AiCallLogRepository aiCallLogRepository;
    private final ObjectMapper objectMapper;

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void record(Long userId,
                       Long sessionId,
                       String operation,
                       AiCallLog.Outcome outcome,
                       Object request,
                       Object response,
                       long latencyMs,
                       String errorMessage) {
        try {
            String requestJson = toJson(request);
            String responseJson = toJson(response);

            aiCallLogRepository.save(AiCallLog.builder()
                    .userId(userId)
                    .sessionId(sessionId)
                    .operation(operation)
                    .outcome(outcome)
                    .requestPayload(truncate(requestJson))
                    .responsePayload(truncate(responseJson))
                    .requestChars(requestJson == null ? 0 : requestJson.length())
                    .responseChars(responseJson == null ? 0 : responseJson.length())
                    .latencyMs(latencyMs)
                    .success(outcome == AiCallLog.Outcome.GEMINI
                            || outcome == AiCallLog.Outcome.FALLBACK_SERVICE)
                    .errorMessage(truncateError(errorMessage))
                    .build());
        } catch (Exception e) {
            log.warn("Không ghi được ai_call_logs (userId={}, operation={}): {}",
                    userId, operation, e.getMessage());
        }
    }

    private String toJson(Object value) {
        if (value == null) {
            return null;
        }
        try {
            return objectMapper.writeValueAsString(value);
        } catch (Exception e) {
            return String.valueOf(value);
        }
    }

    private String truncate(String value) {
        if (value == null || value.length() <= MAX_PAYLOAD_CHARS) {
            return value;
        }
        return value.substring(0, MAX_PAYLOAD_CHARS) + "…[truncated]";
    }

    private String truncateError(String value) {
        if (value == null || value.length() <= 500) {
            return value;
        }
        return value.substring(0, 500);
    }
}
