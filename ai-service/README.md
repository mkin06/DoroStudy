# DoroStudy AI Service

Microservice Python (FastAPI) phân tích phiên học Pomodoro bằng Gemini API.
Stateless — không kết nối DB, chỉ nhận JSON từ backend Spring Boot và trả JSON.

## Chạy local

```bash
cd ai-service
python -m venv .venv
.venv\Scripts\activate        # Windows
pip install -r requirements.txt

set GEMINI_API_KEY=your-key   # Windows (hoặc export trên Linux/Mac)
uvicorn main:app --port 8000 --reload
```

Không có `GEMINI_API_KEY` service vẫn chạy, dùng feedback rule-based (để dev/demo offline).

## API

### `GET /health`

```json
{ "status": "ok", "gemini": true, "model": "gemini-2.0-flash" }
```

### `POST /analyze-session`

Request (camelCase, khớp Jackson bên Java):

```json
{
  "currentSession": {
    "subject": "Math",
    "durationMinutes": 50,
    "pomodoroCount": 2,
    "startTime": "2026-07-02T20:00:00",
    "completionPercent": 75,
    "focusLevel": 4,
    "distractionReasons": ["phone"]
  },
  "history": [
    {
      "date": "2026-07-01",
      "subject": "Math",
      "durationMinutes": 90,
      "focusLevel": 5,
      "completionPercent": 80,
      "distractionReasons": []
    }
  ]
}
```

Response:

```json
{
  "summary": "...",
  "comparison": null,
  "recommendation": "...",
  "focusScore": 78.5,
  "source": "gemini"
}
```

- `comparison` là `null` khi user có dưới 3 phiên lịch sử (không đủ dữ liệu so sánh).
- `source` = `"fallback"` khi Gemini lỗi/không có key — backend không cần quan tâm, format giống hệt.

## Test nhanh bằng curl

```bash
curl -X POST http://localhost:8000/analyze-session \
  -H "Content-Type: application/json" \
  -d "{\"currentSession\":{\"durationMinutes\":50,\"completionPercent\":75,\"focusLevel\":4,\"distractionReasons\":[\"phone\"]},\"history\":[]}"
```

## Docker

```bash
docker build -t dorostudy-ai .
docker run -p 8000:8000 -e GEMINI_API_KEY=your-key dorostudy-ai
```
