package org.devnqminh.studyfocus.service.Impl.authen;

import org.devnqminh.studyfocus.dto.request.authentication.LoginRequest;
import org.devnqminh.studyfocus.dto.request.authentication.RegisterRequest;
import org.devnqminh.studyfocus.dto.response.authentication.LoginResponse;
import org.devnqminh.studyfocus.dto.response.user.UserProfileResponse;
import org.devnqminh.studyfocus.model.User;
import org.devnqminh.studyfocus.repository.UserRepository;
import org.devnqminh.studyfocus.service.IAuthService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestTemplate;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class AuthServiceImpl implements IAuthService {
    @Autowired
    private UserRepository userRepository;
    @Autowired
    private PasswordEncoder passwordEncoder;

    @Value("${google.client-id:}")
    private String googleClientId;

    private final RestTemplate restTemplate = new RestTemplate();

    //Implement JWT token generation
    private String generateToken(User user) {
        return "dummy-jwt-token";
    }

    @Override
    public LoginResponse login(LoginRequest loginRequest) {

        User user = userRepository.findByUsername(loginRequest.getUsername())
                .orElseThrow(() -> new RuntimeException("Invalid username or password"));

        if (!passwordEncoder.matches(
                loginRequest.getPassword(),
                user.getPasswordHash()
        )) {
            throw new RuntimeException("Invalid username or password");
        }

        String token = "dummy-token";
        return new LoginResponse(token, user.getUsername(), user.getId());
    }

    @Override
    public void register(RegisterRequest request) {
        if (userRepository.findByUsername(request.getUsername()).isPresent()) {
            throw new RuntimeException("Username already exists");
        }
        if (request.getEmail() != null && !request.getEmail().trim().isEmpty()) {
            String trimmedEmail = request.getEmail().trim();
            if (userRepository.findByEmail(trimmedEmail).isPresent()) {
                throw new RuntimeException("Email already exists");
            }
        }
        User user = new User();
        user.setUsername(request.getUsername());
        user.setPasswordHash(passwordEncoder.encode(request.getPassword()));
        user.setName(request.getName());
        if (request.getEmail() != null && !request.getEmail().trim().isEmpty()) {
            user.setEmail(request.getEmail().trim());
        }
        user.setCreatedAt(Instant.now());
        user.setStatus("ACTIVE");
        userRepository.save(user);
    }

    @Override
    @Transactional
    public LoginResponse loginOrRegisterWithGoogle(String idToken) {
        if (idToken == null || idToken.trim().isEmpty()) {
            throw new IllegalArgumentException("Google ID Token must not be empty");
        }

        String url = "https://oauth2.googleapis.com/tokeninfo?id_token=" + idToken.trim();
        Map<String, Object> payload;
        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> response = restTemplate.getForObject(url, Map.class);
            payload = response;
        } catch (Exception e) {
            throw new RuntimeException("Invalid or expired Google token");
        }

        if (payload == null) {
            throw new RuntimeException("Unable to verify Google token");
        }

        String aud = (String) payload.get("aud");
        if (googleClientId != null && !googleClientId.trim().isEmpty()) {
            String expectedAud = googleClientId.trim();
            if (expectedAud.endsWith(".")) {
                expectedAud = expectedAud.substring(0, expectedAud.length() - 1);
            }
            if (aud != null && !expectedAud.equals(aud.trim())) {
                throw new RuntimeException("Google token audience mismatch");
            }
        }

        String email = (String) payload.get("email");
        String emailVerified = String.valueOf(payload.get("email_verified"));
        if (email == null || email.trim().isEmpty() || !"true".equalsIgnoreCase(emailVerified)) {
            throw new RuntimeException("Google account email is not verified");
        }

        String cleanEmail = email.trim();
        String name = (String) payload.get("name");
        String picture = (String) payload.get("picture");

        User user = userRepository.findByEmail(cleanEmail).orElse(null);
        if (user == null) {
            String baseUsername = cleanEmail.split("@")[0].replaceAll("[^a-zA-Z0-9_]", "");
            if (baseUsername.isEmpty()) {
                baseUsername = "user";
            }
            String candidateUsername = baseUsername;
            int suffix = 1;
            while (userRepository.findByUsername(candidateUsername).isPresent()) {
                candidateUsername = baseUsername + suffix;
                suffix++;
            }

            user = User.builder()
                    .email(cleanEmail)
                    .name(name != null && !name.trim().isEmpty() ? name.trim() : baseUsername)
                    .username(candidateUsername)
                    .passwordHash(passwordEncoder.encode(UUID.randomUUID().toString()))
                    .image(picture)
                    .createdAt(Instant.now())
                    .status("ACTIVE")
                    .build();
            user = userRepository.save(user);
        } else {
            if ((user.getImage() == null || user.getImage().trim().isEmpty()) && picture != null) {
                user.setImage(picture);
                userRepository.save(user);
            }
        }

        String token = generateToken(user);
        return new LoginResponse(token, user.getUsername(), user.getId());
    }

    @Override
    @Transactional(readOnly = true)
    public UserProfileResponse getUserProfile(Long userId) {
        User user = userRepository.findByIdWithTimes(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));

        return UserProfileResponse.builder()
                .id(user.getId())
                .username(user.getUsername())
                .name(user.getName())
                .email(user.getEmail())
                .location(user.getLocation())
                .image(user.getImage())
                .createdAt(user.getCreatedAt())
                .status(user.getStatus())
                .times(user.getTimes().stream()
                        .map(time -> UserProfileResponse.StudyTimeDTO.builder()
                                .id(time.getId())
                                .duration(time.getDuration())
                                .breakTime(time.getBreakTime())
                                .count(time.getCount())
                                .createdAt(time.getCreatedAt())
                                .build())
                        .collect(Collectors.toList()))
                .build();
    }

}
