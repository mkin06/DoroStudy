package org.devnqminh.studyfocus.config.ai;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;

import java.util.HashMap;
import java.util.Locale;
import java.util.Map;

/**
 * Cấu hình Freemium: quota gọi AI và giới hạn tính năng theo gói cước.
 *
 * Nguyên tắc phân tầng — quan trọng hơn bản thân các con số:
 *
 *   FocusInsightEngine chạy cục bộ, KHÔNG tốn một đồng nào. Vì vậy điểm tập trung, chuỗi
 *   ngày, độ dài phiên tối ưu, ngưỡng cạn năng lượng và cảnh báo tụt nhịp đều cho không,
 *   không giới hạn. Đó là phần khiến user ở lại, và giữ nó miễn phí không làm tăng COGS.
 *
 *   Chỉ ba thứ bị tính phí, vì cả ba đều có chi phí thật hoặc là chiều sâu đáng trả tiền:
 *     1. Số lượt Gemini diễn giải mỗi ngày  -> chi phí API trực tiếp
 *     2. Số môn được phân tích giờ vàng riêng -> chiều sâu của lợi thế cạnh tranh
 *     3. Độ dài cửa sổ lịch sử được phân tích -> giá trị tích luỹ theo thời gian
 *
 * Mọi con số đều đọc từ application.properties, không hardcode:
 *
 *   ai.quota.limits.FREE=3
 *   ai.quota.limits.PREMIUM=50
 *   ai.quota.plans.FREE.subject-insight-limit=1
 *   ai.quota.plans.FREE.history-days=30
 *   ai.quota.plans.PREMIUM.subject-insight-limit=-1
 *   ai.quota.plans.PREMIUM.history-days=-1
 *
 * Giá trị âm ở bất kỳ giới hạn nào đều nghĩa là không giới hạn.
 */
@ConfigurationProperties(prefix = "ai.quota")
@Getter
@Setter
public class AiQuotaProperties {

    public static final String PLAN_FREE = "FREE";
    public static final String PLAN_PREMIUM = "PREMIUM";

    /** Số lượt gọi AI tối đa mỗi ngày, theo mã gói. */
    private Map<String, Integer> limits = new HashMap<>();

    /** Giới hạn tính năng theo mã gói. */
    private Map<String, PlanLimits> plans = new HashMap<>();

    /** Gói áp dụng cho user chưa gắn subscription. */
    private String defaultPlan = PLAN_FREE;

    /** Múi giờ dùng để xác định mốc "một ngày" khi reset quota. */
    private String zone = "Asia/Ho_Chi_Minh";

    @Getter
    @Setter
    public static class PlanLimits {

        /** Số môn được phân tích giờ vàng riêng; âm = không giới hạn. */
        private int subjectInsightLimit = -1;

        /** Số ngày lịch sử được đưa vào phân tích; âm = không giới hạn. */
        private int historyDays = -1;
    }

    /**
     * Quota của một gói. Không khai báo thì lấy theo default-plan;
     * default-plan cũng không khai báo thì mặc định 3 (mức Free bảo thủ nhất).
     */
    public int limitFor(String planCode) {
        Integer limit = limits.get(normalize(planCode));
        if (limit == null) {
            limit = limits.get(defaultPlan);
        }
        return limit == null ? 3 : limit;
    }

    /**
     * Giới hạn tính năng của một gói. Gói lạ hoặc chưa khai báo thì rơi về default-plan;
     * default-plan cũng chưa khai báo thì trả về bản không giới hạn — cố ý "fail open":
     * cấu hình thiếu làm user được dùng nhiều hơn thì còn sửa được, chứ khoá oan tính năng
     * của người đã trả tiền thì mất khách.
     */
    public PlanLimits limitsFor(String planCode) {
        PlanLimits planLimits = plans.get(normalize(planCode));
        if (planLimits == null) {
            planLimits = plans.get(defaultPlan);
        }
        return planLimits == null ? new PlanLimits() : planLimits;
    }

    private String normalize(String planCode) {
        return planCode == null ? defaultPlan : planCode.toUpperCase(Locale.ROOT);
    }
}
