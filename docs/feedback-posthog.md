# Feedback AI Reflection và UX/UI trên DoroStudy

Thư mục triển khai: **`D:\F\SUM26\EXE101\dorostudy`**. Đây là dự án có sẵn PostHog, nhạc nền, ghi chú, Focus Coach, quota AI và onboarding. Không sao chép backend khảo sát của bản `C:\Users\boyth\IdeaProjects\project\studyfocus` vào đây.

## Người dùng góp ý ở đâu?

- Nút **Góp ý** ở góc trang học hoặc **Góp ý sản phẩm** trong menu tài khoản.
- **Viết góp ý cho nhóm** ngay bên dưới kết quả Reflection, giữ đúng phản hồi vừa đọc để đánh giá.
- Hai loại: **AI Reflection** và **Giao diện & trải nghiệm**. Đổi loại vẫn giữ hai bản nháp riêng khi hộp góp ý còn mở.
- Khách chưa đăng nhập vẫn viết comment UX/UI được. Đánh giá AI chỉ mở khi có một Reflection thực tế; không bắt khách tưởng tượng chất lượng AI.
- Comment tối đa **1.500 ký tự**, không chọn sẵn điểm hay câu trả lời. Comment là bắt buộc ở nhánh UX/UI; ở nhánh AI, người dùng có thể chỉ trả lời hai câu nhanh hoặc kể thêm.
- Không tự mở popup trong lúc học. Dùng nút đóng, “Để sau” hoặc Escape để quay lại.

## Câu hỏi và chức năng hiện có

AI: mức hữu ích 1–5, khả năng áp dụng, nhận xét tự do. Phần mở rộng: tác nhân → cách thực sự đã xử lý → kết quả tự đánh giá → hỗ trợ mong muốn.

Bao phủ điện thoại/mạng xã hội, tiếng ồn, mệt mỏi, suy nghĩ lan man, nội dung khó, việc khác và không xao nhãng. Các hỗ trợ được hỏi bám vào đồng hồ tạm dừng/tiếp tục, nhạc nền, nghỉ ngắn, ghi chú và chia mục tiêu. Có lựa chọn không cần app hỗ trợ.

UX/UI: viết nhận xét cụ thể, chọn khu vực và loại vướng mắc. Các khu vực: đồng hồ, AI Reflection, kế hoạch phiên tới, nhạc nền, ghi chú, hồ sơ/thống kê, cài đặt, hình nền/thời tiết, hướng dẫn và trải nghiệm chung.

## Dữ liệu đi đâu?

Góp ý gửi trực tiếp tới **PostHog Cloud** bằng public project token đã có. Không thêm bảng MySQL, endpoint ghi khảo sát, Redis instance, service hoặc lượt gọi Gemini.

- Có `VITE_POSTHOG_REFLECTION_SURVEY_ID` / `VITE_POSTHOG_UX_SURVEY_ID`: gửi sự kiện chuẩn **`survey sent`** với question UUID, submission UUID, phiên bản và câu trả lời; xem trong **Surveys → Responses**.
- Chưa có hai ID này: vẫn gửi **`feedback_submitted`**; vào **Activity → Events**, lọc sự kiện rồi mở `feedback_comment`, `form`, `area`, `issue_type`… Đó là dữ liệu event thật, không phải một native Survey đã được tạo.
- Chỉ nhấn **Gửi góp ý** mới truyền comment. Analytics tự động tiếp tục loại nội dung nhập, tên, email, mật khẩu và query string. Form có lớp `ph-no-capture`.
- Người dùng được thông báo ngay trong form rằng nội dung họ chủ động gửi được chuyển tới PostHog cùng mã khách/tài khoản. Không gửi nội dung ghi chú học tập, mục tiêu, lời khuyên AI hay toàn bộ URL qua luồng này.
- Giữ `disable_surveys: true` cho module popup tự động của SDK: UI ở đây do app hiển thị và gửi theo **headless/API survey**, không phụ thuộc popup, tải danh sách survey hoặc đánh giá feature flag mỗi lần mở trang.

Form chỉ hiện thành công sau HTTP acknowledgement từ PostHog. Nếu lỗi mạng, bị chặn hoặc nhận receipt từ chối, giữ nội dung để thử lại. Retry không sửa nội dung dùng lại UUID để PostHog có thể loại trùng sau xử lý; không hứa loại trùng tức thì. Khi bật Do Not Track/opt out, không âm thầm vượt qua lựa chọn đó; người dùng có thể tải nhận xét thành file text để gửi riêng cho nhóm.

## Báo cáo trực quan

`scripts/posthog-feedback-plan.mjs` định nghĩa hai API Surveys và chín báo cáo:

1. Phễu bắt đầu học → hoàn thành phiên → xem Reflection → áp dụng kế hoạch từ Reflection.
2. Số góp ý theo ngày.
3. Phân bố mức hữu ích AI (chỉ nguồn Gemini).
4. Mức rõ ràng/khả năng áp dụng lời khuyên.
5. Tác nhân → cách xử lý → kết quả.
6. Hỗ trợ mong muốn từ sản phẩm.
7. Góp ý UX/UI theo khu vực.
8. Bảng đọc comment AI và UX/UI, kèm nguồn phản hồi.
9. Nguồn cộng đồng của người đã góp ý.

