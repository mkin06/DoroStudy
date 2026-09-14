package org.devnqminh.studyfocus.dto.ai;

/**
 * Kết quả AI service trả về.
 */
public record AiAnalyzeResponse(
        String summary,
        String comparison,      // null khi user chưa đủ lịch sử
        String recommendation,
        Double focusScore,
        String source           // "gemini" | "fallback"
) {
}
