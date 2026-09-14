package org.devnqminh.studyfocus.model;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Entity
@Table(name = "user_settings")
@Data
public class UserSettings {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // owning side
    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", unique = true, nullable = false)
    private User user;

    // Pomodoro settings
    @Column(name = "focus_time", nullable = false)
    private int focusTime = 25;

    @Column(name = "short_break", nullable = false)
    private int shortBreak = 5;

    @Column(name = "long_break", nullable = false)
    private int longBreak = 15;

    @Column(name = "preset_name", length = 100)
    private String presetName = "Classic Pomodoro";

    private boolean countUpTimer = false;

    private boolean deepFocusMode = false;

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
