package org.devnqminh.studyfocus.model;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.*;
import jakarta.persistence.Id;


import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "subscriptions")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Subscription {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /**
     * Mã gói dùng để tra quota AI trong config (ai.quota.limits.<code>).
     * User chưa gắn subscription được coi là FREE.
     */
    // nullable ở tầng DB để ddl-auto=update không làm hỏng bảng subscriptions đã có dữ liệu;
    // @NotBlank vẫn bắt buộc code cho mọi bản ghi tạo qua ứng dụng
    @NotBlank
    @Column(unique = true, length = 30)
    private String code;

    @NotBlank
    @Column(nullable = false, length = 100)
    private String name;
    @NotNull
    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal price;
    // 1 subscription plan can be used by many users (current plan)
    @OneToMany(mappedBy = "subscription")
    @Builder.Default
    private List<User> users = new ArrayList<>();
}
