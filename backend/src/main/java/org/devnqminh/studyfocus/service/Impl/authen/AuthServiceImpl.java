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
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;
import org.springframework.dao.DataIntegrityViolationException;

import java.time.Instant;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

@Service
public class AuthServiceImpl implements IAuthService {
    @Autowired
    private UserRepository userRepository;
    @Autowired
    private PasswordEncoder passwordEncoder;

    @Value("${google.client-id:}")
    private String googleClientId;

    private final RestTemplate restTemplate = new RestTemplate();

    @Override
    public LoginResponse login(LoginRequest loginRequest) {
        String identifier = normalizeIdentifier(loginRequest.getUsername());
        if (identifier.isEmpty() || loginRequest.getPassword() == null) {
            throw new RuntimeException("Invalid username or password");
        }

        List<User> candidates = userRepository.findLoginCandidates(identifier);
        if (candidates.size() != 1) {
            throw new RuntimeException("Invalid username or password");
        }
        User user = candidates.get(0);

        if (!passwordEncoder.matches(
                loginRequest.getPassword(),
                user.getPasswordHash()
        )) {
            throw new RuntimeException("Invalid username or password");
        }

        return new LoginResponse(user.getUsername(), user.getId(), user.getRole());
    }

    @Override
    @Transactional
    public void register(RegisterRequest request) {
        String username = normalizeIdentifier(request.getUsername()).toLowerCase(Locale.ROOT);
        String email = normalizeIdentifier(request.getEmail()).toLowerCase(Locale.ROOT);
        String name = request.getName() == null ? "" : request.getName().trim();
        String password = request.getPassword();

        if (password == null || password.getBytes(StandardCharsets.UTF_8).length > 72) {
            throw new IllegalArgumentException("Mật khẩu quá dài. Vui lòng dùng tối đa 72 byte UTF-8.");
        }
        if (userRepository.existsByNormalizedUsername(username)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Tên đăng nhập đã được sử dụng.");
        }
        if (userRepository.existsByNormalizedEmail(email)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Email đã được sử dụng.");
        }

        User user = new User();
        user.setUsername(username);
        user.setPasswordHash(passwordEncoder.encode(password));
        user.setName(name);
        user.setEmail(email);
        user.setCreatedAt(Instant.now());
        user.setStatus("ACTIVE");
        user.setRole("duynhatvo05@gmail.com".equalsIgnoreCase(email) ? "ADMIN" : "USER");
        try {
            userRepository.saveAndFlush(user);
        } catch (DataIntegrityViolationException e) {
            // Chặn trường hợp hai request đăng ký trùng chạy đồng thời.
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Tên đăng nhập hoặc email đã được sử dụng.");
        }
    }

    @Override
    @Transactional
    public LoginResponse loginOrRegisterWithGoogle(String idToken) {
        if (idToken == null || idToken.trim().isEmpty()) {
            throw new IllegalArgumentException("Google không trả về mã xác thực.");
        }

        String url = "https://oauth2.googleapis.com/tokeninfo?id_token=" + idToken.trim();
        Map<String, Object> payload;
        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> response = restTemplate.getForObject(url, Map.class);
            payload = response;
        } catch (Exception e) {
            throw new RuntimeException("Mã xác thực Google không hợp lệ hoặc đã hết hạn.");
        }

        if (payload == null) {
            throw new RuntimeException("Không thể xác minh tài khoản Google.");
        }

        String aud = (String) payload.get("aud");
        if (googleClientId == null || googleClientId.trim().isEmpty()) {
            throw new RuntimeException("Máy chủ chưa được cấu hình Google Client ID.");
        }
        String expectedAud = googleClientId.trim();
        if (aud == null || !expectedAud.equals(aud.trim())) {
            throw new RuntimeException("Mã xác thực Google không thuộc ứng dụng DoroStudy.");
        }

        String email = (String) payload.get("email");
        String emailVerified = String.valueOf(payload.get("email_verified"));
        if (email == null || email.trim().isEmpty() || !"true".equalsIgnoreCase(emailVerified)) {
            throw new RuntimeException("Email của tài khoản Google chưa được xác minh.");
        }

        String cleanEmail = email.trim();
        String name = (String) payload.get("name");
        String picture = (String) payload.get("picture");

        User user = userRepository.findByEmailIgnoreCase(cleanEmail).orElse(null);
        if (user == null) {
            String baseUsername = cleanEmail.split("@")[0].replaceAll("[^a-zA-Z0-9_]", "");
            if (baseUsername.isEmpty()) {
                baseUsername = "user";
            }
            String candidateUsername = baseUsername;
            int suffix = 1;
            while (userRepository.findByUsernameIgnoreCase(candidateUsername).isPresent()) {
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
                    .role("duynhatvo05@gmail.com".equalsIgnoreCase(cleanEmail) ? "ADMIN" : "USER")
                    .build();
            user = userRepository.save(user);
        } else {
            boolean modified = false;
            if ((user.getImage() == null || user.getImage().trim().isEmpty()) && picture != null) {
                user.setImage(picture);
                modified = true;
            }
            if ("duynhatvo05@gmail.com".equalsIgnoreCase(cleanEmail) && !"ADMIN".equalsIgnoreCase(user.getRole())) {
                user.setRole("ADMIN");
                modified = true;
            }
            if (modified) {
                userRepository.save(user);
            }
        }

        return new LoginResponse(user.getUsername(), user.getId(), user.getRole());
    }

    @Override
    @Transactional(readOnly = true)
    public UserProfileResponse getUserProfile(Long userId) {
        // /me nằm trên đường tải trang chính nên chỉ đọc bản ghi user. Lịch sử phiên có
        // endpoint riêng với giới hạn thời gian; fetch-join ở đây từng tải trùng toàn bộ.
        User user = userRepository.findById(userId)
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
                .role(user.getRole() != null ? user.getRole() : "USER")
                .times(List.of())
                .build();
    }

    private String normalizeIdentifier(String value) {
        return value == null ? "" : value.trim();
    }

}
