HANOX MOD Z ALOK — GÓI ĐƯA LÊN HOSTING (GitHub Pages)

1) Giải nén toàn bộ ZIP vào một thư mục.
2) Trên Windows, cần Python 3.10+ và Internet. Chạy PREPARE_UPLOAD.bat và đợi tải xong ảnh runtime.
3) Nếu báo lỗi, xem UPLOAD_ASSETS_REPORT.txt; chưa upload cho đến khi runtime assets đủ.
4) Tạo một repository GitHub mới (hoặc repository bạn sở hữu). Upload toàn bộ NỘI DUNG bên trong thư mục này lên thư mục gốc repository, không upload file ZIP.
5) Vào Settings → Pages → Build and deployment → Deploy from a branch → chọn branch main và folder /(root) → Save.
6) Chờ GitHub Pages xuất bản, mở URL Pages được GitHub hiển thị. Mở bằng HTTPS trên điện thoại.

LƯU Ý
- Gói này là website tĩnh, không phải APK.
- Dữ liệu export lớn khoảng 30.7 MB, vì vậy cần upload đủ các file .bin và .gz; không đổi tên file.
- Các file ảnh runtime phải nằm đúng đường dẫn assets/runtime/ và icon nằm assets/category-icons/.
- Báo cáo nguồn đã ghi nhận 4 URL assets/previews mặc định trả 404. Script chỉ tải runtime textures; 4 preview mặc định không phải texture trang phục.
- Chưa thể xác nhận 3D/export chạy hoàn chỉnh nếu chưa deploy và kiểm thử trên trình duyệt thực tế.


THÊM: FIREBASE SERVER KEY / TÀI KHOẢN
- Xem FIREBASE_SETUP_VI.md để cấu hình Email/Google Auth, Cloud Firestore, Cloud Functions và cấp admin đầu tiên.
- Điền firebase-config.js trước khi triển khai.
- Đưa toàn bộ file tĩnh lên GitHub Pages; deploy Cloud Functions riêng bằng Firebase CLI.
- Không tải service-account JSON hoặc mật khẩu admin lên GitHub.
