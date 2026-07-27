package vn.flowery.staff.config;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Properties;

public record AppConfig(String apiBaseUrl) {
    private static final String DEFAULT_API_BASE_URL = "http://127.0.0.1:5000/api";

    public AppConfig {
        if (apiBaseUrl == null || apiBaseUrl.isBlank()) {
            throw new IllegalArgumentException("Địa chỉ Backend API không được để trống.");
        }
        apiBaseUrl = apiBaseUrl.strip().replaceAll("/+$", "");
    }

    public static AppConfig load() {
        String fromSystemProperty = System.getProperty("flowery.api.baseUrl");
        if (isPresent(fromSystemProperty)) {
            return new AppConfig(fromSystemProperty);
        }

        String fromEnvironment = System.getenv("FLOWERY_API_BASE_URL");
        if (isPresent(fromEnvironment)) {
            return new AppConfig(fromEnvironment);
        }

        Properties properties = new Properties();
        Path configPath = Path.of("config", "application.properties").toAbsolutePath().normalize();
        if (Files.isRegularFile(configPath)) {
            try (InputStream input = Files.newInputStream(configPath)) {
                properties.load(input);
            } catch (IOException error) {
                throw new IllegalStateException(
                    "Không đọc được cấu hình tại " + configPath + ": " + error.getMessage(),
                    error
                );
            }
        }
        return new AppConfig(properties.getProperty("api.baseUrl", DEFAULT_API_BASE_URL));
    }

    private static boolean isPresent(String value) {
        return value != null && !value.isBlank();
    }
}
