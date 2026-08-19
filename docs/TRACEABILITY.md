# Đối chiếu yêu cầu và phần triển khai

| Nhóm yêu cầu | Phần triển khai |
|---|---|
| Tài khoản và hồ sơ | `users`, scrypt, session HMAC, `/auth/*`, `/me`, RBAC và khóa tài khoản |
| Catalog và tìm kiếm | `categories`, `products`, truy vấn có tham số, bộ lọc, phân trang, gợi ý liên quan |
| Giỏ và wishlist | `cart_items`, `wishlists`, API đồng bộ và fallback localStorage cho khách |
| Đơn và thanh toán | transaction SQLite, tính giá lại, idempotency, payment adapter COD/sandbox |
| Kho và giao hàng | chuỗi trạng thái bắt buộc, phân quyền kho, mã vận đơn duy nhất, `order_status_history`, `shipment_attempts`, webhook giao thành công/thất bại |
| Đánh giá và nội dung | xác minh đã mua, trạng thái Pending/Approved/Rejected, `articles` |
| Hoàn tiền | khách gửi lý do/bằng chứng, CSKH Approved/Rejected, cổng thanh toán mới được Complete, lưu mã đối soát |
| Partner API/XML | JSON/XML có phiên bản, escaping XML và API key |
| Bảo mật | validation, SQL binding, password hash, token expiry, rate limit, CSP, request ID, audit log |
| Vận hành | health check, dashboard, Docker, dữ liệu mẫu và kiểm thử tích hợp |
| Windows App | Java Swing OOP, đăng nhập HTTP/JSON, dashboard, chế độ xem đơn của CSKH, xử lý tuần tự và bàn giao của kho, màn hình duyệt hoàn tiền, CRUD sản phẩm/danh mục hoa và cập nhật tồn kho |

## Adapter cần thay khi lên production

- Flowery Payment Sandbox → cổng thẻ/ví chính thức và webhook ký số.
- Flowery Express → API nhà vận chuyển và webhook trạng thái.
- SVG nội bộ → object storage/CDN, upload có kiểm soát và URL ký số.
- SQLite đơn nút → PostgreSQL/SQL Server managed nếu cần nhân bản ngang nhiều node.
- Audit/console log → nền tảng log, metrics, tracing và cảnh báo tập trung.
