# FaceLog Attendance

Hệ thống quản lý nhân sự và chấm công bằng FaceID, gồm Next.js frontend, Express/TypeScript backend và MariaDB/MySQL.

## **ScreenShot**
**1. Dashboard hệ thống.**
<img width="1920" height="1020" alt="3 admin dash" src="https://github.com/user-attachments/assets/706b54e5-6e35-4442-9f14-96820247e71c" />
**2. Quản lý nhân sự.**
<img width="1920" height="1020" alt="5 ql nhan su" src="https://github.com/user-attachments/assets/011efa76-48c0-4e7a-9ff5-47cfdb5eba90" />
**3. Camera chấm công tự động.**
<img width="1920" height="1080" alt="7 cham cong" src="https://github.com/user-attachments/assets/0d18e9b4-44b9-442f-ac9e-a60f7c6ccbe4" />
**4. Báo cáo thống kê.**
<img width="1920" height="1020" alt="9 bc 1" src="https://github.com/user-attachments/assets/49eb7a55-d5b9-4721-966d-983ece68c007" />
**5. Lịch sử chấm công.**
<img width="1920" height="1020" alt="10 bc 2" src="https://github.com/user-attachments/assets/4debe233-ea98-40bd-9887-8aba2130f95e" />
**6. Lịch sử hệ thống.**
<img width="1920" height="1020" alt="14  audit" src="https://github.com/user-attachments/assets/78daf6bb-6e9c-434f-b369-9e56cff20dfa" />

## Chức năng

- Đăng ký FaceID từ ba góc mặt và kiểm tra lại sau khi lưu.
- Chấm công tự động: tự xác định lượt vào/ra, ghi log và cập nhật tổng hợp ngày.
- Báo cáo có tên nhân viên, tìm kiếm, lọc ngày/khoảng ngày, phòng ban, trạng thái, sort và phân trang.
- CRUD hồ sơ nhân sự; thao tác xóa là nghỉ việc/khóa FaceID để giữ lịch sử chấm công.
- Audit log cho thay đổi nhân sự, đăng ký FaceID và ghi nhận chấm công.
- Đăng nhập, đăng ký tài khoản, phân quyền và quản lý account.
- Quản trị ca làm; giờ ra chỉ mở theo giờ kết thúc ca đã cấu hình.
- Xuất dữ liệu báo cáo đang xem thành CSV.

## Khởi chạy

### Database

Import file `be/database/facelog_schema_seed.sql` vào MariaDB/MySQL. Schema mặc định là `facelog_db`. File này đã bao gồm đầy đủ cấu trúc mới nhất và các trigger migration, vì vậy môi trường cài mới không cần chạy thêm migration.

Chỉ với database đã tồn tại từ phiên bản cũ, chạy migration `be/database/migrations/20260721_employee_termination_triggers.sql` để bổ sung trigger kiểm tra ngày nghỉ việc.

### Backend

```bash
cd be
copy .env.example .env
npm install
npm run dev
```

Backend mặc định chạy tại `http://localhost:8000`.

### Frontend

```bash
cd fe
npm install
npm run dev
```

Frontend mặc định chạy tại `http://localhost:3000`. Có thể đổi backend URL bằng `NEXT_PUBLIC_API_BASE_URL`.

Để truy cập từ thiết bị khác trong mạng LAN và sử dụng camera, chạy frontend bằng HTTPS:

```bash
cd fe
npm run dev:https
```

Script tự nhận IP LAN và in địa chỉ dạng `https://192.168.x.x:3000`. Lần chạy đầu script sẽ dùng `mkcert` để tạo CA/chứng chỉ phát triển và có thể yêu cầu quyền cài CA. Máy hoặc điện thoại truy cập cũng phải tin cậy CA này; file CA gốc nằm trong thư mục `mkcert` được thông báo khi khởi động. Cảnh báo không cài được Java trust store có thể bỏ qua nếu chỉ dùng trình duyệt. Có thể ép IP khi máy có nhiều card mạng bằng PowerShell:

```powershell
$env:DEV_HTTPS_HOST="192.168.22.105"
npm run dev:https
```

Frontend gọi API qua `/api`; Next.js proxy nội bộ tới `BACKEND_API_URL` (mặc định `http://localhost:8000/api`) để tránh mixed-content.

Tài khoản seed: `admin / admin123`, `hr.staff / hrstaff123`, `security / security123`. Hash SHA-1 cũ được tự động nâng cấp sang `scrypt` sau lần đăng nhập thành công đầu tiên.

## API chính

- `POST /api/attendance/face-check`: nhận diện, ghi lượt vào/ra và tổng hợp ngày.
- `GET /api/attendance/daily-report`: báo cáo với `keyword`, `from`, `to`, `departmentId`, `status`, `sortBy`, `sortOrder`, `page`, `pageSize`.
- `GET /api/employees`: danh sách nhân sự có lọc, sort và phân trang.
- `POST /api/employees`, `PUT /api/employees/:id`, `DELETE /api/employees/:id`: CRUD nhân sự.
- `GET /api/employees/meta`: danh mục phòng ban và chức vụ.
- `POST /api/faceid/enroll`: lưu/cập nhật hồ sơ FaceID.
- `GET /api/audit-logs`: nhật ký thay đổi hệ thống.

## Kiểm tra build

```bash
cd be && npm run build
cd ../fe && npm run build
```
