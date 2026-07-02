-- =====================================================================
-- 02_seed_data.sql
-- Dữ liệu khởi tạo đầy đủ cho TẤT CẢ bảng (chạy sau 01_schema.sql,
-- trước 05_triggers.sql -- các trigger streak/counter chưa tồn tại lúc
-- này nên các giá trị current_streak/best_streak/sessions_since_last_summary
-- ở bảng users được set THỦ CÔNG cho khớp với dữ liệu times/ai_reflections
-- seed bên dưới).
--
-- Tài khoản demo (đăng nhập thật được qua /api/auth/login):
--   username: demo_student      | password: Demo@12345
--   username: demo_room_host    | password: Demo@12345
-- (password_hash là BCrypt thật, sinh bằng chính BCryptPasswordEncoder
-- của project nên khớp 100% với SecurityConfig hiện tại.)
--
-- Lưu ý: mọi cột trong subquery đều phải có AS alias tường minh -- nếu
-- không, MySQL tự đặt tên cột theo giá trị literal, và khi 2 literal
-- trùng nhau (không phân biệt hoa/thường, vd 'Lifetime' và 'LIFETIME')
-- sẽ báo lỗi 1060 Duplicate column name.
-- =====================================================================

USE studyfocus;

-- ---------------------------------------------------------------------
-- subscriptions
-- ---------------------------------------------------------------------
INSERT INTO subscriptions (name, price, billing_cycle, description, is_active)
SELECT * FROM (SELECT
    'Free' AS name, 0.00 AS price, 'MONTHLY' AS billing_cycle,
    'Gói miễn phí: Pomodoro cơ bản, AI Reflection giới hạn' AS description, TRUE AS is_active
) AS tmp
WHERE NOT EXISTS (SELECT 1 FROM subscriptions WHERE name = 'Free');

INSERT INTO subscriptions (name, price, billing_cycle, description, is_active)
SELECT * FROM (SELECT
    'Premium Monthly' AS name, 49000.00 AS price, 'MONTHLY' AS billing_cycle,
    'Không giới hạn AI Reflection, mở khoá background/nhạc premium' AS description, TRUE AS is_active
) AS tmp
WHERE NOT EXISTS (SELECT 1 FROM subscriptions WHERE name = 'Premium Monthly');

INSERT INTO subscriptions (name, price, billing_cycle, description, is_active)
SELECT * FROM (SELECT
    'Premium Annual' AS name, 399000.00 AS price, 'ANNUAL' AS billing_cycle,
    'Như Premium Monthly, tiết kiệm hơn khi thanh toán theo năm' AS description, TRUE AS is_active
) AS tmp
WHERE NOT EXISTS (SELECT 1 FROM subscriptions WHERE name = 'Premium Annual');

INSERT INTO subscriptions (name, price, billing_cycle, description, is_active)
SELECT * FROM (SELECT
    'Lifetime' AS name, 999000.00 AS price, 'LIFETIME' AS billing_cycle,
    'Thanh toán một lần, sử dụng vĩnh viễn' AS description, TRUE AS is_active
) AS tmp
WHERE NOT EXISTS (SELECT 1 FROM subscriptions WHERE name = 'Lifetime');

-- ---------------------------------------------------------------------
-- note_types
-- ---------------------------------------------------------------------
INSERT INTO note_types (name, status)
SELECT * FROM (SELECT 'General' AS name, 1 AS status) AS tmp
WHERE NOT EXISTS (SELECT 1 FROM note_types WHERE name = 'General');

INSERT INTO note_types (name, status)
SELECT * FROM (SELECT 'Lecture' AS name, 1 AS status) AS tmp
WHERE NOT EXISTS (SELECT 1 FROM note_types WHERE name = 'Lecture');

INSERT INTO note_types (name, status)
SELECT * FROM (SELECT 'Summary' AS name, 1 AS status) AS tmp
WHERE NOT EXISTS (SELECT 1 FROM note_types WHERE name = 'Summary');

INSERT INTO note_types (name, status)
SELECT * FROM (SELECT 'Reminder' AS name, 1 AS status) AS tmp
WHERE NOT EXISTS (SELECT 1 FROM note_types WHERE name = 'Reminder');

INSERT INTO note_types (name, status)
SELECT * FROM (SELECT 'Idea' AS name, 1 AS status) AS tmp
WHERE NOT EXISTS (SELECT 1 FROM note_types WHERE name = 'Idea');

