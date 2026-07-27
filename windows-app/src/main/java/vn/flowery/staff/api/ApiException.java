package vn.flowery.staff.api;

public final class ApiException extends RuntimeException {
    private final int statusCode;
    private final String requestId;

    public ApiException(int statusCode, String message, String requestId) {
        super(message);
        this.statusCode = statusCode;
        this.requestId = requestId == null ? "" : requestId;
    }

    public ApiException(int statusCode, String message, String requestId, Throwable cause) {
        super(message, cause);
        this.statusCode = statusCode;
        this.requestId = requestId == null ? "" : requestId;
    }

    public int statusCode() {
        return statusCode;
    }

    public String requestId() {
        return requestId;
    }
}
