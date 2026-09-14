"""DoroStudy AI Reflection service.

Service stateless: nhận dữ liệu phiên học + lịch sử từ Spring Boot,
gọi Gemini API để phân tích, trả về feedback JSON. Không kết nối DB.

Chạy local:  uvicorn main:app --port 8000
Cần biến môi trường GEMINI_API_KEY (nếu thiếu sẽ dùng fallback rule-based).
"""

import concurrent.futures
import logging
import os
import time

from dotenv import load_dotenv
from fastapi import FastAPI

# Nạp ai-service/.env trước khi đọc bất kỳ biến môi trường nào.
# uvicorn không tự đọc .env, nên thiếu dòng này thì GEMINI_API_KEY trong file
# sẽ bị bỏ qua và mọi response đều rơi về fallback rule-based.
load_dotenv()

from prompts import MIN_HISTORY_FOR_COMPARISON, build_prompt, label_distractions
from schemas import AiFeedback, AnalyzeRequest, GeminiFeedback

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ai-service")

# Mặc định là flash-lite: đo thực tế ~1.4s/lượt, 288 token input + 125 token output,
# không sinh thinking token — rẻ nhất trong họ Flash mà vẫn đủ chất lượng cho 3 câu feedback.
# Các model gemini-3.x-flash bản đầy đủ là reasoning model: chậm hơn mốc 4s và thinking token
# ăn hết max_output_tokens khiến JSON bị cắt, không parse được.
GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-3.5-flash-lite")

# Ngân sách chờ Gemini phía service này. Backend cắt request ở 5s, nên ta phải trả lời
# xong trước mốc đó để user nhận được fallback tử tế thay vì một timeout trắng.
#
# Lưu ý: deadline này KHÔNG gửi cho API — Gemini từ chối deadline dưới 10s
# ("Minimum allowed deadline is 10s"), nên ta chờ ở phía client bằng một thread rồi bỏ
# cuộc khi hết hạn. Request nền có thể vẫn chạy tiếp; ta chấp nhận đánh đổi đó để giữ
# đúng thời gian phản hồi đã hứa với user.
GEMINI_TIMEOUT_MS = int(os.environ.get("GEMINI_TIMEOUT_MS", "4000"))

# Deadline gửi kèm request — phải >= 10s theo yêu cầu của API.
GEMINI_API_DEADLINE_MS = int(os.environ.get("GEMINI_API_DEADLINE_MS", "10000"))

# Chặn trên số token output — feedback chỉ vài câu, cap lại để một lượt bất thường
# không đẩy chi phí lên gấp nhiều lần.
GEMINI_MAX_OUTPUT_TOKENS = int(os.environ.get("GEMINI_MAX_OUTPUT_TOKENS", "600"))

app = FastAPI(title="DoroStudy AI Service", version="0.2.0")

_gemini_client = None
if os.environ.get("GEMINI_API_KEY"):
    from google import genai

    _gemini_client = genai.Client()
    logger.info(
        "Gemini client initialized (model=%s, client-side timeout=%dms, api deadline=%dms)",
        GEMINI_MODEL,
        GEMINI_TIMEOUT_MS,
        GEMINI_API_DEADLINE_MS,
    )
else:
    logger.warning("GEMINI_API_KEY not set — all responses will use rule-based fallback")

# Một thread để chờ Gemini có thể bị bỏ rơi khi hết hạn, nên pool phải đủ rộng
# cho các request tiếp theo.
_executor = concurrent.futures.ThreadPoolExecutor(max_workers=8, thread_name_prefix="gemini")


def _clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def focus_score(completion_percent: int, focus_level: int, energy_level: int | None) -> float:
    """Điểm tập trung 0-100, tính bằng công thức cố định (khớp FocusScoreCalculator bên Java).

    Cố ý KHÔNG trừ điểm khi user báo bị xao nhãng: làm vậy là dạy user khai "không xao nhãng"
    để được điểm cao, mà dữ liệu xao nhãng trung thực mới là thứ tìm ra quy luật.
    Xao nhãng là biến giải thích, không phải hình phạt.
    """
    if energy_level is None:
        score = completion_percent * 0.5 + focus_level * 20 * 0.5
    else:
        score = (completion_percent * 0.45
                 + focus_level * 20 * 0.40
                 + energy_level * 20 * 0.15)
    return round(_clamp(score, 0, 100), 1)