-- ---------------------------------------------------------------------
-- backgrounds
-- ---------------------------------------------------------------------
INSERT INTO backgrounds (name, image, video, type, category, thumbnail, is_premium)
SELECT * FROM (SELECT
    'Rainy Window' AS name, NULL AS image, '/videos/rainy-window.mp4' AS video,
    'MOTION' AS type, 'Nature' AS category, '/thumbnails/rainy-window.jpg' AS thumbnail, FALSE AS is_premium
) AS tmp
WHERE NOT EXISTS (SELECT 1 FROM backgrounds WHERE name = 'Rainy Window');

INSERT INTO backgrounds (name, image, video, type, category, thumbnail, is_premium)
SELECT * FROM (SELECT
    'Minimal Desk' AS name, '/images/minimal-desk.jpg' AS image, NULL AS video,
    'STILL' AS type, 'Workspace' AS category, '/thumbnails/minimal-desk.jpg' AS thumbnail, FALSE AS is_premium
) AS tmp
WHERE NOT EXISTS (SELECT 1 FROM backgrounds WHERE name = 'Minimal Desk');

INSERT INTO backgrounds (name, image, video, type, category, thumbnail, is_premium)
SELECT * FROM (SELECT
    'Snowy Mountain' AS name, NULL AS image, '/videos/snowy-mountain.mp4' AS video,
    'WEATHER' AS type, 'Nature' AS category, '/thumbnails/snowy-mountain.jpg' AS thumbnail, TRUE AS is_premium
) AS tmp
WHERE NOT EXISTS (SELECT 1 FROM backgrounds WHERE name = 'Snowy Mountain');

INSERT INTO backgrounds (name, image, video, type, category, thumbnail, is_premium)
SELECT * FROM (SELECT
    'Cozy Library' AS name, '/images/cozy-library.jpg' AS image, NULL AS video,
    'STILL' AS type, 'Indoor' AS category, '/thumbnails/cozy-library.jpg' AS thumbnail, TRUE AS is_premium
) AS tmp
WHERE NOT EXISTS (SELECT 1 FROM backgrounds WHERE name = 'Cozy Library');

-- ---------------------------------------------------------------------
-- music
-- ---------------------------------------------------------------------
INSERT INTO music (title, link, duration, type, thumbnail, is_premium)
SELECT * FROM (SELECT
    'Lofi Chill Beats' AS title, 'https://www.youtube.com/watch?v=lofi-chill' AS link,
    3600 AS duration, 'YOUTUBE' AS type, '/thumbnails/lofi-chill.jpg' AS thumbnail, FALSE AS is_premium
) AS tmp
WHERE NOT EXISTS (SELECT 1 FROM music WHERE title = 'Lofi Chill Beats');

INSERT INTO music (title, link, duration, type, thumbnail, is_premium)
SELECT * FROM (SELECT
    'Rain Sounds for Focus' AS title, 'https://www.youtube.com/watch?v=rain-sounds' AS link,
    7200 AS duration, 'YOUTUBE' AS type, '/thumbnails/rain-sounds.jpg' AS thumbnail, FALSE AS is_premium
) AS tmp
WHERE NOT EXISTS (SELECT 1 FROM music WHERE title = 'Rain Sounds for Focus');

INSERT INTO music (title, link, duration, type, thumbnail, is_premium)
SELECT * FROM (SELECT
    'Deep Focus Piano' AS title, 'https://open.spotify.com/playlist/deep-focus-piano' AS link,
    5400 AS duration, 'SPOTIFY' AS type, '/thumbnails/deep-focus-piano.jpg' AS thumbnail, TRUE AS is_premium
) AS tmp
WHERE NOT EXISTS (SELECT 1 FROM music WHERE title = 'Deep Focus Piano');

-- ---------------------------------------------------------------------
-- users (2 tài khoản demo, đăng nhập được thật)
-- ---------------------------------------------------------------------
INSERT INTO users (username, email, password_hash, name, status, level, xp, coins,
                    current_streak, best_streak, last_active_date,
                    sessions_since_last_summary, subscription_id, created_at)
