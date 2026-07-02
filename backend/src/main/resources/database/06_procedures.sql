-- =====================================================================
-- 06_procedures.sql
-- Các PROCEDURE cần thiết (chạy sau 01_schema.sql, 05_triggers.sql)
-- Yêu cầu MySQL 8.0+ (dùng window function và JSON_TABLE)
-- =====================================================================

USE studyfocus;

DROP PROCEDURE IF EXISTS sp_join_room;
DROP PROCEDURE IF EXISTS sp_generate_session_summary;
DROP PROCEDURE IF EXISTS sp_expire_subscriptions;

DELIMITER $$

-- Tham gia phòng học nhóm. Việc kiểm tra sức chứa/room đóng đã có
-- trigger trg_room_users_before_insert_capacity lo, ở đây chỉ chặn join trùng.
CREATE PROCEDURE sp_join_room(IN p_room_id BIGINT, IN p_user_id BIGINT)
BEGIN
    IF EXISTS (SELECT 1 FROM room_users WHERE room_id = p_room_id AND user_id = p_user_id) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'User already joined this room';
    ELSE
        INSERT INTO room_users (room_id, user_id, role) VALUES (p_room_id, p_user_id, 'MEMBER');
    END IF;
END$$

-- Tổng hợp thống kê cho 7-10 phiên gần nhất của user (gọi khi
-- sessions_since_last_summary >= 7, xem v_summary_eligibility).
-- ai_content để NULL, backend gọi Gemini xong sẽ UPDATE lại dòng này.
CREATE PROCEDURE sp_generate_session_summary(IN p_user_id BIGINT)
BEGIN
    DECLARE v_session_count INT;
    DECLARE v_from_id BIGINT;
    DECLARE v_to_id BIGINT;
    DECLARE v_best_hour INT;
    DECLARE v_best_time_slot VARCHAR(50);
    DECLARE v_main_distraction VARCHAR(100);

    SELECT sessions_since_last_summary INTO v_session_count
    FROM users WHERE id = p_user_id;

    IF v_session_count IS NULL OR v_session_count < 7 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Not enough sessions for a summary yet';
    END IF;

    -- id của phiên gần nhất và phiên cách đây (v_session_count) phiên
    SELECT id INTO v_to_id
    FROM (
        SELECT id, ROW_NUMBER() OVER (ORDER BY id DESC) AS rn
        FROM times WHERE user_id = p_user_id
    ) ranked WHERE rn = 1;

    SELECT id INTO v_from_id
    FROM (
        SELECT id, ROW_NUMBER() OVER (ORDER BY id DESC) AS rn
        FROM times WHERE user_id = p_user_id
    ) ranked WHERE rn = v_session_count;

    -- khung giờ có focus_score trung bình cao nhất trong khoảng phiên này
    SELECT HOUR(start_time) INTO v_best_hour
    FROM times
    WHERE user_id = p_user_id AND id BETWEEN v_from_id AND v_to_id AND start_time IS NOT NULL
    GROUP BY HOUR(start_time)
    ORDER BY AVG(focus_score) DESC
    LIMIT 1;

    IF v_best_hour IS NOT NULL THEN
        SET v_best_time_slot = CONCAT(LPAD(v_best_hour, 2, '0'), ':00 - ', LPAD(v_best_hour + 1, 2, '0'), ':00');
    END IF;

    -- lý do mất tập trung xuất hiện nhiều nhất trong khoảng phiên này
    SELECT reason INTO v_main_distraction
    FROM (
        SELECT jt.reason AS reason, COUNT(*) AS cnt
        FROM ai_reflections ar
        JOIN JSON_TABLE(
            ar.q_distraction_reasons, '$[*]' COLUMNS (reason VARCHAR(50) PATH '$')
        ) AS jt
        WHERE ar.user_id = p_user_id AND ar.session_id BETWEEN v_from_id AND v_to_id
        GROUP BY jt.reason
        ORDER BY cnt DESC
        LIMIT 1
    ) top_reason;

    INSERT INTO session_summaries (
        user_id, from_session_id, to_session_id, session_count,
        best_time_slot, main_distraction, ai_content
    ) VALUES (
        p_user_id, v_from_id, v_to_id, v_session_count,
        v_best_time_slot, v_main_distraction, NULL
    );

    -- bộ đếm sessions_since_last_summary được reset tự động bởi
    -- trigger trg_session_summaries_after_insert
END$$

-- Hết hạn các gói đăng ký quá ngày expires_at, đưa user về free tier.
-- Nên chạy định kỳ (EVENT hằng ngày hoặc job phía backend).
CREATE PROCEDURE sp_expire_subscriptions()
BEGIN
    UPDATE user_subscriptions
    SET status = 'EXPIRED'
    WHERE status = 'ACTIVE' AND expires_at IS NOT NULL AND expires_at < NOW();

    UPDATE users u
    SET u.subscription_id = NULL
    WHERE u.subscription_id IS NOT NULL
      AND NOT EXISTS (
          SELECT 1 FROM user_subscriptions us
          WHERE us.user_id = u.id AND us.status = 'ACTIVE'
      );
END$$

DELIMITER ;
