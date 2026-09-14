"""Xây dựng prompt gửi Gemini từ dữ liệu phiên học + quy luật đã xác minh.

Phân công cố ý giữa code và model:

  - THỐNG KÊ là việc của backend (FocusInsightEngine). Chính xác tuyệt đối, chạy trong
    bộ nhớ, không tốn một đồng nào, và không bao giờ bịa số.
  - DIỄN ĐẠT là việc của Gemini. Biến quy luật khô khan thành một câu người ta muốn đọc,
    và kê ra hành động cụ thể cho phiên sau.

Trước đây model vừa phải tự tìm quy luật từ vài dòng lịch sử vừa phải viết hay — nó làm
cả hai đều tệ và hay bịa số liệu. Giờ nó chỉ làm việc nó giỏi.

Mỗi lượt gọi tốn tiền thật, nên prompt cố ý ngắn: không lặp hướng dẫn, không gửi lịch sử
khi chưa đủ để so sánh, không gửi field rỗng.
"""

from schemas import AnalyzeRequest, CurrentSession, HistoryItem

# Dưới ngưỡng này thì không yêu cầu AI so sánh (tránh AI bịa số liệu)
MIN_HISTORY_FOR_COMPARISON = 3

# Nhãn tiếng Việt cho các tác nhân xao nhãng frontend gửi lên
DISTRACTION_LABELS = {
    "social_media": "mạng xã hội",
    "noise": "tiếng ồn",
    "fatigue": "mệt mỏi",
    "mind_wandering": "suy nghĩ lan man",
    "none": "không xao nhãng",
}


def label_distractions(reasons: list[str]) -> str:
    return ", ".join(DISTRACTION_LABELS.get(r, r) for r in reasons)


def _time_of_day(start_time: str | None) -> str | None:
    """Chỉ lấy giờ:phút — ngày tháng không giúp gì cho việc khuyên bảo, chỉ tốn token."""
    if not start_time:
        return None
    if "T" in start_time:
        clock = start_time.split("T", 1)[1]
        return clock[:5]
    return start_time[:5]


def _format_session(s: CurrentSession) -> str:
    lines = [
        f"- Thời lượng: {s.duration_minutes:.0f} phút ({s.pomodoro_count} pomodoro)",
        f"- Hoàn thành mục tiêu: {s.completion_percent}%",
        f"- Tự chấm mức tập trung: {s.focus_level}/5",
    ]
    if s.energy_level is not None:
        lines.append(f"- Năng lượng còn lại sau phiên: {s.energy_level}/5")
    if s.subject:
        lines.append(f"- Môn học: {s.subject}")
    clock = _time_of_day(s.start_time)
    if clock:
        lines.append(f"- Bắt đầu lúc: {clock}")
    if s.distraction_reasons:
        lines.append(f"- Xao nhãng chính: {label_distractions(s.distraction_reasons)}")
    else:
        lines.append("- Xao nhãng chính: không")
    return "\n".join(lines)


def _format_history(history: list[HistoryItem]) -> str:
    lines = []
    for h in history:
        parts = [h.date or "?"]
        if h.subject:
            parts.append(h.subject)
        if h.duration_minutes is not None:
            parts.append(f"{h.duration_minutes:.0f}p")
        if h.focus_level is not None:
            parts.append(f"tập trung {h.focus_level}/5")
        if h.completion_percent is not None:
            parts.append(f"hoàn thành {h.completion_percent}%")
        if h.distraction_reasons:
            parts.append(f"xao nhãng: {label_distractions(h.distraction_reasons)}")
        lines.append("- " + ", ".join(parts))
    return "\n".join(lines)


