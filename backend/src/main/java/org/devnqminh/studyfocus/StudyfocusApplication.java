package org.devnqminh.studyfocus;

import org.devnqminh.studyfocus.model.NoteType;
import org.devnqminh.studyfocus.model.User;
import org.devnqminh.studyfocus.repository.NoteTypeRepository;
import org.devnqminh.studyfocus.repository.UserRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

@SpringBootApplication(proxyBeanMethods = false)
public class StudyfocusApplication {

    public static void main(String[] args) {
        SpringApplication.run(StudyfocusApplication.class, args);
    }

    @Bean
    CommandLineRunner init(UserRepository userRepository, NoteTypeRepository noteTypeRepository) {
        return args -> {
            if (userRepository.findByUsername("testuser").isEmpty()) {
                User user = User.builder()
                        .name("Test User")
                        .username("testuser")
                        .email("testuser@example.com")
                        .passwordHash(new BCryptPasswordEncoder().encode("123456"))
                        .createdAt(java.time.Instant.now())
                        .status("ACTIVE")
                        .build();
                userRepository.save(user);
            }

            if (noteTypeRepository.findByName("General").isEmpty()) {
                noteTypeRepository.save(NoteType.builder()
                        .name("General")
                        .status(1)
                        .build());
            }
        };
    }
}