package org.devnqminh.studyfocus.model;


import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.*;

@Entity
@Table(name = "music")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor @Builder
public class Music {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @NotBlank
    @Column(nullable = false, length = 500)
    private String link;

    @NotNull
    @Column(nullable = false)
    private Double duration;

    @NotBlank
    @Column(nullable = false, length = 200)
    private String title;
}
