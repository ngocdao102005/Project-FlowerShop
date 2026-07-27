package vn.flowery.staff;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import vn.flowery.staff.api.ApiClient;
import vn.flowery.staff.json.Json;
import vn.flowery.staff.model.Category;
import vn.flowery.staff.model.CategoryDraft;
import vn.flowery.staff.model.DashboardStats;
import vn.flowery.staff.model.Product;
import vn.flowery.staff.model.ProductDraft;
import vn.flowery.staff.model.User;
import vn.flowery.staff.model.Values;
import vn.flowery.staff.service.AuthService;
import vn.flowery.staff.service.CategoryService;
import vn.flowery.staff.service.DashboardService;
import vn.flowery.staff.service.ProductService;

public final class ApiIntegrationTest {
    private ApiIntegrationTest() {
    }

    public static void run() throws Exception {
        AtomicBoolean sawAuthorization = new AtomicBoolean();
        AtomicBoolean sawStockPayload = new AtomicBoolean();
        AtomicInteger crudCalls = new AtomicInteger();
        AtomicInteger categoryCrudCalls = new AtomicInteger();
        HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext(
            "/api/",
            exchange -> handle(
                exchange,
                sawAuthorization,
                sawStockPayload,
                crudCalls,
                categoryCrudCalls
            )
        );
        server.start();

        try {
            String baseUrl = "http://127.0.0.1:" + server.getAddress().getPort() + "/api";
            ApiClient api = new ApiClient(baseUrl);
            User user = new AuthService(api).login("admin@flowery.vn", "Admin@123".toCharArray());
            check("admin".equals(user.role()), "AuthService phải đọc đúng vai trò.");

            DashboardStats stats = new DashboardService(api).loadStats();
            check(stats.revenue() == 1_250_000L, "Dashboard phải đọc đúng doanh thu.");
            check(stats.orders() == 7L, "Dashboard phải đọc đúng số đơn.");

            Product updated = new ProductService(api).updateStock(4, 23);
            check(updated.stockQuantity() == 23, "Phải đọc lại tồn kho sau cập nhật.");

            ProductService products = new ProductService(api);
            List<Category> categories = products.listCategories();
            check(categories.size() == 1, "Phải tải được danh mục cho biểu mẫu.");
            check(categories.getFirst().active(), "Danh mục mẫu phải đang hoạt động.");

            CategoryService categoryService = new CategoryService(api);
            CategoryDraft categoryDraft = new CategoryDraft(
                "Danh mục Java",
                "danh-muc-java",
                "Mô tả danh mục"
            );
            Category createdCategory = categoryService.createCategory(categoryDraft);
            check(createdCategory.id() == 9L, "Create danh mục phải trả về item.");
            Category updatedCategory = categoryService.updateCategory(
                createdCategory.id(),
                new CategoryDraft("Danh mục Java Đã Sửa", "danh-muc-java", "Mô tả mới")
            );
            check(
                "Danh mục Java Đã Sửa".equals(updatedCategory.name()),
                "Update danh mục phải trả về dữ liệu mới."
            );
            Category archivedCategory = categoryService.archiveCategory(updatedCategory.id());
            check(!archivedCategory.active(), "Delete danh mục phải là soft delete.");
            Category activeCategory = categoryService.reactivateCategory(archivedCategory.id());
            check(activeCategory.active(), "Phải kích hoạt lại được danh mục.");
            check(categoryCrudCalls.get() == 4, "Phải gọi đủ CRUD và kích hoạt danh mục.");

            ProductDraft draft = new ProductDraft(
                categories.getFirst().id(),
                "Hoa CRUD Java",
                "hoa-crud-java",
                520_000L,
                "Mô tả",
                "",
                "Sinh nhật",
                "Hoa hồng",
                "Đỏ",
                14,
                true,
                "Nội dung"
            );
            Product created = products.createProduct(draft);
            check(created.id() == 5L, "Create phải đọc sản phẩm vừa tạo.");
            Product edited = products.updateProduct(
                created.id(),
                new ProductDraft(
                    draft.categoryId(),
                    "Hoa CRUD Java Đã Sửa",
                    draft.slug(),
                    550_000L,
                    draft.description(),
                    draft.imageUrl(),
                    draft.occasion(),
                    draft.flowerType(),
                    draft.color(),
                    draft.stockQuantity(),
                    draft.active(),
                    draft.editorialReview()
                ),
                true
            );
            check(
                "Hoa CRUD Java Đã Sửa".equals(edited.name()),
                "Update phải đọc sản phẩm đã sửa."
            );
            products.archiveProduct(edited.id());
            check(crudCalls.get() == 3, "Phải gọi đủ POST, PUT và DELETE.");
            check(sawAuthorization.get(), "ApiClient phải gửi bearer token.");
            check(sawStockPayload.get(), "ApiClient phải gửi JSON cập nhật tồn kho.");
        } finally {
            server.stop(0);
        }
    }

