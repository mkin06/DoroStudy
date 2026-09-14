package org.devnqminh.studyfocus.service;

import org.devnqminh.studyfocus.dto.request.ReflectionRequest;
import org.devnqminh.studyfocus.dto.response.FocusProfileResponse;
import org.devnqminh.studyfocus.dto.response.NextSessionPlan;
import org.devnqminh.studyfocus.dto.response.ReflectionResponse;

import java.util.List;

public interface IAiReflectionService {

    /**
     * Lưu reflection cho một phiên học và gọi AI service để lấy feedback.
     *
     * Reflection luôn được lưu, kể cả khi ai-service chết (dùng feedback mặc định) hoặc khi
     * user đã hết quota AI trong ngày — trường hợp hết quota ném
     * {@link org.devnqminh.studyfocus.exception.AiQuotaExceededException} mang theo bản đã lưu.
     */
    ReflectionResponse createReflection(ReflectionRequest request, Long userId);

    List<ReflectionResponse> getUserReflections(Long userId);

    ReflectionResponse getBySessionId(Long sessionId, Long userId);

    /**
     * Hồ sơ tập trung cá nhân ("Focus DNA"): phát hiện đã mở khoá, giờ vàng theo môn,
     * độ dài phiên tối ưu, ngưỡng cạn năng lượng và tình trạng duy trì thói quen.
     * Luôn trả về được — phiên đầu tiên đã có nội dung, không phải chờ đủ 10 phiên.
     */
    FocusProfileResponse getFocusProfile(Long userId);

    /**
     * Kế hoạch cho phiên học SẮP tới: môn, độ dài, khung giờ, biện pháp chặn xao nhãng và
     * điểm dự đoán nếu user làm theo.
     *
     * Chạy cục bộ nên không tiêu quota AI và gọi được ở mọi lần mở app — đó là điều kiện
     * bắt buộc để nó kịp tác động vào hành vi TRƯỚC phiên, thay vì chỉ nhận xét sau phiên.
     *
     * @param subjectHint môn user đang gõ ở ô Task, có thể null
     */
    NextSessionPlan getNextSessionPlan(Long userId, String subjectHint);
}
