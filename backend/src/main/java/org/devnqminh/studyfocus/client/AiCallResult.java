package org.devnqminh.studyfocus.client;

import org.devnqminh.studyfocus.dto.ai.AiAnalyzeResponse;

/**
 * Kết quả một lượt gọi ai-service, kèm số liệu cần cho log COGS.
 *
 * @param response     null nếu gọi thất bại (timeout / service chết / body rỗng)
 * @param latencyMs    thời gian chờ thực tế, tính cả lượt thất bại
 * @param errorMessage null nếu thành công
 */
public record AiCallResult(AiAnalyzeResponse response, long latencyMs, String errorMessage) {

    public boolean isSuccess() {
        return response != null;
    }

    public static AiCallResult ok(AiAnalyzeResponse response, long latencyMs) {
        return new AiCallResult(response, latencyMs, null);
    }

    public static AiCallResult failed(long latencyMs, String errorMessage) {
        return new AiCallResult(null, latencyMs, errorMessage);
    }
}
