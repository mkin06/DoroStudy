package org.devnqminh.studyfocus.client;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.devnqminh.studyfocus.dto.ai.AiAnalyzeRequest;
import org.devnqminh.studyfocus.dto.ai.AiAnalyzeResponse;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

/**
 * Client gọi Python AI service.
 *
 * Không bao giờ ném exception: lỗi/timeout trả về {@link AiCallResult} thất bại kèm
 * latency, để caller tự quyết định fallback và ghi log COGS. Luồng lưu reflection của
 * user không được phụ thuộc vào việc AI sống hay chết.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class AiServiceClient {

    private final RestClient aiRestClient;

    public AiCallResult analyzeSession(AiAnalyzeRequest request) {
        long startedAt = System.nanoTime();
        try {
            AiAnalyzeResponse response = aiRestClient.post()
                    .uri("/analyze-session")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(request)
                    .retrieve()
                    .body(AiAnalyzeResponse.class);

            long latencyMs = elapsedMs(startedAt);
            if (response == null) {
                return AiCallResult.failed(latencyMs, "AI service trả về body rỗng");
            }
            return AiCallResult.ok(response, latencyMs);
        } catch (Exception e) {
            long latencyMs = elapsedMs(startedAt);
            log.warn("AI service không phản hồi sau {}ms, dùng feedback mặc định: {}",
                    latencyMs, e.getMessage());
            return AiCallResult.failed(latencyMs, describe(e));
        }
    }

    private long elapsedMs(long startedAtNanos) {
        return (System.nanoTime() - startedAtNanos) / 1_000_000;
    }

    private String describe(Exception e) {
        String message = e.getMessage();
        String text = e.getClass().getSimpleName() + (message == null ? "" : ": " + message);
        return text.length() > 500 ? text.substring(0, 500) : text;
    }
}
