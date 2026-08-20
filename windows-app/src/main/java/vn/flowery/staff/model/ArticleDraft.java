package vn.flowery.staff.model;

import java.util.List;
import java.util.Map;

public record ArticleDraft(
    String title,
    String slug,
    String summary,
    String content,
    String status
) {
    public Map<String, Object> toPayload() {
        return Map.of(
            "title", title.strip(),
            "slug", slug.strip(),
            "summary", summary.strip(),
            "content", content.strip(),
            "status", status,
            "product_ids", List.of()
        );
    }
}