def _fallback_feedback(req: AnalyzeRequest) -> AiFeedback:
    """Feedback rule-based khi Gemini không khả dụng — app vẫn chạy được khi demo."""
    s = req.current_session
    score = focus_score(s.completion_percent, s.focus_level, s.energy_level)

    summary = (
        f"Bạn đã học {s.duration_minutes:.0f} phút, hoàn thành "
        f"{s.completion_percent}% mục tiêu với mức tập trung {s.focus_level}/5."
    )

    meaningful = [r for r in s.distraction_reasons if r != "none"]
    if meaningful:
        recommendation = (
            f"Bạn báo bị xao nhãng bởi {label_distractions(meaningful)}. "
            "Phiên tới hãy loại bỏ tác nhân đó trước khi bắt đầu."
        )
    elif s.focus_level <= 2:
        recommendation = (
            "Mức tập trung phiên này thấp. Phiên tới thử rút ngắn thời lượng "
            "và đặt một mục tiêu nhỏ, rõ ràng hơn."
        )
    else:
        recommendation = "Phiên tốt. Giữ nguyên thiết lập này cho phiên tiếp theo."

    return AiFeedback(
        summary=summary,
        comparison=None,
        recommendation=recommendation,
        focus_score=score,
        source="fallback",
    )


def _gemini_feedback(req: AnalyzeRequest) -> AiFeedback:
    prompt = build_prompt(req)
    response = _gemini_client.models.generate_content(
        model=GEMINI_MODEL,
        contents=prompt,
        config={
            "response_mime_type": "application/json",
            "response_schema": GeminiFeedback,
            "temperature": 0.7,
            "max_output_tokens": GEMINI_MAX_OUTPUT_TOKENS,
            "http_options": {"timeout": GEMINI_API_DEADLINE_MS},
        },
    )
    parsed: GeminiFeedback = response.parsed
    if parsed is None:
        # Gemini trả JSON không parse được (thường do bị cắt vì max_output_tokens)
        raise ValueError("Gemini response could not be parsed into GeminiFeedback")

    # Chốt chặn cuối: chỉ cho so sánh khi thật sự có cơ sở — hoặc đủ lịch sử thô,
    # hoặc có quy luật backend đã xác minh. Thiếu cả hai thì mọi "so sánh" đều là bịa.
    comparison = parsed.comparison
    if not req.known_patterns and len(req.history) < MIN_HISTORY_FOR_COMPARISON:
        comparison = None

    s = req.current_session
    return AiFeedback(
        summary=parsed.summary,
        comparison=comparison,
        recommendation=parsed.recommendation,
        focus_score=focus_score(s.completion_percent, s.focus_level, s.energy_level),
        source="gemini",
    )


@app.get("/health")
def health():
    return {
        "status": "ok",
        "gemini": _gemini_client is not None,
        "model": GEMINI_MODEL,
        "timeoutMs": GEMINI_TIMEOUT_MS,
        "apiDeadlineMs": GEMINI_API_DEADLINE_MS,
    }


@app.post("/analyze-session", response_model=AiFeedback, response_model_by_alias=True)
def analyze_session(req: AnalyzeRequest) -> AiFeedback:
    if _gemini_client is None:
        return _fallback_feedback(req)

    started = time.perf_counter()
    future = _executor.submit(_gemini_feedback, req)
    try:
        feedback = future.result(timeout=GEMINI_TIMEOUT_MS / 1000)
        logger.info("Gemini OK in %dms", int((time.perf_counter() - started) * 1000))
        return feedback
    except concurrent.futures.TimeoutError:
        # Bỏ cuộc chờ nhưng không cancel được request đang bay; user được trả lời ngay
        logger.warning(
            "Gemini vượt %dms, trả fallback rule-based", GEMINI_TIMEOUT_MS
        )
        return _fallback_feedback(req)
    except Exception as exc:
        logger.warning(
            "Gemini failed after %dms (%s), falling back to rule-based feedback",
            int((time.perf_counter() - started) * 1000),
            exc,
        )
        return _fallback_feedback(req)