SELECT * FROM (SELECT
    'demo_student' AS username,
    'demo.student@studyfocus.app' AS email,
    '$2a$10$KwcTv08LBhlY7yA2..L2re7nN6ncaJGwZZM.ZnCuoHD7VmuLFYcMG' AS password_hash,
    'Nguyễn Văn Demo' AS name,
    'ACTIVE' AS status,
    3 AS level, 450 AS xp, 120 AS coins,
    7 AS current_streak, 7 AS best_streak, DATE'2026-07-01' AS last_active_date,
    0 AS sessions_since_last_summary,
    (SELECT id FROM subscriptions WHERE name = 'Premium Monthly') AS subscription_id,
    TIMESTAMP'2026-06-20 09:00:00' AS created_at
) AS tmp
WHERE NOT EXISTS (SELECT 1 FROM users WHERE username = 'demo_student');

INSERT INTO users (username, email, password_hash, name, status, level, xp, coins,
                    current_streak, best_streak, last_active_date,
                    sessions_since_last_summary, subscription_id, created_at)
SELECT * FROM (SELECT
    'demo_room_host' AS username,
    'demo.host@studyfocus.app' AS email,
    '$2a$10$KwcTv08LBhlY7yA2..L2re7nN6ncaJGwZZM.ZnCuoHD7VmuLFYcMG' AS password_hash,
    'Trần Thị Chủ Phòng' AS name,
    'ACTIVE' AS status,
    5 AS level, 1200 AS xp, 300 AS coins,
    2 AS current_streak, 10 AS best_streak, DATE'2026-07-01' AS last_active_date,
    0 AS sessions_since_last_summary,
    NULL AS subscription_id,
    TIMESTAMP'2026-06-10 09:00:00' AS created_at
) AS tmp
WHERE NOT EXISTS (SELECT 1 FROM users WHERE username = 'demo_room_host');

SET @demo_student_id = (SELECT id FROM users WHERE username = 'demo_student');
SET @demo_host_id    = (SELECT id FROM users WHERE username = 'demo_room_host');

-- ---------------------------------------------------------------------
-- user_subscriptions
-- ---------------------------------------------------------------------
INSERT INTO user_subscriptions (user_id, subscription_id, started_at, expires_at, status)
SELECT * FROM (SELECT
    @demo_student_id AS user_id,
    (SELECT id FROM subscriptions WHERE name = 'Premium Monthly') AS subscription_id,
    TIMESTAMP'2026-06-20 09:00:00' AS started_at,
    TIMESTAMP'2026-07-20 09:00:00' AS expires_at,
    'ACTIVE' AS status
) AS tmp
WHERE NOT EXISTS (
    SELECT 1 FROM user_subscriptions
    WHERE user_id = @demo_student_id AND started_at = TIMESTAMP'2026-06-20 09:00:00'
);

-- ---------------------------------------------------------------------
-- user_settings
-- ---------------------------------------------------------------------
INSERT INTO user_settings (user_id, focus_time, short_break, long_break, preset_name, count_up_timer, deep_focus_mode)
SELECT * FROM (SELECT
    @demo_student_id AS user_id, 50 AS focus_time, 10 AS short_break, 20 AS long_break,
    'Deep Work 50/10' AS preset_name, FALSE AS count_up_timer, TRUE AS deep_focus_mode
) AS tmp
WHERE NOT EXISTS (SELECT 1 FROM user_settings WHERE user_id = @demo_student_id);

INSERT INTO user_settings (user_id, focus_time, short_break, long_break, preset_name, count_up_timer, deep_focus_mode)
SELECT * FROM (SELECT
    @demo_host_id AS user_id, 25 AS focus_time, 5 AS short_break, 15 AS long_break,
    'Classic Pomodoro' AS preset_name, FALSE AS count_up_timer, FALSE AS deep_focus_mode
) AS tmp
WHERE NOT EXISTS (SELECT 1 FROM user_settings WHERE user_id = @demo_host_id);

-- ---------------------------------------------------------------------
-- user_backgrounds / user_music (yêu thích của demo_student)
-- ---------------------------------------------------------------------
INSERT INTO user_backgrounds (user_id, background_id, is_favourite)
SELECT * FROM (SELECT
    @demo_student_id AS user_id, (SELECT id FROM backgrounds WHERE name = 'Minimal Desk') AS background_id, TRUE AS is_favourite
) AS tmp
WHERE NOT EXISTS (
    SELECT 1 FROM user_backgrounds WHERE user_id = @demo_student_id
    AND background_id = (SELECT id FROM backgrounds WHERE name = 'Minimal Desk')
);

