package vn.flowery.staff.service;

import java.util.Map;
import vn.flowery.staff.api.ApiException;
import vn.flowery.staff.api.ApiTransport;
import vn.flowery.staff.model.User;
import vn.flowery.staff.model.Values;

public final class AuthService {
    private final ApiTransport api;

    public AuthService(ApiTransport api) {
        this.api = api;
    }

    public User login(String email, char[] password) {
        try {
            Object response = api.post(
                "/auth/login",
                Map.of("email", email.strip(), "password", new String(password))
            );
            Map<String, Object> payload = Values.object(response);
            String token = Values.text(payload, "token");
            User user = User.from(payload.get("user"));
            if (token.isBlank()) {
                throw new ApiException(-1, "Backend không trả về token đăng nhập.", "");
            }
            if (!user.canUseStaffApp()) {
                throw new ApiException(
                    403,
                    "Tài khoản khách hàng không được phép sử dụng ứng dụng nhân viên.",
                    ""
                );
            }
            api.setToken(token);
            return user;
        } finally {
            java.util.Arrays.fill(password, '\0');
        }
    }

    public void logout() {
        api.clearToken();
    }
}
