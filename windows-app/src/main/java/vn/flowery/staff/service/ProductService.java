package vn.flowery.staff.service;

import java.util.List;
import java.util.Map;
import vn.flowery.staff.api.ApiTransport;
import vn.flowery.staff.model.Category;
import vn.flowery.staff.model.Product;
import vn.flowery.staff.model.ProductDraft;
import vn.flowery.staff.model.Values;

public final class ProductService {
    private final ApiTransport api;

    public ProductService(ApiTransport api) {
        this.api = api;
    }

    public List<Product> listProducts() {
        Map<String, Object> payload = Values.object(api.get("/admin/products"));
        return Values.array(payload.get("items")).stream().map(Product::from).toList();
    }

    public List<Category> listCategories() {
        Map<String, Object> payload = Values.object(api.get("/admin/categories"));
        return Values.array(payload.get("items")).stream().map(Category::from).toList();
    }

    public Product createProduct(ProductDraft draft) {
        Map<String, Object> payload = Values.object(
            api.post("/admin/products", draft.toPayload(true))
        );
        return Product.from(payload.get("item"));
    }

    public Product updateProduct(long productId, ProductDraft draft, boolean includeStock) {
        Map<String, Object> payload = Values.object(
            api.put("/admin/products/" + productId, draft.toPayload(includeStock))
        );
        return Product.from(payload.get("item"));
    }

    public void archiveProduct(long productId) {
        api.delete("/admin/products/" + productId);
    }

    public Product updateStock(long productId, int stockQuantity) {
        Map<String, Object> payload = Values.object(
            api.patch(
                "/admin/products/" + productId + "/stock",
                Map.of("stock_quantity", stockQuantity)
            )
        );
        return Product.from(payload.get("item"));
    }
}