INSERT INTO user_backgrounds (user_id, background_id, is_favourite)
SELECT * FROM (SELECT
    @demo_student_id AS user_id, (SELECT id FROM backgrounds WHERE name = 'Rainy Window') AS background_id, FALSE AS is_favourite
) AS tmp
WHERE NOT EXISTS (
    SELECT 1 FROM user_backgrounds WHERE user_id = @demo_student_id
    AND background_id = (SELECT id FROM backgrounds WHERE name = 'Rainy Window')
);

INSERT INTO user_music (user_id, music_id, is_favourite)
SELECT * FROM (SELECT
    @demo_student_id AS user_id, (SELECT id FROM music WHERE title = 'Lofi Chill Beats') AS music_id, TRUE AS is_favourite
) AS tmp
WHERE NOT EXISTS (
    SELECT 1 FROM user_music WHERE user_id = @demo_student_id
    AND music_id = (SELECT id FROM music WHERE title = 'Lofi Chill Beats')
);

INSERT INTO user_music (user_id, music_id, is_favourite)
SELECT * FROM (SELECT
    @demo_student_id AS user_id, (SELECT id FROM music WHERE title = 'Rain Sounds for Focus') AS music_id, FALSE AS is_favourite
) AS tmp
WHERE NOT EXISTS (
    SELECT 1 FROM user_music WHERE user_id = @demo_student_id
    AND music_id = (SELECT id FROM music WHERE title = 'Rain Sounds for Focus')
);

-- ---------------------------------------------------------------------
-- calendars
-- ---------------------------------------------------------------------
INSERT INTO calendars (user_id, date, content)
SELECT * FROM (SELECT @demo_student_id AS user_id, DATE'2026-06-25' AS date, 'Ngày bắt đầu ôn tập chương Đạo hàm' AS content) AS tmp
WHERE NOT EXISTS (SELECT 1 FROM calendars WHERE user_id = @demo_student_id AND date = '2026-06-25');

INSERT INTO calendars (user_id, date, content)
SELECT * FROM (SELECT @demo_student_id AS user_id, DATE'2026-07-01' AS date, 'Chuẩn bị thi giữa kỳ môn Toán' AS content) AS tmp
WHERE NOT EXISTS (SELECT 1 FROM calendars WHERE user_id = @demo_student_id AND date = '2026-07-01');

-- ---------------------------------------------------------------------
-- notes
-- ---------------------------------------------------------------------
INSERT INTO notes (title, content, user_id, calendar_id, type_id)
SELECT * FROM (SELECT
    'Công thức đạo hàm cần nhớ' AS title,
    'd/dx(sin x) = cos x; d/dx(cos x) = -sin x; d/dx(e^x) = e^x' AS content,
    @demo_student_id AS user_id,
    (SELECT id FROM calendars WHERE user_id = @demo_student_id AND date = '2026-07-01') AS calendar_id,
    (SELECT id FROM note_types WHERE name = 'Lecture') AS type_id
) AS tmp
WHERE NOT EXISTS (SELECT 1 FROM notes WHERE user_id = @demo_student_id AND title = 'Công thức đạo hàm cần nhớ');

INSERT INTO notes (title, content, user_id, calendar_id, type_id)
SELECT * FROM (SELECT
    'Ý tưởng ôn tập nhóm' AS title,
    'Rủ nhóm bạn lập phòng học chung mỗi tối để ôn thi giữa kỳ' AS content,
    @demo_student_id AS user_id,
    NULL AS calendar_id,
    (SELECT id FROM note_types WHERE name = 'Idea') AS type_id
) AS tmp
WHERE NOT EXISTS (SELECT 1 FROM notes WHERE user_id = @demo_student_id AND title = 'Ý tưởng ôn tập nhóm');

-- ---------------------------------------------------------------------
-- tasks
-- ---------------------------------------------------------------------
INSERT INTO tasks (user_id, title, subject, priority, status, due_date)
SELECT * FROM (SELECT
    @demo_student_id AS user_id, 'Ôn tập chương Đạo hàm' AS title, 'Toán' AS subject,
    'HIGH' AS priority, 'IN_PROGRESS' AS status, DATE'2026-07-10' AS due_date
) AS tmp
WHERE NOT EXISTS (SELECT 1 FROM tasks WHERE user_id = @demo_student_id AND title = 'Ôn tập chương Đạo hàm');