Các SQL tile tính 30 ngày gần nhất, chỉ `app_environment = production`, dùng `feedback_id` để tránh cộng lặp retry trong số phản hồi. Bảng comment hiển thị 200 phản hồi gần nhất có chữ. File cấu hình là **kế hoạch có thể tạo báo cáo**, không tự chứng minh dashboard đã tồn tại trong tài khoản.

Ngoài event đã có, app thêm `ai_reflection_viewed` (chỉ khi tab hiển thị), `ai_plan_applied` (phân biệt kết quả Reflection với thẻ phiên tới), `music_track_selected`, `feedback_opened` và `feedback_dismissed`. Không ghi từng giây timer hay từng phím gõ. Tên bài nhạc/link YouTube không đi theo event chọn nhạc.

## Tạo Surveys và dashboard

Project do chủ dự án cung cấp: **620259**, PostHog US — [mở project](https://us.posthog.com/project/620259/web/health). Script đã dùng ID và host này làm mặc định. Đường dẫn project không thay thế quyền đăng nhập/kết nối tài khoản.

Ưu tiên kết nối PostHog trong chat để kiểm tra đúng project và tạo bằng công cụ tài khoản. Nếu dùng CLI/script của nhóm:

1. Xem trước cấu hình bằng `node scripts/setup-posthog-feedback.mjs`.
2. Cung cấp `POSTHOG_PERSONAL_API_KEY` **chỉ trong môi trường shell quản trị**. `POSTHOG_PROJECT_ID` và `POSTHOG_APP_HOST` là tùy chọn ghi đè project mặc định 620259/US. Không dùng tiền tố `VITE_` cho personal API key và không commit khóa.
3. Chạy `node scripts/setup-posthog-feedback.mjs --apply`. Script tìm theo tên để tái sử dụng Surveys/dashboard/insights, kiểm tra question UUID và xác minh query trước khi lưu insight mới. Nó không tạo dữ liệu khảo sát giả.
4. Lấy hai public Survey IDs được trả về, đặt thành **frontend build variables** `VITE_POSTHOG_REFLECTION_SURVEY_ID` và `VITE_POSTHOG_UX_SURVEY_ID`. Public project token frontend phải thuộc cùng project đã tạo Surveys.
5. Rebuild/deploy frontend. Dockerfile, Docker Compose và `.env.docker.example` đã có các biến mới. Không cần deploy backend hoặc migration cho chức năng góp ý này.

Script không tự đọc, ghi hoặc in personal key. Không chạy `--apply` khi chưa xác nhận đúng project. Survey câu hỏi dùng UUID cố định ở `frontend/src/lib/feedbackSchema.js`; không tự thay câu hỏi/ID của khảo sát cũ sau khi đã có câu trả lời.

## Chi phí và cách dùng số liệu

- Tải form bằng chunk riêng khi mở; không thêm thư viện khảo sát ngoài SDK PostHog đã có. Không tăng dữ liệu khảo sát trong Railway MySQL.
- Một lần gửi là một event phản hồi; không gửi câu trả lời từng phần hay từng ký tự. Giới hạn một lần gửi/phút trong cùng phiên trình duyệt là giảm thao tác lặp, không phải cơ chế chống spam server tuyệt đối.
- PostHog có cơ chế tính usage riêng. Giữ event có mục đích, xem Usage trong project và đặt giới hạn phù hợp; không bảo đảm toàn bộ Railway/PostHog luôn miễn phí.
- Form không tự mở nên không dùng số lượt xem trang làm mẫu số “tỷ lệ trả lời”. `feedback_opened` tính lượt mở hợp lệ theo từng loại; nếu tính tỷ lệ, chọn unique users và cùng cửa sổ thời gian, tách AI/UX.
- Người trả lời tự nguyện không đại diện toàn bộ khách hàng. Mức hữu ích và “quay lại học được” là tự đánh giá, không chứng minh quan hệ nhân quả.
- Nguồn `gemini`, `fallback`, `unavailable` được giữ riêng để không chấm nhầm phản hồi dự phòng thành chất lượng mô hình.
- `utm_source` và `utm_campaign` chỉ lưu nhãn ngắn, không phải toàn bộ URL. Ví dụ share `/?utm_source=facebook&utm_campaign=checkpoint2`. Chỉ dùng chúng để phân nhóm người đã góp ý; lượt tiếp cận/lượt nhấp cần dữ liệu kênh riêng.
- Trước khi chụp comment đưa lên slide công khai, nhóm cần xem lại nội dung để tránh đưa thông tin riêng tư do người dùng tự gõ lên bài trình bày.

## Kiểm tra

Trong `frontend`, chạy `npm run build`, `npm run lint`, `npm run test:e2e`. Test feedback dùng SDK thật và chặn toàn bộ request PostHog bằng dữ liệu giả; không upload test vào project. Ba viewport: desktop, điện thoại và màn hình 320 px.

Nguồn: [PostHog custom surveys](https://posthog.com/docs/surveys/implementing-custom-surveys), [Capture API](https://posthog.com/docs/api/capture), [giảm chi phí analytics](https://posthog.com/docs/product-analytics/cutting-costs).
