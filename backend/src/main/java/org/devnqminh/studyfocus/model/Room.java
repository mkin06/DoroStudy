package org.devnqminh.studyfocus.model;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotNull;
import lombok.*;

@Entity
@Table(name = "rooms")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class Room {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // tránh keyword LIMIT trong SQL bằng cách đổi tên cột
    @NotNull
    @Column(name = "room_limit", nullable = false)
    private Integer limit;

    @NotNull
    @Column(nullable = false)
    private Integer quantity;
}