INSERT INTO tasks (user_id, title, subject, priority, status, due_date)
SELECT * FROM (SELECT
    @demo_student_id AS user_id, 'Luyện nghe IELTS' AS title, 'Tiếng Anh' AS subject,
    'MEDIUM' AS priority, 'TODO' AS status, DATE'2026-07-15' AS due_date
) AS tmp
WHERE NOT EXISTS (SELECT 1 FROM tasks WHERE user_id = @demo_student_id AND title = 'Luyện nghe IELTS');

SET @task_math_id   = (SELECT id FROM tasks WHERE user_id = @demo_student_id AND title = 'Ôn tập chương Đạo hàm');
SET @task_ielts_id  = (SELECT id FROM tasks WHERE user_id = @demo_student_id AND title = 'Luyện nghe IELTS');

-- ---------------------------------------------------------------------
-- times (8 phiên Pomodoro liên tiếp 2026-06-25 -> 2026-07-01, khớp streak=7)
-- ---------------------------------------------------------------------
INSERT INTO times (user_id, task_id, subject, session_type, duration, break_time, count, start_time, focus_score)
SELECT * FROM (SELECT @demo_student_id AS user_id, @task_math_id AS task_id, 'Toán' AS subject, 'POMODORO' AS session_type, 25 AS duration, 5 AS break_time, 1 AS count, TIMESTAMP'2026-06-25 08:10:00' AS start_time, 82.5 AS focus_score) AS tmp
WHERE NOT EXISTS (SELECT 1 FROM times WHERE user_id = @demo_student_id AND start_time = '2026-06-25 08:10:00');

INSERT INTO times (user_id, task_id, subject, session_type, duration, break_time, count, start_time, focus_score)
SELECT * FROM (SELECT @demo_student_id AS user_id, NULL AS task_id, NULL AS subject, 'POMODORO' AS session_type, 25 AS duration, 5 AS break_time, 1 AS count, TIMESTAMP'2026-06-25 20:05:00' AS start_time, 55.0 AS focus_score) AS tmp
WHERE NOT EXISTS (SELECT 1 FROM times WHERE user_id = @demo_student_id AND start_time = '2026-06-25 20:05:00');

INSERT INTO times (user_id, task_id, subject, session_type, duration, break_time, count, start_time, focus_score)
SELECT * FROM (SELECT @demo_student_id AS user_id, @task_math_id AS task_id, 'Toán' AS subject, 'POMODORO' AS session_type, 25 AS duration, 5 AS break_time, 1 AS count, TIMESTAMP'2026-06-26 08:05:00' AS start_time, 88.0 AS focus_score) AS tmp
WHERE NOT EXISTS (SELECT 1 FROM times WHERE user_id = @demo_student_id AND start_time = '2026-06-26 08:05:00');

INSERT INTO times (user_id, task_id, subject, session_type, duration, break_time, count, start_time, focus_score)
SELECT * FROM (SELECT @demo_student_id AS user_id, @task_ielts_id AS task_id, 'Tiếng Anh' AS subject, 'POMODORO' AS session_type, 25 AS duration, 5 AS break_time, 1 AS count, TIMESTAMP'2026-06-27 08:15:00' AS start_time, 75.0 AS focus_score) AS tmp
WHERE NOT EXISTS (SELECT 1 FROM times WHERE user_id = @demo_student_id AND start_time = '2026-06-27 08:15:00');

INSERT INTO times (user_id, task_id, subject, session_type, duration, break_time, count, start_time, focus_score)
SELECT * FROM (SELECT @demo_student_id AS user_id, @task_math_id AS task_id, 'Toán' AS subject, 'POMODORO' AS session_type, 50 AS duration, 10 AS break_time, 2 AS count, TIMESTAMP'2026-06-28 08:00:00' AS start_time, 90.0 AS focus_score) AS tmp
WHERE NOT EXISTS (SELECT 1 FROM times WHERE user_id = @demo_student_id AND start_time = '2026-06-28 08:00:00');

