# Flowery - hệ thống bán hoa trực tuyến

Flowery là một Hybrid System có thể chạy độc lập, được xây dựng từ tài liệu mô tả
nghiệp vụ và sơ đồ kiến trúc phân lớp. Hệ thống gồm cửa hàng React, cổng quản trị,
API Node.js, cơ sở dữ liệu MySQL 8.4 LTS và Windows App Java cho nhân viên.

Sơ đồ kiến trúc tham chiếu được lưu tại `docs/architecture.png`.

## Cập nhật 1.6.0

- Chuẩn hóa mô hình vai trò theo tài liệu hướng đối tượng: `Customer`, `Staff`,
  `Editor`, `Admin`; hợp nhất trách nhiệm kho/CSKH vào `Staff` và loại vai trò
  `warehouse` khỏi luồng cấp quyền mới.
- Mở cổng vận hành theo đúng vai trò: Staff quản lý catalog, đơn hàng, đánh giá và
  hoàn tiền; Editor quản lý cẩm nang; Admin quản lý toàn bộ và cấp tài khoản cấp dưới.
- Bổ sung vòng đời bài viết `Draft → InReview → Published → Archived`, quản lý phiên
  bản, liên kết sản phẩm và nhập nội dung/ảnh từ DOCX.
- Gắn đánh giá vào từng `OrderItem` đã giao để một lần mua chỉ tạo một đánh giá,
  đồng thời giữ endpoint cũ ở chế độ tương thích.
- Nâng cấp hồ sơ với ảnh đại diện được thu nhỏ tại trình duyệt, xác thực số điện
  thoại/địa chỉ và đổi mật khẩu; tài khoản do Admin tạo bắt buộc đổi mật khẩu tạm.
- Nâng cấp Windows App 1.6.0 với RBAC mới và màn hình quản lý cẩm nang bằng các
  đối tượng Java/HTTP API, không kết nối trực tiếp MySQL.

## Cập nhật 1.5.0

- Chuyển cơ sở dữ liệu vận hành mặc định từ SQLite sang MySQL Community Server
  8.4 LTS, sử dụng InnoDB, khóa ngoại và bộ ký tự `utf8mb4`.
- Tự tạo đầy đủ schema khi backend khởi động và bổ sung lệnh
  `npm run db:migrate` để chuyển dữ liệu SQLite cũ sang MySQL.
- Giữ SQLite `:memory:` riêng cho kiểm thử nhanh; Web và Windows App vẫn chỉ giao
  tiếp với Backend API, không truy cập database trực tiếp.
- Bổ sung Docker Compose gồm cả MySQL, health check và volume dữ liệu riêng.

## Cập nhật 1.4.0

- Chuẩn hóa trạng thái đơn hàng: `Confirmed → Preparing → Shipping → Delivered`;
  không còn cho phép nhảy trạng thái hoặc nhân viên tự xác nhận giao thành công.
- Tách đúng trách nhiệm: kho chuẩn bị/bàn giao; CSKH xem đơn và duyệt/từ chối hoàn
  tiền; đơn vị vận chuyển xác nhận giao hàng; cổng thanh toán hoàn tất hoàn tiền.
- Bàn giao vận chuyển bắt buộc có đơn vị và mã vận đơn duy nhất.
- Thêm Integration API nhận sự kiện giao thành công, giao thất bại/giao lại và xác
  nhận hoàn tiền; lưu lịch sử chuyển trạng thái cùng các lần giao.
- Web có modal yêu cầu hoàn tiền đầy đủ lý do và liên kết bằng chứng; Windows App có
  màn hình CSKH xử lý hoàn tiền và UI chuyển trạng thái theo ngữ cảnh.
- Bổ sung kiểm thử tích hợp xuyên suốt kho → vận chuyển → hoàn tiền.

## Cập nhật 1.0.2

- Thay bộ font mặc định bằng font hệ thống có hỗ trợ đầy đủ dấu tiếng Việt.
- Sửa hiện tượng dấu và ký tự bị tách trong các tiêu đề serif trên storefront và
  backoffice.

## Windows App 1.6.0

Dự án có thêm ứng dụng desktop `windows-app/` dành cho staff, editor và admin:

- Java 21, Swing và kiến trúc hướng đối tượng.
- Đăng nhập bằng Backend API, bearer token chỉ tồn tại trong phiên ứng dụng.
- Dashboard vận hành; Staff cập nhật tuần tự đơn, tồn kho và thông tin bàn giao.
- Màn hình CSKH phê duyệt/từ chối hoàn tiền; yêu cầu đã duyệt chờ cổng thanh toán xác nhận.
- CRUD sản phẩm hoa: thêm, xem, sửa, ngừng bán; tìm kiếm, cảnh báo sắp hết hàng và cập nhật tồn kho.
- CRUD danh mục hoa có soft delete an toàn, kích hoạt lại và bảo vệ danh mục đang có sản phẩm.
- Editor/Admin quản lý bản nháp, gửi duyệt, xuất bản và lưu trữ cẩm nang hoa.
- UX/UI mới với menu đang chọn, toolbar thoáng, trạng thái trực quan và nút theo ngữ cảnh.
- Bản vá icon vector loại bỏ ô vuông do thiếu glyph Unicode trên Windows.
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

