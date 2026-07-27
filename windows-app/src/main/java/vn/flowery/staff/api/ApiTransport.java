package vn.flowery.staff.api;

public interface ApiTransport {
    Object get(String path);

    Object post(String path, Object body);

    Object put(String path, Object body);

    Object patch(String path, Object body);

    Object delete(String path);

    void setToken(String token);

    void clearToken();
}
