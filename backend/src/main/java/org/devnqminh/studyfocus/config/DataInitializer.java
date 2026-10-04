package org.devnqminh.studyfocus.config;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.devnqminh.studyfocus.config.ai.AiQuotaProperties;
import org.devnqminh.studyfocus.model.NoteType;
import org.devnqminh.studyfocus.model.Subscription;
import org.devnqminh.studyfocus.repository.NoteTypeRepository;
import org.devnqminh.studyfocus.repository.SubscriptionRepository;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;

@Component
@RequiredArgsConstructor
@Slf4j
public class DataInitializer implements ApplicationRunner {

    private final NoteTypeRepository noteTypeRepository;
    private final SubscriptionRepository subscriptionRepository;

    @Override
    public void run(ApplicationArguments args) {
        if (noteTypeRepository.findByName("General").isEmpty()) {
            noteTypeRepository.save(NoteType.builder()
                    .name("General")
                    .status(1)
                    .build());
        }

        // Hai gói cước tối thiểu để rate limit AI có cái tra quota.
        // User chưa gắn subscription được coi là FREE (xem AiQuotaProperties.defaultPlan).
        seedPlan(AiQuotaProperties.PLAN_FREE, "Free", BigDecimal.ZERO);
        seedPlan(AiQuotaProperties.PLAN_PREMIUM, "Premium", new BigDecimal("49000"));
    }

    private void seedPlan(String code, String name, BigDecimal price) {
        if (subscriptionRepository.findByCode(code).isEmpty()) {
            subscriptionRepository.save(Subscription.builder()
                    .code(code)
                    .name(name)
                    .price(price)
                    .build());
            log.info("Seeded subscription plan {}", code);
        }
    }
}
