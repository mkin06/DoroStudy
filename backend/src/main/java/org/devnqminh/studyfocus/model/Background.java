package org.devnqminh.studyfocus.model;


import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "backgrounds")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor @Builder
public class Background {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(length = 500)
    private String image;

    @Column(length = 500)
    private String video;
}