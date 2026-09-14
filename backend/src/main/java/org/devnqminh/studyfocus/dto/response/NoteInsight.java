package org.devnqminh.studyfocus.dto.response;

/**
 * Điều AI đọc được từ ghi chú user viết TRONG phiên học vừa rồi.
 *
 * Đây là mảnh dữ liệu duy nhất trong sản phẩm phản ánh user THẬT SỰ làm gì, chứ không phải
 * họ khai gì. Ô Task và popup reflection đều là lời tự khai; ghi chú thì không — người ta
 * không viết "đạo hàm" khi đang xem TikTok.
 *
 * Nhờ vậy hệ thống trả lời được hai câu mà không app Pomodoro nào trả lời:
 *   - Không gắn môn thì sao?  → đoán từ ghi chú rồi mời gắn bằng một cú chạm.
 *   - Gắn môn rồi thì sao?    → đối chiếu; khai Toán mà ghi toàn từ vựng tiếng Anh thì nói thẳng.
 *
 * @param verdict          MISMATCH | ON_TRACK | SUBJECT_DETECTED | NOTED_ONLY
 * @param icon             emoji hiển thị đầu thẻ
 * @param message          đúng một câu ngắn — màn hình kết quả cố ý ít chữ
 * @param declaredSubject  môn user khai ở ô Task, null nếu bỏ trống
 * @param detectedSubject  môn đoán được từ ghi chú, null nếu không đủ căn cứ
 * @param noteCount        số ghi chú user chạm vào trong phiên
 * @param wordCount        tổng số từ đã viết — thước đo "có thật sự làm việc" khách quan nhất
 * @param confidence       0-100 cho phần đoán môn
 */
public record NoteInsight(
        String verdict,
        String icon,
        String message,
        String declaredSubject,
        String detectedSubject,
        int noteCount,
        int wordCount,
        int confidence
) {
}
