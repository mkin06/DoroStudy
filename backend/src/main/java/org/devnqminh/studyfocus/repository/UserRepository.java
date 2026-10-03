package org.devnqminh.studyfocus.repository;

import org.devnqminh.studyfocus.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;
@Repository
public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByUsername(String username);
    Optional<User> findByEmail(String email);
    boolean existsByUsername(String username);
    boolean existsByEmail(String email);
    Optional<User> findById(Long id);

    //  EAGER FETCH để tránh LazyInitializationException và N+1 query
    @Query("SELECT u FROM User u LEFT JOIN FETCH u.times WHERE u.id = :id")
    Optional<User> findByIdWithTimes(@Param("id") Long id);

    /**
     * Mã gói cước của user để tra quota AI, lấy bằng một query thay vì chạm vào
     * association LAZY (open-in-view đang tắt nên truy cập ngoài transaction sẽ lỗi).
     * Trả về Optional rỗng khi user chưa gắn subscription — caller coi như gói mặc định.
     */
    @Query("SELECT s.code FROM User u JOIN u.subscription s WHERE u.id = :id")
    Optional<String> findPlanCodeByUserId(@Param("id") Long id);
}
