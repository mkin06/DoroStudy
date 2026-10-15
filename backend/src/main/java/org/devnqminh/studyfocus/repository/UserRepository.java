package org.devnqminh.studyfocus.repository;

import org.devnqminh.studyfocus.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.List;
@Repository
public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByUsername(String username);
    Optional<User> findByEmail(String email);
    Optional<User> findByUsernameIgnoreCase(String username);
    Optional<User> findByEmailIgnoreCase(String email);
    boolean existsByUsername(String username);
    boolean existsByEmail(String email);
    Optional<User> findById(Long id);

    // Tìm được cả dữ liệu cũ từng vô tình lưu khoảng trắng ở hai đầu.
    @Query("SELECT u FROM User u WHERE lower(trim(u.username)) = lower(:value) OR lower(trim(coalesce(u.email, ''))) = lower(:value)")
    List<User> findLoginCandidates(@Param("value") String value);

    @Query("SELECT CASE WHEN count(u) > 0 THEN true ELSE false END FROM User u WHERE lower(trim(u.username)) = lower(:username)")
    boolean existsByNormalizedUsername(@Param("username") String username);

    @Query("SELECT CASE WHEN count(u) > 0 THEN true ELSE false END FROM User u WHERE lower(trim(coalesce(u.email, ''))) = lower(:email)")
    boolean existsByNormalizedEmail(@Param("email") String email);

    /**
     * Mã gói cước của user để tra quota AI, lấy bằng một query thay vì chạm vào
     * association LAZY (open-in-view đang tắt nên truy cập ngoài transaction sẽ lỗi).
     * Trả về Optional rỗng khi user chưa gắn subscription — caller coi như gói mặc định.
     */
    @Query("SELECT s.code FROM User u JOIN u.subscription s WHERE u.id = :id")
    Optional<String> findPlanCodeByUserId(@Param("id") Long id);
}
