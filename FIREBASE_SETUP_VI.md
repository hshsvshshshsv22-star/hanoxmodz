HANOX MOD Z — Xác thực Firebase + KHÓA MÁY CHỦ + QUẢN TRỊ

Logic

· Email/mật khẩu và đăng nhập Google sử dụng Firebase Authentication.
· Mỗi khóa chỉ có thể đổi một lần. Khóa N ngày sẽ cộng N điểm vào tài khoản đang đăng nhập.
· Một thao tác tạo thành công sẽ trừ 1 điểm. "Tạo 4 phiên bản" là một thao tác và trừ 1 điểm.
· Có thể đổi khóa mới sau đó để cộng thêm điểm. Điểm không hết hạn trong bản triển khai này.
· Các thao tác quản trị và thay đổi điểm chạy qua Cloud Functions; quy tắc phía client của Firestore từ chối ghi khóa trực tiếp và cập nhật điểm.

1. Tạo dự án Firebase

1. Trong Firebase Console, tạo/chọn một dự án. Thêm một Web App và sao chép cấu hình của nó vào firebase-config.js (thay thế tất cả các giá trị YOUR_*). Cấu hình web này vốn được công khai theo thiết kế; tuyệt đối không đặt file JSON tài khoản dịch vụ hoặc khóa riêng tư vào kho lưu trữ này.
2. Authentication → Sign-in method: bật Email/Password và Google.
3. Authentication → Settings → Authorized domains: thêm chính xác tên miền máy chủ GitHub Pages (đối với trang dự án, thường là TENBAN.github.io; đối với tên miền tùy chỉnh, thêm tên miền đó).
4. Tạo Cloud Firestore ở chế độ production.

2. Triển khai quy tắc và Functions

Yêu cầu Node.js 20 và Firebase CLI trên máy tính/môi trường Termux hỗ trợ; bản thân GitHub Pages không thể chạy mã máy chủ. Trong thư mục dự án:

```bash
npm install -g firebase-tools
firebase login
firebase use --add
cd functions && npm install && cd ..
firebase deploy --only firestore:rules,functions
```

Việc triển khai Cloud Functions có thể yêu cầu bật thanh toán (Blaze) trong Firebase/Google Cloud. Không được bỏ qua yêu cầu này. GitHub Pages vẫn là dịch vụ lưu trữ tĩnh.

3. Tạo quản trị viên đầu tiên

1. Đăng ký/đăng nhập một lần tại trang đã triển khai bằng tài khoản sẽ làm quản trị viên.
2. Firebase Console → Authentication → Users → sao chép UID của người dùng đó.
3. Firestore → tạo collection admins, ID tài liệu chính xác là UID đó. Thêm trường role (string) = admin.
4. Tải lại admin.html. Chỉ những tài khoản có UID nằm trong admins với role admin mới có thể quản lý khóa. Không để người dùng ghi vào collection admins.

4. GitHub Pages

Tải nội dung của thư mục này lên thư mục gốc của kho lưu trữ, bao gồm firebase-config.js, admin.html, firebase.json, firestore.rules và thư mục functions/. GitHub Pages chỉ phục vụ file tĩnh; triển khai Functions riêng bằng Firebase CLI.

Lưu ý bảo mật quan trọng

Mã trình duyệt là công khai trên GitHub Pages. Không đặt mật khẩu quản trị, thông tin xác thực tài khoản dịch vụ hoặc bí mật riêng tư trong HTML/JS. Quy tắc Firestore bảo vệ bản ghi khóa và số dư điểm; Cloud Functions xác thực vai trò quản trị và thực hiện giao dịch điểm. Các tệp ZIP/tài nguyên có thể tải xuống thực tế cũng là tài nguyên tĩnh công khai, vì vậy điều này kiểm soát luồng trang web chính thức và sổ cái điểm tài khoản, chứ không phải DRM chống lại người tải xuống hoặc sửa đổi các tệp client công khai.

Hành vi đã biết

· days của khóa là số điểm được cấp, không phải thời hạn tài khoản theo thời gian. "Vĩnh viễn" hiện tại có nghĩa là 99.999 điểm (hữu hạn), được hiển thị rõ ràng trong phần quản trị.
· maxDevices được ghi lại để quản lý nhưng việc ràng buộc tài khoản được thực thi bằng việc đổi khóa một lần, không phải hệ thống dấu vân tay phần cứng/thiết bị đầy đủ. Dấu vân tay trình duyệt không đáng tin cậy và có thể bị giả mạo.
· Khu vực Cloud Functions là asia-southeast1. Nếu bạn thay đổi khu vực, hãy cập nhật biến trong firebase-config.js.
· Chưa có cấu hình Firebase nào được điền sẵn cho bạn; bạn phải sử dụng cấu hình web của dự án riêng và triển khai quy tắc/functions trước khi đăng nhập/thao tác khóa hoạt động.