package org.devnqminh.studyfocus.repository;

import org.devnqminh.studyfocus.model.PushSubscription;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface PushSubscriptionRepository extends JpaRepository<PushSubscription, Long> {

    Optional<PushSubscription> findByEndpoint(String endpoint);

    List<PushSubscription> findByUserIdAndActiveTrue(Long userId);

    /**
     * Toàn bộ đăng ký còn sống, đã fetch sẵn user.
     *
     * Job quét chạy mỗi giờ và đụng tới user của từng bản ghi, nên để lazy sẽ thành N+1
     * query. Số user bật thông báo luôn nhỏ hơn nhiều tổng số user, vì vậy nạp một lượt là
     * đủ rẻ và đơn giản hơn phân trang.
     */
    @Query("select s from PushSubscription s join fetch s.user where s.active = true")
    List<PushSubscription> findAllActiveWithUser();
}