INSERT INTO times (user_id, task_id, subject, session_type, duration, break_time, count, start_time, focus_score)
SELECT * FROM (SELECT @demo_student_id AS user_id, NULL AS task_id, NULL AS subject, 'POMODORO' AS session_type, 25 AS duration, 5 AS break_time, 1 AS count, TIMESTAMP'2026-06-29 21:30:00' AS start_time, 40.0 AS focus_score) AS tmp
WHERE NOT EXISTS (SELECT 1 FROM times WHERE user_id = @demo_student_id AND start_time = '2026-06-29 21:30:00');

INSERT INTO times (user_id, task_id, subject, session_type, duration, break_time, count, start_time, focus_score)
SELECT * FROM (SELECT @demo_student_id AS user_id, @task_ielts_id AS task_id, 'Tiếng Anh' AS subject, 'POMODORO' AS session_type, 25 AS duration, 5 AS break_time, 1 AS count, TIMESTAMP'2026-06-30 08:20:00' AS start_time, 78.0 AS focus_score) AS tmp
WHERE NOT EXISTS (SELECT 1 FROM times WHERE user_id = @demo_student_id AND start_time = '2026-06-30 08:20:00');

-- phiên thứ 8: mới nhất, CHƯA có ai_reflections -> minh hoạ v_pending_reflections
INSERT INTO times (user_id, task_id, subject, session_type, duration, break_time, count, start_time, focus_score)
SELECT * FROM (SELECT @demo_student_id AS user_id, @task_math_id AS task_id, 'Toán' AS subject, 'POMODORO' AS session_type, 25 AS duration, 5 AS break_time, 1 AS count, TIMESTAMP'2026-07-01 08:10:00' AS start_time, NULL AS focus_score) AS tmp
WHERE NOT EXISTS (SELECT 1 FROM times WHERE user_id = @demo_student_id AND start_time = '2026-07-01 08:10:00');

-- ---------------------------------------------------------------------
-- ai_reflections (cho 7 phiên đầu; phiên thứ 8 để trống - đang chờ)
-- ---------------------------------------------------------------------
INSERT INTO ai_reflections (session_id, user_id, q_completion_percent, q_focus_level, q_distraction_reasons, q_improve_next, ai_summary, ai_comparison, ai_recommendation, focus_score, badges)
SELECT * FROM (SELECT
    (SELECT id FROM times WHERE user_id = @demo_student_id AND start_time = '2026-06-25 08:10:00') AS session_id,
    @demo_student_id AS user_id, 90 AS q_completion_percent, 4 AS q_focus_level,
    CAST('["phone"]' AS JSON) AS q_distraction_reasons,
    'Tắt thông báo điện thoại' AS q_improve_next,
    'Bạn hoàn thành 90% mục tiêu với mức tập trung khá tốt.' AS ai_summary,
    NULL AS ai_comparison,
    'Thử để điện thoại ở phòng khác trong buổi tới.' AS ai_recommendation,
    82.5 AS focus_score, 'first_session' AS badges
) AS tmp
WHERE NOT EXISTS (SELECT 1 FROM ai_reflections WHERE session_id = (SELECT id FROM times WHERE user_id = @demo_student_id AND start_time = '2026-06-25 08:10:00'));

INSERT INTO ai_reflections (session_id, user_id, q_completion_percent, q_focus_level, q_distraction_reasons, q_improve_next, ai_summary, ai_comparison, ai_recommendation, focus_score, badges)
SELECT * FROM (SELECT
    (SELECT id FROM times WHERE user_id = @demo_student_id AND start_time = '2026-06-25 20:05:00') AS session_id,
    @demo_student_id AS user_id, 60 AS q_completion_percent, 2 AS q_focus_level,
    CAST('["phone","tired"]' AS JSON) AS q_distraction_reasons,
    'Ngủ đủ giấc trước khi học buổi tối' AS q_improve_next,
    'Buổi tối bạn khá mệt và mất tập trung nhiều lần.' AS ai_summary,
    NULL AS ai_comparison,
    'Cân nhắc chuyển buổi học sang buổi sáng.' AS ai_recommendation,
    55.0 AS focus_score, NULL AS badges
) AS tmp
WHERE NOT EXISTS (SELECT 1 FROM ai_reflections WHERE session_id = (SELECT id FROM times WHERE user_id = @demo_student_id AND start_time = '2026-06-25 20:05:00'));

