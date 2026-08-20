# MySQL cho Flowery

Flowery sử dụng MySQL Community Server 8.4 LTS, InnoDB và `utf8mb4` trong chế độ
vận hành. SQLite chỉ còn là database `:memory:` cho kiểm thử tự động và là nguồn
dữ liệu cũ khi chạy migration.

## Cấu hình

Sao chép `.env.example` thành `.env`, sau đó đặt `DB_CLIENT=mysql` và điền các biến
`MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_DATABASE`, `MYSQL_USER`, `MYSQL_PASSWORD`.
Không commit `.env`, mật khẩu hoặc bản sao database lên GitHub.

Khi database chưa có người dùng, đặt thêm `BOOTSTRAP_ADMIN_EMAIL` và
`BOOTSTRAP_ADMIN_PASSWORD` mạnh. Hai giá trị chỉ được đọc để băm và tạo Admin đầu
tiên; API không ghi mật khẩu thô vào log/audit. Sau khi đăng nhập, có thể xóa hai
dòng bootstrap khỏi `.env`. Nếu database đã có tài khoản, chúng không còn cần thiết.

`APP_SECRET` phải là chuỗi ngẫu nhiên dài ít nhất 32 ký tự và `PARTNER_API_KEY`
ít nhất 24 ký tự. Không dùng giá trị ví dụ khi chạy MySQL.

Tài khoản ứng dụng chỉ cần quyền `SELECT`, `INSERT`, `UPDATE`, `DELETE`, `CREATE`,
`ALTER`, `INDEX` và `REFERENCES` trên database `flowery`; không dùng tài khoản
`root` để chạy Backend API.

## Di chuyển dữ liệu

```powershell
npm run db:migrate
```

Migration tạo schema, xóa dữ liệu đích và sao chép toàn bộ bảng từ SQLite sang
MySQL trong đúng thứ tự khóa ngoại. Vì đây là thao tác thay thế dữ liệu đích, cần
sao lưu trước khi chạy lại trên môi trường đã có dữ liệu thật.

## Xác minh

```powershell
npm run check
npm start
```

Mở `http://127.0.0.1:5000/api/health`; phản hồi `status: healthy` xác nhận Backend
API đã truy vấn được database.
