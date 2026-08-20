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
| PATCH | `/me/password` | Authenticated | Đổi mật khẩu và xóa cờ mật khẩu tạm |
| GET | `/me/reviewable-items` | Authenticated | Các dòng hàng đã giao có thể đánh giá |

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
| POST | `/order-items/:id/reviews` | Gửi đánh giá cho đúng dòng hàng đã giao |
| POST | `/products/:id/reviews` | Endpoint tương thích, tự chọn lần mua chưa đánh giá gần nhất |

`POST /orders` hỗ trợ header `Idempotency-Key`. Backend bỏ qua giá do frontend gửi,
đọc lại giá/tồn kho và hoàn tất cập nhật trong một transaction.

## Quản trị

Prefix `/admin`; tất cả endpoint đều kiểm tra vai trò:

- `GET /stats`
- `GET/POST/PUT/DELETE /products`
- `PATCH /products/:id/stock` (Staff và Admin)
- `GET/POST/PUT/DELETE /categories` (DELETE là soft delete và chặn khi còn sản phẩm hoạt động)
- `GET/PATCH /orders`
- `GET/PATCH /reviews`
- `GET/POST/PATCH /users` (Admin; mật khẩu tự sinh chỉ trả về một lần)
- `GET/PATCH /refunds`
- `GET/POST/PUT/DELETE /articles`, `POST /articles/import`, `POST /articles/:id/publish`
- `GET /audit`

Staff/Admin cập nhật đơn theo chuỗi `Confirmed → Preparing → Shipping`;
khi chuyển `Shipping` phải gửi `carrier` và `tracking_code`. Nhân viên CSKH/quản trị
duyệt hoặc từ chối yêu cầu hoàn tiền đang `Pending`; họ không được tự đặt
`Completed`. Editor quản lý cẩm nang theo chuỗi `Draft → InReview → Published → Archived`.
Admin có toàn quyền và chỉ được cấp tài khoản cấp dưới `customer`, `staff`, `editor`.

## Tích hợp vận chuyển và hoàn tiền

Các endpoint sau dùng `X-API-Key` và dành cho hệ thống đối tác:

| Method | Endpoint | Mục đích |
|---|---|---|
| GET | `/integrations/shipments/:trackingCode` | Lấy thông tin vận đơn |
| POST | `/integrations/shipments/:trackingCode/events` | Gửi `Delivered` kèm `proof_url`, hoặc `DeliveryFailed` kèm `reason` và `retry_at` |
| POST | `/integrations/refunds/:id/complete` | Cổng thanh toán hoàn tất yêu cầu `Approved` bằng `provider_reference` |

Đơn vị vận chuyển là tác nhân duy nhất chuyển đơn `Shipping → Delivered`. Một lần
giao thất bại không đổi trạng thái đơn mà được lưu tại `shipment_attempts` để giao lại.

## Đối tác

```http
GET /api/partner/catalog
GET /api/partner/catalog.xml
X-API-Key: <partner-key>
```

Query `?key=` chỉ phục vụ trải nghiệm cục bộ. Môi trường thật phải dùng header,
HTTPS và khóa riêng cho từng đối tác.
