package org.devnqminh.studyfocus.dto.response.authentication;

public class LoginResponse {
    private String token;
    private String username;
    private Long userId;

    public LoginResponse(String token, String username, Long userId) {
        this.token = token;
        this.username = username;
        this.userId = userId;
    }
    public String getToken() {return this.token;}
    public String getUsername() {return this.username;}
    public Long getUserId() {return this.userId;}
}
