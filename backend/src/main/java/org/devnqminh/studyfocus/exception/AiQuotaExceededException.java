package org.devnqminh.studyfocus.exception;

import lombok.Getter;
import org.devnqminh.studyfocus.dto.response.ReflectionResponse;

/**
 * User đã dùng hết quota gọi AI trong ngày.
 *
 * Reflection của user vẫn được lưu trước khi ném exception này (kèm focus_score tính
 * cục bộ) — chỉ lượt gọi AI bị chặn, dữ liệu user không bị mất. Vì vậy exception mang
 * theo luôn reflection đã lưu để trả về trong body 429.
 */
@Getter
public class AiQuotaExceededException extends RuntimeException {

    private final String plan;
    private final int limit;
    private final int used;
    private final ReflectionResponse reflection;

    public AiQuotaExceededException(String plan, int limit, int used, ReflectionResponse reflection) {
        super(String.format(
                "Bạn đã dùng hết %d lượt phân tích AI hôm nay (gói %s). "
                        + "Reflection vẫn được lưu. Quota sẽ đặt lại vào ngày mai.",
                limit, plan));
        this.plan = plan;
        this.limit = limit;
        this.used = used;
        this.reflection = reflection;
    }
}
