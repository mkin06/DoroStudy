package org.devnqminh.studyfocus.security;

import org.devnqminh.studyfocus.controller.AuthController;
import org.devnqminh.studyfocus.dto.request.authentication.LoginRequest;
import org.devnqminh.studyfocus.dto.response.authentication.LoginResponse;
import org.devnqminh.studyfocus.dto.response.user.UserProfileResponse;
import org.devnqminh.studyfocus.service.IAuthService;
import org.junit.jupiter.api.Test;
import org.springframework.boot.WebApplicationType;
import org.springframework.boot.autoconfigure.EnableAutoConfiguration;
import org.springframework.boot.autoconfigure.jdbc.DataSourceAutoConfiguration;
import org.springframework.boot.autoconfigure.orm.jpa.HibernateJpaAutoConfiguration;
import org.springframework.boot.autoconfigure.security.servlet.UserDetailsServiceAutoConfiguration;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.boot.web.servlet.context.ServletWebServerApplicationContext;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Import;
import org.springframework.session.SessionRepository;
import org.springframework.session.data.redis.RedisSessionRepository;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import jakarta.servlet.http.HttpSession;
import java.util.Map;

import java.net.CookieManager;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class LocalSessionConfigurationTest {
    @Configuration(proxyBeanMethods = false)
    @EnableAutoConfiguration(exclude = {DataSourceAutoConfiguration.class, HibernateJpaAutoConfiguration.class,
            UserDetailsServiceAutoConfiguration.class})
    @Import({SecurityConfig.class, AuthController.class, SessionProbe.class})
    static class TestApplication {
        @Bean IAuthService authService() {
            IAuthService service = mock(IAuthService.class);
            when(service.login(any(LoginRequest.class))).thenReturn(new LoginResponse("session_test", 42L));
            when(service.loginOrRegisterWithGoogle(anyString())).thenReturn(new LoginResponse("google_user", 42L));
            when(service.getUserProfile(42L)).thenReturn(UserProfileResponse.builder()
                    .id(42L).username("session_test").name("Session test").build());
            return service;
        }
    }

    @RestController
    static class SessionProbe {
        @GetMapping("/api/session-test")
        Map<String, Object> check(HttpSession session) {
            return Map.of("userId", session.getAttribute("USER_ID"));
        }
    }

    @Test
    void defaultProfileCanLoginAndKeepCookieSessionWithoutRedis() throws Exception {
        try (var context = new SpringApplicationBuilder(TestApplication.class).web(WebApplicationType.SERVLET)
                .run("--server.port=0", "--spring.profiles.active=", "--spring.profiles.default=default",
                        "--spring.data.redis.host=127.0.0.1", "--spring.data.redis.port=1", "--spring.main.banner-mode=off")) {
            assertThat(context.getBeansOfType(SessionRepository.class)).isEmpty();
            int port = ((ServletWebServerApplicationContext) context).getWebServer().getPort();
            URI base = URI.create("http://127.0.0.1:" + port);
            CookieManager cookies = new CookieManager();
            HttpClient client = HttpClient.newBuilder().cookieHandler(cookies).build();

            var beforeLogin = client.send(HttpRequest.newBuilder(base.resolve("/api/auth/me")).GET().build(),
                    HttpResponse.BodyHandlers.ofString());
            assertThat(beforeLogin.statusCode()).isEqualTo(401);
            assertThat(beforeLogin.headers().allValues("set-cookie")).isEmpty();
            var unauthorized = client.send(HttpRequest.newBuilder(base.resolve("/api/session-test")).GET().build(),
                    HttpResponse.BodyHandlers.ofString());
            assertThat(unauthorized.statusCode()).isEqualTo(401);
            assertThat(unauthorized.headers().allValues("set-cookie")).isEmpty();

            var login = client.send(HttpRequest.newBuilder(base.resolve("/api/auth/login"))
                            .header("Content-Type", "application/json")
                            .POST(HttpRequest.BodyPublishers.ofString("{\"username\":\"session_test\",\"password\":\"test-password\"}"))
                            .build(), HttpResponse.BodyHandlers.ofString());
            assertThat(login.statusCode()).isEqualTo(200);
            assertThat(cookies.getCookieStore().getCookies()).anyMatch(cookie -> cookie.getName().equals("DOROSTUDY_SESSION"));

            var profile = client.send(HttpRequest.newBuilder(base.resolve("/api/auth/me")).GET().build(),
                    HttpResponse.BodyHandlers.ofString());
            assertThat(profile.statusCode()).isEqualTo(200);
            assertThat(profile.body()).contains("\"id\":42");
            for (int i = 0; i < 3; i++) {
                var protectedRequest = client.send(HttpRequest.newBuilder(base.resolve("/api/session-test")).GET().build(),
                        HttpResponse.BodyHandlers.ofString());
                assertThat(protectedRequest.statusCode()).isEqualTo(200);
                assertThat(protectedRequest.body()).contains("\"userId\":42");
            }

            var logout = client.send(HttpRequest.newBuilder(base.resolve("/api/auth/logout"))
                    .POST(HttpRequest.BodyPublishers.noBody()).build(), HttpResponse.BodyHandlers.ofString());
            assertThat(logout.statusCode()).isEqualTo(200);
            var afterLogout = client.send(HttpRequest.newBuilder(base.resolve("/api/auth/me")).GET().build(),
                    HttpResponse.BodyHandlers.ofString());
            assertThat(afterLogout.statusCode()).isEqualTo(401);

            // First Google sign-in and a returning Google user must keep a session
            // on protected APIs, not merely succeed on the public /auth/me route.
            for (int attempt = 0; attempt < 2; attempt++) {
                var google = client.send(HttpRequest.newBuilder(base.resolve("/api/auth/google"))
                        .header("Content-Type", "application/json")
                        .POST(HttpRequest.BodyPublishers.ofString("{\"idToken\":\"test-token\"}")).build(),
                        HttpResponse.BodyHandlers.ofString());
                assertThat(google.statusCode()).isEqualTo(200);
                var secured = client.send(HttpRequest.newBuilder(base.resolve("/api/session-test")).GET().build(),
                        HttpResponse.BodyHandlers.ofString());
                assertThat(secured.statusCode()).isEqualTo(200);
                assertThat(secured.body()).contains("\"userId\":42");
                client.send(HttpRequest.newBuilder(base.resolve("/api/auth/logout"))
                        .POST(HttpRequest.BodyPublishers.noBody()).build(), HttpResponse.BodyHandlers.discarding());
            }
        }
    }

    @Test
    void dockerProfileStillUsesRedisSessions() {
        try (var context = new SpringApplicationBuilder(TestApplication.class).web(WebApplicationType.SERVLET)
                .run("--server.port=0", "--spring.profiles.active=docker", "--spring.data.redis.host=127.0.0.1",
                        "--spring.data.redis.port=1", "--spring.data.redis.password=", "--spring.main.banner-mode=off")) {
            assertThat(context.getBean(SessionRepository.class)).isInstanceOf(RedisSessionRepository.class);
            assertThat(context.getEnvironment().getProperty("spring.session.redis.namespace")).isEqualTo("dorostudy:session");
            assertThat(context.getEnvironment().getProperty("spring.autoconfigure.exclude")).isNull();
        }
    }
}
