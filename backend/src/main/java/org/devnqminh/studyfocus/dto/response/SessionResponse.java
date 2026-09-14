package org.devnqminh.studyfocus.dto.response;

public record SessionResponse(
        Long id,
        Double duration,
        Double breakTime,
        Integer count,
        String subject,
        Long userId,
        String username
) {
}
//record phù hợp với các đối tượng dữ liệu đơn , không cần logic phức
//nếu chỉ cần tạo đối tượng mà dữ liệu không thay các giá trị đó thì record rất phù , mã sạch và dể bảo trì hơn