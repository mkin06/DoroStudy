package org.devnqminh.studyfocus.service.authen;

import org.devnqminh.studyfocus.dto.request.authentication.LoginRequest;
import org.devnqminh.studyfocus.dto.request.authentication.RegisterRequest;
import org.devnqminh.studyfocus.model.User;
import org.devnqminh.studyfocus.repository.UserRepository;
import org.devnqminh.studyfocus.service.Impl.authen.AuthServiceImpl;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestTemplate;
import org.springframework.http.MediaType;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AuthServiceImplTest {

    @Mock UserRepository userRepository;
    @Mock PasswordEncoder passwordEncoder;
    @InjectMocks AuthServiceImpl authService;

    @Test
    void returningGoogleUserUsesExistingAccountOnEveryLogin() {
        ReflectionTestUtils.setField(authService, "googleClientId", "test-client.apps.googleusercontent.com");
        RestTemplate template = (RestTemplate) ReflectionTestUtils.getField(authService, "restTemplate");
        MockRestServiceServer server = MockRestServiceServer.bindTo(template).build();
        User user = User.builder().id(42L).username("google_user").email("user@example.test").image("existing").build();
        when(userRepository.findByEmailIgnoreCase("user@example.test")).thenReturn(Optional.of(user));
        for (int i = 0; i < 2; i++) {
            server.expect(requestTo("https://oauth2.googleapis.com/tokeninfo?id_token=token-" + i))
                    .andRespond(withSuccess("{\"aud\":\"test-client.apps.googleusercontent.com\",\"email\":\"user@example.test\",\"email_verified\":\"true\"}", MediaType.APPLICATION_JSON));
        }
        assertThat(authService.loginOrRegisterWithGoogle("token-0").getUserId()).isEqualTo(42L);
        assertThat(authService.loginOrRegisterWithGoogle("token-1").getUserId()).isEqualTo(42L);
        verify(userRepository, never()).save(any(User.class));
        server.verify();
    }

    @Test
    void googleCredentialForAnotherAppIsRejected() {
        ReflectionTestUtils.setField(authService, "googleClientId", "test-client.apps.googleusercontent.com");
        MockRestServiceServer server = MockRestServiceServer.bindTo((RestTemplate) ReflectionTestUtils.getField(authService, "restTemplate")).build();
        server.expect(requestTo("https://oauth2.googleapis.com/tokeninfo?id_token=wrong-audience"))
                .andRespond(withSuccess("{\"aud\":\"different-client\",\"email\":\"user@example.test\",\"email_verified\":\"true\"}", MediaType.APPLICATION_JSON));
        assertThatThrownBy(() -> authService.loginOrRegisterWithGoogle("wrong-audience"))
                .hasMessageContaining("không thuộc ứng dụng");
        verifyNoInteractions(userRepository);
        server.verify();
    }

    @Test
    void registerNormalizesIdentityFieldsButKeepsPasswordExact() {
        RegisterRequest request = new RegisterRequest();
        request.setName("  Nguyễn Minh  ");
        request.setUsername("  Minh.User  ");
        request.setEmail("  MINH@Example.COM  ");
        request.setPassword(" password có khoảng trắng ");

        when(passwordEncoder.encode(" password có khoảng trắng ")).thenReturn("bcrypt-hash");
        when(userRepository.saveAndFlush(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));

        authService.register(request);

        ArgumentCaptor<User> captor = ArgumentCaptor.forClass(User.class);
        verify(userRepository).saveAndFlush(captor.capture());
        User saved = captor.getValue();
        assertThat(saved.getUsername()).isEqualTo("minh.user");
        assertThat(saved.getEmail()).isEqualTo("minh@example.com");
        assertThat(saved.getName()).isEqualTo("Nguyễn Minh");
        assertThat(saved.getPasswordHash()).isEqualTo("bcrypt-hash");
        verify(passwordEncoder).encode(" password có khoảng trắng ");
    }

    @Test
    void loginAcceptsTrimmedUsernameOrEmailAndChecksPasswordWithoutTrimming() {
        LoginRequest request = new LoginRequest();
        request.setUsername("  MINH@Example.COM ");
        request.setPassword(" exact password ");
        User user = User.builder().id(7L).username("minh.user").passwordHash("bcrypt-hash").build();

        when(userRepository.findLoginCandidates("MINH@Example.COM")).thenReturn(List.of(user));
        when(passwordEncoder.matches(" exact password ", "bcrypt-hash")).thenReturn(true);

        var response = authService.login(request);

        assertThat(response.getUserId()).isEqualTo(7L);
        assertThat(response.getUsername()).isEqualTo("minh.user");
        verify(passwordEncoder).matches(" exact password ", "bcrypt-hash");
    }
}
