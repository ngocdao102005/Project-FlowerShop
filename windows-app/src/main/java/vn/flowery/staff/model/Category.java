package vn.flowery.staff.model;

import java.util.Map;

public record Category(
    long id,
    String name,
    String slug,
    String description,
    boolean active,
    long productCount
) {
    public static Category from(Object value) {
        Map<String, Object> source = Values.object(value);
        return new Category(
            Values.longNumber(source, "category_id"),
            Values.text(source, "name"),
            Values.text(source, "slug"),
            Values.text(source, "description"),
            Values.bool(source, "active"),
            Values.longNumber(source, "product_count")
        );
    }

    @Override
    public String toString() {
        return active ? name : name + " (ngừng dùng)";
    }
}