def build_prompt(req: AnalyzeRequest) -> str:
    has_history = len(req.history) >= MIN_HISTORY_FOR_COMPARISON
    has_patterns = bool(req.known_patterns)

    # Chỉ thị dấu tiếng Việt đặt ở ĐẦU và nhắc lại ở CUỐI: flash-lite có xu hướng trả lời
    # không dấu khi prompt dài, và một câu nhắc duy nhất ở cuối không đủ để chặn.
    prompt = f"""Bạn là study coach trong DoroStudy (app Pomodoro). Một học viên vừa kết thúc phiên học và điền reflection.

QUAN TRỌNG NHẤT: mọi chữ bạn viết ra phải là tiếng Việt CÓ DẤU.
Viết "bạn đã hoàn thành 80% mục tiêu" — TUYỆT ĐỐI KHÔNG viết "ban da hoan thanh 80% muc tieu".

PHIÊN VỪA XONG:
{_format_session(req.current_session)}
"""

    if has_patterns:
        # Quy luật đã được hệ thống tính từ toàn bộ lịch sử — model chỉ được dùng, không được sửa
        patterns = "\n".join(f"- {p}" for p in req.known_patterns)
        prompt += f"""
QUY LUẬT HỆ THỐNG ĐÃ XÁC MINH TỪ LỊCH SỬ CỦA HỌC VIÊN (số liệu đã đúng, không được sửa hay bịa thêm):
{patterns}
"""
    elif has_history:
        prompt += f"""
LỊCH SỬ GẦN ĐÂY (mới nhất trước):
{_format_history(req.history)}
"""

    if req.session_notes:
        # Kết luận về ghi chú do backend (NoteAnalyzer) quyết định, không phải model.
        # "Bạn khai một đằng làm một nẻo" là câu quá nặng để một model tự phán từ vài dòng text.
        prompt += f"""
GHI CHÚ USER VIẾT TRONG PHIÊN NÀY:
{req.session_notes}
"""
        if req.note_verdict:
            prompt += f"""
HỆ THỐNG ĐÃ ĐỐI CHIẾU GHI CHÚ (kết luận đã đúng, không được sửa): {req.note_verdict}
"""

    prompt += """
Trả về JSON. VIẾT CỰC NGẮN — user đọc lướt trên màn hình nghỉ, câu dài là câu bị bỏ qua:
- "summary": TỐI ĐA 12 TỪ. Một điều đáng chú ý nhất, không đọc lại số liệu.
"""

    if has_patterns:
        prompt += """- "comparison": TỐI ĐA 14 TỪ, diễn giải quy luật quan trọng nhất ở trên. Chỉ dùng số liệu đã cho.
"""
    elif has_history:
        prompt += """- "comparison": TỐI ĐA 14 TỪ so với lịch sử trên. Chỉ nêu quy luật thấy được trong dữ liệu. Không bịa số.
"""
    else:
        prompt += """- "comparison": null. Học viên chưa đủ lịch sử, không được so sánh hay bịa dữ liệu cũ.
"""

    if req.planned_next_session:
        # Hệ thống đã chốt kế hoạch bằng thống kê; việc của model là diễn đạt cho hấp dẫn,
        # KHÔNG phải nghĩ ra một bộ số khác. Vì vậy câu lệnh này cố ý rất cứng.
        prompt += f"""- "recommendation": TỐI ĐA 16 TỪ, một câu ra lệnh làm được ngay. Giữ nguyên mọi con số dưới đây, không đề xuất độ dài hay khung giờ khác:
  {req.planned_next_session}
"""
    else:
        prompt += """- "recommendation": TỐI ĐA 16 TỪ. MỘT hành động cho phiên sau, nêu rõ số phút/khung giờ/thao tác. Không khuyên chung chung kiểu "hãy tập trung hơn".
"""

    prompt += """
Quy tắc: xưng "bạn", MỖI FIELD ĐÚNG MỘT CÂU, không markdown, không emoji (giao diện tự gắn icon), thẳng thắn chứ không sáo rỗng.
Thà thiếu chữ còn hơn thừa chữ: cắt hết trạng từ, lời khen xã giao và mọi mệnh đề giải thích.
Nhắc lại: viết tiếng Việt CÓ DẤU đầy đủ. Câu trả lời không dấu bị coi là sai.
"""
    return prompt