INSERT INTO ai_reflections (session_id, user_id, q_completion_percent, q_focus_level, q_distraction_reasons, q_improve_next, ai_summary, ai_comparison, ai_recommendation, focus_score, badges)
SELECT * FROM (SELECT
    (SELECT id FROM times WHERE user_id = @demo_student_id AND start_time = '2026-06-26 08:05:00') AS session_id,
    @demo_student_id AS user_id, 95 AS q_completion_percent, 4 AS q_focus_level,
    CAST('["noise"]' AS JSON) AS q_distraction_reasons,
    NULL AS q_improve_next,
    'Buổi sáng nay bạn tập trung tốt, chỉ bị ồn xung quanh làm phân tâm nhẹ.' AS ai_summary,
    NULL AS ai_comparison,
    'Có thể dùng tai nghe chống ồn cho các buổi sáng.' AS ai_recommendation,
    88.0 AS focus_score, 'consistency_3' AS badges
) AS tmp
WHERE NOT EXISTS (SELECT 1 FROM ai_reflections WHERE session_id = (SELECT id FROM times WHERE user_id = @demo_student_id AND start_time = '2026-06-26 08:05:00'));

INSERT INTO ai_reflections (session_id, user_id, q_completion_percent, q_focus_level, q_distraction_reasons, q_improve_next, ai_summary, ai_comparison, ai_recommendation, focus_score, badges)
SELECT * FROM (SELECT
    (SELECT id FROM times WHERE user_id = @demo_student_id AND start_time = '2026-06-27 08:15:00') AS session_id,
    @demo_student_id AS user_id, 80 AS q_completion_percent, 3 AS q_focus_level,
    CAST('["phone"]' AS JSON) AS q_distraction_reasons,
    NULL AS q_improve_next,
    'Buổi học tiếng Anh khá ổn dù có xao nhãng vì điện thoại.' AS ai_summary,
    'So với 3 buổi trước, mức tập trung của bạn ổn định hơn.' AS ai_comparison,
    'Bật chế độ không làm phiền khi luyện nghe.' AS ai_recommendation,
    75.0 AS focus_score, NULL AS badges
) AS tmp
WHERE NOT EXISTS (SELECT 1 FROM ai_reflections WHERE session_id = (SELECT id FROM times WHERE user_id = @demo_student_id AND start_time = '2026-06-27 08:15:00'));

INSERT INTO ai_reflections (session_id, user_id, q_completion_percent, q_focus_level, q_distraction_reasons, q_improve_next, ai_summary, ai_comparison, ai_recommendation, focus_score, badges)
SELECT * FROM (SELECT
    (SELECT id FROM times WHERE user_id = @demo_student_id AND start_time = '2026-06-28 08:00:00') AS session_id,
    @demo_student_id AS user_id, 98 AS q_completion_percent, 5 AS q_focus_level,
    CAST('[]' AS JSON) AS q_distraction_reasons,
    NULL AS q_improve_next,
    'Đây là buổi học tập trung nhất của bạn trong tuần.' AS ai_summary,
    'Điểm tập trung tăng đáng kể so với 4 buổi trước đó.' AS ai_comparison,
    'Giữ nguyên khung giờ 8h sáng cho môn Toán.' AS ai_recommendation,
    90.0 AS focus_score, 'deep_focus' AS badges
) AS tmp
WHERE NOT EXISTS (SELECT 1 FROM ai_reflections WHERE session_id = (SELECT id FROM times WHERE user_id = @demo_student_id AND start_time = '2026-06-28 08:00:00'));

INSERT INTO ai_reflections (session_id, user_id, q_completion_percent, q_focus_level, q_distraction_reasons, q_improve_next, ai_summary, ai_comparison, ai_recommendation, focus_score, badges)
SELECT * FROM (SELECT
    (SELECT id FROM times WHERE user_id = @demo_student_id AND start_time = '2026-06-29 21:30:00') AS session_id,
    @demo_student_id AS user_id, 50 AS q_completion_percent, 2 AS q_focus_level,
    CAST('["phone","tired","noise"]' AS JSON) AS q_distraction_reasons,
    'Không nên học sau 21h khi đã mệt' AS q_improve_next,
    'Buổi học muộn bị ảnh hưởng bởi nhiều yếu tố gây xao nhãng.' AS ai_summary,
    'Đây là buổi có điểm tập trung thấp nhất trong 6 buổi gần đây.' AS ai_comparison,
    'Ưu tiên học vào buổi sáng thay vì tối muộn.' AS ai_recommendation,
    40.0 AS focus_score, NULL AS badges
) AS tmp
WHERE NOT EXISTS (SELECT 1 FROM ai_reflections WHERE session_id = (SELECT id FROM times WHERE user_id = @demo_student_id AND start_time = '2026-06-29 21:30:00'));

