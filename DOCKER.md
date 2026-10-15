# Chạy DoroStudy bằng Docker

Stack gồm frontend Nginx, backend Spring Boot, AI FastAPI, MySQL và Redis.

## Khởi động

```powershell
Copy-Item .env.docker.example .env
# Thay toàn bộ giá trị change_this_* bằng secret ngẫu nhiên trước khi chạy.
docker compose up -d --build
docker compose ps
```

Mở ứng dụng tại `http://localhost:5173`. Frontend chuyển tiếp `/api` sang backend trong
mạng Docker nên trình duyệt không cần biết địa chỉ container.

`ai-service/.env` được nạp lúc chạy container để lấy `GEMINI_API_KEY`; file này bị loại
khỏi build context và không nằm trong image. Nếu không có key, AI service vẫn chạy bằng
phản hồi fallback.

Chỉ frontend được publish ra máy host. Backend, AI, MySQL và Redis chỉ giao tiếp trong
mạng Docker. Redis và MySQL đều bắt buộc mật khẩu lấy từ file `.env`; file này đã được
`.gitignore` loại khỏi Git.

Mặc định frontend chỉ bind vào `127.0.0.1` để không bị mở HTTP trực tiếp ra Internet.
Khi release, hãy giữ cấu hình này và đặt HTTPS reverse proxy (Caddy/Nginx/Cloudflare)
trên cùng server chuyển tiếp về `127.0.0.1:5173`.

Khi đặt ứng dụng sau HTTPS reverse proxy, đặt `SESSION_COOKIE_SECURE=true`. Không bật
giá trị này khi chỉ chạy bằng `http://localhost`, vì trình duyệt sẽ không gửi cookie bảo mật
qua HTTP.

## Xem log và dừng

```powershell
docker compose logs -f backend ai-service
docker compose down
```

`docker compose down` giữ dữ liệu. Chỉ dùng lệnh dưới khi muốn xoá cả database và Redis:

```powershell
docker compose down -v
```

File `01_schema.sql` chỉ được MySQL chạy khi volume `mysql_data` được tạo lần đầu. Seed
demo không được mount vào container production. Sau đó dữ liệu được giữ trong named volume.
