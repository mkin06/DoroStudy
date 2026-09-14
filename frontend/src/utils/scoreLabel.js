/**
 * Dịch điểm tập trung 0-100 sang thứ người vừa học xong đọc được ngay.
 *
 * Vì sao cần: con số 78 không nói gì với người đang mệt. Họ phải tự hỏi "78 là tốt hay tệ?",
 * "mình giảm 12 điểm là nhiều hay ít?" — đúng loại suy nghĩ mà một app dành cho người vừa
 * học xong không được bắt họ làm. Con số vẫn giữ (nó là thứ mọi phân tích khác dựa vào),
 * nhưng thứ ĐỌC TRƯỚC phải là một từ.
 *
 * Thang chia trùng với thang emoji user tự chấm trong popup (😫😕😐🙂🔥) để hai chỗ nói cùng
 * một ngôn ngữ: user chọn 🙂 thì điểm cũng nên ra "Tốt", không phải một con số lạ.
 */

const BANDS = [
  { min: 85, emoji: '🔥', label: 'Rất tập trung', className: 'excellent' },
  { min: 70, emoji: '🙂', label: 'Tốt', className: 'good' },
  { min: 55, emoji: '😐', label: 'Tạm được', className: 'ok' },
  { min: 40, emoji: '😕', label: 'Kém', className: 'low' },
  { min: 0, emoji: '😫', label: 'Rất kém', className: 'poor' },
];

/** @returns {{emoji: string, label: string, className: string}} */
export function scoreBand(score) {
  const value = Math.max(0, Math.min(100, Math.round(score ?? 0)));
  return BANDS.find((b) => value >= b.min) ?? BANDS[BANDS.length - 1];
}

/**
 * Chênh lệch so với phiên trước, nói bằng lời.
 *
 * Ngưỡng chọn theo mức người ta thật sự CẢM nhận được, không phải theo số tròn: dưới 3 điểm
 * là dao động của chính việc tự chấm chứ không phải thay đổi thật, nên gọi là "ngang nhau"
 * mới đúng — báo "giảm 2 điểm" chỉ làm user lo về một thứ không có thật.
 *
 * @param {number|null} delta chênh lệch điểm so với phiên trước
 * @returns {{text: string, direction: 'up'|'down'|'flat'}|null}
 */
export function deltaPhrase(delta) {
  if (delta == null) return null;

  const size = Math.abs(delta);
  if (size < 3) {
    return { text: 'ngang phiên trước', direction: 'flat' };
  }

  const up = delta > 0;
  let magnitude;
  if (size < 10) magnitude = 'một chút';
  else if (size < 20) magnitude = 'rõ rệt';
  else magnitude = 'hẳn';

  return {
    text: `${up ? 'tốt hơn' : 'kém hơn'} phiên trước ${magnitude}`,
    direction: up ? 'up' : 'down',
  };
}

/** Câu trả lời cho "điểm này tính kiểu gì vậy?" — hiện khi user chủ động hỏi. */
export const SCORE_EXPLAINER =
  'Điểm gộp ba câu bạn vừa trả lời: bạn hoàn thành bao nhiêu % mục tiêu, '
  + 'bạn tự chấm tập trung mấy sao, và năng lượng còn lại. '
  + 'Báo bị xao nhãng KHÔNG bị trừ điểm — nó chỉ giúp AI tìm nguyên nhân.';
