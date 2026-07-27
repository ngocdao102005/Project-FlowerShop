package vn.flowery.staff.model;

import java.util.LinkedHashMap;
import java.util.Map;

public record ProductDraft(
    long categoryId,
    String name,
    String slug,
    long price,
    String description,
    String imageUrl,
    String occasion,
    String flowerType,
    String color,
    int stockQuantity,
    boolean active,
    String editorialReview
) {
    public Map<String, Object> toPayload(boolean includeStock) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("category_id", categoryId);
        payload.put("name", name);
        payload.put("slug", slug);
        payload.put("price", price);
        payload.put("description", description);
        payload.put("image_url", imageUrl);
        payload.put("occasion", occasion);
        payload.put("flower_type", flowerType);
        payload.put("color", color);
        if (includeStock) {
            payload.put("stock_quantity", stockQuantity);
        }
        payload.put("active", active);
        payload.put("editorial_review", editorialReview);
        return payload;
    }
}
