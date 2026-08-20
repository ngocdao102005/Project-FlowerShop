# Đối chiếu yêu cầu và phần triển khai

| Nhóm yêu cầu | Phần triển khai |
|---|---|
| Tài khoản và hồ sơ | `users`, avatar, đổi/mật khẩu tạm, scrypt, session HMAC, `/auth/*`, `/me`, RBAC và khóa tài khoản |
| Catalog và tìm kiếm | `categories`, `products`, truy vấn có tham số, bộ lọc, phân trang, gợi ý liên quan |
| Giỏ và wishlist | `cart_items`, `wishlists`, API đồng bộ và fallback localStorage cho khách |
| Đơn và thanh toán | transaction MySQL/InnoDB, tính giá lại, idempotency, payment adapter COD/sandbox |
| Kho và giao hàng | Staff xử lý chuỗi trạng thái bắt buộc, mã vận đơn duy nhất, `order_status_history`, `shipment_attempts`, webhook giao thành công/thất bại |
| Đánh giá và nội dung | đánh giá gắn duy nhất với `order_items` đã giao; cẩm nang có tác giả, phiên bản, liên kết sản phẩm, media DOCX và trạng thái Draft/InReview/Published/Archived |
| Hoàn tiền | khách gửi lý do/bằng chứng, CSKH Approved/Rejected, cổng thanh toán mới được Complete, lưu mã đối soát |
| Partner API/XML | JSON/XML có phiên bản, escaping XML và API key |
| Bảo mật | validation, SQL binding, password hash, token expiry, rate limit, CSP, request ID, audit log |
| Vận hành | health check, dashboard, Docker, dữ liệu mẫu và kiểm thử tích hợp |
| Windows App | Java Swing OOP, đăng nhập HTTP/JSON, RBAC Staff/Editor/Admin, xử lý đơn/hoàn tiền, CRUD sản phẩm/danh mục, tồn kho và vòng đời cẩm nang |

## Adapter cần thay khi lên production

- Flowery Payment Sandbox → cổng thẻ/ví chính thức và webhook ký số.
- Flowery Express → API nhà vận chuyển và webhook trạng thái.
- SVG nội bộ → object storage/CDN, upload có kiểm soát và URL ký số.
- MySQL cục bộ → MySQL managed/cluster nếu cần HA, sao lưu tự động và nhân bản ngang.
- Audit/console log → nền tảng log, metrics, tracing và cảnh báo tập trung.