INSERT INTO ai_reflections (session_id, user_id, q_completion_percent, q_focus_level, q_distraction_reasons, q_improve_next, ai_summary, ai_comparison, ai_recommendation, focus_score, badges)
SELECT * FROM (SELECT
    (SELECT id FROM times WHERE user_id = @demo_student_id AND start_time = '2026-06-30 08:20:00') AS session_id,
    @demo_student_id AS user_id, 85 AS q_completion_percent, 3 AS q_focus_level,
    CAST('["tired"]' AS JSON) AS q_distraction_reasons,
    NULL AS q_improve_next,
    'Buổi học tiếng Anh buổi sáng cho kết quả khá tốt dù còn hơi mệt.' AS ai_summary,
    'Cải thiện rõ so với buổi tối trước đó.' AS ai_comparison,
    'Duy trì thói quen học buổi sáng.' AS ai_recommendation,
    78.0 AS focus_score, NULL AS badges
) AS tmp
WHERE NOT EXISTS (SELECT 1 FROM ai_reflections WHERE session_id = (SELECT id FROM times WHERE user_id = @demo_student_id AND start_time = '2026-06-30 08:20:00'));

-- ---------------------------------------------------------------------
-- session_summaries (tổng hợp 7 phiên đầu tiên, khớp sp_generate_session_summary)
-- ---------------------------------------------------------------------
INSERT INTO session_summaries (user_id, from_session_id, to_session_id, session_count, best_time_slot, main_distraction, trend, ai_content)
SELECT * FROM (SELECT
    @demo_student_id AS user_id,
    (SELECT id FROM times WHERE user_id = @demo_student_id AND start_time = '2026-06-25 08:10:00') AS from_session_id,
    (SELECT id FROM times WHERE user_id = @demo_student_id AND start_time = '2026-06-30 08:20:00') AS to_session_id,
    7 AS session_count,
    '08:00 - 09:00' AS best_time_slot,
    'phone' AS main_distraction,
    'UP' AS trend,
    'Trong 7 buổi gần đây, bạn tập trung tốt nhất vào khung giờ 08:00-09:00. Nguyên nhân mất tập trung phổ biến nhất là điện thoại. Xu hướng tập trung đang cải thiện dần theo thời gian.' AS ai_content
) AS tmp
WHERE NOT EXISTS (
    SELECT 1 FROM session_summaries
    WHERE user_id = @demo_student_id
      AND to_session_id = (SELECT id FROM times WHERE user_id = @demo_student_id AND start_time = '2026-06-30 08:20:00')
);

-- ---------------------------------------------------------------------
-- rooms / room_users
-- ---------------------------------------------------------------------
INSERT INTO rooms (name, room_limit, created_by, status)
SELECT * FROM (SELECT
    'Phòng học nhóm Toán cao cấp' AS name, 6 AS room_limit, @demo_host_id AS created_by, 'ACTIVE' AS status
) AS tmp
WHERE NOT EXISTS (SELECT 1 FROM rooms WHERE name = 'Phòng học nhóm Toán cao cấp' AND created_by = @demo_host_id);

SET @room_id = (SELECT id FROM rooms WHERE name = 'Phòng học nhóm Toán cao cấp' AND created_by = @demo_host_id);

INSERT INTO room_users (room_id, user_id, role)
SELECT * FROM (SELECT @room_id AS room_id, @demo_host_id AS user_id, 'HOST' AS role) AS tmp
WHERE NOT EXISTS (SELECT 1 FROM room_users WHERE room_id = @room_id AND user_id = @demo_host_id);

INSERT INTO room_users (room_id, user_id, role)
SELECT * FROM (SELECT @room_id AS room_id, @demo_student_id AS user_id, 'MEMBER' AS role) AS tmp
WHERE NOT EXISTS (SELECT 1 FROM room_users WHERE room_id = @room_id AND user_id = @demo_student_id);
