package vn.flowery.staff.api;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Map;
import vn.flowery.staff.json.Json;

public final class ApiClient implements ApiTransport {
    private final HttpClient httpClient;
    private final URI baseUri;
    private volatile String token;

    public ApiClient(String apiBaseUrl) {
        this(
            HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(10))
                .followRedirects(HttpClient.Redirect.NORMAL)
                .build(),
            apiBaseUrl
        );
    }

    ApiClient(HttpClient httpClient, String apiBaseUrl) {
        this.httpClient = httpClient;
        String normalized = apiBaseUrl.strip().replaceAll("/+$", "") + "/";
        this.baseUri = URI.create(normalized);
    }

    @Override
    public Object get(String path) {
        return request("GET", path, null);
    }

    @Override
    public Object post(String path, Object body) {
        return request("POST", path, body);
    }

    @Override
    public Object put(String path, Object body) {
        return request("PUT", path, body);
    }

    @Override
    public Object patch(String path, Object body) {
        return request("PATCH", path, body);
    }

    @Override
    public Object delete(String path) {
        return request("DELETE", path, null);
    }

    @Override
    public void setToken(String token) {
        if (token == null || token.isBlank()) {
            throw new IllegalArgumentException("Token đăng nhập không hợp lệ.");
        }
        this.token = token;
    }

    @Override
    public void clearToken() {
        token = null;
    }

    private Object request(String method, String path, Object body) {
        String relativePath = path.startsWith("/") ? path.substring(1) : path;
        HttpRequest.Builder builder = HttpRequest.newBuilder(baseUri.resolve(relativePath))
            .timeout(Duration.ofSeconds(25))
            .header("Accept", "application/json")
            .header("Accept-Charset", StandardCharsets.UTF_8.name());

        String sessionToken = token;
        if (sessionToken != null) {
            builder.header("Authorization", "Bearer " + sessionToken);
        }
        if (body == null) {
            builder.method(method, HttpRequest.BodyPublishers.noBody());
        } else {
            builder.header("Content-Type", "application/json; charset=utf-8");
            builder.method(
                method,
                HttpRequest.BodyPublishers.ofString(Json.stringify(body), StandardCharsets.UTF_8)
            );
        }

        try {
            HttpResponse<String> response = httpClient.send(
                builder.build(),
                HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8)
            );
            Object payload = parsePayload(response.body());
            if (response.statusCode() >= 200 && response.statusCode() < 300) {
                return payload;
            }
            Map<String, Object> errorPayload = payload instanceof Map<?, ?>
                ? object(payload)
                : Map.of();
            String message = string(errorPayload.get("error"));
            if (message.isBlank()) {
                message = "Backend trả về lỗi HTTP " + response.statusCode() + ".";
            }
            throw new ApiException(
                response.statusCode(),
                message,
                string(errorPayload.get("request_id"))
            );
        } catch (InterruptedException error) {
            Thread.currentThread().interrupt();
            throw new ApiException(-1, "Yêu cầu tới Backend API đã bị gián đoạn.", "", error);
        } catch (IOException error) {
            throw new ApiException(
                -1,
                "Không kết nối được Backend API tại " + baseUri + ". Hãy kiểm tra máy chủ đang chạy.",
                "",
                error
            );
        }
    }

    private static Object parsePayload(String body) {
        if (body == null || body.isBlank()) {
            return null;
        }
        try {
            return Json.parse(body);
        } catch (IllegalArgumentException error) {
            throw new ApiException(-1, "Backend trả về dữ liệu không phải JSON hợp lệ.", "", error);
        }
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> object(Object value) {
        return (Map<String, Object>) value;
    }

    private static String string(Object value) {
        return value == null ? "" : String.valueOf(value);
    }
}
