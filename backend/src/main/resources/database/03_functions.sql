-- =====================================================================
-- 03_functions.sql
-- Các FUNCTION cần thiết (chạy sau 01_schema.sql)
--
-- Nếu server bật binary logging và báo lỗi "you do not have the SUPER
-- privilege...", chạy: SET GLOBAL log_bin_trust_function_creators = 1;
-- (không cần trên MySQL local mặc định của project này).
-- =====================================================================

USE studyfocus;

DROP FUNCTION IF EXISTS fn_room_current_members;
DROP FUNCTION IF EXISTS fn_room_has_space;
DROP FUNCTION IF EXISTS fn_task_total_focus_minutes;
DROP FUNCTION IF EXISTS fn_user_task_completion_rate;

DELIMITER $$

-- Số thành viên hiện có trong phòng (thay cho cột quantity)
CREATE FUNCTION fn_room_current_members(p_room_id BIGINT)
RETURNS INT
DETERMINISTIC
READS SQL DATA
BEGIN
    DECLARE v_count INT;
    SELECT COUNT(*) INTO v_count FROM room_users WHERE room_id = p_room_id;
    RETURN v_count;
END$$

-- Phòng còn chỗ trống hay không
CREATE FUNCTION fn_room_has_space(p_room_id BIGINT)
RETURNS BOOLEAN
READS SQL DATA
BEGIN
    DECLARE v_limit INT;
    DECLARE v_current INT;

    SELECT room_limit INTO v_limit FROM rooms WHERE id = p_room_id;
    SET v_current = fn_room_current_members(p_room_id);

    RETURN v_current < v_limit;
END$$

-- Tổng số phút tập trung đã ghi nhận cho 1 task
CREATE FUNCTION fn_task_total_focus_minutes(p_task_id BIGINT)
RETURNS INT
READS SQL DATA
BEGIN
    DECLARE v_total INT;
    SELECT COALESCE(SUM(duration), 0) INTO v_total FROM times WHERE task_id = p_task_id;
    RETURN v_total;
END$$

-- Tỉ lệ hoàn thành task của user trong N ngày gần nhất (dùng cho AI prompt / dashboard)
CREATE FUNCTION fn_user_task_completion_rate(p_user_id BIGINT, p_days INT)
RETURNS DECIMAL(5,2)
READS SQL DATA
BEGIN
    DECLARE v_total INT;
    DECLARE v_done INT;

    SELECT COUNT(*), SUM(status = 'DONE')
    INTO v_total, v_done
    FROM tasks
    WHERE user_id = p_user_id
      AND created_at >= DATE_SUB(NOW(), INTERVAL p_days DAY);

    IF v_total = 0 THEN
        RETURN NULL;
    END IF;

    RETURN ROUND(v_done * 100.0 / v_total, 2);
END$$

DELIMITER ;
