-- =====================================================================
-- 05_triggers.sql
-- Các TRIGGER cần thiết (chạy sau 01_schema.sql)
-- =====================================================================

USE studyfocus;

DROP TRIGGER IF EXISTS trg_ai_reflections_after_insert;
DROP TRIGGER IF EXISTS trg_session_summaries_after_insert;
DROP TRIGGER IF EXISTS trg_times_after_insert_streak;
DROP TRIGGER IF EXISTS trg_room_users_before_insert_capacity;

DELIMITER $$

-- Mỗi lần user hoàn thành reflection -> tăng bộ đếm để biết khi nào đủ 7 phiên
CREATE TRIGGER trg_ai_reflections_after_insert
AFTER INSERT ON ai_reflections
FOR EACH ROW
BEGIN
    UPDATE users
    SET sessions_since_last_summary = sessions_since_last_summary + 1
    WHERE id = NEW.user_id;
END$$

-- Khi AI đã tổng hợp xong 1 session_summary -> reset bộ đếm về 0
CREATE TRIGGER trg_session_summaries_after_insert
AFTER INSERT ON session_summaries
FOR EACH ROW
BEGIN
    UPDATE users
    SET sessions_since_last_summary = 0
    WHERE id = NEW.user_id;
END$$

-- Cập nhật streak học tập mỗi khi có phiên Pomodoro mới
CREATE TRIGGER trg_times_after_insert_streak
AFTER INSERT ON times
FOR EACH ROW
BEGIN
    DECLARE v_last_active DATE;

    SELECT last_active_date INTO v_last_active FROM users WHERE id = NEW.user_id;

    IF v_last_active IS NULL OR v_last_active < CURDATE() THEN
        IF v_last_active = CURDATE() - INTERVAL 1 DAY THEN
            -- học liên tục từ hôm qua -> tăng streak
            UPDATE users
            SET current_streak = current_streak + 1,
                best_streak = GREATEST(best_streak, current_streak + 1),
                last_active_date = CURDATE()
            WHERE id = NEW.user_id;
        ELSE
            -- bỏ lỡ >=1 ngày hoặc lần đầu học -> streak reset về 1
            UPDATE users
            SET current_streak = 1,
                best_streak = GREATEST(best_streak, 1),
                last_active_date = CURDATE()
            WHERE id = NEW.user_id;
        END IF;
    END IF;
END$$

-- Chặn join phòng khi phòng đã đóng hoặc đã đầy (bảo vệ ở tầng DB, không chỉ tầng app)
CREATE TRIGGER trg_room_users_before_insert_capacity
BEFORE INSERT ON room_users
FOR EACH ROW
BEGIN
    DECLARE v_limit INT;
    DECLARE v_status VARCHAR(20);
    DECLARE v_current INT;

    SELECT room_limit, status INTO v_limit, v_status FROM rooms WHERE id = NEW.room_id;
    SELECT COUNT(*) INTO v_current FROM room_users WHERE room_id = NEW.room_id;

    IF v_status <> 'ACTIVE' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Room is closed';
    ELSEIF v_current >= v_limit THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Room is full';
    END IF;
END$$

DELIMITER ;