- Đăng ký, đăng nhập, hồ sơ/ảnh đại diện, đổi mật khẩu, khóa tài khoản và RBAC.
- Catalog, tìm kiếm, lọc theo danh mục/dịp/màu, sắp xếp và gợi ý sản phẩm liên quan.
- Danh sách yêu thích và giỏ hàng lưu trên máy chủ cho người dùng đã đăng nhập.
- Checkout tính lại giá ở backend, kiểm tra tồn kho trong transaction và chống tạo
  đơn lặp bằng idempotency key.
- Thanh toán COD và adapter sandbox cho thẻ/ví; không thu hoặc lưu dữ liệu thẻ.
- Theo dõi đơn/vận chuyển, hủy trước khi giao, hoàn tồn kho và yêu cầu hoàn tiền.
- Đánh giá gắn với từng dòng hàng đã nhận, có quy trình kiểm duyệt.
- Backoffice quản lý dashboard, sản phẩm, danh mục, đơn, đánh giá, cẩm nang, người
  dùng và hoàn tiền theo đúng vai trò.
- Partner API JSON/XML có API key; ảnh sản phẩm mẫu được phục vụ nội bộ.
- Request ID, rate limit, audit log, HMAC session token, scrypt password hash và
  truy vấn SQL có tham số.

## Yêu cầu

- Node.js 24 trở lên.
- npm 10 trở lên.
- MySQL Community Server 8.4 LTS (hoặc chạy đồng thời bằng Docker Compose).

## Chạy nhanh

```powershell
npm ci
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

## Tài khoản khởi tạo

MySQL không dùng thông tin đăng nhập mặc định. Lần khởi tạo đầu tiên bắt buộc cấu
hình `BOOTSTRAP_ADMIN_EMAIL` và `BOOTSTRAP_ADMIN_PASSWORD` trong `.env` (tệp này
bị Git bỏ qua). Sau khi đăng nhập, Admin tạo Staff/Editor trong màn hình Người dùng;
mật khẩu tự sinh chỉ hiển thị đúng một lần. Bộ kiểm thử SQLite sử dụng fixture nội bộ
riêng và không được dùng làm tài khoản vận hành.

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
- `DB_CLIENT`: `mysql` trong vận hành; `sqlite` chỉ dành cho kiểm thử/fallback.
- `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_DATABASE`: vị trí database MySQL.
- `MYSQL_USER`, `MYSQL_PASSWORD`, `MYSQL_SSL`: thông tin đăng nhập và TLS MySQL.
- `BOOTSTRAP_ADMIN_EMAIL`, `BOOTSTRAP_ADMIN_PASSWORD`: chỉ dùng khi MySQL chưa có
  tài khoản; không được commit `.env` hoặc gửi các giá trị này vào tài liệu/log.
- `DATABASE_PATH`: đường dẫn SQLite cũ, chỉ dùng khi di chuyển/fallback.
- `CLIENT_ORIGIN`: origin frontend được phép gọi API trong chế độ phát triển.

Nếu không đặt `APP_SECRET`, server sẽ tự sinh khóa và lưu vào
`server/data/app.secret`. Nếu không đặt `PARTNER_API_KEY`, server cũng tự sinh
khóa tích hợp riêng và lưu vào `server/data/partner-api.key`. Hai tệp này đều
bị Git bỏ qua và khóa không được in ra terminal.

### Di chuyển SQLite cũ sang MySQL

Sau khi tạo database và cập nhật `.env`, chạy:

```powershell
npm run db:migrate
```

Lệnh này tạo schema nếu cần, xóa dữ liệu đích và sao chép toàn bộ dữ liệu từ
`DATABASE_PATH`. Hãy sao lưu MySQL trước khi chạy lại trên database đang sử dụng.

## Kiểm thử

```powershell
npm test
npm run lint
npm run build
```

Bộ kiểm thử tích hợp bao phủ catalog, validation tài khoản, checkout chống sửa giá,
idempotency, tồn kho, hủy đơn, RBAC, duyệt đánh giá, Partner XML, chuỗi trạng thái
kho/vận chuyển và vòng đời hoàn tiền.

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
  database.js           chọn MySQL/SQLite, migration và dữ liệu mẫu
  mysql-database.js     adapter MySQL cho lớp nghiệp vụ hiện có
  mysql-schema.js       schema MySQL/InnoDB
  mysql-worker.js       thực thi truy vấn ngoài luồng HTTP
  security.js           scrypt, token HMAC và XML escaping
  server.js             HTTP API, RBAC, nghiệp vụ và static hosting
  tests/                 kiểm thử tích hợp bằng node:test
scripts/
  migrate-sqlite-to-mysql.js  chuyển dữ liệu SQLite sang MySQL
windows-app/             Java Swing desktop, HTTP/JSON, test và đóng gói Windows
docs/
  API.md                 hợp đồng API chính
  TRACEABILITY.md        đối chiếu yêu cầu với phần đã triển khai
  mentor/                workbook RBAC/mô tả màn hình và Draw.io wireframe/wireflow
```

## Phạm vi tích hợp

Đây là hệ thống MVP chạy thực tế, không phải cấu hình production hoàn chỉnh cho
thanh toán thật. Thẻ/ví đang dùng adapter sandbox; vận chuyển và ảnh bàn giao dùng
dữ liệu nội bộ. Khi triển khai thương mại, thay các adapter này bằng cổng thanh
toán, đơn vị vận chuyển và object storage/CDN chính thức, đồng thời đặt reverse
proxy TLS, secret manager, backup và giám sát tập trung.
