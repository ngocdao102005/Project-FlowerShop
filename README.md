# Flowery - hệ thống bán hoa trực tuyến

Flowery là một Hybrid System có thể chạy độc lập, được xây dựng từ tài liệu mô tả
nghiệp vụ và sơ đồ kiến trúc phân lớp. Hệ thống gồm cửa hàng React, cổng quản trị,
API Node.js, cơ sở dữ liệu SQLite tự khởi tạo và Windows App Java cho nhân viên.

Sơ đồ kiến trúc tham chiếu được lưu tại `docs/architecture.png`.

## Cập nhật 1.0.2

- Thay bộ font mặc định bằng font hệ thống có hỗ trợ đầy đủ dấu tiếng Việt.
- Sửa hiện tượng dấu và ký tự bị tách trong các tiêu đề serif trên storefront và
  backoffice.

## Windows App 1.2.0

Dự án có thêm ứng dụng desktop `windows-app/` dành cho staff, warehouse, editor và admin:

- Java 21, Swing và kiến trúc hướng đối tượng.
- Đăng nhập bằng Backend API, bearer token chỉ tồn tại trong phiên ứng dụng.
- Dashboard vận hành, danh sách/cập nhật trạng thái đơn hàng.
- CRUD sản phẩm hoa: thêm, xem, sửa, ngừng bán; tìm kiếm, cảnh báo sắp hết hàng và cập nhật tồn kho.
- CRUD danh mục hoa có soft delete an toàn, kích hoạt lại và bảo vệ danh mục đang có sản phẩm.
- UX/UI mới với menu đang chọn, toolbar thoáng, trạng thái trực quan và nút theo ngữ cảnh.
- Không truy cập trực tiếp SQLite/MySQL; toàn bộ dữ liệu đi qua HTTP/JSON.
- Đóng gói `FloweryStaff.exe` kèm Java Runtime bằng `jpackage`.

Khởi động backend tại `http://127.0.0.1:5000`, sau đó xem hướng dẫn biên dịch và chạy tại
`windows-app/README.md`.

## Cập nhật 1.0.1

- Bổ sung nút đăng xuất rõ ràng cho khách hàng trên desktop và luôn giữ nút khả dụng
  trên màn hình nhỏ.
- Bổ sung nút đăng xuất riêng trong thanh điều hướng của cổng quản trị.
- Đăng xuất xóa phiên phía trình duyệt, dữ liệu giỏ hàng và danh sách yêu thích của
  phiên hiện tại, sau đó đưa người dùng về trang chủ.

## Chức năng đã triển khai

- Đăng ký, đăng nhập, hồ sơ khách hàng, khóa tài khoản và phân quyền theo vai trò.
- Catalog, tìm kiếm, lọc theo danh mục/dịp/màu, sắp xếp và gợi ý sản phẩm liên quan.
- Danh sách yêu thích và giỏ hàng lưu trên máy chủ cho người dùng đã đăng nhập.
- Checkout tính lại giá ở backend, kiểm tra tồn kho trong transaction và chống tạo
  đơn lặp bằng idempotency key.
- Thanh toán COD và adapter sandbox cho thẻ/ví; không thu hoặc lưu dữ liệu thẻ.
- Theo dõi đơn/vận chuyển, hủy trước khi giao, hoàn tồn kho và yêu cầu hoàn tiền.
- Đánh giá chỉ dành cho khách đã nhận hàng, có quy trình kiểm duyệt.
- Backoffice quản lý dashboard, sản phẩm, danh mục, đơn, đánh giá, người dùng và
  hoàn tiền.
- Partner API JSON/XML có API key; ảnh sản phẩm mẫu được phục vụ nội bộ.
- Request ID, rate limit, audit log, HMAC session token, scrypt password hash và
  truy vấn SQL có tham số.

## Yêu cầu

- Node.js 24 trở lên (dự án dùng mô-đun `node:sqlite` tích hợp).
- npm 10 trở lên.

## Chạy nhanh

```powershell
cd client
npm ci
cd ..
npm run build
npm start
```

Mở `http://127.0.0.1:5000`.

Để phát triển frontend và backend với hot reload:

```powershell
cd client
npm ci
cd ..
npm run dev
```

Frontend chạy ở `http://127.0.0.1:5173`, API ở `http://127.0.0.1:5000`.

## Tài khoản mẫu

| Vai trò | Email | Mật khẩu |
|---|---|---|
| Khách hàng | `lan@flowery.vn` | `Customer@123` |
| Quản trị | `admin@flowery.vn` | `Admin@123` |

Dữ liệu mẫu còn có một đơn đã giao cho tài khoản khách hàng để thử chức năng đánh
giá và hoàn tiền.

Partner XML mẫu:

```text
http://127.0.0.1:5000/api/partner/catalog.xml?key=demo-partner-key
```

Trong môi trường thật, bắt buộc thay `APP_SECRET`, `PARTNER_API_KEY` và chỉ truyền
API key qua header `X-API-Key`.

## Cấu hình

Sao chép `.env.example` thành `.env` hoặc khai báo biến môi trường trong nền tảng
triển khai:

- `PORT`, `HOST`: cổng và địa chỉ lắng nghe.
- `APP_SECRET`: khóa ký session token.
- `PARTNER_API_KEY`: khóa bảo vệ catalog đối tác.
- `DATABASE_PATH`: đường dẫn tệp SQLite.
- `CLIENT_ORIGIN`: origin frontend được phép gọi API trong chế độ phát triển.

Nếu không đặt `APP_SECRET`, server sẽ tự sinh khóa và lưu vào
`server/data/app.secret`.

## Kiểm thử

```powershell
npm test
npm run lint
npm run build
```

Bộ kiểm thử tích hợp bao phủ catalog, validation tài khoản, checkout chống sửa giá,
idempotency, tồn kho, hủy đơn, RBAC, duyệt đánh giá và Partner XML.

## Docker

```powershell
docker compose up --build
```

Ứng dụng được mở tại `http://127.0.0.1:5000`; dữ liệu nằm trong volume
`flowery-data`.

## Cấu trúc

```text
client/                 React + Vite storefront/backoffice
server/
  database.js           schema, migration và dữ liệu mẫu
  security.js           scrypt, token HMAC và XML escaping
  server.js             HTTP API, RBAC, nghiệp vụ và static hosting
  tests/                 kiểm thử tích hợp bằng node:test
windows-app/             Java Swing desktop, HTTP/JSON, test và đóng gói Windows
docs/
  API.md                 hợp đồng API chính
  TRACEABILITY.md        đối chiếu yêu cầu với phần đã triển khai
```

## Phạm vi tích hợp

Đây là hệ thống MVP chạy thực tế, không phải cấu hình production hoàn chỉnh cho
thanh toán thật. Thẻ/ví đang dùng adapter sandbox; vận chuyển và ảnh bàn giao dùng
dữ liệu nội bộ. Khi triển khai thương mại, thay các adapter này bằng cổng thanh
toán, đơn vị vận chuyển và object storage/CDN chính thức, đồng thời đặt reverse
proxy TLS, secret manager, backup và giám sát tập trung.
