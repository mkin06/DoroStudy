"""Pydantic models cho AI service.

Java (Jackson) gửi JSON theo camelCase, nên tất cả model kế thừa CamelModel
để chấp nhận camelCase khi nhận và trả về camelCase khi serialize.
"""

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel


class CamelModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
    )


class CurrentSession(CamelModel):
    subject: str | None = None
    duration_minutes: float = Field(gt=0)
    pomodoro_count: int = 1
    start_time: str | None = None  # ISO datetime, ví dụ "2026-07-02T20:00:00"
    completion_percent: int = Field(ge=0, le=100)
    focus_level: int = Field(ge=1, le=5)
    energy_level: int | None = Field(default=None, ge=1, le=5)
    distraction_reasons: list[str] = []


class HistoryItem(CamelModel):
    date: str | None = None
    subject: str | None = None
    duration_minutes: float | None = None
    focus_level: int | None = None
    completion_percent: int | None = None
    distraction_reasons: list[str] = []


class AnalyzeRequest(CamelModel):
    current_session: CurrentSession
    history: list[HistoryItem] = []
    # Quy luật backend đã xác minh bằng thống kê — model chỉ diễn giải, không tự suy ra
    known_patterns: list[str] = []
    # Kế hoạch phiên kế tiếp backend đã tính sẵn (môn, độ dài, khung giờ, dự đoán điểm).
    # Có nó thì "recommendation" phải diễn đạt đúng kế hoạch này: user sẽ thấy y hệt con số
    # đó trên thẻ Focus Coach trước phiên sau, hai chỗ nói lệch nhau là mất hết độ tin cậy.
    planned_next_session: str | None = None
    # Trích đoạn ghi chú user viết TRONG phiên, và kết luận backend đã rút ra từ chúng.
    # Đây là dữ liệu duy nhất không phải lời tự khai, nên feedback nhắc được đúng nội dung
    # user đang học thay vì chỉ bình luận mấy con số họ tự chấm.
    session_notes: str | None = None
    note_verdict: str | None = None


class AiFeedback(CamelModel):
    summary: str
    comparison: str | None = None
    recommendation: str
    focus_score: float = Field(ge=0, le=100)
    source: str = "gemini"  # "gemini" | "fallback"


class GeminiFeedback(BaseModel):
    """Schema cho structured output của Gemini (không dùng alias).

    Cố ý KHÔNG có focus_score: điểm phải tính bằng công thức cố định, vì mọi phân tích
    quy luật (giờ vàng, độ dài tối ưu, kỷ lục cá nhân) đều so sánh điểm giữa các phiên.
    Để model chấm thì cùng một phiên chạy hai lần ra hai điểm khác nhau, mọi so sánh
    thành vô nghĩa. Model chỉ viết chữ; điểm là việc của code.
    """

    summary: str
    comparison: str | None = None
    recommendation: str
