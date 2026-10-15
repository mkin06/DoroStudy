// Shared by the app and the PostHog setup script. Stable IDs keep historical answers valid.
export const FEEDBACK_VERSION = 'checkpoint2_v1';
export const COMMENT_LIMIT = 1500;
export const ACTIONABILITY = [
  ['clear', 'Tôi biết bước tiếp theo cần làm'],
  ['unclear', 'Tôi chưa rõ phải làm thế nào'],
  ['not_relevant', 'Lời khuyên chưa phù hợp với phiên này'],
  ['already_doing', 'Đó là việc tôi đã làm rồi'],
];
export const DISTRACTIONS = [
  ['social_media', 'Điện thoại / mạng xã hội'], ['noise', 'Tiếng ồn'], ['fatigue', 'Mệt mỏi'],
  ['mind_wandering', 'Suy nghĩ lan man'], ['difficult_content', 'Nội dung khó'],
  ['other', 'Việc khác'], ['none', 'Không bị xao nhãng'],
];
export const COPING_ACTIONS = {
  social_media: [['silence_phone', 'Tắt thông báo / bật không làm phiền'], ['move_phone', 'Để điện thoại ngoài tầm với'], ['close_apps', 'Đóng ứng dụng / tab gây xao nhãng']],
  noise: [['headphones', 'Dùng tai nghe / chế độ chống ồn'], ['background_audio', 'Bật hoặc điều chỉnh nhạc nền'], ['change_place', 'Chuyển sang chỗ yên tĩnh hơn']],
  fatigue: [['rest', 'Nghỉ một lúc'], ['move_body', 'Đứng dậy / vận động nhẹ'], ['shorten_session', 'Rút ngắn phiên học'], ['stop_session', 'Kết thúc buổi học']],
  mind_wandering: [['write_note', 'Ghi lại suy nghĩ để xử lý sau'], ['smaller_goal', 'Chọn một việc nhỏ để quay lại học'], ['rest', 'Nghỉ một lúc']],
  difficult_content: [['split_task', 'Chia bài thành phần nhỏ'], ['review_basics', 'Xem lại kiến thức nền / ví dụ'], ['ask_help', 'Tìm tài liệu / hỏi người khác'], ['change_task', 'Chuyển sang việc khác']],
  other: [['change_place', 'Thay đổi chỗ học'], ['stop_session', 'Kết thúc buổi học']],
};
export const COMMON_ACTIONS = [['pause', 'Tạm dừng để xử lý gián đoạn'], ['continue', 'Tiếp tục học, không xử lý riêng'], ['other', 'Cách khác (ghi thêm ở ô nhận xét)']];
export const OUTCOMES = [['returned', 'Tôi quay lại học được'], ['still_distracted', 'Tôi quay lại nhưng vẫn khó tập trung'], ['stopped', 'Tôi chưa quay lại / đã dừng buổi học'], ['not_tried', 'Tôi chưa thử cách xử lý nào']];
export const SUPPORTS = [
  ['timer_controls', 'Tạm dừng / tiếp tục dễ hơn'], ['music', 'Điều khiển nhạc nền thuận tiện hơn'],
  ['breaks', 'Gợi ý nghỉ / điều chỉnh độ dài phiên'], ['notes', 'Ghi nhanh điều đang làm tôi phân tâm'],
  ['smaller_goal', 'Chia mục tiêu thành bước nhỏ'], ['clearer_advice', 'Lời khuyên AI sát tình huống hơn'],
  ['no_support', 'Tôi tự xử lý được, không cần app hỗ trợ'], ['other', 'Hỗ trợ khác (ghi thêm ở ô nhận xét)'],
];
export const AREAS = [['timer', 'Đồng hồ / tạm dừng / nghỉ'], ['ai_reflection', 'AI Reflection sau phiên học'], ['next_plan', 'Kế hoạch phiên tiếp theo'], ['music', 'Nhạc nền'], ['notes', 'Ghi chú'], ['insights', 'Hồ sơ tập trung / thống kê'], ['settings', 'Cài đặt'], ['background', 'Hình nền / thời tiết'], ['onboarding', 'Hướng dẫn sử dụng'], ['other', 'Trải nghiệm chung / phần khác']];
export const ISSUE_TYPES = [['confusing', 'Khó hiểu / chưa biết phải làm gì'], ['hard_to_use', 'Khó tìm hoặc thao tác bất tiện'], ['bug', 'Có lỗi / không hoạt động'], ['suggestion', 'Đề xuất cải thiện'], ['positive', 'Điều tôi thấy hữu ích']];

const choice = (key, id, question, choices, optional = true) => ({ key, id, question, type: 'single_choice', choices: choices.map(([, label]) => label), optional });
const comment = (id, optional) => ({ key: 'comment', id, type: 'open', question: 'Bạn muốn nhóm cải thiện điều gì? Hãy mô tả cụ thể.', optional });
const copingChoices = Array.from(new Map([...Object.values(COPING_ACTIONS).flat(), ...COMMON_ACTIONS]).entries());
export const FEEDBACK_SURVEYS = {
  ai: {
    name: 'DoroStudy — AI Reflection — Checkpoint 2 v1',
    questions: [
      { key: 'usefulness', id: '51ce5223-155e-4dcb-a8c2-890596d1a001', type: 'rating', display: 'number', scale: 5, lowerBoundLabel: 'Không hữu ích', upperBoundLabel: 'Rất hữu ích', question: 'Phản hồi vừa rồi hữu ích với bạn ở mức nào?', optional: false },
      choice('actionability', '51ce5223-155e-4dcb-a8c2-890596d1a002', 'Sau khi đọc lời khuyên, bạn có biết cần làm gì ở phiên tiếp theo không?', ACTIONABILITY, false),
      comment('51ce5223-155e-4dcb-a8c2-890596d1a003', true),
      choice('distraction', '51ce5223-155e-4dcb-a8c2-890596d1a004', 'Trong phiên đó, điều gì khiến bạn xao nhãng nhất?', DISTRACTIONS),
      choice('coping_action', '51ce5223-155e-4dcb-a8c2-890596d1a005', 'Bạn đã xử lý thế nào? Chọn cách chính đã dùng.', copingChoices),
      choice('outcome', '51ce5223-155e-4dcb-a8c2-890596d1a006', 'Sau đó, bạn có quay lại học được không?', OUTCOMES),
      choice('requested_support', '51ce5223-155e-4dcb-a8c2-890596d1a007', 'Bạn muốn DoroStudy hỗ trợ gì trong tình huống này?', SUPPORTS),
    ],
  },
  ux: {
    name: 'DoroStudy — UX/UI comments — Checkpoint 2 v1',
    questions: [
      comment('51ce5223-155e-4dcb-a8c2-890596d1b001', false),
      choice('area', '51ce5223-155e-4dcb-a8c2-890596d1b002', 'Góp ý này thuộc phần nào?', AREAS, false),
      choice('issue_type', '51ce5223-155e-4dcb-a8c2-890596d1b003', 'Điều bạn muốn chia sẻ là gì?', ISSUE_TYPES, false),
    ],
  },
};

const LABELS = { actionability: ACTIONABILITY, distraction: DISTRACTIONS, coping_action: copingChoices, outcome: OUTCOMES, requested_support: SUPPORTS, area: AREAS, issue_type: ISSUE_TYPES };
export function responseLabel(key, value) {
  return LABELS[key]?.find(([code]) => code === value)?.[1] || String(value);
}