    private static void handle(
        HttpExchange exchange,
        AtomicBoolean sawAuthorization,
        AtomicBoolean sawStockPayload,
        AtomicInteger crudCalls,
        AtomicInteger categoryCrudCalls
    ) throws IOException {
        String path = exchange.getRequestURI().getPath();
        if ("/api/auth/login".equals(path) && "POST".equals(exchange.getRequestMethod())) {
            respond(exchange, 200, """
                {
                  "token": "integration-token",
                  "user": {
                    "user_id": 1,
                    "email": "admin@flowery.vn",
                    "full_name": "Quản trị Flowery",
                    "role": "admin"
                  }
                }
                """);
            return;
        }

        String authorization = exchange.getRequestHeaders().getFirst("Authorization");
        if ("Bearer integration-token".equals(authorization)) {
            sawAuthorization.set(true);
        } else {
            respond(exchange, 401, "{\"error\":\"Thiếu token\"}");
            return;
        }

        if ("/api/admin/stats".equals(path) && "GET".equals(exchange.getRequestMethod())) {
            respond(exchange, 200, """
                {
                  "stats": {
                    "revenue": 1250000,
                    "orders": 7,
                    "pending_orders": 2,
                    "customers": 5,
                    "low_stock": 1,
                    "pending_reviews": 3
                  }
                }
                """);
            return;
        }

        if ("/api/admin/categories".equals(path) && "GET".equals(exchange.getRequestMethod())) {
            respond(exchange, 200, """
                {
                  "items": [
                    {
                      "category_id": 2,
                      "name": "Bó hoa",
                      "slug": "bo-hoa",
                      "description": "Danh mục bó hoa",
                      "active": 1,
                      "product_count": 4
                    }
                  ]
                }
                """);
            return;
        }

        if ("/api/admin/categories".equals(path) && "POST".equals(exchange.getRequestMethod())) {
            Map<String, Object> payload = readJson(exchange);
            if ("Danh mục Java".equals(payload.get("name"))) {
                categoryCrudCalls.incrementAndGet();
            }
            respond(exchange, 201, categoryResponse("Danh mục Java", true));
            return;
        }

        if ("/api/admin/categories/9".equals(path) && "PUT".equals(exchange.getRequestMethod())) {
            Map<String, Object> payload = readJson(exchange);
            if (Boolean.TRUE.equals(payload.get("active"))) {
                categoryCrudCalls.incrementAndGet();
                respond(exchange, 200, categoryResponse("Danh mục Java Đã Sửa", true));
            } else {
                if ("Danh mục Java Đã Sửa".equals(payload.get("name"))) {
                    categoryCrudCalls.incrementAndGet();
                }
                respond(exchange, 200, categoryResponse("Danh mục Java Đã Sửa", true));
            }
            return;
        }

        if ("/api/admin/categories/9".equals(path)
            && "DELETE".equals(exchange.getRequestMethod())) {
            categoryCrudCalls.incrementAndGet();
            respond(exchange, 200, categoryResponse("Danh mục Java Đã Sửa", false));
            return;
        }

        if ("/api/admin/products".equals(path) && "POST".equals(exchange.getRequestMethod())) {
            Map<String, Object> payload = readJson(exchange);
            if ("Hoa CRUD Java".equals(payload.get("name"))) {
                crudCalls.incrementAndGet();
            }
            respond(exchange, 201, productResponse("Hoa CRUD Java", 520000));
            return;
        }

        if ("/api/admin/products/5".equals(path) && "PUT".equals(exchange.getRequestMethod())) {
            Map<String, Object> payload = readJson(exchange);
            if ("Hoa CRUD Java Đã Sửa".equals(payload.get("name"))) {
                crudCalls.incrementAndGet();
            }
            respond(exchange, 200, productResponse("Hoa CRUD Java Đã Sửa", 550000));
            return;
        }

        if ("/api/admin/products/5".equals(path) && "DELETE".equals(exchange.getRequestMethod())) {
            crudCalls.incrementAndGet();
            respond(exchange, 200, "{\"success\":true}");
            return;
        }

        if ("/api/admin/products/4/stock".equals(path)
            && "PATCH".equals(exchange.getRequestMethod())) {
            String body = new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
            Map<String, Object> payload = Values.object(Json.parse(body));
            sawStockPayload.set(((Number) payload.get("stock_quantity")).intValue() == 23);
            respond(exchange, 200, """
                {
                  "item": {
                    "product_id": 4,
                    "name": "Hộp hoa thử nghiệm",
                    "category_name": "Hộp hoa",
                    "price": 650000,
                    "stock_quantity": 23,
                    "active": 1
                  }
                }
                """);
            return;
        }

        respond(exchange, 404, "{\"error\":\"Không tìm thấy\"}");
    }

    private static Map<String, Object> readJson(HttpExchange exchange) throws IOException {
        String body = new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
        return Values.object(Json.parse(body));
    }

    private static String productResponse(String name, long price) {
        return """
            {
              "item": {
                "product_id": 5,
                "category_id": 2,
                "name": "%s",
                "slug": "hoa-crud-java",
                "category_name": "Bó hoa",
                "price": %d,
                "description": "Mô tả",
                "image_url": "",
                "occasion": "Sinh nhật",
                "flower_type": "Hoa hồng",
                "color": "Đỏ",
                "stock_quantity": 14,
                "active": 1,
                "editorial_review": "Nội dung"
              }
            }
            """.formatted(name, price);
    }

    private static String categoryResponse(String name, boolean active) {
        return """
            {
              "success": true,
              "item": {
                "category_id": 9,
                "name": "%s",
                "slug": "danh-muc-java",
                "description": "Mô tả danh mục",
                "active": %d,
                "product_count": 0
              }
            }
            """.formatted(name, active ? 1 : 0);
    }

    private static void respond(HttpExchange exchange, int status, String body) throws IOException {
        byte[] data = body.getBytes(StandardCharsets.UTF_8);
        exchange.getResponseHeaders().set("Content-Type", "application/json; charset=utf-8");
        exchange.sendResponseHeaders(status, data.length);
        exchange.getResponseBody().write(data);
        exchange.close();
    }

    private static void check(boolean condition, String message) {
        if (!condition) {
            throw new AssertionError(message);
        }
    }
}
