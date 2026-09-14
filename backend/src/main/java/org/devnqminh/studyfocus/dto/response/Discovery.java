package org.devnqminh.studyfocus.dto.response;

/**
 * Một "phát hiện" về thói quen học của user — đơn vị giá trị nhỏ nhất mà AI trả về.
 *
 * Cố ý thiết kế thành thẻ ngắn có icon thay vì đoạn văn: user đọc lướt 1 giây là hiểu,
 * và mỗi phiên mở khoá thêm thẻ mới thì phần thưởng luôn mới (variable reward) thay vì
 * lặp lại cùng một đoạn mô tả.
 *
 * @param id         khoá ổn định, dùng để biết thẻ nào vừa mới xuất hiện
 * @param icon       emoji hiển thị đầu thẻ
 * @param title      tiêu đề ngắn, tối đa vài từ
 * @param detail     một câu có số liệu thật
 * @param evidence   cơ sở dữ liệu của phát hiện, ví dụ "6 phiên môn Toán"
 * @param confidence 0-100, thấp khi mẫu còn ít — hiển thị để user không tin nhầm
 * @param isNew      true khi phát hiện này vừa mở khoá ở đúng phiên vừa xong
 */
public record Discovery(
        String id,
        String icon,
        String title,
        String detail,
        String evidence,
        int confidence,
        boolean isNew
) {

    public Discovery asNew() {
        return new Discovery(id, icon, title, detail, evidence, confidence, true);
    }
}
