# Hướng dẫn đọc mã nguồn Flowery 1.6.1

Tài liệu này bổ sung cho các chú thích `=== Khối ... ===` đặt trực tiếp trong mã
nguồn. Mục tiêu là giúp trình bày nhanh trách nhiệm của từng khối mà không phải
đọc toàn bộ câu lệnh chi tiết.

## Backend

| Tệp / khối | Chức năng |
| --- | --- |
| `server/server.js` – HTTP và chuẩn hóa | Đọc JSON, trả response, kiểm tra kích thước và làm sạch input. |
| `server/server.js` – khóa bí mật | Đọc khóa từ môi trường hoặc sinh khóa cục bộ nằm ngoài Git. |
| `server/server.js` – xác thực/RBAC | Xác minh token, tài khoản bị khóa và vai trò được phép. |
| `server/server.js` – tài khoản | Đăng ký, đăng nhập, hồ sơ, đổi mật khẩu và tài khoản nội bộ. |
| `server/server.js` – catalog | Danh mục, sản phẩm, tìm kiếm và cẩm nang công khai. |
| `server/server.js` – giao dịch | Wishlist, giỏ hàng, checkout, đơn hàng, đánh giá và hoàn tiền. |
| `server/server.js` – tích hợp | Webhook vận chuyển/hoàn tiền và Partner API/XML có API key. |
| `server/server.js` – backoffice | CRUD catalog, nội dung, đơn, user, refund và audit theo vai trò. |
| `server/database.js` | Chọn SQLite/MySQL, migration an toàn và dữ liệu khởi tạo. |
| `server/mysql-database.js` | Adapter MySQL đồng bộ, kiểm tra metadata rồi chạy migration. |
| `server/mysql-schema.js` | Định nghĩa bảng, cột bổ sung và chuẩn hóa database phiên bản cũ. |
| `server/security.js` | Scrypt cho mật khẩu, HMAC cho token và hàm chuẩn hóa bảo mật. |

## Web App

| Tệp / khối | Chức năng |
| --- | --- |
| `client/src/api.js` | Gắn bearer token, mã hóa body và chuyển lỗi API thành thông báo UI. |
| `client/src/App.jsx` – Storefront | Catalog, tìm kiếm, wishlist, giỏ hàng và checkout. |
| `client/src/App.jsx` – Tài khoản | Đăng ký/đăng nhập, hồ sơ, đơn cá nhân và đổi mật khẩu. |
| `client/src/App.jsx` – Backoffice | Điều hướng và tải dữ liệu theo `staff`, `editor`, `admin`. |
| `client/src/App.jsx` – Người dùng | Tạo tài khoản cấp dưới, kiểm tra mật khẩu, RBAC và khóa user. |

## Windows App

| Tệp / khối | Chức năng |
| --- | --- |
| `LoginFrame.java` | Đăng nhập nhân viên mà không lưu sẵn mật khẩu. |
| `MainFrame.java` | Điều phối navigation và ẩn/hiện module theo vai trò. |
| `*Service.java` | Gọi Backend API, không kết nối trực tiếp database. |
| `*Panel.java` | Màn hình nghiệp vụ CRUD và hiển thị phản hồi cho nhân viên. |

## Quy tắc khi sửa mã

1. Validation phải có ở giao diện để UX rõ ràng và lặp lại ở backend để bảo mật.
2. Mọi thao tác nhạy cảm phải qua `requireUser` với đúng nhóm vai trò.
3. Không ghi mật khẩu, token hoặc API key vào source, URL, log hay audit metadata.
4. Migration phải chạy lặp an toàn và không xóa dữ liệu hiện hữu.
5. Sau khi sửa chạy `npm run check` và `windows-app/package.ps1`.
