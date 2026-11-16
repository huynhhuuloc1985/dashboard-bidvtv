# ĐIỀU HÀNH 360 — Web theo dõi công việc và khảo sát nội bộ

Một ứng dụng giao diện **tiếng Việt**, có thể sử dụng trên điện thoại và máy tính. Quản trị viên tạo yêu cầu và giao cho nhiều phòng ban; cán bộ cập nhật tiến độ công việc hoặc trả lời biểu mẫu khảo sát; dashboard thống kê và xuất CSV mở trong Excel.

## Các chức năng đã có

- Dashboard toàn đơn vị: lượt báo cáo, số hoàn thành, đang thực hiện, quá hạn; biểu đồ tổng thể và tỷ lệ hoàn thành theo phòng. Khi kết nối trực tuyến, dashboard tự đồng bộ mỗi khoảng 60 giây, hoặc bấm **Làm mới**.
- Tạo yêu cầu **Công việc/Báo cáo** hoặc **Khảo sát** và chọn các phòng cần báo cáo, hạn nộp.
- Khảo sát có 3 loại trường: nội dung tự do, số liệu (`[số]`), Có/Không (`[có/không]`).
- Cán bộ cập nhật tiến độ 0–100%, kết quả thực hiện, hoặc điền câu hỏi; có thể đính kèm *đường dẫn* tài liệu minh chứng.
- Người quản lý xem phản hồi của từng phòng, **cộng tổng/trung bình các câu hỏi số liệu** và số câu trả lời Có/Không theo từng đợt khảo sát, theo dõi yêu cầu quá hạn, đóng/mở yêu cầu, xuất CSV cho Excel.
- Quản trị viên có thể tạo phòng ban, gán vai trò/quyền và phòng cho tài khoản (khi bật chế độ trực tuyến).
- Giao diện responsive phù hợp điện thoại; tất cả dữ liệu trao đổi qua HTTPS nếu triển khai GitHub Pages + Supabase.

## A. Dùng thử ngay (không cần tạo tài khoản)

1. Mở `index.html` trong trình duyệt hoặc đăng các file lên GitHub Pages.
2. Có sẵn 6 phòng ban, 5 đợt yêu cầu mẫu và nhiều lượt kết quả.
3. Dùng hộp chọn ở góc phải để chuyển giữa **Quản trị viên** và **cán bộ của từng phòng**.
4. Thử tạo yêu cầu mới, nhập kết quả, trả lời khảo sát, xem dashboard hoặc bấm **Xuất báo cáo CSV**.

**Giới hạn quan trọng:** Bản dùng thử lưu bằng `localStorage` trên chính trình duyệt. Người dùng ở điện thoại/máy tính khác **KHÔNG** thấy cùng dữ liệu. Không dùng bản demo để lưu thông tin nội bộ quan trọng.

## B. Bật chế độ trực tuyến để nhiều phòng cùng sử dụng

### Bước 1 — Tạo cơ sở dữ liệu

1. Đăng ký / đăng nhập tại https://supabase.com và tạo **New project** (có gói miễn phí với giới hạn tài nguyên).
2. Trong Supabase > **SQL Editor**, mở file `schema.sql`, dán toàn bộ nội dung và bấm **Run**.
3. Trong **Project Settings / API Keys** (hoặc mục Connect), lấy **Project URL** và **Publishable key** (hay `anon` key cũ). TUYỆT ĐỐI không dùng `service_role` hoặc secret key ở website.
4. Mở `config.js`, nhập giá trị (bên trong dấu nháy):

```javascript
window.DASHBOARD_CONFIG = {
  SUPABASE_URL: 'https://ten-du-an.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_...',
  ORGANIZATION_NAME: 'Tên đơn vị của bạn'
};
```

5. Lưu file và tải lại website. Ứng dụng sẽ tự chuyển qua màn hình đăng nhập. Khi đăng nhập, người dùng được giới hạn dữ liệu theo phòng và vai trò bằng các chính sách **Row Level Security (RLS)**.

### Bước 2 — Tạo người quản trị đầu tiên

1. Mở website, chọn **Đăng ký**, nhập tên, email và mật khẩu của người quản lý.
2. Nếu Supabase bật xác thực email, vào email xác nhận trước khi đăng nhập.
3. Quay lại **Supabase SQL Editor** và chạy riêng câu lệnh sau (đổi email đúng của người vừa đăng ký):

```sql
update public.profiles
set role = 'admin'
where email = 'email-quan-tri@donvi.vn';
```

