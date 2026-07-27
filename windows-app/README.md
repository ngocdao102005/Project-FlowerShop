# Flowery Staff — Windows App

Flowery Staff là ứng dụng desktop Java dành cho nhân viên vận hành, nhân viên kho,
biên tập viên và quản trị viên của hệ thống bán hoa trực tuyến.

Ứng dụng tuân thủ kiến trúc Hybrid System:

- Giao diện Windows được xây dựng bằng Java Swing và lập trình hướng đối tượng.
- Windows App chỉ gọi Backend API bằng HTTP/JSON; không kết nối trực tiếp cơ sở dữ liệu.
- Backend chịu trách nhiệm xác thực, phân quyền, nghiệp vụ và lưu dữ liệu.
- Hợp đồng API hiện tại tương thích với backend Node.js/SQLite; có thể thay bằng
  PHP MVC/MySQL sau này nếu giữ nguyên endpoint và cấu trúc JSON.

## Chức năng

- Đăng nhập tài khoản nhân viên và từ chối tài khoản customer.
- Dashboard: doanh thu, tổng đơn, đơn chờ xử lý, khách hàng, hàng sắp hết và đánh giá chờ duyệt.
- Danh sách đơn hàng và cập nhật trạng thái: xác nhận, chuẩn bị, đang giao, đã giao hoặc hủy.
- CRUD sản phẩm hoa: thêm mới, xem, chỉnh sửa và ngừng bán nhưng vẫn giữ lịch sử.
- Biểu mẫu đầy đủ danh mục, giá, mô tả, ảnh, dịp tặng, loại hoa, màu sắc và nội dung biên tập.
- CRUD danh mục hoa: thêm, xem, sửa, ngừng sử dụng và kích hoạt lại.
- Bảo vệ danh mục đang có sản phẩm hoạt động để tránh làm hỏng catalog.
- Tìm kiếm cục bộ và cảnh báo hàng còn từ 10 sản phẩm trở xuống.
- Cập nhật tồn kho dành cho staff, warehouse và admin.
- Đăng xuất xóa bearer token khỏi bộ nhớ và quay lại màn hình đăng nhập.

## UX/UI phiên bản 1.2.0

- Menu trái hiển thị rõ màn hình đang chọn và mô tả ngữ cảnh trên thanh tiêu đề.
- Toolbar sản phẩm, danh mục và đơn hàng được bố trí hai hàng, phù hợp màn hình nhỏ hơn.
- Nút sửa, ngừng bán và cập nhật kho chỉ khả dụng sau khi chọn dữ liệu hợp lệ.
- Bảng có màu trạng thái, hàng xen kẽ, cảnh báo tồn kho thấp và tooltip cho thao tác.
- Biểu mẫu kiểm tra dữ liệu tại chỗ; lỗi API hiển thị trực tiếp mà không làm treo giao diện.

## Chạy bản đóng gói

1. Khởi động Backend API của dự án chính tại `http://127.0.0.1:5000`.
2. Mở `FloweryStaff.exe` trong thư mục `dist\FloweryStaff`.
3. Đăng nhập tài khoản mẫu:

| Vai trò | Email | Mật khẩu |
|---|---|---|
| Quản trị | `admin@flowery.vn` | `Admin@123` |

Bản đóng gói chứa sẵn Java Runtime nên máy người dùng không phải cài JDK.

## Cấu hình Backend API

Mặc định ứng dụng gọi:

```text
http://127.0.0.1:5000/api
```

Có thể thay đổi theo thứ tự ưu tiên:

1. JVM property `-Dflowery.api.baseUrl=http://may-chu:5000/api`
2. Biến môi trường `FLOWERY_API_BASE_URL`
3. Tệp `config\application.properties`

Khi triển khai qua mạng, dùng HTTPS và không đưa Windows App kết nối thẳng MySQL.

## Biên dịch và kiểm thử

Yêu cầu cho máy phát triển: JDK 21.

```powershell
.\build.ps1
.\run.ps1
```

`build.ps1` biên dịch UTF-8, tạo `build\FloweryStaff.jar` và chạy:

- kiểm thử parser/serializer JSON;
- kiểm thử tích hợp đăng nhập, bearer token, dashboard, CRUD sản phẩm, CRUD danh mục
  và cập nhật tồn kho với HTTP server giả lập.

## Đóng gói Windows

```powershell
.\package.ps1
```

Kết quả nằm tại `dist\FloweryStaff\FloweryStaff.exe`.

## Cấu trúc mã nguồn

```text
src/main/java/vn/flowery/staff/
  api/        HTTP client, bearer token và lỗi API
  config/     cấu hình địa chỉ backend
  json/       parser/serializer JSON không dùng thư viện ngoài
  model/      User, DashboardStats, Order, Product
  service/    lớp nghiệp vụ giao tiếp API
  ui/         cửa sổ đăng nhập, cửa sổ chính và các màn hình chức năng
src/test/     kiểm thử tự động
```
