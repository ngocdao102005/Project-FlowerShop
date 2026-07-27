package vn.flowery.staff.model;

import java.util.Map;

public record Product(
    long id,
    long categoryId,
    String name,
    String slug,
    String categoryName,
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
    public static Product from(Object value) {
        Map<String, Object> source = Values.object(value);
        return new Product(
            Values.longNumber(source, "product_id"),
            Values.longNumber(source, "category_id"),
            Values.text(source, "name"),
            Values.text(source, "slug"),
            Values.text(source, "category_name"),
            Values.longNumber(source, "price"),
            Values.text(source, "description"),
            Values.text(source, "image_url"),
            Values.text(source, "occasion"),
            Values.text(source, "flower_type"),
            Values.text(source, "color"),
            Values.integer(source, "stock_quantity"),
            Values.bool(source, "active"),
            Values.text(source, "editorial_review")
        );
    }

    public Product withActive(boolean activeValue) {
        return new Product(
            id,
            categoryId,
            name,
            slug,
            categoryName,
            price,
            description,
            imageUrl,
            occasion,
            flowerType,
            color,
            stockQuantity,
            activeValue,
            editorialReview
        );
    }
}
