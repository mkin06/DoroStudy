package org.devnqminh.studyfocus.model;


import jakarta.persistence.*;
import jakarta.validation.constraints.NotNull;
import lombok.*;

@Entity
@Table(
        name = "user_music",
        uniqueConstraints = @UniqueConstraint(name = "uk_user_music", columnNames = {"user_id", "music_id"})
)
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor @Builder
public class UserMusic {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "music_id", nullable = false)
    private Music music;

    // favourite nên để ở bảng join (vì favourite là theo từng user)
    @NotNull
    @Column(nullable = false)
    private Boolean isFavourite;

    @PrePersist
    void prePersist() {
        if (isFavourite == null) isFavourite = false;
    }
}
