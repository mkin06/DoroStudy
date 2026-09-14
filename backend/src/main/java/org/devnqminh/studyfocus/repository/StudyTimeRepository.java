package org.devnqminh.studyfocus.repository;

import org.devnqminh.studyfocus.model.StudyTime;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;


import java.util.List;
import java.sql.Date;

@Repository
public interface StudyTimeRepository extends JpaRepository<StudyTime, Long> {
    // Tìm sessions theo user, sắp xếp mới nhất trước
    List<StudyTime> findByUserIdOrderByIdDesc(Long userId);
    //Tính tổng time tự học
    @Query("SELECT COALESCE(SUM(st.duration), 0.0) FROM StudyTime st WHERE st.user.id = :userId")
    Double getTotalStudyTimeByUserId(@Param("userId") Long userId);
    //Đến số session
    Long countByUserId(Long userId);
    // Tính tổng số pomodoros
    @Query("SELECT COALESCE(SUM(st.count), 0) FROM StudyTime st WHERE st.user.id = :userId")
    Integer getTotalPomodorosByUserId(@Param("userId") Long userId);

    // Tìm ngày học bằng userId
    @Query(value = """
        SELECT DATE(CONVERT_TZ(t.created_at, '+00:00', '+07:00')) AS study_day
        FROM times t
        WHERE t.user_id = :userId
        GROUP BY DATE(CONVERT_TZ(t.created_at, '+00:00', '+07:00'))
        HAVING SUM(t.`count`) >= 1
        ORDER BY study_day ASC
        """, nativeQuery = true)
List<Date> findActiveStudyDaysByUserId(@Param("userId") Long userId);

//Tính tổng số pomodoros tuần này
@Query(value = """
    SELECT COALESCE(SUM(t.`count`), 0)
    FROM times t
    WHERE t.user_id = :userId
      AND DATE(CONVERT_TZ(t.created_at, '+00:00', '+07:00')) >= DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY)
      AND DATE(CONVERT_TZ(t.created_at, '+00:00', '+07:00')) < DATE_ADD(DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY), INTERVAL 7 DAY)
    """, nativeQuery = true)
Integer getThisWeekPomodorosByUserId(@Param("userId") Long userId);
}
