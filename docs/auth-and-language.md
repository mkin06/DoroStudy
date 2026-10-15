# Đăng nhập ổn định và chuyển ngôn ngữ Việt/Anh

Thay đổi tại `D:\F\SUM26\EXE101\dorostudy`.

## Phiên đăng nhập

- `studySession.js` và `reflection.js` không chuyển trang khi API trả 401/403. Trước đây, tạm dừng đồng hồ làm thẻ Focus Coach gọi lại API; một phản hồi lỗi ở đây đủ để đẩy người học sang trang đăng nhập.
- Focus Coach chỉ gọi API khi đã có người dùng. Các API đăng nhập, phiên học, ghi chú, nhắc nhở và reflection dùng chung `API_URL` để không gửi cookie sang hai backend khác nhau.
- `/auth/me` và logout không tạo phiên nếu chưa có phiên. Login và Google login chỉ tạo/đổi ID phiên sau khi xác thực thành công. Điều này tránh phản hồi kiểm tra khách ghi đè cookie đăng nhập bằng một phiên rỗng.
- Spring Security trả 401 cho yêu cầu chưa xác thực và không tạo saved-request session. Local default profile dùng timeout 12 giờ, đồng nhất với Docker. Phiên local vẫn mất khi backend khởi động lại; Docker dùng Redis như trước.

## Google

- Nút Google được giữ trong DOM khi đang xác thực; có thể thử lại sau lỗi.
- Google Identity Services được khởi tạo một lần cho mỗi SDK trong trang; thay đổi form/ngôn ngữ không khởi tạo lại SDK. Callback luôn trỏ tới form hiện tại.
- Google login kiểm tra `/auth/me` sau khi backend đăng nhập thành công trước khi chuyển về trang học, tương tự đăng nhập mật khẩu.
- Kiểm thử sử dụng SDK và phản hồi token giả lập. Không đăng nhập vào tài khoản Google thật của người dùng.

Tài liệu: [Google Identity Services JavaScript reference](https://developers.google.com/identity/gsi/web/reference/js-reference), [Spring Security session management](https://docs.spring.io/spring-security/reference/servlet/authentication/session-management.html).

## Ngôn ngữ và feedback

- Nút VI/EN nằm trong header trang học và góc trên trang đăng nhập/đăng ký. Lựa chọn lưu ở `localStorage` với khóa `dorostudy.language`; khi chưa chọn thì dùng ngôn ngữ trình duyệt. Đổi ngôn ngữ không tải lại trang hoặc reset đồng hồ.
- Giao diện chính, form xác thực, hướng dẫn, cài đặt, nhạc, ghi chú, hồ sơ và form feedback dùng chung từ điển tĩnh. Không cài thư viện dịch hoặc gọi API dịch.
- Form feedback đổi cả câu hỏi, lựa chọn, gợi ý nhập, thông báo và thuộc tính `lang`. Văn bản người dùng tự viết được giữ nguyên.
- PostHog nhận thêm `language: vi|en`. Mã lựa chọn, ID câu hỏi và nhãn chuẩn của survey giữ nguyên để thống kê cũ/mới không bị tách đôi. Không thêm bảng hoặc cột database cho khảo sát/ngôn ngữ.
- Reflection mới gửi `language` tới backend và AI service. Gemini trả lời theo ngôn ngữ đó trong cùng lượt gọi hiện có; fallback cũng có tiếng Anh. Không gọi AI thêm để dịch lịch sử. Nội dung AI lịch sử vẫn giữ ngôn ngữ lúc tạo.
- Các lời khuyên tính cục bộ được dịch bằng mẫu văn bản trong từ điển; khi bổ sung mẫu mới ở backend, cần thêm bản tiếng Anh tương ứng trong `frontend/src/lib/messages.en.json`.

## Chạy thử

Khởi động lại backend và AI service, chạy/reload frontend để nạp mã mới. Với Railway cần triển khai lại ba service tương ứng. Các thay đổi ở đây chưa được triển khai lên Railway.

Kiểm thử hồi quy nằm ở `frontend/e2e/auth-language.spec.js`, `LocalSessionConfigurationTest` và `AuthServiceImplTest`: bắt đầu/tạm dừng với lỗi API, cookie trên API bảo vệ, đăng nhập Google lại, thử lại sau lỗi và sau khi đổi ngôn ngữ, form feedback tiếng Anh và lưu lựa chọn ngôn ngữ.
