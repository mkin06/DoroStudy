package org.devnqminh.studyfocus.model;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import lombok.*;
import jakarta.persistence.Id;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;


@Entity
@Table(name = "users")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @NotBlank
    @Column(nullable = false, length = 120)
    private String name;

    @NotBlank
    @Column(nullable = false, unique = true, length = 60)
    private String username;

    @NotBlank
    @Column(nullable = false, length = 255)
    private String passwordHash;

    @Column(nullable = true, unique = true)
    private String email;

    @Column(length = 255)
    private String location;

    @Column(length = 255)
    private String image;

    @Column(nullable = false)
    private Instant createdAt;

    @Column(nullable = false, length = 30)
    private String status; // e.g., ACTIVE, INACTIVE

    // Many users -> one subscription plan (optional: free user)
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "subscription_id") // maps id_sub(FR)
    private Subscription subscription;

    // --- Relationships ---
    @OneToMany(mappedBy = "user", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<StudyTime> times = new ArrayList<>();

    @OneToMany(mappedBy = "user", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<Note> notes = new ArrayList<>();

    @OneToMany(mappedBy = "user", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<RoomUser> roomUsers = new ArrayList<>();

    @OneToMany(mappedBy = "user", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<UserMusic> userMusic = new ArrayList<>();

    @OneToMany(mappedBy = "user", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<UserBackground> userBackgrounds = new ArrayList<>();

    @PrePersist
    void prePersist() {
        if (createdAt == null) createdAt = Instant.now();
        if (status == null) status = "ACTIVE";
    }
}
