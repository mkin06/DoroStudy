-- =====================================================================
-- 04_views.sql
-- Các VIEW cần thiết (chạy sau 01_schema.sql)
-- =====================================================================

USE studyfocus;

DROP VIEW IF EXISTS v_room_occupancy;
DROP VIEW IF EXISTS v_user_stats;
DROP VIEW IF EXISTS v_task_progress;
DROP VIEW IF EXISTS v_pending_reflections;
DROP VIEW IF EXISTS v_summary_eligibility;

-- Tình trạng phòng học nhóm: sĩ số hiện tại / giới hạn, còn chỗ hay không
CREATE VIEW v_room_occupancy AS
SELECT
    r.id AS room_id,
    r.name,
    r.room_limit,
    r.status,
    (SELECT COUNT(*) FROM room_users ru WHERE ru.room_id = r.id) AS current_members,
    ((SELECT COUNT(*) FROM room_users ru WHERE ru.room_id = r.id) >= r.room_limit) AS is_full
FROM rooms r;

-- Thống kê tổng quan mỗi user: gamification + tổng số phiên/phút tập trung
CREATE VIEW v_user_stats AS
SELECT
    u.id AS user_id,
    u.username,
    u.level,
    u.xp,
    u.coins,
    u.current_streak,
    u.best_streak,
    COUNT(t.id) AS total_sessions,
    COALESCE(SUM(t.duration), 0) AS total_focus_minutes
FROM users u
LEFT JOIN times t ON t.user_id = u.id
GROUP BY u.id, u.username, u.level, u.xp, u.coins, u.current_streak, u.best_streak;

-- Tiến độ từng task: số phiên đã học, tổng thời lượng, lần học gần nhất
CREATE VIEW v_task_progress AS
SELECT
    tk.id AS task_id,
    tk.user_id,
    tk.title,
    tk.status,
    tk.priority,
    COUNT(t.id) AS total_sessions,
    COALESCE(SUM(t.duration), 0) AS total_focus_minutes,
    MAX(t.created_at) AS last_session_at
FROM tasks tk
LEFT JOIN times t ON t.task_id = tk.id
GROUP BY tk.id, tk.user_id, tk.title, tk.status, tk.priority;

-- Các phiên đã kết thúc nhưng user chưa trả lời reflection (để app nhắc)
CREATE VIEW v_pending_reflections AS
SELECT
    t.id AS session_id,
    t.user_id,
    t.subject,
    t.created_at
FROM times t
LEFT JOIN ai_reflections ar ON ar.session_id = t.id
WHERE ar.id IS NULL;

-- User nào đã đủ 7 phiên để AI tổng hợp session_summary
CREATE VIEW v_summary_eligibility AS
SELECT
    id AS user_id,
    username,
    sessions_since_last_summary,
    (sessions_since_last_summary >= 7) AS ready_for_summary
FROM users;