4. Đăng xuất/đăng nhập lại. Bạn sẽ thấy mục **Tài khoản** và nút **Tạo yêu cầu mới**.
5. Tạo các phòng tại mục **Phòng ban**. Cho cán bộ đăng ký bằng email của họ. Vào mục **Tài khoản**, gán mỗi người vào đúng phòng, chọn **Cán bộ**, rồi bấm **Lưu**.

**Gợi ý bảo mật:** Sau khi tạo tài khoản, nên tắt đăng ký công khai hoặc giới hạn email được phép đăng ký, bật xác thực email/MFA và đặt mật khẩu đủ mạnh. Trước khi đưa vào sử dụng chính thức, cần kiểm thử phân quyền (đặc biệt người không cùng phòng và người không phải quản trị) trên dự án Supabase của đơn vị.

### Bước 3 — Đưa website lên Internet bằng GitHub Pages

1. Đăng nhập GitHub, tạo repository mới, ví dụ `dashboard-don-vi`, chế độ **Private hoặc Public** tùy chính sách của đơn vị. Lưu ý: GitHub Pages thường có yêu cầu riêng theo loại tài khoản/kho lưu trữ.
2. Tải lên **4 file** nằm trong cùng thư mục: `index.html`, `style.css`, `app.js`, `config.js` (không cần đưa `schema.sql` lên web).
3. Vào repository > **Settings** > **Pages** > phần **Build and deployment**, chọn **Deploy from a branch**, branch `main`, folder `/ (root)`, bấm **Save**.
4. Mở đường dẫn do GitHub Pages cung cấp, thường có dạng `https://ten-tai-khoan.github.io/dashboard-don-vi/`.
5. Trên Supabase > **Authentication** > **URL Configuration**, điền URL website vào Site URL (và Redirect URLs nếu cần) để xử lý xác thực email phù hợp.
6. Gửi URL web cho từng phòng ban. Mọi người sử dụng được trên Android/iPhone mà không cần cài phần mềm riêng.

### Cách thao tác trên điện thoại Android

- Trong ứng dụng GitHub hoặc Chrome, mở repository > dấu `+` / **Add file** > **Upload files** (có thể cần bật **Trang web cho máy tính** trong Chrome), chọn 4 file từ thư mục tải về.
- GitHub Pages và Supabase được cấu hình trong trình duyệt Chrome, nếu giao diện quá hẹp hãy bật **Trang web cho máy tính**.
- Sau khi xuất bản, mở địa chỉ web > menu Chrome > **Thêm vào màn hình chính** để truy cập như một ứng dụng.

## C. Những điểm cần biết trước khi dùng chính thức

- Đây là **bản nền tảng MVP**, không phải phần mềm đã được kiểm thử bảo mật và vận hành ở cấp cơ quan. Nên thử với dữ liệu giả trước.
- Chưa có: tải tệp trực tiếp, lịch sử chỉnh sửa và duyệt báo cáo, nhắc hạn qua email/Zalo, chỉnh sửa câu hỏi sau khi phát hành, nhập Excel và biểu mẫu nhiều cấp.
- Mỗi phòng có **một bản báo cáo chung cho mỗi yêu cầu**. Nhiều cán bộ cùng phòng có thể cập nhật bản này; lần lưu sau sẽ thay nội dung cũ, không lưu lịch sử.
- Hạn nộp để thống kê **quá hạn**; phiên bản này không tự khóa nộp sau hạn, chỉ khóa khi quản trị viên **Đóng yêu cầu**.
- Xuất **CSV UTF-8 có BOM** (mở được trong Microsoft Excel), không phải file XLSX chuẩn. Hãy kiểm tra cách Excel hiển thị dấu tiếng Việt ở máy của đơn vị.
- Phiên bản mẫu chưa triển khai kiểm thử RLS tự động, nhật ký kiểm toán, backup/khôi phục, giới hạn tần suất và bảo vệ chống đăng ký rác. Cần bổ sung nếu có dữ liệu nhạy cảm.
- Khi cần thay đổi thông tin đơn vị, chỉ sửa `ORGANIZATION_NAME` trong `config.js`.

## Cấu trúc file

- `index.html` — trang web chính
- `style.css` — giao diện responsive
- `app.js` — nghiệp vụ, biểu mẫu, dashboard và xuất CSV
- `config.js` — chuyển đổi giữa chế độ dùng thử và Supabase
- `schema.sql` — bảng cơ sở dữ liệu, trigger và phân quyền RLS
- `README.md` — hướng dẫn này

## Nguồn tham khảo kỹ thuật

- Supabase: https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase Auth: https://supabase.com/docs/guides/auth
- GitHub Pages: https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site
