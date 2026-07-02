-- =====================================================================
-- 01_schema.sql
-- Định nghĩa toàn bộ cấu trúc DB cho StudyFocus (bao gồm phần AI Reflection)
-- Engine: MySQL 8.0+
--
-- Ghi chú khác biệt so với entity Java hiện tại (cần đồng bộ khi migrate):
--   - rooms: bỏ cột `quantity` (số thành viên tính bằng COUNT(room_users))
--   - calendars: thêm user_id (entity hiện tại đang thiếu FK này)
--   - times: thêm task_id, subject, session_type, start_time, focus_score
--   - users: thêm level/xp/coins/streak/last_active_date/sessions_since_last_summary
-- =====================================================================

CREATE DATABASE IF NOT EXISTS studyfocus
    CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE studyfocus;

-- ---------------------------------------------------------------------
-- 1. subscriptions
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS subscriptions (
    id              BIGINT PRIMARY KEY AUTO_INCREMENT,
    name            VARCHAR(100) NOT NULL,
    price           DECIMAL(12,2) NOT NULL DEFAULT 0,
    billing_cycle   ENUM('MONTHLY','ANNUAL','LIFETIME') NOT NULL,
    description     TEXT,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 2. users
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id                              BIGINT PRIMARY KEY AUTO_INCREMENT,
    username                        VARCHAR(60)  NOT NULL UNIQUE,
    email                           VARCHAR(255) NOT NULL UNIQUE,
    password_hash                   VARCHAR(255) NOT NULL,
    name                            VARCHAR(120) NOT NULL,
    image                           VARCHAR(500),
    status                          ENUM('ACTIVE','INACTIVE','BANNED') NOT NULL DEFAULT 'ACTIVE',

    level                           INT NOT NULL DEFAULT 1,
    xp                              INT NOT NULL DEFAULT 0,
    coins                           INT NOT NULL DEFAULT 0,

    current_streak                  INT NOT NULL DEFAULT 0,
    best_streak                     INT NOT NULL DEFAULT 0,
    last_active_date                DATE,

    -- đếm số phiên đã hoàn thành reflection kể từ lần AI tổng hợp gần nhất
    -- dùng để trigger session_summaries sau mỗi 7 phiên (thay vì theo tuần)
    sessions_since_last_summary     INT NOT NULL DEFAULT 0,

    subscription_id                 BIGINT NULL,
    created_at                      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 3. user_subscriptions
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_subscriptions (
    id                  BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id             BIGINT NOT NULL,
    subscription_id     BIGINT NOT NULL,
    started_at          DATETIME NOT NULL,
    expires_at          DATETIME NULL,
    status              ENUM('ACTIVE','EXPIRED','CANCELLED') NOT NULL DEFAULT 'ACTIVE',

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE RESTRICT,
    INDEX idx_user_subscriptions_user (user_id)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 4. user_settings
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_settings (
    id                  BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id             BIGINT NOT NULL UNIQUE,
    focus_time          INT NOT NULL DEFAULT 25,
    short_break         INT NOT NULL DEFAULT 5,
    long_break          INT NOT NULL DEFAULT 15,
    preset_name         VARCHAR(100) DEFAULT 'Classic Pomodoro',
    count_up_timer      BOOLEAN NOT NULL DEFAULT FALSE,
    deep_focus_mode     BOOLEAN NOT NULL DEFAULT FALSE,
    created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 5. backgrounds
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS backgrounds (
    id              BIGINT PRIMARY KEY AUTO_INCREMENT,
    name            VARCHAR(100),
    image           VARCHAR(500),
    video           VARCHAR(500),
    type            ENUM('MOTION','STILL','WEATHER','PERSONALIZE') NOT NULL DEFAULT 'STILL',
    category        VARCHAR(100),
    thumbnail       VARCHAR(500),
    is_premium      BOOLEAN NOT NULL DEFAULT FALSE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 6. music
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS music (
    id              BIGINT PRIMARY KEY AUTO_INCREMENT,
    title           VARCHAR(200) NOT NULL,
    link            VARCHAR(500) NOT NULL,
    duration        INT,
    type            ENUM('YOUTUBE','SPOTIFY','CUSTOM') NOT NULL DEFAULT 'YOUTUBE',
    thumbnail       VARCHAR(500),
    is_premium      BOOLEAN NOT NULL DEFAULT FALSE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 7. user_backgrounds
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_backgrounds (
    id              BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id         BIGINT NOT NULL,
    background_id   BIGINT NOT NULL,
    is_favourite    BOOLEAN NOT NULL DEFAULT FALSE,

    UNIQUE KEY uk_user_background (user_id, background_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (background_id) REFERENCES backgrounds(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 8. user_music
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_music (
    id              BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id         BIGINT NOT NULL,
    music_id        BIGINT NOT NULL,
    is_favourite    BOOLEAN NOT NULL DEFAULT FALSE,

    UNIQUE KEY uk_user_music (user_id, music_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (music_id) REFERENCES music(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 9. note_types
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS note_types (
    id          BIGINT PRIMARY KEY AUTO_INCREMENT,
    name        VARCHAR(80) NOT NULL UNIQUE,
    status      TINYINT NOT NULL DEFAULT 1
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 10. calendars
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS calendars (
    id          BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id     BIGINT NOT NULL,
    date        DATE NOT NULL,
    content     TEXT,

    UNIQUE KEY uk_calendar_user_date (user_id, date),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 11. notes
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notes (
    id              BIGINT PRIMARY KEY AUTO_INCREMENT,
    title           VARCHAR(200),
    content         TEXT,
    user_id         BIGINT NOT NULL,
    calendar_id     BIGINT NULL,
    type_id         BIGINT NOT NULL,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (calendar_id) REFERENCES calendars(id) ON DELETE SET NULL,
    FOREIGN KEY (type_id) REFERENCES note_types(id) ON DELETE RESTRICT,
    INDEX idx_notes_user (user_id)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 12. tasks
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tasks (
    id              BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id         BIGINT NOT NULL,
    title           VARCHAR(200) NOT NULL,
    subject         VARCHAR(100),
    priority        ENUM('LOW','MEDIUM','HIGH') NOT NULL DEFAULT 'MEDIUM',
    status          ENUM('TODO','IN_PROGRESS','DONE') NOT NULL DEFAULT 'TODO',
    due_date        DATE,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_tasks_user (user_id)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 13. times (Pomodoro sessions)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS times (
    id              BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id         BIGINT NOT NULL,
    task_id         BIGINT NULL,

    -- optional: tag nhanh môn học khi không gắn task cụ thể
    subject         VARCHAR(100) NULL,

    session_type    ENUM('POMODORO','CUSTOM','STOPWATCH') NOT NULL DEFAULT 'POMODORO',
    duration        DOUBLE NOT NULL,
    break_time      DOUBLE NOT NULL,
    count           INT NOT NULL DEFAULT 1,
    start_time      DATETIME NULL,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- do AI tính sau khi có reflection, không phải user nhập
    focus_score     DECIMAL(5,2) NULL,

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE SET NULL,
    INDEX idx_times_user_created (user_id, created_at)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 14. ai_reflections (per-session, 3 câu hỏi sau mỗi Pomodoro)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ai_reflections (
    id                      BIGINT PRIMARY KEY AUTO_INCREMENT,
    session_id              BIGINT NOT NULL,
    user_id                 BIGINT NOT NULL,

    q_completion_percent    INT NULL,               -- slider 0-100
    q_focus_level           INT NULL,                -- 1-5 (emoji scale)
    q_distraction_reasons   JSON NULL,               -- ví dụ: ["phone","noise"]
    q_improve_next          TEXT NULL,               -- optional

    ai_summary              TEXT,
    ai_comparison           TEXT NULL,               -- NULL nếu user mới (<7 phiên)
    ai_recommendation       TEXT,

    focus_score             DECIMAL(5,2),
    badges                  VARCHAR(255),

    created_at              DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    UNIQUE KEY uk_ai_reflection_session (session_id),
    FOREIGN KEY (session_id) REFERENCES times(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_ai_reflections_user (user_id)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 15. session_summaries (tổng hợp mỗi 7-10 phiên, thay cho "weekly")
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS session_summaries (
    id                  BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id             BIGINT NOT NULL,
    from_session_id     BIGINT NOT NULL,
    to_session_id       BIGINT NOT NULL,
    session_count       INT NOT NULL,

    best_time_slot      VARCHAR(50),
    main_distraction    VARCHAR(100),
    trend               ENUM('UP','DOWN','STABLE'),
    ai_content          TEXT,

    created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    UNIQUE KEY uk_session_summary_user_to (user_id, to_session_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (from_session_id) REFERENCES times(id),
    FOREIGN KEY (to_session_id) REFERENCES times(id)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 16. rooms
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rooms (
    id              BIGINT PRIMARY KEY AUTO_INCREMENT,
    name            VARCHAR(100),
    room_limit      INT NOT NULL,
    created_by      BIGINT NOT NULL,
    status          ENUM('ACTIVE','CLOSED') NOT NULL DEFAULT 'ACTIVE',
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 17. room_users (số thành viên hiện có = COUNT(*) theo room_id)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS room_users (
    id              BIGINT PRIMARY KEY AUTO_INCREMENT,
    room_id         BIGINT NOT NULL,
    user_id         BIGINT NOT NULL,
    role            ENUM('HOST','MEMBER') NOT NULL DEFAULT 'MEMBER',
    joined_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    UNIQUE KEY uk_room_user (room_id, user_id),
    FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;
