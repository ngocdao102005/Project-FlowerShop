package vn.flowery.staff;

import java.util.List;
import java.util.Map;
import vn.flowery.staff.json.Json;
import vn.flowery.staff.model.Values;

public final class JsonTest {
    private JsonTest() {
    }

    public static void run() {
        String source = """
            {
              "name": "Bó hoa Việt Nam",
              "stock": 12,
              "active": true,
              "notes": ["Dòng 1", "Dòng 2\\nCó dấu"],
              "empty": null
            }
            """;

        Map<String, Object> object = Values.object(Json.parse(source));
        check("Bó hoa Việt Nam".equals(object.get("name")), "Phải đọc đúng UTF-8.");
        check(((Number) object.get("stock")).longValue() == 12L, "Phải đọc đúng số nguyên.");
        check(Boolean.TRUE.equals(object.get("active")), "Phải đọc đúng boolean.");
        check(Values.array(object.get("notes")).size() == 2, "Phải đọc đúng mảng.");

        String encoded = Json.stringify(Map.of(
            "message", "Xin chào \"Flowery\"",
            "values", List.of(1, 2, 3),
            "enabled", true
        ));
        Map<String, Object> roundTrip = Values.object(Json.parse(encoded));
        check(
            "Xin chào \"Flowery\"".equals(roundTrip.get("message")),
            "Chuỗi JSON phải round-trip."
        );

        boolean rejected = false;
        try {
            Json.parse("{\"broken\":]");
        } catch (IllegalArgumentException expected) {
            rejected = true;
        }
        check(rejected, "JSON hỏng phải bị từ chối.");
    }

    private static void check(boolean condition, String message) {
        if (!condition) {
            throw new AssertionError(message);
        }
    }
}
