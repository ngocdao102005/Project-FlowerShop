package vn.flowery.staff.model;

import java.util.List;
import java.util.Map;

public final class Values {
    private Values() {
    }

    @SuppressWarnings("unchecked")
    public static Map<String, Object> object(Object value) {
        if (!(value instanceof Map<?, ?>)) {
            throw new IllegalArgumentException("Backend trả về object JSON không hợp lệ.");
        }
        return (Map<String, Object>) value;
    }

    @SuppressWarnings("unchecked")
    public static List<Object> array(Object value) {
        if (!(value instanceof List<?>)) {
            throw new IllegalArgumentException("Backend trả về mảng JSON không hợp lệ.");
        }
        return (List<Object>) value;
    }

    public static String text(Map<String, Object> source, String key) {
        Object value = source.get(key);
        return value == null ? "" : String.valueOf(value);
    }

    public static long longNumber(Map<String, Object> source, String key) {
        Object value = source.get(key);
        if (value instanceof Number number) {
            return number.longValue();
        }
        try {
            return Long.parseLong(String.valueOf(value));
        } catch (RuntimeException error) {
            return 0L;
        }
    }

    public static int integer(Map<String, Object> source, String key) {
        return Math.toIntExact(longNumber(source, key));
    }

    public static boolean bool(Map<String, Object> source, String key) {
        Object value = source.get(key);
        if (value instanceof Boolean bool) {
            return bool;
        }
        if (value instanceof Number number) {
            return number.intValue() != 0;
        }
        return Boolean.parseBoolean(String.valueOf(value));
    }
}
