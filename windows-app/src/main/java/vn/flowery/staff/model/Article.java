package vn.flowery.staff.model;

import java.util.Map;

public record Article(
    long id,
    String title,
    String slug,
    String summary,
    String content,
    String status,
    int version,
    String authorName,
    String updatedAt
) {
    public static Article from(Object value) {
        Map<String, Object> source = Values.object(value);
        return new Article(
            Values.longNumber(source, "article_id"),
            Values.text(source, "title"),
            Values.text(source, "slug"),
            Values.text(source, "summary"),
            Values.text(source, "content"),
            Values.text(source, "status"),
            Values.integer(source, "version"),
            Values.text(source, "author_name"),
            Values.text(source, "updated_at")
        );
    }
}
