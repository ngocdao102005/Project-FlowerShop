# Hợp đồng API chính

Base URL: `/api`. API trả JSON, trừ endpoint XML và SVG. Các lỗi có dạng:

```json
{
  "error": "Mô tả lỗi",
  "request_id": "UUID"
}
```

Endpoint cần đăng nhập sử dụng:

```http
Authorization: Bearer <session-token>
```

## Xác thực và hồ sơ

| Method | Endpoint | Quyền | Mục đích |
|---|---|---|---|
| POST | `/auth/register` | Public | Tạo tài khoản khách |
| POST | `/auth/login` | Public | Đăng nhập |
| GET | `/me` | Authenticated | Lấy hồ sơ |
| PATCH | `/me` | Authenticated | Cập nhật hồ sơ |

Mật khẩu tối thiểu 8 ký tự, có chữ và số. Token mặc định hết hạn sau 12 giờ.

## Catalog và nội dung

| Method | Endpoint | Mục đích |
|---|---|---|
| GET | `/categories` | Danh mục đang hoạt động |
| GET | `/products` | Tìm kiếm, lọc, sắp xếp và phân trang |
| GET | `/products/:id` | Chi tiết, đánh giá và gợi ý liên quan |
| GET | `/articles` | Bài viết biên tập |

Query của `/products`: `q`, `category`, `occasion`, `color`, `minPrice`,
`maxPrice`, `sort`, `page`, `limit`.

## Wishlist, giỏ và đơn

| Method | Endpoint | Mục đích |
|---|---|---|
| GET | `/wishlist` | Danh sách yêu thích |
| POST/DELETE | `/wishlist/:productId` | Thêm/bỏ yêu thích |
| GET | `/cart` | Giỏ hàng hiện tại |
| POST | `/cart` | Thêm sản phẩm |
| PATCH/DELETE | `/cart/:productId` | Sửa/xóa dòng giỏ |
| POST | `/orders` | Checkout |
| GET | `/orders/mine` | Lịch sử đơn |
| GET | `/orders/:id` | Chi tiết đơn |
| POST | `/orders/:id/cancel` | Hủy trước khi giao |
| POST | `/orders/:id/refunds` | Yêu cầu hoàn tiền |
| POST | `/products/:id/reviews` | Gửi đánh giá |

`POST /orders` hỗ trợ header `Idempotency-Key`. Backend bỏ qua giá do frontend gửi,
đọc lại giá/tồn kho và hoàn tất cập nhật trong một transaction.

## Quản trị

Prefix `/admin`; tất cả endpoint đều kiểm tra vai trò:

- `GET /stats`
- `GET/POST/PUT/DELETE /products`
- `PATCH /products/:id/stock` (nhân viên vận hành, kho và quản trị)
- `GET/POST/PUT/DELETE /categories` (DELETE là soft delete và chặn khi còn sản phẩm hoạt động)
- `GET/PATCH /orders`
- `GET/PATCH /reviews`
- `GET/PATCH /users`
- `GET/PATCH /refunds`
- `GET /audit`

Nhân viên kho/vận hành có quyền xử lý đơn và hoàn tiền. Biên tập viên quản lý
catalog/đánh giá. Quản trị viên có toàn quyền.

## Đối tác

```http
GET /api/partner/catalog
GET /api/partner/catalog.xml
X-API-Key: <partner-key>
```

Query `?key=` chỉ phục vụ trải nghiệm cục bộ. Môi trường thật phải dùng header,
HTTPS và khóa riêng cho từng đối tác.
