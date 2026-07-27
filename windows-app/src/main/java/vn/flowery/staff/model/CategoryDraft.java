package vn.flowery.staff.model;

import java.util.LinkedHashMap;
import java.util.Map;

public record CategoryDraft(String name, String slug, String description) {
    public Map<String, Object> toPayload() {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("name", name);
        payload.put("slug", slug);
        payload.put("description", description);
        return payload;
    }
}
