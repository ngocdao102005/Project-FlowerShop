package vn.flowery.staff.service;

import java.util.List;
import java.util.Map;
import vn.flowery.staff.api.ApiTransport;
import vn.flowery.staff.model.Category;
import vn.flowery.staff.model.CategoryDraft;
import vn.flowery.staff.model.Values;

public final class CategoryService {
    private final ApiTransport api;

    public CategoryService(ApiTransport api) {
        this.api = api;
    }

    public List<Category> listCategories() {
        Map<String, Object> payload = Values.object(api.get("/admin/categories"));
        return Values.array(payload.get("items")).stream().map(Category::from).toList();
    }

    public Category createCategory(CategoryDraft draft) {
        Map<String, Object> payload = Values.object(
            api.post("/admin/categories", draft.toPayload())
        );
        return Category.from(payload.get("item"));
    }

    public Category updateCategory(long categoryId, CategoryDraft draft) {
        Map<String, Object> payload = Values.object(
            api.put("/admin/categories/" + categoryId, draft.toPayload())
        );
        return Category.from(payload.get("item"));
    }

    public Category archiveCategory(long categoryId) {
        Map<String, Object> payload = Values.object(
            api.delete("/admin/categories/" + categoryId)
        );
        return Category.from(payload.get("item"));
    }

    public Category reactivateCategory(long categoryId) {
        Map<String, Object> payload = Values.object(
            api.put("/admin/categories/" + categoryId, Map.of("active", true))
        );
        return Category.from(payload.get("item"));
    }
}
